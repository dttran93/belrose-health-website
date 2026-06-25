// src/features/BackendChainParity/hooks/useMembersIntegrity.ts

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import type { BelroseUserProfile } from '@/types/core';
import {
  checkMemberIntegrity,
  buildChainOnlyItem,
  MemberIntegrityItem,
} from '../services/memberIntegrityService';
import { getMemberContract } from '../lib/contracts';

const db = getFirestore(getApp());

async function fetchMembersIntegrity(): Promise<MemberIntegrityItem[]> {
  const [snapshot, allOnChainHashes] = await Promise.all([
    getDocs(collection(db, 'users')),
    getMemberContract().getAllUsers(),
  ]);

  const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }) as BelroseUserProfile);

  const firestoreHashSet = new Set<string>(
    users
      .map(u => u.onChainIdentity?.userIdHash?.toLowerCase())
      .filter((h): h is string => Boolean(h))
  );

  const chainOnlyHashes = allOnChainHashes.filter(h => !firestoreHashSet.has(h.toLowerCase()));

  const [firestoreItems, chainOnlyItems] = await Promise.all([
    Promise.all(users.map(user => checkMemberIntegrity(user))),
    Promise.all(chainOnlyHashes.map(h => buildChainOnlyItem(h))),
  ]);

  return [...firestoreItems, ...chainOnlyItems];
}

export function useMembersIntegrity() {
  return useQuery({
    queryKey: ['backend-chain-parity', 'members'],
    queryFn: fetchMembersIntegrity,
    staleTime: 10 * 60 * 1000,
  });
}
