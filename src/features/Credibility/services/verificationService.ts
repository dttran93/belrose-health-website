//src/features/Credibility/services/verificationService.ts

import { ethers } from 'ethers';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
  collection,
  where,
  query,
  getDocs,
} from 'firebase/firestore';
import { blockchainHealthRecordService } from './blockchainHealthRecordService';
import { FileText, Lock, LucideIcon, MapPin, X } from 'lucide-react';
import { getDisputeId } from './disputeService';
import {
  onVerificationCreated,
  onVerificationModified,
  onVerificationRevoked,
} from './credibilityScoreService';
import { BlockchainSyncQueueService } from '@/features/BlockchainWallet/services/blockchainSyncQueueService';

// ============================================================
// TYPES
// ============================================================

export type VerificationLevel = 0 | 1 | 2 | 3;
export type VerificationLevelOptions = 1 | 2 | 3;
export type VerificationLevelOptionName = 'Provenance' | 'Content' | 'Full';

export interface VerificationConfig {
  value: VerificationLevelOptions;
  name: VerificationLevelOptionName;
  icon: LucideIcon;
  description: string;
  declarative: string;
}

export interface VerificationDoc {
  id: string;
  recordHash: string;
  recordId: string;
  verifierId: string;
  verifierIdHash: string;
  level: VerificationLevelOptions;
  isActive: boolean;
  createdAt: Timestamp;
  lastModified?: Timestamp;
  chainStatus: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

export const VERIFICATION_LEVEL_CONFIG: Record<VerificationLevelOptions, VerificationConfig> = {
  3: {
    value: 3,
    name: 'Full',
    icon: Lock,
    declarative:
      'I created this record or am willing to verify both the content and provenance of the record.',
    description:
      'The verifier is vouching for both the content and the provenance of this record. They are either the provider who originally created the record or directly verified that the record is complete and accuate',
  },
  2: {
    value: 2,
    name: 'Content',
    icon: FileText,
    declarative:
      'I am vouching for the content of the record, but I did not observe the original interaction described.',
    description:
      'The verifier is vouching for the content of the record. They may not have originally created the record or directly observed the interaction, however they have certified they agree with its content.',
  },
  1: {
    value: 1,
    name: 'Provenance',
    icon: MapPin,
    declarative:
      'I am confirming that the origin of the record is correct. I am not verifying the accuracy of its content.',
    description:
      'The verifier is confirming the origin of the record is correctly stated. They are not verifying the completeness and accuracy of the content itself.',
  },
};

// Helper functions to access config
export const getVerificationConfig = (
  verificationLevel: VerificationLevelOptions
): VerificationConfig => VERIFICATION_LEVEL_CONFIG[verificationLevel];

// Arrays for iterating in UI (forms, selects, etc.)
export const VERIFICATION_OPTIONS = Object.values(VERIFICATION_LEVEL_CONFIG);

// ============================================================
// HELPERS
// ============================================================

/**
 * Generates a deterministic verification document ID.
 * Format: {recordHash}_{verifierId}
 * This ensures one verification per user per record hash.
 */
export function getVerificationId(recordHash: string, verifierId: string): string {
  return `${recordHash}_${verifierId}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// ============================================================
// QUERY FUNCTIONS
// ============================================================

/**
 * Fetches all verifications for a record (across all versions/hashes).
 * Uses Firestore query on recordId field.
 *
 * @param recordId - The record ID to fetch verifications for
 * @returns Array of VerificationDoc objects
 */
export async function getVerificationsByRecordId(recordId: string): Promise<VerificationDoc[]> {
  const db = getFirestore();
  const verificationsRef = collection(db, 'verifications');

  // Query all verifications where recordId matches
  const q = query(verificationsRef, where('recordId', '==', recordId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(
    doc =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as VerificationDoc
  );
}

/**
 * Fetches verifications with version information.
 * Groups verifications by hash and includes version numbers.
 *
 * @param recordId - The record ID
 * @param hashVersionMap - Map of recordHash -> versionNumber (from record's version history)
 * @returns Array of verifications with version info attached
 */
export async function getVerificationsWithVersionInfo(
  recordId: string,
  hashVersionMap: Map<string, number>
): Promise<VerificationDoc[]> {
  const verifications = await getVerificationsByRecordId(recordId);
  const totalVersions = hashVersionMap.size;

  return verifications.map(v => ({
    ...v,
    versionNumber: hashVersionMap.get(v.recordHash) ?? 0,
    totalVersions,
  }));
}

// ============================================================
// VERIFICATION FUNCTIONS
// ============================================================

/**
 * Create a new verification for a record.
 *
 * @param recordId - The record ID
 * @param recordHash - The content hash being verified
 * @param verifierId - The user creating the verification
 * @param level - The verification level (1, 2, or 3)
 * @returns The verification document ID
 */
export async function createVerification(
  recordId: string,
  recordHash: string,
  verifierId: string,
  level: VerificationLevelOptions
): Promise<string> {
  const db = getFirestore();

  // CHECK 1: Ensure record exists
  const recordRef = doc(db, 'records', recordId);
  const recordSnap = await getDoc(recordRef);

  if (!recordSnap.exists()) {
    throw new Error('Record not found.');
  }

  // CHECK 2: Check for existing verification
  const verificationId = getVerificationId(recordHash, verifierId);
  const docRef = doc(db, 'verifications', verificationId);
  const existing = await getDoc(docRef);

  if (existing.exists()) {
    const data = existing.data();

    // If it's already confirmed on-chain and active, block it.
    if (data?.isActive && data?.chainStatus === 'confirmed') {
      throw new Error('You have already verified this record. Use modify to update.');
    }

    console.log('Retrying failed or pending verification...');
  }

  // CHECK 3: You cannot both dispute and verify the same recordHash
  const disputeId = getDisputeId(recordHash, verifierId);
  const disputeDocRef = doc(db, 'disputes', disputeId);
  const disputeExisting = await getDoc(disputeDocRef);

  if (disputeExisting.exists()) {
    const disputeData = disputeExisting.data();
    if (disputeData?.isActive) {
      throw new Error('You cannot both verify and dispute the same record hash');
    }
  }

  console.log('🔄 Creating verification:', { recordId, recordHash, level });

  // Step 1: Write to blockchain
  try {
    console.log('🔗 Writing verification to blockchain...');
    const tx = await blockchainHealthRecordService.verifyRecord(recordId, recordHash, level);
    console.log('✅ Blockchain: Verification recorded');

    // Step 2: Write to Firestore
    const verifierIdHash = ethers.keccak256(ethers.toUtf8Bytes(verifierId));

    if (existing.exists()) {
      await updateDoc(docRef, {
        level,
        isActive: true,
        chainStatus: 'confirmed',
        txHash: tx.txHash,
        error: null,
        lastModified: Timestamp.now(),
      });
      console.log('✅ Firestore: Verification reactivated');
    } else {
      await setDoc(docRef, {
        recordHash,
        recordId,
        verifierId,
        verifierIdHash,
        level,
        isActive: true,
        createdAt: Timestamp.now(),
        chainStatus: 'confirmed',
        txHash: tx.txHash,
      });
      console.log('✅ Firestore: Verification created');
    }

    // Step 3: Update credibility score
    await onVerificationCreated(recordId, recordHash, level, tx.txHash);

    console.log('✅ Verification created successfully');
    return verificationId;
  } catch (error) {
    console.error('❌ Blockchain verification failed:', error);

    // Log failure for diagnostics, but DON'T write to Firestore
    await BlockchainSyncQueueService.logFailure({
      contract: 'HealthRecordCore',
      action: 'verifyRecord',
      userId: verifierId,
      error: getErrorMessage(error),
      context: {
        type: 'verification',
        recordId,
        recordHash,
        level,
      },
    });

    // Re-throw to prevent any further operations
    throw error;
  }
}

/**
 * Retract an existing verification.
 * Atomic operation: blockchain first, then Firestore.
 *
 * @param recordHash - The content hash of the verification to retract
 * @param verifierId - The user retracting the verification
 */
export async function retractVerification(recordHash: string, verifierId: string): Promise<void> {
  // CHECK 1: Find the verification and make sure it is active
  const verificationId = getVerificationId(recordHash, verifierId);

  const db = getFirestore();
  const docRef = doc(db, 'verifications', verificationId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error('Verification not found');
  }

  const data = snapshot.data();
  if (!data?.isActive) {
    throw new Error('Verification is already inactive');
  }

  // CHECK 2: You can only retract your own verification
  if (data.verifierId !== verifierId) {
    throw new Error('You can only retract your own verifications');
  }

  console.log('🔄 Retracting verification:', { recordHash, verifierId });

  // Step 1: Write to blockchain
  try {
    console.log('🔗 Retracting verification on blockchain...');
    const tx = await blockchainHealthRecordService.retractVerification(recordHash);
    console.log('✅ Blockchain: Verification retracted');

    // Step 2: Update Firestore (only if blockchain succeeded)
    await updateDoc(docRef, {
      isActive: false,
      lastModified: Timestamp.now(),
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });
    console.log('✅ Firestore: Verification marked inactive');

    // Step 3: Update credibility score
    await onVerificationRevoked(data.recordId, data.recordHash, data.level, tx.txHash);

    console.log('✅ Verification retracted successfully');
  } catch (error) {
    console.error('❌ Blockchain retraction failed:', error);

    // Log failure for diagnostics, DON'T update Firestore
    await BlockchainSyncQueueService.logFailure({
      contract: 'HealthRecordCore',
      action: 'retractVerification',
      userId: verifierId,
      error: getErrorMessage(error),
      context: {
        type: 'verification-retraction',
        recordId: data.recordId,
        recordHash: recordHash,
      },
    });

    // Re-throw to prevent any further operations
    throw error;
  }
}

/**
 * Modify the level of an existing verification.
 * Atomic operation: blockchain first, then Firestore.
 *
 * @param recordHash - The content hash of the verification to modify
 * @param verifierId - The user modifying the verification
 * @param newLevel - The new verification level
 */
export async function modifyVerificationLevel(
  recordHash: string,
  verifierId: string,
  newLevel: VerificationLevelOptions
): Promise<void> {
  // CHECK 1: Make sure that the verification exists and is active
  const verificationId = getVerificationId(recordHash, verifierId);
  const db = getFirestore();
  const docRef = doc(db, 'verifications', verificationId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error('Verification not found');
  }

  const data = snapshot.data();
  if (!data?.isActive) {
    throw new Error('Cannot modify an inactive verification');
  }

  // CHECK 2: Ensure user owns this verification
  if (data.verifierId !== verifierId) {
    throw new Error('You can only modify your own verification');
  }

  // CHECK 3: Make sure that the verification level is different
  const oldLevel = data.level;
  if (oldLevel === newLevel) {
    throw new Error('New level is the same as current level');
  }

  console.log('🔄 Modifying verification level:', { recordHash, oldLevel, newLevel });

  // Step 1: Write to blockchain
  try {
    console.log('🔗 Modifying verification level on blockchain...');
    const tx = await blockchainHealthRecordService.modifyVerificationLevel(recordHash, newLevel);
    console.log('✅ Blockchain: Verification level updated');

    // Step 2: Update Firestore
    await updateDoc(docRef, {
      level: newLevel,
      lastModified: Timestamp.now(),
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });
    console.log('✅ Firestore: Verification level updated');

    // Step 3: Update credibility score
    await onVerificationModified(data.recordId, recordHash, oldLevel, newLevel, tx.txHash);

    console.log('✅ Verification level modified successfully');
  } catch (error) {
    console.error('❌ Blockchain modification failed:', error);

    // Log failure for diagnostics, DON'T update Firestore
    await BlockchainSyncQueueService.logFailure({
      contract: 'HealthRecordCore',
      action: 'modifyVerificationLevel',
      userId: verifierId,
      error: getErrorMessage(error),
      context: {
        type: 'verification-modification',
        recordId: data.recordId,
        recordHash: recordHash,
        oldLevel: oldLevel,
        newLevel: newLevel,
      },
    });

    // Re-throw to prevent any further operations
    throw error;
  }
}

/**
 * Get a specific verification by record hash and verifier ID.
 *
 * @param recordHash - The content hash
 * @param verifierId - The verifier's user ID
 * @returns The verification document or null if not found
 */
export async function getVerification(
  recordHash: string,
  verifierId: string
): Promise<VerificationDoc | null> {
  const verificationId = getVerificationId(recordHash, verifierId);

  const db = getFirestore();
  try {
    const snapshot = await getDoc(doc(db, 'verifications', verificationId));

    if (!snapshot.exists()) return null;

    return { id: snapshot.id, ...snapshot.data() } as VerificationDoc;
  } catch (error) {
    console.debug('Verification not found or not accessible:', verificationId);
    return null;
  }
}
