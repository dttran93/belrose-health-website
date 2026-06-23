// src/features/BackendChainParity/hooks/useRecordsIntegrity.ts

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { checkRecordIntegrity } from '../services/recordSubjectIntegrityService';
import type { FirestoreRecord } from '../lib/types';
import type { RecordIntegrityItem } from '../services/recordSubjectIntegrityService';

const db = getFirestore(getApp());

async function fetchRecordsIntegrity(): Promise<RecordIntegrityItem[]> {
  const [recordsSnap, verSnap, dispSnap] = await Promise.all([
    getDocs(collection(db, 'records')),
    getDocs(collection(db, 'verifications')),
    getDocs(collection(db, 'disputes')),
  ]);

  // Build a set of recordIds that have at least one backend V or D — zero extra per-record queries.
  const recordIdsWithCredibility = new Set<string>();
  for (const doc of [...verSnap.docs, ...dispSnap.docs]) {
    const rid = doc.data().recordId as string | undefined;
    if (rid) recordIdsWithCredibility.add(rid);
  }

  const records: FirestoreRecord[] = recordsSnap.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<FirestoreRecord, 'id'>),
  }));

  return Promise.all(
    records.map(record =>
      checkRecordIntegrity(record, recordIdsWithCredibility.has(record.id))
    )
  );
}

export function useRecordsIntegrity() {
  return useQuery({
    queryKey: ['backend-chain-parity', 'records'],
    queryFn: fetchRecordsIntegrity,
    staleTime: 10 * 60 * 1000,
  });
}
