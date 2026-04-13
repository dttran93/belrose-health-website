// src/features/AddRecord/hooks/useRecordFollowUps.ts

/**
 * useRecordFollowUps
 *
 * Given any FileObject, returns a list of FollowUpItems that still need action.
 * Each item only appears when a real condition on the record is unmet:
 *
 *   - Subject:  fileItem.subjects is empty
 *   - Verify:   current user has no active verification or dispute (async Firestore check)
 *   - Request:  TODO — current user has open requests, should associate them?
 *
 * This hook is intentionally decoupled from any UI. Drop it anywhere you render
 * a FileObject and want to surface outstanding actions.
 *
 * Usage:
 *   const { followUpItems, isLoading } = useRecordFollowUps(fileItem, {
 *     onAction: (fileItem) => openReviewPanel(fileItem),
 *   });
 */

import { FileObject } from '@/types/core';
import React, { useEffect, useState } from 'react';
import { FollowUpItem } from '../components/FollowUpItems';
import { useReviewedByCurrentUser } from '@/features/Credibility/hooks/useVerifiedByCurrentUser';
import { LinkIcon, ShieldCheck, User } from 'lucide-react';
import SubjectQueryService from '@/features/Subject/services/subjectQueryService';
import { useInboundRequests } from '@/features/RequestRecord/hooks/usePendingInboundRequests';

// ─── Options ─────────────────────────────────────────────────────────────────

export interface UseRecordFollowUpsOptions {
  onAction: (fileItem: FileObject, itemId: string) => void;
}

// ─── Return type ─────────────────────────────────────────────────────────────

export interface UseRecordFollowUpsResult {
  /** The list of items that still need action. Empty = nothing to show. */
  followUpItems: FollowUpItem[];
  /**
   * True while async checks (e.g. verification lookup) are still resolving.
   * The list may grow once loading completes, so avoid rendering until false
   * if you don't want items appearing one-by-one.
   */
  isLoading: boolean;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRecordFollowUps(
  fileItem: FileObject,
  options: UseRecordFollowUpsOptions
): UseRecordFollowUpsResult {
  const { onAction } = options;

  // Only run async checks when the record is fully saved to Firestore
  const isEligible = fileItem.status === 'completed' && (!!fileItem.firestoreId || !!fileItem.id);

  // ── Check 1: Subject ───────────────────────────────────────────────────────
  // Synchronous — subjects array is already on the FileObject
  const hasSubject = (fileItem.subjects ?? []).length > 0;

  // Also check if a consent request is already pending (request sent, not yet accepted)
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [isLoadingPendingRequest, setIsLoadingPendingRequest] = useState(false);

  useEffect(() => {
    if (!isEligible || hasSubject) return; // no need to check if subject already set

    const recordId = fileItem.firestoreId ?? fileItem.id;
    setIsLoadingPendingRequest(true);

    SubjectQueryService.getPendingConsentRequestsForRecord(recordId)
      .then(requests => setHasPendingRequest(requests.length > 0))
      .catch(() => setHasPendingRequest(false))
      .finally(() => setIsLoadingPendingRequest(false));
  }, [isEligible, hasSubject, fileItem.firestoreId, fileItem.id]);

  // Add isLoadingPendingRequest to the overall loading state

  // ── Check 2: Verification ─────────────────────────────────────────────────
  // Async — queries Firestore for an active verification or dispute doc
  // useReviewedByCurrentUser safely no-ops when record.recordHash is missing
  const { hasReviewed, isLoading: isLoadingReview } = useReviewedByCurrentUser(fileItem);

  // ── Check 3: Linked request ───────────────────────────────────────────────
  const { requests: inboundRequests, loading: isLoadingRequests } = useInboundRequests();
  const hasPendingRequests = inboundRequests.some(r => r.status === 'pending');

  // ── Build list ────────────────────────────────────────────────────────────
  // Don't build anything until the record is eligible and async checks resolve
  const isLoading = isEligible && (isLoadingReview || isLoadingPendingRequest || isLoadingRequests);

  const followUpItems = React.useMemo<FollowUpItem[]>(() => {
    if (!isEligible || isLoading) return [];

    const items: FollowUpItem[] = [];

    if (!hasSubject && !hasPendingRequest) {
      items.push({
        id: 'subject',
        label: 'Tag a subject',
        subtext:
          'A subject has not been set. Click here to officially link this record to its subject.',
        icon: User,
        status: 'pending',
        ctaLabel: 'Send request',
        onAction: () => onAction(fileItem, 'subject'),
      });
    }

    if (!hasReviewed) {
      items.push({
        id: 'verify',
        label: 'Review this record',
        subtext:
          'Credibility of records is vital for future doctors and users of this data. Please review the record and submit a verification or dispute.',
        icon: ShieldCheck,
        status: 'pending',
        ctaLabel: 'Review',
        onAction: () => onAction(fileItem, 'verify'),
      });
    }

    if (hasPendingRequests) {
      items.push({
        id: 'link-request',
        label: 'Relate to a request',
        subtext: 'You have open requests. Link this record to a relevant request.',
        icon: LinkIcon,
        status: 'pending',
        ctaLabel: 'Link',
        onAction: () => onAction(fileItem, 'link-request'),
      });
    }

    return items;
  }, [isEligible, isLoading, hasSubject, hasReviewed, hasPendingRequests, fileItem, onAction]);

  return { followUpItems, isLoading };
}

export default useRecordFollowUps;
