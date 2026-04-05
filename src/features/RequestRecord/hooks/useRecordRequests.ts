// src/features/RecordRequest/hooks/useRecordRequests.ts

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { RecordRequestService } from '../services/recordRequestService';
import { RecordRequest } from '../services/fulfillRequestService';

export type RequestFilter = 'active' | 'fulfilled' | 'all';

interface UseRecordRequestsReturn {
  requests: RecordRequest[];
  filtered: RecordRequest[];
  loading: boolean;
  error: string | null;
  filter: RequestFilter;
  setFilter: (f: RequestFilter) => void;
  refresh: () => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  resendRequest: (requestId: string) => Promise<void>;
  // Counts for stat cards
  counts: { pending: number; opened: number; fulfilled: number };
}

export function useRecordRequests(): UseRecordRequestsReturn {
  const [requests, setRequests] = useState<RecordRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RequestFilter>('active');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await RecordRequestService.getMyRequests();
      setRequests(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const cancelRequest = useCallback(async (requestId: string) => {
    try {
      await RecordRequestService.cancelRequest(requestId);
      // Optimistic update — reflect change immediately
      setRequests(prev =>
        prev.map(r => (r.inviteCode === requestId ? { ...r, status: 'cancelled' } : r))
      );
      toast.success('Request cancelled');
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel request');
    }
  }, []);

  const resendRequest = useCallback(async (requestId: string) => {
    try {
      await RecordRequestService.resendRequest(requestId);
      toast.success('Reminder email sent');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend email');
    }
  }, []);

  // Filtered list based on active tab
  const filtered = requests.filter(r => {
    if (filter === 'active') return r.status === 'pending';
    if (filter === 'fulfilled') return r.status === 'fulfilled';
    return true; // 'all'
  });

  // Stat card counts
  const counts = {
    pending: requests.filter(r => r.status === 'pending' && !r.readAt).length,
    opened: requests.filter(r => r.status === 'pending' && !!r.readAt).length,
    fulfilled: requests.filter(r => r.status === 'fulfilled').length,
  };

  return {
    requests,
    filtered,
    loading,
    error,
    filter,
    setFilter,
    refresh,
    cancelRequest,
    resendRequest,
    counts,
  };
}
