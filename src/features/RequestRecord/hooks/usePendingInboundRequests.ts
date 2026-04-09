// src/features/RecordRequest/hooks/useInboundRequests.ts

import { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { RecordRequest } from '../services/fulfillRequestService';

interface UseInboundRequestsReturn {
  requests: RecordRequest[];
  filtered: RecordRequest[];
  loading: boolean;
  error: string | null;
  filter: InboundRequestFilter;
  setFilter: (f: InboundRequestFilter) => void;
  refresh: () => Promise<void>;
  counts: { pending: number; fulfilled: number };
}

export type InboundRequestFilter = 'pending' | 'fulfilled' | 'all';

export function useInboundRequests(): UseInboundRequestsReturn {
  const { user } = useAuthContext();
  const [requests, setRequests] = useState<RecordRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboundRequestFilter>('pending');

  const refresh = useCallback(async () => {
    if (!user?.uid || !user?.email) return;

    const db = getFirestore();
    setLoading(true);
    setError(null);

    try {
      // Query both by userId and email — covers the case where a guest
      // later registers as a full user (targetUserId gets set) but also
      // catches any legacy docs that only have targetEmail
      const [byIdSnap, byEmailSnap] = await Promise.all([
        getDocs(query(collection(db, 'recordRequests'), where('targetUserId', '==', user.uid))),
        getDocs(query(collection(db, 'recordRequests'), where('targetEmail', '==', user.email))),
      ]);

      // Deduplicate by document ID
      const docsById = new Map<string, RecordRequest>();
      [...byIdSnap.docs, ...byEmailSnap.docs].forEach(d => {
        docsById.set(d.id, { ...d.data(), inviteCode: d.id } as RecordRequest);
      });

      // Sort newest first client-side (avoids needing a composite index)
      const sorted = Array.from(docsById.values()).sort(
        (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()
      );

      setRequests(sorted);
    } catch (err: any) {
      setError(err.message || 'Failed to load incoming requests');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, user?.email]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = requests.filter(r => {
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'fulfilled') return r.status === 'fulfilled';
    return true;
  });

  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    fulfilled: requests.filter(r => r.status === 'fulfilled').length,
  };

  return { requests, filtered, loading, error, filter, setFilter, refresh, counts };
}
