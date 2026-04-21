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
import { FollowUpItem } from '../components/ui/FollowUpItems';
import { useReviewedByCurrentUser } from '@/features/Credibility/hooks/useVerifiedByCurrentUser';
import { LinkIcon, ShieldCheck, User, UserX } from 'lucide-react';
import SubjectQueryService from '@/features/Subject/services/subjectQueryService';
import { useInboundRequests } from '@/features/RequestRecord/hooks/usePendingInboundRequests';
import useAuth from '@/features/Auth/hooks/useAuth';
import { useSubjectAlerts } from '@/features/Subject/hooks/useSubjectAlerts';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

// ─── Options ─────────────────────────────────────────────────────────────────

export interface UseRecordFollowUpsOptions {
  refreshKey?: number;
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
  const recordId = fileItem.firestoreId ?? fileItem.id;

  // ── Check 1: Subject ───────────────────────────────────────────────────────

  // Also check if a consent request is already pending (request sent, not yet accepted)
  const [freshSubjects, setFreshSubjects] = useState<string[]>(fileItem.subjects ?? []);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [isLoadingPendingRequest, setIsLoadingPendingRequest] = useState(false);

  useEffect(() => {
    if (!isEligible) return;
    const db = getFirestore();
    getDoc(doc(db, 'records', recordId)).then(snap => {
      if (snap.exists()) setFreshSubjects(snap.data().subjects ?? []);
    });
  }, [isEligible, recordId, options?.refreshKey]);

  const hasSubject = freshSubjects.length > 0;

  const { hasPendingRejectionResponse, isLoading: isLoadingAlerts } = useSubjectAlerts({
    recordId,
  });

  // ── Check 2: Verification ─────────────────────────────────────────────────
  // Async — queries Firestore for an active verification or dispute doc
  // useReviewedByCurrentUser safely no-ops when record.recordHash is missing
  const { user } = useAuth();

  const isSubject = freshSubjects.includes(user?.uid || '');
  const isCreator = fileItem.uploadedBy === user?.uid;

  const {
    hasReviewed,
    reviewedCurrentVersion,
    isLoading: isLoadingReview,
  } = useReviewedByCurrentUser(fileItem);

  // ── Check 3: Linked request ───────────────────────────────────────────────
  const { requests: inboundRequests, loading: isLoadingRequests } = useInboundRequests();
  const hasPendingRequests = inboundRequests.some(r => r.status === 'pending');

  // ── Build list ────────────────────────────────────────────────────────────
  // Don't build anything until the record is eligible and async checks resolve
  const isLoading =
    isEligible &&
    (isLoadingReview || isLoadingPendingRequest || isLoadingRequests || isLoadingAlerts);

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

    if (hasPendingRejectionResponse) {
      items.push({
        id: 'subject-rejection',
        label: 'Respond to subject rejection',
        subtext: 'A subject has declined or removed themselves — review and decide how to proceed',
        icon: UserX,
        status: 'pending',
        ctaLabel: 'Review',
        onAction: () => onAction(fileItem, 'subject-rejection'),
      });
    }

    // Only show verification item if user is not the subject (they don't need to verify their own record)
    if (!isSubject) {
      if (!hasReviewed) {
        items.push({
          id: 'verify',
          label: 'Verify this record',
          subtext: 'Confirm the data looks correct',
          icon: ShieldCheck,
          status: 'pending',
          ctaLabel: 'Review',
          onAction: () => onAction(fileItem, 'verify'),
        });
      } else if (!reviewedCurrentVersion) {
        items.push({
          id: 'verify',
          label: 'Re-verify this record',
          subtext: 'This record has been edited since your last review',
          icon: ShieldCheck,
          status: 'pending',
          ctaLabel: 'Re-verify',
          onAction: () => onAction(fileItem, 'verify'),
        });
      }
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
