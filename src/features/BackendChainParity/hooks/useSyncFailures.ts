// src/features/BackendChainParity/hooks/useSyncFailures.ts

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, orderBy, query, getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import type { SyncQueueRecord } from '@/features/BlockchainWallet/services/blockchainSyncQueueService';

const db = getFirestore(getApp());

async function fetchSyncFailures(): Promise<SyncQueueRecord[]> {
  const q = query(collection(db, 'blockchainSyncQueue'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<SyncQueueRecord, 'id'>),
  }));
}

export function useSyncFailures() {
  return useQuery({
    queryKey: ['backend-chain-parity', 'sync-failures'],
    queryFn: fetchSyncFailures,
    staleTime: 5 * 60 * 1000,
  });
}
