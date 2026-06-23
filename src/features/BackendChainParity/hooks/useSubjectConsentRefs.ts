// src/features/BackendChainParity/hooks/useSubjectConsentRefs.ts

import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import type { BlockchainRef } from '../lib/types';

/** Keyed by subjectId — only populated if the consent request has a blockchainRef */
export type SubjectConsentRefsMap = Record<string, BlockchainRef | undefined>;

export function useSubjectConsentRefs(recordId: string | null) {
  return useQuery<SubjectConsentRefsMap>({
    queryKey: ['backend-chain-parity', 'consent-refs', recordId],
    enabled: !!recordId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const db = getFirestore();
      const snap = await getDocs(
        query(collection(db, 'subjectConsentRequests'), where('recordId', '==', recordId))
      );
      const map: SubjectConsentRefsMap = {};
      for (const d of snap.docs) {
        const data = d.data();
        if (data.subjectId && data.blockchainRef) {
          map[data.subjectId as string] = data.blockchainRef as BlockchainRef;
        }
      }
      return map;
    },
  });
}
