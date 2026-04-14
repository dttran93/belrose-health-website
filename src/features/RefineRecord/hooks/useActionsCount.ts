// src/features/RefineRecord/hooks/useActionsCount.ts

/**
 * useActionsCount
 *
 * Returns the total number of records with outstanding follow-up actions,
 * used to drive the badge on the QuickActions activity button and the
 * Actions tab in ActivityHub.
 *
 * Architecture note: we can't call useRecordFollowUps in a loop, so we
 * replicate the lightweight synchronous checks here:
 *   - subject missing
 *   - no verification (proxied via credibility.score === 0 or undefined)
 *   - pending inbound requests
 *   - pending rejection responses (async, owned records only)
 *
 * The credibility proxy (score > 0 = has been verified at some point) avoids
 * per-record Firestore reads. It's not perfectly accurate but good enough for
 * a badge count.
 *
 * TODO: replace the credibility proxy with a denormalized `hasVerification`
 * boolean on FileObject once that field exists on the record document.
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { useUserRecords } from '@/features/ViewEditRecord/hooks/useUserRecords';
import SubjectQueryService from '@/features/Subject/services/subjectQueryService';
import { useInboundRequests } from '@/features/RequestRecord/hooks/usePendingInboundRequests';

export function useActionsCount(): { count: number; isLoading: boolean } {
  const { user } = useAuthContext();
  const { records, loading: recordsLoading } = useUserRecords(user?.uid, { filterType: 'all' });
  const { requests: inboundRequests, loading: requestsLoading } = useInboundRequests();

  const [rejectionCount, setRejectionCount] = useState(0);
  const [rejectionLoading, setRejectionLoading] = useState(false);

  // Fetch pending rejection responses for records the user owns/uploaded
  const fetchRejectionCounts = useCallback(async () => {
    if (!records.length || !user?.uid) return;

    const ownedRecords = records.filter(
      r => r.uploadedBy === user.uid || (r.owners ?? []).includes(user.uid)
    );

    if (!ownedRecords.length) {
      setRejectionCount(0);
      return;
    }

    setRejectionLoading(true);
    try {
      const counts = await Promise.all(
        ownedRecords.map(async r => {
          const recordId = r.firestoreId ?? r.id;
          const alerts = await SubjectQueryService.getPendingRejectionResponses(recordId);
          return alerts.length;
        })
      );
      setRejectionCount(counts.reduce((sum, n) => sum + n, 0));
    } catch {
      setRejectionCount(0);
    } finally {
      setRejectionLoading(false);
    }
  }, [records, user?.uid]);

  useEffect(() => {
    if (!recordsLoading) fetchRejectionCounts();
  }, [recordsLoading, fetchRejectionCounts]);

  if (recordsLoading || requestsLoading) {
    return { count: 0, isLoading: true };
  }

  // ── Synchronous counts ────────────────────────────────────────────────────
  // Count records (not items) that have at least one outstanding action.
  // One record = one count, regardless of how many items it has.

  const hasPendingInboundRequests = inboundRequests.some(r => r.status === 'pending');

  let count = 0;

  for (const record of records) {
    const isSubject = (record.subjects ?? []).includes(user?.uid ?? '');
    let recordNeedsAttention = false;

    // Subject missing
    if ((record.subjects ?? []).length === 0) {
      recordNeedsAttention = true;
    }

    // No verification ever — proxy: credibility score absent or zero
    // Skip for subjects — being a subject is their verification signal
    if (!isSubject && !(record.credibility?.score && record.credibility.score > 0)) {
      recordNeedsAttention = true;
    }

    // User has pending inbound requests that could be linked
    if (hasPendingInboundRequests) {
      recordNeedsAttention = true;
    }

    if (recordNeedsAttention) count++;
  }

  // Add rejection responses (async, already a record-level count)
  count += rejectionCount;

  return { count, isLoading: rejectionLoading };
}
