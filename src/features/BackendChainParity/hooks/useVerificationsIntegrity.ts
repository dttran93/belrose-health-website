// src/features/BackendChainParity/hooks/useVerificationsIntegrity.ts

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import {
  checkVerificationIntegrity,
  checkDisputeIntegrity,
  VerificationIntegrityItem,
  DisputeIntegrityItem,
} from '../services/credibilityIntegrityService';
import type { VerificationDoc, DisputeDoc } from '@belrose/shared';

const db = getFirestore(getApp());

async function fetchVerificationsIntegrity(): Promise<VerificationIntegrityItem[]> {
  const snapshot = await getDocs(collection(db, 'verifications'));
  const items = snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<VerificationDoc, 'id'>),
  })) as VerificationDoc[];

  return Promise.all(items.map(item => checkVerificationIntegrity(item)));
}

async function fetchDisputesIntegrity(): Promise<DisputeIntegrityItem[]> {
  const snapshot = await getDocs(collection(db, 'disputes'));
  const items = snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as Omit<DisputeDoc, 'id'>),
  })) as DisputeDoc[];

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
