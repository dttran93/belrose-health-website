// src/features/BackendChainParity/hooks/useVerificationsIntegrity.ts

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { checkVerificationIntegrity, checkDisputeIntegrity } from '../services/integrityCheckService';
import type {
  FirestoreVerification,
  FirestoreDispute,
  VerificationIntegrityItem,
  DisputeIntegrityItem,
} from '../lib/types';

const db = getFirestore(getApp());

async function fetchVerificationsIntegrity(): Promise<VerificationIntegrityItem[]> {
  const snapshot = await getDocs(collection(db, 'verifications'));
  const items: FirestoreVerification[] = snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<FirestoreVerification, 'id'>),
  }));

  return Promise.all(items.map(item => checkVerificationIntegrity(item)));
}

async function fetchDisputesIntegrity(): Promise<DisputeIntegrityItem[]> {
  const snapshot = await getDocs(collection(db, 'disputes'));
  const items: FirestoreDispute[] = snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<FirestoreDispute, 'id'>),
  }));

  return Promise.all(items.map(item => checkDisputeIntegrity(item)));
}

export function useVerificationsIntegrity() {
  return useQuery({
    queryKey: ['backend-chain-parity', 'verifications'],
    queryFn: fetchVerificationsIntegrity,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDisputesIntegrity() {
  return useQuery({
    queryKey: ['backend-chain-parity', 'disputes'],
    queryFn: fetchDisputesIntegrity,
    staleTime: 10 * 60 * 1000,
  });
}
