// src/features/Trustee/hooks/useRecordTrustees.ts
//
// Fetches all active trustee relationships relevant to a record.
//
// Returns two things:
//   trusteeMap:  trusteeId → entry
//                "I am a trustee — who am I acting for, and at what level?"
//                Used to render the shield badge on the trustee's card.
//
//   trustorMap:  trustorId → TrusteeEntry[]
//                "I am a trustor — who are my trustees on this record?"
//                Used to render the expand toggle on the trustor's card.

import { useState, useEffect, useCallback } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { BelroseUserProfile } from '@/types/core';
import { TrustLevel } from '@/features/Trustee/services/trusteeRelationshipService';

// ============================================================================
// TYPES
// ============================================================================

export interface TrusteeEntry {
  trusteeId: string;
  trustorId: string;
  trustLevel: TrustLevel;
  trusteeProfile: BelroseUserProfile | null;
  trustorProfile: BelroseUserProfile | null;
}

export type TrusteeByIdMap = Map<string, TrusteeEntry>; // trusteeId → entry
export type TrustorByIdMap = Map<string, TrusteeEntry[]>; // trustorId → entries

// ============================================================================
// HOOK
// ============================================================================

/**
 * @param recordUserIds  All userIds with a direct role on the record
 *                       (owners + administrators + viewers)
 * @param recordTrustees The `trustees` array from the FileObject —
 *                       userIds who have record access via a trustee relationship
 */
export function useRecordTrustees(recordUserIds: string[], recordTrustees: string[] = []) {
  const [trusteeMap, setTrusteeMap] = useState<TrusteeByIdMap>(new Map());
  const [trustorMap, setTrustorMap] = useState<TrustorByIdMap>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchTrustees = useCallback(async () => {
    if (recordUserIds.length === 0 || recordTrustees.length === 0) {
      setTrusteeMap(new Map());
      setTrustorMap(new Map());
      return;
    }

    setLoading(true);
    try {
      const db = getFirestore();

      // Firestore `in` queries cap at 30 items — chunk defensively
      const trusteeChunks = chunk(recordTrustees, 30);
      const allDocs: QueryDocumentSnapshot<DocumentData>[] = [];

      // We need both constraints satisfied: trustorId IN recordUserIds AND trusteeId IN recordTrustees.
      // Since Firestore doesn't support two `in` clauses on different fields in one query,
      // we query by trusteeId chunks (smaller set) and filter trustorId client-side.
      const recordUserIdSet = new Set(recordUserIds);

      for (const trusteeChunk of trusteeChunks) {
        const q = query(
          collection(db, 'trusteeRelationships'),
          where('trusteeId', 'in', trusteeChunk),
          where('status', '==', 'active')
        );
        const snap = await getDocs(q);
        // Filter client-side: only keep docs where trustor is on this record
        const relevant = snap.docs.filter(d => recordUserIdSet.has(d.data().trustorId));
        allDocs.push(...relevant);
      }

      // Batch-fetch all profiles needed
      const allIds = new Set<string>();
      allDocs.forEach(d => {
        allIds.add(d.data().trustorId);
        allIds.add(d.data().trusteeId);
      });
      const profiles =
        allIds.size > 0
          ? await getUserProfiles(Array.from(allIds))
          : new Map<string, BelroseUserProfile>();

      // Build both maps in one pass
      const byTrustee: TrusteeByIdMap = new Map();
      const byTrustor: TrustorByIdMap = new Map();

      allDocs.forEach(d => {
        const { trustorId, trusteeId, trustLevel } = d.data() as {
          trustorId: string;
          trusteeId: string;
          trustLevel: TrustLevel;
        };

        const entry: TrusteeEntry = {
          trusteeId,
          trustorId,
          trustLevel,
          trusteeProfile: profiles.get(trusteeId) ?? null,
          trustorProfile: profiles.get(trustorId) ?? null,
        };

        byTrustee.set(trusteeId, entry);

        if (!byTrustor.has(trustorId)) byTrustor.set(trustorId, []);
        byTrustor.get(trustorId)!.push(entry);
      });

      setTrusteeMap(byTrustee);
      setTrustorMap(byTrustor);
    } catch (error) {
      console.error('useRecordTrustees: fetch failed', error);
    } finally {
      setLoading(false);
    }
  }, [recordUserIds.join(','), recordTrustees.join(',')]);

  useEffect(() => {
    fetchTrustees();
  }, [fetchTrustees]);

  return { trusteeMap, trustorMap, loading, refetch: fetchTrustees };
}

// ============================================================================
// UTIL
// ============================================================================

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
