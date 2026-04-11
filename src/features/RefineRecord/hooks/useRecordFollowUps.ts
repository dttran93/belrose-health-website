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
import React from 'react';
import { FollowUpItem } from '../components/FollowUpItems';
import { useReviewedByCurrentUser } from '@/features/Credibility/hooks/useVerifiedByCurrentUser';
import { LinkIcon, ShieldCheck, User } from 'lucide-react';

// ─── Options ─────────────────────────────────────────────────────────────────

export interface UseRecordFollowUpsOptions {
  onAction: (fileItem: FileObject) => void;
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
  const isEligible = fileItem.status === 'completed' && !!fileItem.firestoreId;

  // ── Check 1: Subject ───────────────────────────────────────────────────────
  // Synchronous — subjects array is already on the FileObject
  const hasSubject = (fileItem.subjects ?? []).length > 0;

  // ── Check 2: Verification ─────────────────────────────────────────────────
  // Async — queries Firestore for an active verification or dispute doc
  // useReviewedByCurrentUser safely no-ops when record.recordHash is missing
  const { hasReviewed, isLoading: isLoadingReview } = useReviewedByCurrentUser(fileItem);

  // ── Check 3: Linked request ───────────────────────────────────────────────
  // TODO: swap `true` for `!fileItem.linkedRequestId` once that field is added
  // to FileObject. The RequestRecord feature stores fulfilledRecordId on the
  // request side, so you'll want a field on the record pointing back.
  const needsLinkedRequest = true;

  // ── Build list ────────────────────────────────────────────────────────────
  // Don't build anything until the record is eligible and async checks resolve
  const isLoading = isEligible && isLoadingReview;

  const followUpItems = React.useMemo<FollowUpItem[]>(() => {
    if (!isEligible || isLoading) return [];

    const items: FollowUpItem[] = [];

    if (!hasSubject) {
      items.push({
        id: 'subject',
        label: 'Tag a subject',
        subtext:
          'A subject has not been set. Click here to officially link this record to its subject.',
        icon: User,
        status: 'pending',
        ctaLabel: 'Send request',
        onAction: () => onAction(fileItem),
      });
    }

    if (!hasReviewed) {
      items.push({
        id: 'verify',
        label: 'Verify this record',
        subtext:
          'Credibility of records is vital for future doctors and users of this data. Please review the record and submit a verification or dispute.',
        icon: ShieldCheck,
        status: 'pending',
        ctaLabel: 'Review',
        onAction: () => onAction(fileItem),
      });
    }

    if (needsLinkedRequest) {
      items.push({
        id: 'link-request',
        label: 'Relate to a request',
        subtext: 'You have open requests. Link this record to a relevant request.',
        icon: LinkIcon,
        status: 'pending',
        ctaLabel: 'Link',
        onAction: () => onAction(fileItem),
      });
    }

    return items;
  }, [isEligible, isLoading, hasSubject, hasReviewed, needsLinkedRequest, fileItem, onAction]);

  return { followUpItems, isLoading };
}

export default useRecordFollowUps;
