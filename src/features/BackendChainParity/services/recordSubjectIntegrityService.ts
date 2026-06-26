// src/features/BackendChainParity/services/recordSubjectIntegrityService.ts

import { ethers, id } from 'ethers';
import type { HashComparison, IntegrityStatus, SubjectComparison } from '../lib/types';
import { getHealthContract } from '../lib/contracts';
import { FileObject } from '@/types/core';

export interface RecordIntegrityItem {
  firestoreId: string;
  recordHash: string | null;
  recordIdHash?: string;
  backendSubjects: string[];
  onChainSubjects: string[];
  activeOnChainSubjects: string[];
  subjectComparisons?: SubjectComparison[];
  backendHashes: string[];
  onChainHashes: string[];
  activeOnChainHashes: string[];
  hashComparisons?: HashComparison[];
  integrityStatus: IntegrityStatus;
  hashExistsOnChain?: boolean;
  hasBackendCredibilityReview?: boolean;
  error?: string;
}

export async function checkRecordIntegrity(
  record: FileObject,
  hasBackendCredibilityReview = false
): Promise<RecordIntegrityItem> {
  const backendSubjects = record.subjects ?? [];

  const currentHash = record.recordHash?.toLowerCase();
  const backendHashes: string[] = [
    ...(currentHash ? [currentHash] : []),
    ...(record.previousRecordHash ?? []).map(h => h.toLowerCase()),
  ];

  // Pre-populate backend subjects/hashes as missing_from_chain so every
  // early-return path still surfaces them in the UI.
  const initialSubjectComparisons: SubjectComparison[] = backendSubjects.map(uid => ({
    uid,
    userIdHash: ethers.id(uid).toLowerCase(),
    isActiveOnChain: false,
    syncStatus: 'missing_from_chain' as const,
  }));

  const initialHashComparisons: HashComparison[] = backendHashes.map(hash => ({
    hash,
    isCurrentHash: hash === currentHash,
    isActiveOnChain: false,
    syncStatus: 'missing_from_chain' as const,
  }));

  const resolvedRecordIdHash = record.recordIdHash ?? id(record.id);

  const base: Omit<RecordIntegrityItem, 'integrityStatus'> = {
    firestoreId: record.id,
    recordHash: record.recordHash,
    recordIdHash: resolvedRecordIdHash,
    backendSubjects,
    onChainSubjects: [],
    activeOnChainSubjects: [],
    subjectComparisons: initialSubjectComparisons,
    backendHashes,
    onChainHashes: [],
    activeOnChainHashes: [],
    hashComparisons: initialHashComparisons,
    hasBackendCredibilityReview,
  };

  // Can't do chain checks without a record hash (recordIdHash is derived from id if missing).
  if (!record.recordHash) {
    return { ...base, integrityStatus: 'failed' };
  }

  try {
    const contract = getHealthContract();

    // getRecordIdForHash reverts if the hash is not active on-chain.
    let returnedRecordIdHash: string;
    try {
      returnedRecordIdHash = await contract.getRecordIdForHash(record.recordHash);
    } catch {
      // Hash not on-chain. If there's also nothing in backend, it's not_applicable.
      const isNotApplicable = backendSubjects.length === 0 && !hasBackendCredibilityReview;
      return {
        ...base,
        integrityStatus: isNotApplicable ? 'not_applicable' : 'missing',
        hashExistsOnChain: false,
      };
    }

    if (returnedRecordIdHash.toLowerCase() !== resolvedRecordIdHash.toLowerCase()) {
      return { ...base, integrityStatus: 'mismatch', hashExistsOnChain: true };
    }

    // Fetch full subject + hash history in parallel
    const [rawOnChainSubjects, rawOnChainHashes] = await Promise.all([
      contract.getRecordSubjects(resolvedRecordIdHash),
      contract.getRecordVersionHistory(resolvedRecordIdHash),
    ]);

    const onChainSubjects: string[] = rawOnChainSubjects.map((h: string) => h.toLowerCase());
    const onChainHashes: string[] = rawOnChainHashes.map((h: string) => h.toLowerCase());

    // Resolve active status for every subject and hash in parallel
    const [subjectActiveResults, hashActiveResults] = await Promise.all([
      Promise.all(
        onChainSubjects.map(async hash => ({
          hash,
          isActive: (await contract.isActiveSubject(resolvedRecordIdHash!, hash)) as boolean,
        }))
      ),
      Promise.all(
        onChainHashes.map(async hash => ({
          hash,
          isActive: (await contract.doesHashExist(hash)) as boolean,
        }))
      ),
    ]);

    const subjectActiveMap = new Map(subjectActiveResults.map(r => [r.hash, r.isActive]));
    const hashActiveMap = new Map(hashActiveResults.map(r => [r.hash, r.isActive]));

    const activeOnChainSubjects = subjectActiveResults.filter(r => r.isActive).map(r => r.hash);
    const activeOnChainHashes = hashActiveResults.filter(r => r.isActive).map(r => r.hash);

    // ── Subject comparisons ──────────────────────────────────────────────────
    const subjectComparisons: SubjectComparison[] = [];
    const processedSubjectHashes = new Set<string>();

    for (const uid of backendSubjects) {
      const userIdHash = ethers.id(uid).toLowerCase();
      processedSubjectHashes.add(userIdHash);
      const isActiveOnChain = subjectActiveMap.get(userIdHash) ?? false;
      subjectComparisons.push({
        uid,
        userIdHash,
        isActiveOnChain,
        syncStatus: isActiveOnChain ? 'active_sync' : 'missing_from_chain',
      });
    }

    for (const hash of onChainSubjects) {
      if (!processedSubjectHashes.has(hash)) {
        const isActiveOnChain = subjectActiveMap.get(hash) ?? false;
        subjectComparisons.push({
          userIdHash: hash,
          isActiveOnChain,
          syncStatus: isActiveOnChain ? 'missing_from_backend' : 'removed_sync',
        });
      }
    }

    // ── Hash comparisons ─────────────────────────────────────────────────────
    const hashComparisons: HashComparison[] = [];
    const processedHashValues = new Set<string>();

    for (const hash of backendHashes) {
      processedHashValues.add(hash);
      const isActiveOnChain = hashActiveMap.get(hash) ?? false;
      hashComparisons.push({
        hash,
        isCurrentHash: hash === currentHash,
        isActiveOnChain,
        syncStatus: isActiveOnChain ? 'active_sync' : 'missing_from_chain',
      });
    }

    for (const hash of onChainHashes) {
      if (!processedHashValues.has(hash)) {
        const isActiveOnChain = hashActiveMap.get(hash) ?? false;
        hashComparisons.push({
          hash,
          isCurrentHash: false,
          isActiveOnChain,
          syncStatus: isActiveOnChain ? 'missing_from_backend' : 'removed_sync',
        });
      }
    }

    // ── Integrity status ─────────────────────────────────────────────────────
    // not_applicable: nothing was ever written on-chain and no backend V&D/subject exists
    const isNotApplicable =
      backendSubjects.length === 0 &&
      onChainSubjects.length === 0 &&
      onChainHashes.length === 0 &&
      !hasBackendCredibilityReview;

    let integrityStatus: IntegrityStatus;
    if (isNotApplicable) {
      integrityStatus = 'not_applicable';
    } else if (subjectComparisons.some(s => s.syncStatus === 'missing_from_backend')) {
      integrityStatus = 'mismatch';
    } else if (subjectComparisons.some(s => s.syncStatus === 'missing_from_chain')) {
      integrityStatus = 'missing';
    } else {
      integrityStatus = 'synced';
    }

    return {
      ...base,
      onChainSubjects,
      activeOnChainSubjects,
      subjectComparisons,
      onChainHashes,
      activeOnChainHashes,
      hashComparisons,
      integrityStatus,
      hashExistsOnChain: true,
    };
  } catch (error) {
    return { ...base, integrityStatus: 'failed', error: String(error) };
  }
}
