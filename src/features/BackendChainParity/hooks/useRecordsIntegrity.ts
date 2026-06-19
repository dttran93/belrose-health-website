// src/features/BackendChainParity/hooks/useRecordsIntegrity.ts

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { checkRecordIntegrity } from '../services/integrityCheckService';
import type { FirestoreRecord, RecordIntegrityItem } from '../lib/types';

const db = getFirestore(getApp());

async function fetchRecordsIntegrity(): Promise<RecordIntegrityItem[]> {
  const snapshot = await getDocs(collection(db, 'records'));
  const records: FirestoreRecord[] = snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<FirestoreRecord, 'id'>),
  }));

  return Promise.all(records.map(record => checkRecordIntegrity(record)));
}

export function useRecordsIntegrity() {
  return useQuery({
    queryKey: ['backend-chain-parity', 'records'],
    queryFn: fetchRecordsIntegrity,
    staleTime: 10 * 60 * 1000,
  });
}
