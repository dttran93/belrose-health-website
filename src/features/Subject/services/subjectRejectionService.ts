//src/features/Subject/services/subjectRejectionService.ts

/*
 * This service manages the subject Rejection lifecycle including responses from the requestor
 * - Updating the subjectConsentRequest with a rejection
 * - Manage response from creator
 */

import { doc, getDoc, getFirestore, Timestamp, updateDoc } from 'firebase/firestore';
import { RespondToRejectionResult } from './subjectService';
import { getAuth } from 'firebase/auth';
import { SubjectConsentRequest } from './subjectConsentService';

export type SubjectRejectionType = 'request_rejected' | 'removed_after_acceptance';

export type CreatorResponseStatus = 'pending_creator_decision' | 'dropped' | 'escalated';

export type RejectionReasons =
  | 'identity_mismatch'
  | 'content_dispute'
  | 'privacy'
  | 'duplicate'
  | 'other';

export const REJECTION_REASON_OPTIONS: { value: RejectionReasons; label: string }[] = [
  { value: 'identity_mismatch', label: 'I am not the person listed as the subject' },
  { value: 'content_dispute', label: "I am this person, but I don't recognize this content" },
  {
    value: 'privacy',
    label: 'I recognize this content, but prefer not to be listed for privacy reasons',
  },
  { value: 'duplicate', label: 'This is a duplicate request' },
  { value: 'other', label: 'Other reason' },
];

/**
 * Creator's response to a subject rejection
 * Nested within SubjectConsentRequest.rejection
 */
export interface CreatorResponse {
  status: CreatorResponseStatus;
  lastModified?: Timestamp;
}

/**
 * Rejection data - nested within SubjectConsentRequest
 * Only populated when a subject removes themselves AFTER accepting
 */
export interface SubjectRejectionData {
  rejectionType: SubjectRejectionType;
  rejectedAt: Timestamp;
  reason: RejectionReasons;
  creatorResponse?: CreatorResponse;
}

export class SubjectRejectionService {
  // ============================================================================
  // SUBJECT REMOVAL AFTER CONSENT
  // ============================================================================

  /**
   * Handle a subject removing themselves after previously accepting consent
   */
  static async rejectAfterAcceptance(params: {
    recordId: string;
    subjectId: string;
    reason: RejectionReasons;
    signature?: string;
  }): Promise<SubjectRejectionData> {
    const { recordId, subjectId, reason, signature } = params;
    const db = getFirestore();

    const requestId = `${recordId}_${subjectId}`;
    const requestRef = doc(db, 'subjectConsentRequests', requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error('Consent request not found');
    }

    const requestData = requestDoc.data() as SubjectConsentRequest;

    if (requestData.status !== 'accepted') {
      throw new Error('Rejection is only allowed after acceptance');
    }

    const rejectionData: SubjectRejectionData = {
      rejectionType: 'removed_after_acceptance' as SubjectRejectionType,
      rejectedAt: Timestamp.now(),
      reason,
      creatorResponse: {
        status: 'pending_creator_decision',
      },
    };

    await updateDoc(requestRef, {
      rejection: rejectionData,
    });

    return rejectionData;
  }

  // ============================================================================
  // CREATOR RESPONSE
  // ============================================================================

  /**
   * Creator responds to a subject rejection
   */
  static async respondToRejection(
    recordId: string,
    subjectId: string,
    response: CreatorResponseStatus
  ): Promise<RespondToRejectionResult> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const recordRef = doc(db, 'records', recordId);
    const recordDoc = await getDoc(recordRef);

    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();
    const canRespond =
      recordData.uploadedBy === user.uid ||
      recordData.owners?.includes(user.uid) ||
      recordData.administrators?.includes(user.uid);

    if (!canRespond) {
      throw new Error(
        'Only the record creator, owners, or administrators can respond to rejections'
      );
    }

    const requestId = `${recordId}_${subjectId}`;
    const requestRef = doc(db, 'subjectConsentRequests', requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error('Consent request not found');
    }

    const requestData = requestDoc.data() as SubjectConsentRequest;

    if (!requestData.rejection) {
      throw new Error('No rejection found for this subject');
    }

    if (requestData.rejection.creatorResponse?.status !== 'pending_creator_decision') {
      throw new Error('This rejection has already been responded to');
    }

    const creatorResponse: CreatorResponse = {
      status: response,
      lastModified: Timestamp.now(),
    };

    await updateDoc(requestRef, {
      'rejection.creatorResponse': creatorResponse,
    });

    return {
      success: true,
      recordId,
      subjectId,
      response,
    };
  }
}
