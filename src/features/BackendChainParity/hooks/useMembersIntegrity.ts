// src/features/BackendChainParity/hooks/useMembersIntegrity.ts

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import type { BelroseUserProfile } from '@/types/core';
import { checkMemberIntegrity, MemberIntegrityItem } from '../services/memberIntegrityService';

const db = getFirestore(getApp());

// Chain-only member detection (users on-chain but missing from Firebase) requires
// querying all users on chain. Querying all users on chain would be unsustainable,
// the read would get too large for any node to do at once. Plan is to do event-based
// indexing: a background process watches on-chain events and writes them to Firestore,
// making the chain→Firebase direction queryable without a full on-chain scan. Until
// indexer is built, this hook covers the Firebase→chain direction only.
async function fetchMembersIntegrity(): Promise<MemberIntegrityItem[]> {
  const snapshot = await getDocs(collection(db, 'users'));
  const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }) as BelroseUserProfile);
  return Promise.all(users.map(user => checkMemberIntegrity(user)));
}

export function useMembersIntegrity() {
  return useQuery({
    queryKey: ['backend-chain-parity', 'members'],
    queryFn: fetchMembersIntegrity,
    staleTime: 10 * 60 * 1000,
  });
}
