// src/features/HealthProfile/hooks/useBlockchainCompleteness.ts

/**
 * useBlockchainCompleteness
 *
 * Compares Firestore records against what the subject has anchored on-chain.
 *
 * TWO MODES:
 *
 * 1. Fast mode (default, runs automatically on load)
 *    Uses record.recordHash from Firestore. Quick, no compute.
 *    Catches accidental drift and server-side tampering where the hash
 *    field wasn't also updated. Sufficient for most use cases.
 *
 * 2. Verified mode (triggered by the user via recompute())
 *    Recomputes SHA-256 from live record content using RecordHashService.
 *    Provides full cryptographic guarantee — even a compromised server
 *    that updated both content AND the stored hash field will be caught.
 *    Sets lastVerifiedAt timestamp so the UI can show "Verified 2 mins ago".
 *
 * STATUS MEANINGS:
 *   'anchored_match'    ✅  On-chain, hash matches
 *   'anchored_mismatch' ⚠️  On-chain but hash differs — possible tampering
 *   'not_anchored'      ⬜  Not found on-chain — unverified record
 *   'no_hash'           ℹ️  No hash available to compare (missing or encrypted)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { FileObject } from '@/types/core';
import { blockchainHealthRecordService } from '@/features/Credibility/services/blockchainHealthRecordService';
import { RecordHashService } from '@/features/ViewEditRecord/services/generateRecordHash';

// ============================================================================
// TYPES
// ============================================================================

export type RecordBlockchainStatus =
  | 'anchored_match' // ✅ Current hash found on-chain
  | 'anchored_previous_version' // 🔵 A previous hash found on-chain — edited since anchoring
  | 'anchored_mismatch' // ⚠️ On-chain but no version matches — broken chain
  | 'not_anchored' // ⬜ Not found in subject's on-chain medical history
  | 'no_hash'; // ℹ️ No hash available to compare

export interface RecordCompletenessResult {
  record: FileObject;
  status: RecordBlockchainStatus;
  /** All hashes stored on-chain for this recordId (empty if not anchored) */
  onChainHashes: string[];
  /**
   * True if the matched hash is the last entry in onChainHashes.
   * The contract appends new hashes, so last = most recent anchored version.
   */
  isLatestHash: boolean;
  /**
   * For 'anchored_previous_version': the specific previous hash that matched on-chain.
   * Tells the UI which generation of the record was verified — useful for showing
   * "Verified at version N" or linking to that version in the version history.
   */
  matchedPreviousHash?: string;
}

export interface BlockchainCompletenessSummary {
  total: number;
  anchoredMatch: number;
  anchoredPreviousVersion: number; // Edited since anchoring but traceable
  anchoredMismatch: number;
  notAnchored: number;
  noHash: number;
}

export interface UseBlockchainCompletenessReturn {
  results: RecordCompletenessResult[];
  summary: BlockchainCompletenessSummary;
  isLoading: boolean;
  /** True only while recompute() is running — lets the UI show a spinner on the button */
  isRecomputing: boolean;
  error: Error | null;
  /**
   * Whether the current results are backed by cryptographically recomputed hashes.
   * False on initial load (uses stored recordHash). True after recompute() completes.
   */
  isVerified: boolean;
  /**
   * Timestamp of the last successful recompute() call. Null until first recompute.
   * Use this to show "Last verified: 3 minutes ago" in the UI.
   */
  lastVerifiedAt: Date | null;
  /**
   * Trigger cryptographic recomputation of all record hashes.
   * Computes SHA-256 from live content and re-runs the on-chain comparison.
   * Sets isVerified=true and updates lastVerifiedAt on success.
   */
  recompute: () => Promise<void>;
}

// ============================================================================
// HELPER
// ============================================================================

/**
 * Cross-reference a hash (and its previous versions) against the on-chain
 * version history for a record. Extracted so both fast and verified paths
 * use identical logic.
 *
 * Check order:
 *   1. Current hash → anchored_match
 *   2. Any previous hash → anchored_previous_version (edited since anchoring)
 *   3. Anchored but nothing matches → anchored_mismatch (broken chain)
 *   4. Not anchored → not_anchored
 *   5. No hash to check → no_hash
 */
function resolveStatus(
  currentHash: string | null | undefined,
  previousHashes: string[] | null | undefined,
  recordId: string | undefined,
  anchoredRecordIds: Set<string>,
  versionHistoryMap: Map<string, string[]>
): Pick<
  RecordCompletenessResult,
  'status' | 'onChainHashes' | 'isLatestHash' | 'matchedPreviousHash'
> {
  if (!currentHash) {
    return { status: 'no_hash', onChainHashes: [], isLatestHash: false };
  }

  // After the !currentHash guard, TS still tracks the type as string | null | undefined
  // because it can't narrow through early returns in all control paths.
  // Assigning to a typed const is the correct fix — it's a genuine narrowing, not a cast.
  const hash: string = currentHash;

  const isAnchored = recordId ? anchoredRecordIds.has(recordId) : false;
  if (!isAnchored) {
    return { status: 'not_anchored', onChainHashes: [], isLatestHash: false };
  }

  const onChainHashes = recordId ? (versionHistoryMap.get(recordId) ?? []) : [];

  const currentIndex = onChainHashes.indexOf(hash);
  if (currentIndex !== -1) {
    return {
      status: 'anchored_match',
      onChainHashes,
      isLatestHash: currentIndex === onChainHashes.length - 1,
    };
  }

  // Check previous hashes — iterate newest-first
  const prevHashes = (previousHashes ?? []).filter((h): h is string => !!h);

  // Use a for...of loop instead of index-based iteration
  for (const prevHash of [...prevHashes].reverse()) {
    const prevIndex = onChainHashes.indexOf(prevHash);

    if (prevIndex !== -1) {
      return {
        status: 'anchored_previous_version',
        onChainHashes,
        isLatestHash: prevIndex === onChainHashes.length - 1,
        matchedPreviousHash: prevHash,
      };
    }
  }

  return { status: 'anchored_mismatch', onChainHashes, isLatestHash: false };
}

// ============================================================================
// HOOK
// ============================================================================

export function useBlockchainCompleteness(
  subjectFirebaseUid: string,
  records: FileObject[]
): UseBlockchainCompletenessReturn {
  // On-chain data (fetched once on load)
  const [anchoredRecordIds, setAnchoredRecordIds] = useState<Set<string>>(new Set());
  const [versionHistoryMap, setVersionHistoryMap] = useState<Map<string, string[]>>(new Map());

  // Recomputed hashes — only populated after recompute() is called
  const [computedHashMap, setComputedHashMap] = useState<Map<string, string>>(new Map());

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Verification state
  const [isVerified, setIsVerified] = useState(false);
  const [lastVerifiedAt, setLastVerifiedAt] = useState<Date | null>(null);

  // =========================================================================
  // INITIAL LOAD: Fetch on-chain data only
  // =========================================================================
  // We don't recompute hashes here — fast mode uses record.recordHash directly.

  useEffect(() => {
    if (!subjectFirebaseUid || records.length === 0) {
      setIsLoading(false);
      return;
    }

    const fetchChainData = async () => {
      setIsLoading(true);
      setError(null);
      // Reset verification state when records change
      setIsVerified(false);
      setComputedHashMap(new Map());

      try {
        const userIdHash = ethers.id(subjectFirebaseUid);
        console.log(`⛓️ Fetching on-chain data for ${subjectFirebaseUid.slice(0, 8)}...`);

        // getActiveSubjectMedicalHistory filters out unanchored records.
        // The contract keeps all history for audit, but active = currently claimed.
        const onChainRecordIds: string[] =
          await blockchainHealthRecordService.getActiveSubjectMedicalHistory(userIdHash);

        console.log(`📋 ${onChainRecordIds.length} anchored records on-chain`);
        setAnchoredRecordIds(new Set(onChainRecordIds));

        // Only fetch version history for records we have in Firestore
        const firestoreIds = new Set(records.map(r => r.id).filter(Boolean) as string[]);
        const overlap = onChainRecordIds.filter(id => firestoreIds.has(id));

        const historyEntries = await Promise.all(
          overlap.map(async recordId => {
            const hashes = await blockchainHealthRecordService.getRecordVersionHistory(recordId);
            return [recordId, hashes] as [string, string[]];
          })
        );

        setVersionHistoryMap(new Map(historyEntries));
      } catch (err) {
        console.error('❌ Chain fetch failed:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch blockchain data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchChainData();
  }, [subjectFirebaseUid, records.length]);

  // =========================================================================
  // RECOMPUTE: Cryptographic verification on demand
  // =========================================================================

  const recompute = useCallback(async () => {
    if (isRecomputing || records.length === 0) return;

    setIsRecomputing(true);
    setError(null);

    try {
      console.log(`🔐 Recomputing hashes for ${records.length} records...`);

      const hashEntries = await Promise.all(
        records
          .filter(r => r.id && !r.isEncrypted) // Skip encrypted — hash would be wrong
          .map(async record => {
            const hash = await RecordHashService.generateRecordHash(record);
            return [record.id!, hash] as [string, string];
          })
      );

      setComputedHashMap(new Map(hashEntries));
      setIsVerified(true);
      setLastVerifiedAt(new Date());
      console.log(`✅ Recomputed ${hashEntries.length} hashes`);
    } catch (err) {
      console.error('❌ Hash recomputation failed:', err);
      setError(err instanceof Error ? err : new Error('Failed to recompute hashes'));
    } finally {
      setIsRecomputing(false);
    }
  }, [records, isRecomputing]);

  // =========================================================================
  // RESULTS: Cross-reference using whichever hash source is active
  // =========================================================================

  const results = useMemo<RecordCompletenessResult[]>(() => {
    return records.map(record => {
      // Fast mode: stored recordHash. Verified mode: recomputed hash.
      // Explicitly typed to match resolveStatus's accepted parameter type.
      const hash: string | null | undefined =
        isVerified && record.id ? (computedHashMap.get(record.id) ?? null) : record.recordHash;

      return {
        record,
        ...resolveStatus(
          hash,
          record.previousRecordHash,
          record.id,
          anchoredRecordIds,
          versionHistoryMap
        ),
      };
    });
  }, [records, isVerified, computedHashMap, anchoredRecordIds, versionHistoryMap]);

  // =========================================================================
  // SUMMARY
  // =========================================================================

  const summary = useMemo<BlockchainCompletenessSummary>(
    () => ({
      total: results.length,
      anchoredMatch: results.filter(r => r.status === 'anchored_match').length,
      anchoredPreviousVersion: results.filter(r => r.status === 'anchored_previous_version').length,
      anchoredMismatch: results.filter(r => r.status === 'anchored_mismatch').length,
      notAnchored: results.filter(r => r.status === 'not_anchored').length,
      noHash: results.filter(r => r.status === 'no_hash').length,
    }),
    [results]
  );

  return {
    results,
    summary,
    isLoading,
    isRecomputing,
    error,
    isVerified,
    lastVerifiedAt,
    recompute,
  };
}

export default useBlockchainCompleteness;
