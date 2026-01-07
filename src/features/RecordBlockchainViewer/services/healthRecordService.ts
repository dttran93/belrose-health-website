// src/features/HealthRecordViewer/services/healthRecordService.ts

/**
 * Service for interacting with the HealthRecordCore smart contract
 *
 * This is a read-only service using a public RPC provider.
 * No wallet connection required.
 */

import { ethers } from 'ethers';
import {
  HealthRecordStats,
  AnchoredRecord,
  Verification,
  Dispute,
  UnacceptedUpdateFlag,
  VerificationLevel,
  DisputeSeverity,
  DisputeCulpability,
  ResolutionType,
  SubjectLink,
  RecordVersion,
  HealthRecordCoreContract,
} from '../lib/types';
import {
  HEALTH_RECORD_CORE_ADDRESS,
  HEALTH_RECORD_CORE_ABI,
  SEPOLIA_RPC_URL,
  DEPLOYMENT_BLOCK,
} from '../lib/constants';
import {
  getProfilesByUserIdHashes,
  transformToUserProfile,
} from '@/features/MemberBlockchainViewer/services/userProfileService';

// ===============================================================
// SINGLETON INSTANCES
// ===============================================================

let provider: ethers.JsonRpcProvider | null = null;
let contract: (HealthRecordCoreContract & ethers.Contract) | null = null;

/**
 * Get or create the provider instance
 */
function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  }
  return provider;
}

/**
 * Get or create the contract instance
 */
function getContract(): HealthRecordCoreContract & ethers.Contract {
  if (!contract) {
    contract = new ethers.Contract(
      HEALTH_RECORD_CORE_ADDRESS,
      HEALTH_RECORD_CORE_ABI,
      getProvider()
    ) as HealthRecordCoreContract & ethers.Contract;
  }
  return contract;
}

// ===============================================================
// HELPER: Query events in chunks (to avoid RPC limits)
// ===============================================================

async function queryFilterInChunks(
  contract: ethers.Contract,
  filter: ethers.DeferredTopicFilter,
  fromBlock: number,
  toBlock: number | string,
  chunkSize: number = 10000
): Promise<(ethers.EventLog | ethers.Log)[]> {
  const currentBlock =
    typeof toBlock === 'number'
      ? toBlock
      : (await contract.runner?.provider?.getBlockNumber()) || fromBlock + chunkSize;

  let allEvents: (ethers.EventLog | ethers.Log)[] = [];
  let start = fromBlock;

  while (start <= currentBlock) {
    const end = Math.min(start + chunkSize - 1, currentBlock);
    console.log(`🔍 Querying blocks ${start} to ${end}...`);

    const events = await contract.queryFilter(filter, start, end);
    allEvents = allEvents.concat(events);

    start += chunkSize;
  }

  return allEvents;
}

// ===============================================================
// STATS
// ===============================================================

/**
 * Get aggregate stats from the contract
 */
export async function getHealthRecordStats(): Promise<HealthRecordStats> {
  const contract = getContract();

  try {
    const [totalAnchoredRecords, totalVerifications, totalDisputes, totalUnacceptedFlags] =
      await Promise.all([
        contract.getTotalAnchoredRecords(),
        contract.totalVerifications(),
        contract.totalDisputes(),
        contract.totalUnacceptedFlags(),
      ]);

    return {
      totalAnchoredRecords: Number(totalAnchoredRecords),
      totalVerifications: Number(totalVerifications),
      totalDisputes: Number(totalDisputes),
      totalUnacceptedFlags: Number(totalUnacceptedFlags),
    };
  } catch (error) {
    console.error('❌ Failed to fetch health record stats:', error);
    throw error;
  }
}

// ===============================================================
// ANCHORED RECORDS
// ===============================================================

/**
 * Get all anchored records by querying RecordAnchored events
 *
 * Note: recordId and recordHash are indexed strings, so we only get their hashes
 * from events. We use the subjectIdHash and work backwards to find records.
 */
export async function getAnchoredRecords(): Promise<AnchoredRecord[]> {
  const contract = getContract();

  try {
    // 1. Query RecordAnchored events to get unique subjectIdHashes
    // Since recordId is an indexed string, we only get its hash - not useful directly
    // But subjectIdHash is bytes32, so we get the actual value
    const anchoredEvents = await queryFilterInChunks(
      contract,
      contract.filters.RecordAnchored(),
      DEPLOYMENT_BLOCK,
      'latest'
    );

    // Collect unique subject hashes from events
    const subjectHashSet = new Set<string>();
    for (const event of anchoredEvents) {
      if (event instanceof ethers.EventLog && event.args) {
        // subjectIdHash is the 3rd indexed param (bytes32, so we get actual value)
        const subjectIdHash = event.args.subjectIdHash;
        if (subjectIdHash && subjectIdHash !== ethers.ZeroHash) {
          subjectHashSet.add(subjectIdHash);
        }
      }
    }

    console.log(`📋 Found ${subjectHashSet.size} unique subjects from events`);

    // 2. For each subject, get their medical history (list of recordIds)
    const recordIdSet = new Set<string>();
    for (const subjectIdHash of subjectHashSet) {
      try {
        const recordIds: string[] = await contract.getSubjectMedicalHistory(subjectIdHash);
        recordIds.forEach(id => recordIdSet.add(id));
      } catch (err) {
        console.warn(`Failed to get history for subject ${subjectIdHash}:`, err);
      }
    }

    const uniqueRecordIds = Array.from(recordIdSet);
    console.log(`📋 Found ${uniqueRecordIds.length} unique anchored records`);

    // 3. Collect all subject hashes for profile enrichment
    const allSubjectHashes = new Set<string>();

    // 4. Fetch details for each record
    const records: AnchoredRecord[] = await Promise.all(
      uniqueRecordIds.map(async recordId => {
        // Get subjects
        const subjectHashes: string[] = await contract.getRecordSubjects(recordId);

        // Get version history
        const versionHashes: string[] = await contract.getRecordVersionHistory(recordId);

        // Check active status for each subject
        const subjects: SubjectLink[] = await Promise.all(
          subjectHashes.map(async subjectIdHash => {
            const isActive = await contract.isActiveSubject(recordId, subjectIdHash);
            allSubjectHashes.add(subjectIdHash);
            return {
              subjectIdHash,
              isActive,
            };
          })
        );

        // Check active status for each hash
        const versionHistory: RecordVersion[] = await Promise.all(
          versionHashes.map(async hash => {
            const isActive = await contract.doesHashExist(hash);
            return {
              hash,
              isActive,
            };
          })
        );

        // Count actives
        const activeSubjectCount = subjects.filter(s => s.isActive).length;
        const activeVersionCount = versionHistory.filter(v => v.isActive).length;

        return {
          recordId,
          subjects,
          versionHistory,
          activeSubjectCount,
          totalSubjectCount: subjects.length,
          activeVersionCount,
        };
      })
    );

    // 5. Enrich with Firebase profiles
    const profileMap = await getProfilesByUserIdHashes(Array.from(allSubjectHashes));

    // Apply profiles to subjects
    for (const record of records) {
      for (const subject of record.subjects) {
        const fbProfile = profileMap.get(subject.subjectIdHash);
        if (fbProfile) {
          subject.profile = transformToUserProfile(fbProfile);
        }
      }
    }

    return records;
  } catch (error) {
    console.error('❌ Failed to fetch anchored records:', error);
    throw error;
  }
}

/**
 * Get a single anchored record by ID
 */
export async function getAnchoredRecord(recordId: string): Promise<AnchoredRecord | null> {
  const contract = getContract();

  try {
    const subjectHashes: string[] = await contract.getRecordSubjects(recordId);

    // If no subjects, record doesn't exist
    if (subjectHashes.length === 0) {
      return null;
    }

    const versionHashes: string[] = await contract.getRecordVersionHistory(recordId);

    const subjects: SubjectLink[] = await Promise.all(
      subjectHashes.map(async subjectIdHash => {
        const isActive = await contract.isActiveSubject(recordId, subjectIdHash);
        return { subjectIdHash, isActive };
      })
    );

    const versionHistory: RecordVersion[] = await Promise.all(
      versionHashes.map(async hash => {
        const isActive = await contract.doesHashExist(hash);
        return { hash, isActive };
      })
    );

    // Enrich with profiles
    const profileMap = await getProfilesByUserIdHashes(subjectHashes);
    for (const subject of subjects) {
      const fbProfile = profileMap.get(subject.subjectIdHash);
      if (fbProfile) {
        subject.profile = transformToUserProfile(fbProfile);
      }
    }

    return {
      recordId,
      subjects,
      versionHistory,
      activeSubjectCount: subjects.filter(s => s.isActive).length,
      totalSubjectCount: subjects.length,
      activeVersionCount: versionHistory.filter(v => v.isActive).length,
    };
  } catch (error) {
    console.error(`❌ Failed to fetch record ${recordId}:`, error);
    return null;
  }
}

// ===============================================================
// VERIFICATIONS
// ===============================================================

/**
 * Get all verifications by querying RecordVerified events
 *
 * Note: recordHash and recordId are indexed strings, so we only get their hashes.
 * We use verifierIdHash (bytes32) to find users, then look up their verifications.
 */
export async function getAllVerifications(): Promise<Verification[]> {
  const contract = getContract();

  try {
    // 1. Get all users who have verified something by querying events
    const verifiedEvents = await queryFilterInChunks(
      contract,
      contract.filters.RecordVerified(),
      DEPLOYMENT_BLOCK,
      'latest'
    );

    console.log(`📋 Found ${verifiedEvents.length} RecordVerified events`);

    // Collect unique verifier hashes (bytes32, so we get actual values)
    const verifierHashes = new Set<string>();
    for (const event of verifiedEvents) {
      if (event instanceof ethers.EventLog && event.args) {
        const verifierIdHash = event.args.verifierIdHash;
        if (verifierIdHash && verifierIdHash !== ethers.ZeroHash) {
          verifierHashes.add(verifierIdHash);
        }
      }
    }

    console.log(`📋 Found ${verifierHashes.size} unique verifiers`);

    // 2. For each verifier, get the hashes they've verified
    const verifications: Verification[] = [];

    for (const verifierIdHash of verifierHashes) {
      try {
        // Get all record hashes this user has verified
        const recordHashes: string[] = await contract.getUserVerifications(verifierIdHash);

        for (const recordHash of recordHashes) {
          // Get the verification details
          const [exists, recordId, level, createdAt, isActive] = await contract.getUserVerification(
            recordHash,
            verifierIdHash
          );

          if (exists) {
            verifications.push({
              verifierIdHash,
              recordId,
              recordHash,
              level: parseVerificationLevel(Number(level)),
              createdAt: Number(createdAt),
              isActive,
            });
          }
        }
      } catch (err) {
        console.warn(`Failed to get verifications for user ${verifierIdHash}:`, err);
      }
    }

    // 3. Enrich with Firebase profiles
    const profileMap = await getProfilesByUserIdHashes(Array.from(verifierHashes));

    for (const verification of verifications) {
      const fbProfile = profileMap.get(verification.verifierIdHash);
      if (fbProfile) {
        verification.verifierProfile = transformToUserProfile(fbProfile);
      }
    }

    return verifications;
  } catch (error) {
    console.error('❌ Failed to fetch verifications:', error);
    throw error;
  }
}

/**
 * Get verifications for a specific record hash
 */
export async function getVerificationsForHash(recordHash: string): Promise<Verification[]> {
  const contract = getContract();

  try {
    // Contract returns array of Verification structs
    const rawVerifications = await contract.getVerifications(recordHash);

    const verifications: Verification[] = rawVerifications
      .filter((v: any) => v.verifierIdHash !== ethers.ZeroHash)
      .map((v: any) => ({
        verifierIdHash: v.verifierIdHash,
        recordId: v.recordId,
        recordHash,
        level: parseVerificationLevel(Number(v.level)),
        createdAt: Number(v.createdAt),
        isActive: v.isActive,
      }));

    // Enrich with profiles
    const verifierHashes = verifications.map(v => v.verifierIdHash);
    const profileMap = await getProfilesByUserIdHashes(verifierHashes);

    for (const verification of verifications) {
      const fbProfile = profileMap.get(verification.verifierIdHash);
      if (fbProfile) {
        verification.verifierProfile = transformToUserProfile(fbProfile);
      }
    }

    return verifications;
  } catch (error) {
    console.error(`❌ Failed to fetch verifications for hash ${recordHash}:`, error);
    return [];
  }
}

// ===============================================================
// DISPUTES
// ===============================================================

/**
 * Get all disputes by querying RecordDisputed events
 *
 * Note: recordHash and recordId are indexed strings, so we only get their hashes.
 * We use disputerIdHash (bytes32) to find users, then look up their disputes.
 */
export async function getAllDisputes(): Promise<Dispute[]> {
  const contract = getContract();

  try {
    // 1. Get all users who have disputed something by querying events
    const disputedEvents = await queryFilterInChunks(
      contract,
      contract.filters.RecordDisputed(),
      DEPLOYMENT_BLOCK,
      'latest'
    );

    console.log(`📋 Found ${disputedEvents.length} RecordDisputed events`);

    // Collect unique disputer hashes (bytes32, so we get actual values)
    const disputerHashes = new Set<string>();
    for (const event of disputedEvents) {
      if (event instanceof ethers.EventLog && event.args) {
        const disputerIdHash = event.args.disputerIdHash;
        if (disputerIdHash && disputerIdHash !== ethers.ZeroHash) {
          disputerHashes.add(disputerIdHash);
        }
      }
    }

    console.log(`📋 Found ${disputerHashes.size} unique disputers`);

    // 2. For each disputer, get the hashes they've disputed
    const disputes: Dispute[] = [];

    for (const disputerIdHash of disputerHashes) {
      try {
        // Get all record hashes this user has disputed
        const recordHashes: string[] = await contract.getUserDisputes(disputerIdHash);

        for (const recordHash of recordHashes) {
          // Get the dispute details
          const [exists, recordId, severity, culpability, notes, createdAt, isActive] =
            await contract.getUserDispute(recordHash, disputerIdHash);

          if (exists) {
            // Get reaction stats
            const [, activeSupports, activeOpposes] = await contract.getReactionStats(
              recordHash,
              disputerIdHash
            );

            disputes.push({
              disputerIdHash,
              recordId,
              recordHash,
              severity: parseDisputeSeverity(Number(severity)),
              culpability: parseDisputeCulpability(Number(culpability)),
              notes,
              createdAt: Number(createdAt),
              isActive,
              reactionStats: {
                supports: Number(activeSupports),
                opposes: Number(activeOpposes),
              },
            });
          }
        }
      } catch (err) {
        console.warn(`Failed to get disputes for user ${disputerIdHash}:`, err);
      }
    }

    // 3. Enrich with Firebase profiles
    const profileMap = await getProfilesByUserIdHashes(Array.from(disputerHashes));

    for (const dispute of disputes) {
      const fbProfile = profileMap.get(dispute.disputerIdHash);
      if (fbProfile) {
        dispute.disputerProfile = transformToUserProfile(fbProfile);
      }
    }

    return disputes;
  } catch (error) {
    console.error('❌ Failed to fetch disputes:', error);
    throw error;
  }
}

/**
 * Get disputes for a specific record hash
 */
export async function getDisputesForHash(recordHash: string): Promise<Dispute[]> {
  const contract = getContract();

  try {
    const rawDisputes = await contract.getDisputes(recordHash);

    const disputes: Dispute[] = rawDisputes
      .filter((d: any) => d.disputerIdHash !== ethers.ZeroHash)
      .map((d: any) => ({
        disputerIdHash: d.disputerIdHash,
        recordId: d.recordId,
        recordHash,
        severity: parseDisputeSeverity(Number(d.severity)),
        culpability: parseDisputeCulpability(Number(d.culpability)),
        notes: d.notes,
        createdAt: Number(d.createdAt),
        isActive: d.isActive,
      }));

    // Get reaction stats and profiles
    const disputerHashes = disputes.map(d => d.disputerIdHash);
    const profileMap = await getProfilesByUserIdHashes(disputerHashes);

    for (const dispute of disputes) {
      // Reaction stats
      const [, activeSupports, activeOpposes] = await contract.getReactionStats(
        recordHash,
        dispute.disputerIdHash
      );
      dispute.reactionStats = {
        supports: Number(activeSupports),
        opposes: Number(activeOpposes),
      };

      // Profile
      const fbProfile = profileMap.get(dispute.disputerIdHash);
      if (fbProfile) {
        dispute.disputerProfile = transformToUserProfile(fbProfile);
      }
    }

    return disputes;
  } catch (error) {
    console.error(`❌ Failed to fetch disputes for hash ${recordHash}:`, error);
    return [];
  }
}

/**
 * Get reaction stats for a dispute
 */
export async function getDisputeReactionStats(
  recordHash: string,
  disputerIdHash: string
): Promise<{ supports: number; opposes: number }> {
  const contract = getContract();

  try {
    const [, activeSupports, activeOpposes] = await contract.getReactionStats(
      recordHash,
      disputerIdHash
    );

    return {
      supports: Number(activeSupports),
      opposes: Number(activeOpposes),
    };
  } catch (error) {
    console.error('❌ Failed to fetch reaction stats:', error);
    return { supports: 0, opposes: 0 };
  }
}

// ===============================================================
// UNACCEPTED FLAGS
// ===============================================================

/**
 * Get all unaccepted update flags by querying UnacceptedUpdateFlagged events
 */
export async function getAllUnacceptedFlags(): Promise<UnacceptedUpdateFlag[]> {
  const contract = getContract();

  try {
    const flaggedEvents = await queryFilterInChunks(
      contract,
      contract.filters.UnacceptedUpdateFlagged(),
      DEPLOYMENT_BLOCK,
      'latest'
    );

    console.log(`📋 Found ${flaggedEvents.length} UnacceptedUpdateFlagged events`);

    // Group by subject to avoid duplicate fetches
    const subjectFlagIndexMap = new Map<string, number[]>();

    for (const event of flaggedEvents) {
      if (event instanceof ethers.EventLog && event.args) {
        const subjectIdHash = event.args.subjectIdHash;
        const flagIndex = Number(event.args.flagIndex);

        if (!subjectFlagIndexMap.has(subjectIdHash)) {
          subjectFlagIndexMap.set(subjectIdHash, []);
        }
        subjectFlagIndexMap.get(subjectIdHash)!.push(flagIndex);
      }
    }

    // Fetch flag details for each subject
    const flags: UnacceptedUpdateFlag[] = [];

    for (const [subjectIdHash, flagIndices] of subjectFlagIndexMap) {
      for (const flagIndex of flagIndices) {
        try {
          const [recordId, noteHash, createdAt, resolution, resolvedAt, isActive] =
            await contract.getUnacceptedUpdateFlag(subjectIdHash, flagIndex);

          flags.push({
            subjectIdHash,
            recordId,
            noteHash,
            createdAt: Number(createdAt),
            resolution: parseResolutionType(Number(resolution)),
            resolvedAt: Number(resolvedAt),
            isActive,
            flagIndex,
          });
        } catch (error) {
          console.warn(`Failed to fetch flag ${flagIndex} for subject ${subjectIdHash}:`, error);
        }
      }
    }

    return flags;
  } catch (error) {
    console.error('❌ Failed to fetch unaccepted flags:', error);
    throw error;
  }
}

/**
 * Get flags for a specific subject
 */
export async function getFlagsForSubject(subjectIdHash: string): Promise<UnacceptedUpdateFlag[]> {
  const contract = getContract();

  try {
    const rawFlags = await contract.getUnacceptedUpdateFlags(subjectIdHash);

    return rawFlags.map((f: any, index: number) => ({
      subjectIdHash,
      recordId: f.recordId,
      noteHash: f.noteHash,
      createdAt: Number(f.createdAt),
      resolution: parseResolutionType(Number(f.resolution)),
      resolvedAt: Number(f.resolvedAt),
      isActive: f.isActive,
      flagIndex: index,
    }));
  } catch (error) {
    console.error(`❌ Failed to fetch flags for subject ${subjectIdHash}:`, error);
    return [];
  }
}

// ===============================================================
// HELPERS
// ===============================================================

/**
 * Parse verification level from contract value
 */
function parseVerificationLevel(value: number): VerificationLevel {
  if (value >= 1 && value <= 3) return value as VerificationLevel;
  return VerificationLevel.None;
}

/**
 * Parse dispute severity from contract value
 */
function parseDisputeSeverity(value: number): DisputeSeverity {
  if (value >= 1 && value <= 3) return value as DisputeSeverity;
  return DisputeSeverity.None;
}

/**
 * Parse dispute culpability from contract value
 */
function parseDisputeCulpability(value: number): DisputeCulpability {
  if (value >= 1 && value <= 5) return value as DisputeCulpability;
  return DisputeCulpability.None;
}

/**
 * Parse resolution type from contract value
 */
function parseResolutionType(value: number): ResolutionType {
  if (value >= 0 && value <= 4) return value as ResolutionType;
  return ResolutionType.None;
}
