//src/features/Subject/services/subjectBlockchainService.ts

/**
 * This service owns all of the consent state management including:
 * - Creating/Accepting/Rejection/Canceling consent requests
 * - Enforcing valid state transitions
 *
 *  This is the KEY state management for the Subject feature. Everything builds off of
 *  the state of consents.
 */

import {
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  CreatorResponseStatus,
  SubjectRejectionData,
  SubjectRejectionType,
} from './subjectRejectionService';

export type SubjectRequestStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Document structure for subjectConsentRequests collection
 * Document ID format: {recordId}_{targetUserId}
 */
export interface SubjectConsentRequest {
  recordId: string;
  subjectId: string;
  requestedBy: string;
  requestedSubjectRole: 'viewer' | 'administrator' | 'owner';
  status: SubjectRequestStatus;
  createdAt: Timestamp;
  respondedAt?: Timestamp;
  recordTitle?: string;
  grantedAccessOnSubjectRequest: boolean;
  rejection?: SubjectRejectionData;
}

/**
 * Generate the document ID for a consent request
 * Format: {recordId}_{targetUserId}
 */
export const getConsentRequestId = (recordId: string, subjectId: string): string => {
  return `${recordId}_${subjectId}`;
};

export class SubjectConsentService {
  // ============================================================================
  // CREATE
  // ============================================================================

  static async requestConsent(params: {
    recordId: string;
    subjectId: string;
    requestedBy: string;
    requestedSubjectRole: 'viewer' | 'administrator' | 'owner';
    recordTitle: string;
  }): Promise<{ requestId: string }> {
    const db = getFirestore();
    const requestId = getConsentRequestId(params.recordId, params.subjectId);
    const requestRef = doc(db, 'subjectConsentRequests', requestId);

    const existing = await getDoc(requestRef);

    if (existing.exists()) {
      const status = existing.data().status as SubjectRequestStatus;
      if (status === 'pending') {
        throw new Error('A pending consent request already exists');
      }
    }

    const consentRequest: SubjectConsentRequest = {
      recordId: params.recordId,
      subjectId: params.subjectId,
      requestedBy: params.requestedBy,
      requestedSubjectRole: params.requestedSubjectRole,
      status: 'pending',
      createdAt: Timestamp.now(),
      recordTitle: params.recordTitle,
      grantedAccessOnSubjectRequest: false,
    };

    await setDoc(requestRef, consentRequest);

    return { requestId };
  }

  // ============================================================================
  // ACCEPT
  // ============================================================================

  static async acceptConsent(recordId: string, subjectId: string): Promise<void> {
    const db = getFirestore();
    const requestRef = doc(db, 'subjectConsentRequests', getConsentRequestId(recordId, subjectId));
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error('Consent request not found');
    }

    const data = requestDoc.data() as SubjectConsentRequest;

    if (data.status !== 'pending') {
      throw new Error(`Cannot accept consent in status: ${data.status}`);
    }

    await updateDoc(requestRef, {
      status: 'accepted',
      respondedAt: Timestamp.now(),
    });
  }

  // ============================================================================
  // REJECT (PRE-ACCEPT)
  // ============================================================================

  static async rejectConsent(recordId: string, subjectId: string, reason?: string): Promise<void> {
    const db = getFirestore();
    const requestRef = doc(db, 'subjectConsentRequests', getConsentRequestId(recordId, subjectId));
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error('Consent request not found');
    }

    const data = requestDoc.data() as SubjectConsentRequest;

    if (data.status !== 'pending') {
      throw new Error(`Cannot reject consent in status: ${data.status}`);
    }

    await updateDoc(requestRef, {
      status: 'rejected',
      respondedAt: Timestamp.now(),
      rejection: {
        rejectionType: 'request_rejected' as SubjectRejectionType,
        rejectedAt: Timestamp.now(),
        ...(reason && { reason }),
        creatorResponse: {
          status: 'pending_creator_decision' as CreatorResponseStatus,
        },
      },
    });
  }

  // ============================================================================
  // CANCEL
  // ============================================================================

  static async cancelConsent(recordId: string, subjectId: string): Promise<void> {
    const db = getFirestore();
    const requestRef = doc(db, 'subjectConsentRequests', getConsentRequestId(recordId, subjectId));
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      return;
    }

    if (requestDoc.data().status !== 'pending') {
      throw new Error('Only pending consent requests can be cancelled');
    }

    await deleteDoc(requestRef);
  }
}
