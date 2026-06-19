// src/features/BackendChainParity/hooks/useMembersIntegrity.ts

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { checkMemberIntegrity } from '../services/integrityCheckService';
import type { FirestoreUser, MemberIntegrityItem } from '../lib/types';

const db = getFirestore(getApp());

async function fetchMembersIntegrity(): Promise<MemberIntegrityItem[]> {
  const snapshot = await getDocs(collection(db, 'users'));
  const users: FirestoreUser[] = snapshot.docs.map(doc => ({
    uid: doc.id,
    ...(doc.data() as Omit<FirestoreUser, 'uid'>),
  }));

  return Promise.all(users.map(user => checkMemberIntegrity(user)));
}

export function useMembersIntegrity() {
  return useQuery({
    queryKey: ['backend-chain-parity', 'members'],
    queryFn: fetchMembersIntegrity,
    staleTime: 10 * 60 * 1000,
  });
}
