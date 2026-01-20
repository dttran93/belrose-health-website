// features/Subject/services/subjectRemovalService.ts

/**
 * SubjectRemovalService
 *
 * Handles the consent-based flow for removing subjects from records.
 *
 * This service exists because subjects have sovereignty over their blockchain
 * anchoring - only they can unanchor themselves. When an owner/admin wants
 * a subject removed, they must REQUEST removal rather than force it.
 *
 * Flow:
 * 1. Owner/admin creates a removal request
 * 2. Subject receives notification
 * 3. Subject accepts (removes self + unanchors) or rejects (stays as subject)
 *
 * This keeps Firestore and blockchain in sync, maintaining data integrity.
 */

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import SubjectPermissionService from './subjectPermissionService';
import { FileObject } from '@/types/core';

// ============================================================================
// TYPES
// ============================================================================

export type RemovalRequestStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Document structure for subjectRemovalRequests collection
 * Document ID format: {recordId}_{subjectId}
 */
export interface SubjectRemovalRequest {
  recordId: string;
  subjectId: string;
  requestedBy: string;
  reason?: string;
  status: RemovalRequestStatus;
  createdAt: Timestamp;
  respondedAt?: Timestamp;
  subjectResponse?: string; // If they reject, why?
  recordTitle?: string;
}

export interface RequestRemovalResult {
  success: boolean;
  recordId: string;
  subjectId: string;
  requestId: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate the document ID for a removal request
 * Format: {recordId}_{subjectId}
 *
 * This mirrors the consent request ID format for consistency
 */
export const getRemovalRequestId = (recordId: string, subjectId: string): string => {
  return `${recordId}_${subjectId}`;
};

export class SubjectRemovalService {
  // ============================================================================
  // REQUEST METHODS (Called by owner/admin)
  // ============================================================================

  /**
   * Request a subject to remove themselves from a record
   *
   * Called by record owner/admin when they want a subject removed.
   * Creates a pending request that the subject must respond to.
   *
   * @param recordId - The Firestore document ID of the record
   * @param subjectId - The userId of the subject to request removal from
   * @param reason - Optional reason for the removal request
   */
  static async requestRemoval(
    recordId: string,
    subjectId: string,
    reason?: string
  ): Promise<RequestRemovalResult> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Can't request your own removal through this flow
    if (subjectId === user.uid) {
      throw new Error('Use rejectSubjectStatus to remove yourself as a subject');
    }

    console.log('📨 Requesting subject removal:', { recordId, subjectId });

    try {
      // Step 1: Verify record exists and user has permission
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      const recordData = {
        id: recordDoc.id,
        ...recordDoc.data(),
      } as FileObject;

      // Permission check: use the same logic as removing subjects
      // (owners only, or admins if no owners exist)
      if (!SubjectPermissionService.canRemoveSubject(recordData, user.uid)) {
        throw new Error('You do not have permission to request subject removal');
      }

      // Step 2: Verify the target is actually a subject
      const subjects: string[] = recordData.subjects || [];
      if (!subjects.includes(subjectId)) {
        throw new Error('This user is not a subject of this record');
      }

      // Step 3: Check if a pending request already exists
      const requestId = getRemovalRequestId(recordId, subjectId);
      const requestRef = doc(db, 'subjectRemovalRequests', requestId);
      const existingRequest = await getDoc(requestRef);

      if (existingRequest.exists()) {
        const data = existingRequest.data();
        if (data.status === 'pending') {
          throw new Error('A pending removal request already exists for this subject');
        }
      }

      // Step 4: Create the removal request document
      const removalRequest: SubjectRemovalRequest = {
        recordId,
        subjectId,
        requestedBy: user.uid,
        reason: reason || '',
        status: 'pending',
        createdAt: Timestamp.now(),
        recordTitle: recordData.belroseFields?.title || recordData.fileName || 'Untitled Record',
      };

      await setDoc(requestRef, removalRequest);

      console.log('✅ Subject removal request created:', requestId);

      return {
        success: true,
        recordId,
        subjectId,
        requestId,
      };
    } catch (error) {
      console.error('❌ Error requesting subject removal:', error);
      throw error;
    }
  }

  /**
   * Cancel a pending removal request
   *
   * Called by the owner/admin to cancel a request they sent.
   *
   * @param recordId - The Firestore document ID of the record
   * @param subjectId - The userId of the subject
   */
  static async cancelRequest(recordId: string, subjectId: string): Promise<{ success: boolean }> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('🚫 Canceling removal request:', { recordId, subjectId });

    try {
      const requestId = getRemovalRequestId(recordId, subjectId);
      const requestRef = doc(db, 'subjectRemovalRequests', requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error('No removal request found');
      }

      const requestData = requestDoc.data() as SubjectRemovalRequest;

      // Verify it's still pending
      if (requestData.status !== 'pending') {
        throw new Error(`Request has already been ${requestData.status}`);
      }

      // Verify user has permission (must be the one who requested, or an owner/admin)
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      const recordData = {
        id: recordDoc.id,
        ...recordDoc.data(),
      } as FileObject;

      // Can cancel if you're the original requester OR have cancel permissions
      const canCancel =
        requestData.requestedBy === user.uid ||
        SubjectPermissionService.canCancelRequest(recordData, user.uid);

      if (!canCancel) {
        throw new Error('You do not have permission to cancel this request');
      }

      // Delete the request document
      await deleteDoc(requestRef);

      console.log('✅ Removal request canceled');

      return { success: true };
    } catch (error) {
      console.error('❌ Error canceling removal request:', error);
      throw error;
    }
  }

  // ============================================================================
  // RESPONSE METHODS (Called by subject)
  // ============================================================================

  /**
   * Accept a removal request
   *
   * Called by the subject to agree to be removed.
   * This updates the request status but does NOT actually remove the subject -
   * that should be handled by calling SubjectService.rejectSubjectStatus()
   * which handles both Firestore removal and blockchain unanchoring.
   *
   * @param recordId - The Firestore document ID of the record
   * @returns The updated request data
   */
  static async acceptRemoval(
    recordId: string
  ): Promise<{ success: boolean; requestData: SubjectRemovalRequest }> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('✅ Accepting removal request for record:', recordId);

    try {
      const requestId = getRemovalRequestId(recordId, user.uid);
      const requestRef = doc(db, 'subjectRemovalRequests', requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error('No removal request found for you');
      }

      const requestData = requestDoc.data() as SubjectRemovalRequest;

      if (requestData.status !== 'pending') {
        throw new Error(`Request has already been ${requestData.status}`);
      }

      if (requestData.subjectId !== user.uid) {
        throw new Error('This request is not for you');
      }

      // Update the request status
      await updateDoc(requestRef, {
        status: 'accepted',
        respondedAt: Timestamp.now(),
      });

      console.log('✅ Removal request accepted');

      // Return the request data so the caller can proceed with actual removal
      return {
        success: true,
        requestData: {
          ...requestData,
          status: 'accepted',
          respondedAt: Timestamp.now(),
        },
      };
    } catch (error) {
      console.error('❌ Error accepting removal request:', error);
      throw error;
    }
  }

  /**
   * Reject a removal request
   *
   * Called by the subject to decline being removed.
   * The subject remains as a subject of the record.
   *
   * @param recordId - The Firestore document ID of the record
   * @param response - Optional reason for rejecting the removal
   */
  static async rejectRemoval(recordId: string, response?: string): Promise<{ success: boolean }> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('❌ Rejecting removal request for record:', recordId);

    try {
      const requestId = getRemovalRequestId(recordId, user.uid);
      const requestRef = doc(db, 'subjectRemovalRequests', requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error('No removal request found for you');
      }

      const requestData = requestDoc.data() as SubjectRemovalRequest;

      if (requestData.status !== 'pending') {
        throw new Error(`Request has already been ${requestData.status}`);
      }

      if (requestData.subjectId !== user.uid) {
        throw new Error('This request is not for you');
      }

      // Update the request status
      await updateDoc(requestRef, {
        status: 'rejected',
        respondedAt: Timestamp.now(),
        subjectResponse: response,
      });

      console.log('✅ Removal request rejected');

      return { success: true };
    } catch (error) {
      console.error('❌ Error rejecting removal request:', error);
      throw error;
    }
  }
}

export default SubjectRemovalService;
