// features/Subject/services/subjectService.ts

/**
 * SubjectService
 *
 * Handles all Firestore operations related to record subjects:
 * - Setting yourself as subject (immediate, no consent needed)
 * - Requesting someone else to be subject (requires their consent)
 * - Rejecting/removing subject status (unified flow)
 * - Creator response to rejections
 *
 * Notifications are handled with functions/notifications/triggers -->
 * automatically send notifications for any updates within the records collections
 *
 * Blockchain integration (signature verification, anchoring) is handled
 * separately in subjectBlockchainService.ts
 */

import {
  getFirestore,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  getDoc,
  Timestamp,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// ============================================================================
// TYPES
// ============================================================================

export type SubjectRequestStatus = 'pending' | 'accepted' | 'rejected';
export type SubjectRejectionType = 'request_rejected' | 'removed_after_acceptance' | 'self_removal';
export type SubjectRejectionStatus =
  | 'pending_creator_decision'
  | 'acknowledged'
  | 'publicly_listed';

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
}

export interface SubjectRejection {
  subjectId: string;
  rejectionType: SubjectRejectionType;
  rejectedAt: Timestamp;
  reason?: string;

  // Creator's response
  status: SubjectRejectionStatus;
  creatorRespondedAt?: Timestamp;
  publiclyListed: boolean;

  // Audit trail
  originalConsentSignature?: string;
  rejectionSignature?: string;
}

export interface SetSubjectSelfResult {
  success: boolean;
  recordId: string;
  subjectId: string;
}

export interface RequestSubjectConsentResult {
  success: boolean;
  recordId: string;
  subjectId: string;
  requestId?: string;
}

export interface AcceptSubjectRequestResult {
  success: boolean;
  recordId: string;
  accepted: boolean;
  signature?: string;
}

export interface RejectSubjectStatusResult {
  success: boolean;
  recordId: string;
  rejectionType: SubjectRejectionType;
  pendingCreatorDecision: boolean;
}

export interface RespondToRejectionResult {
  success: boolean;
  recordId: string;
  subjectId: string;
  publiclyListed: boolean;
}

export interface IncomingSubjectRequest {
  id: string;
  recordId: string;
  recordTitle?: string;
  requestedBy: string;
  requestedSubjectRole: 'viewer' | 'administrator' | 'owner';
  requestedAt: Timestamp;
  status: SubjectRequestStatus;
}

/**
 * Generate the document ID for a consent request
 * Format: {recordId}_{targetUserId}
 */
const getConsentRequestId = (recordId: string, subjectId: string): string => {
  return `${recordId}_${subjectId}`;
};

export class SubjectService {
  /**
   * Set the current user as the subject of a record
   *
   * This is immediate - no consent flow needed when you're claiming
   * a record is about yourself.
   *
   * @param recordId - The Firestore document ID of the record
   */
  static async setSubjectAsSelf(recordId: string): Promise<SetSubjectSelfResult> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('👤 Setting subject as self for record:', recordId);

    try {
      const recordRef = doc(db, 'records', recordId);

      const recordDoc = await getDoc(recordRef);
      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      const recordData = recordDoc.data();
      const canModify =
        recordData.uploadedBy === user.uid ||
        recordData.owners?.includes(user.uid) ||
        recordData.administrators?.includes(user.uid);

      if (!canModify) {
        throw new Error('You do not have permission to modify this record');
      }

      if (recordData.subjects?.includes(user.uid)) {
        console.log('✓ User is already a subject of this record');
        return {
          success: true,
          recordId,
          subjectId: user.uid,
        };
      }

      await updateDoc(recordRef, {
        subjects: arrayUnion(user.uid),
        lastModified: serverTimestamp(),
      });

      console.log('✅ Successfully set self as subject');

      return {
        success: true,
        recordId,
        subjectId: user.uid,
      };
    } catch (error) {
      console.error('❌ Error setting subject as self:', error);
      throw error;
    }
  }

  /**
   * Request another user to confirm they are the subject of a record
   *
   * This creates a pending request that the target user must accept.
   * The record is NOT updated until they accept.
   *
   * @param recordId - The Firestore document ID of the record
   * @param subjectId - The userId of the proposed subject
   */
  static async requestSubjectConsent(
    recordId: string,
    subjectId: string,
    options?: {
      role?: 'viewer' | 'administrator' | 'owner';
      recordTitle?: string;
    }
  ): Promise<RequestSubjectConsentResult> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    if (subjectId === user.uid) {
      const result = await this.setSubjectAsSelf(recordId);
      return {
        success: result.success,
        recordId,
        subjectId,
        requestId: getConsentRequestId(recordId, subjectId),
      };
    }

    console.log('📨 Requesting subject consent:', { recordId, subjectId });

    try {
      const recordRef = doc(db, 'records', recordId);

      const recordDoc = await getDoc(recordRef);
      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      const recordData = recordDoc.data();
      const canModify =
        recordData.uploadedBy === user.uid ||
        recordData.owners?.includes(user.uid) ||
        recordData.administrators?.includes(user.uid);

      if (!canModify) {
        throw new Error('You do not have permission to modify this record');
      }

      if (recordData.subjects?.includes(subjectId)) {
        throw new Error('This user is already a subject of this record');
      }

      //Check if a pending request already exists
      const requestId = getConsentRequestId(recordId, subjectId);
      const requestRef = doc(db, 'subjectConsentRequests', requestId);
      const existingRequest = await getDoc(requestRef);

      if (existingRequest.exists()) {
        const data = existingRequest.data();
        if (data.status === 'pending') {
          throw new Error('A pending request already exists for this user');
        }
      }

      //Create new consent request document
      const consentRequest: SubjectConsentRequest = {
        recordId,
        subjectId,
        requestedBy: user.uid,
        requestedSubjectRole: options?.role || 'viewer',
        status: 'pending',
        createdAt: Timestamp.now(),
        recordTitle:
          options?.recordTitle ||
          recordData.belroseFields?.title ||
          recordData.fileName ||
          'Untitled Record',
      };

      await setDoc(requestRef, consentRequest);

      console.log('✅ Subject consent request created:', requestId);

      return {
        success: true,
        recordId,
        subjectId: subjectId,
        requestId,
      };
    } catch (error) {
      console.error('❌ Error requesting subject consent:', error);
      throw error;
    }
  }

  /**
   * Accept a pending subject request
   *
   * Called by the proposed subject to confirm they are indeed
   * the subject of the record.
   *
   * @param recordId - The Firestore document ID of the record
   * @param signature - Optional wallet signature for blockchain verification
   */
  static async acceptSubjectRequest(
    recordId: string,
    signature?: string
  ): Promise<AcceptSubjectRequestResult> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('✅ Accepting subject request for record:', recordId);

    try {
      //Step 1: Find and update the consent request
      const requestId = getConsentRequestId(recordId, user.uid);
      const requestRef = doc(db, 'subjectConsentRequests', requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error('No pending subject request found for you');
      }

      const requestData = requestDoc.data() as SubjectConsentRequest;

      if (requestData.status !== 'pending') {
        throw new Error(`Request has already been ${requestData.status}`);
      }

      if (requestData.subjectId !== user.uid) {
        throw new Error('This request is not for you');
      }

      // Step 2: Update the consent request status
      await updateDoc(requestRef, {
        status: 'accepted',
        respondedAt: Timestamp.now(),
      });

      console.log('✅ Consent request updated to accepted');

      // Step 3: Add user to record's subjects array
      const recordRef = doc(db, 'records', recordId);
      await updateDoc(recordRef, {
        subjects: arrayUnion(user.uid),
        lastModified: serverTimestamp(),
      });

      console.log('✅ User added to record subjects');

      return {
        success: true,
        recordId,
        accepted: true,
        signature,
      };
    } catch (error) {
      console.error('❌ Error accepting subject request:', error);
      throw error;
    }
  }

  /**
   * Reject a pending subject request
   *
   * Called by the proposed subject to decline being set as subject.
   *
   * @param recordId - The Firestore document ID of the record
   * @param reason - Optional reason for rejection
   */
  static async rejectSubjectRequest(
    recordId: string,
    reason?: string
  ): Promise<{ success: boolean; recordId: string }> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('❌ Rejecting subject request for record:', recordId);

    try {
      const requestId = getConsentRequestId(recordId, user.uid);
      const requestRef = doc(db, 'subjectConsentRequests', requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error('No pending subject request found for you');
      }

      const requestData = requestDoc.data() as SubjectConsentRequest;

      if (requestData.status !== 'pending') {
        throw new Error(`Request has already been ${requestData.status}`);
      }

      if (requestData.subjectId !== user.uid) {
        throw new Error('This request is not for you');
      }

      // Update the consent request status
      await updateDoc(requestRef, {
        status: 'rejected',
        respondedAt: Timestamp.now(),
      });

      console.log('✅ Subject request rejected');

      return {
        success: true,
        recordId,
      };
    } catch (error) {
      console.error('❌ Error rejecting subject request:', error);
      throw error;
    }
  }

  /**
   * Reject or remove subject status (self-removal flow)
   *
   * Unified function that handles:
   * - Self-removal by owner/admin (added themselves, no consent flow)
   * - Removing oneself as subject (previously accepted via consent)
   *
   * In consent flow cases:
   * 1. Subject is immediately unlinked from the record
   * 2. A SubjectRejection record is created with status 'pending_creator_decision'
   * 3. Creator is notified and must decide whether to publicly list the rejection
   *
   * @param recordId - The Firestore document ID of the record
   * @param options - Optional reason and signature
   */
  static async rejectSubjectStatus(
    recordId: string,
    options?: {
      reason?: string;
      signature?: string;
    }
  ): Promise<RejectSubjectStatusResult> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('🚫 Rejecting/removing subject status for record:', recordId);

    try {
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      const recordData = recordDoc.data();
      const subjects: string[] = recordData.subjects || [];

      // Check if user is currently a subject
      const isCurrentSubject = subjects.includes(user.uid);

      if (!isCurrentSubject) {
        throw new Error('You are not a subject of this record');
      }

      // Check if there was a consent flow by looking up the consent request
      const requestId = getConsentRequestId(recordId, user.uid);
      const requestRef = doc(db, 'subjectConsentRequests', requestId);
      const requestDoc = await getDoc(requestRef);

      const hadConsentFlow = requestDoc.exists() && requestDoc.data()?.status === 'accepted';

      // FLOW 1: SELF REMOVAL - No consent flow existed
      if (!hadConsentFlow) {
        await updateDoc(recordRef, {
          subjects: arrayRemove(user.uid),
          lastModified: serverTimestamp(),
        });

        console.log('✅ Self-removal complete (no consent flow existed)');

        return {
          success: true,
          recordId,
          rejectionType: 'self_removal',
          pendingCreatorDecision: false,
        };
      }

      // FLOW 2: REJECTION FLOW - Removing after consent was given
      const rejectionType: SubjectRejectionType = 'removed_after_acceptance';

      // Create the rejection record on the record document
      const existingRejections: SubjectRejection[] = recordData.subjectRejections || [];
      const rejection: SubjectRejection = {
        subjectId: user.uid,
        rejectionType,
        rejectedAt: Timestamp.now(),
        reason: options?.reason,
        status: 'pending_creator_decision',
        publiclyListed: false,
        rejectionSignature: options?.signature,
      };

      // Update record: remove from subjects, add rejection
      await updateDoc(recordRef, {
        subjects: arrayRemove(user.uid),
        subjectRejections: [...existingRejections, rejection],
        lastModified: serverTimestamp(),
      });

      console.log(`✅ Subject status rejected (type: ${rejectionType})`);

      return {
        success: true,
        recordId,
        rejectionType,
        pendingCreatorDecision: true,
      };
    } catch (error) {
      console.error('❌ Error rejecting subject status:', error);
      throw error;
    }
  }

  /**
   * Respond to a subject rejection
   *
   * Called by the record creator to decide whether to publicly list
   * the rejection. This completes the rejection flow.
   *
   * @param recordId - The Firestore document ID of the record
   * @param subjectId - The userId of the subject who rejected
   * @param publiclyList - Whether to add to public list of unaccepted updates
   */
  static async respondToSubjectRejection(
    recordId: string,
    subjectId: string,
    publiclyList: boolean
  ): Promise<RespondToRejectionResult> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('📋 Responding to subject rejection:', { recordId, subjectId, publiclyList });

    try {
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      const recordData = recordDoc.data();

      // Verify user is the record creator or owner
      const canRespond =
        recordData.uploadedBy === user.uid ||
        recordData.owners?.includes(user.uid) ||
        recordData.administrators.includes(user.uid);

      if (!canRespond) {
        throw new Error(
          'Only the record creator, owners, or administrators can respond to rejections'
        );
      }

      const rejections: SubjectRejection[] = recordData.subjectRejections || [];

      // Find the pending rejection for this subject
      const rejectionIndex = rejections.findIndex(
        rej => rej.subjectId === subjectId && rej.status === 'pending_creator_decision'
      );

      if (rejectionIndex === -1) {
        throw new Error('No pending rejection found for this subject');
      }

      const existingRejection = rejections[rejectionIndex];

      if (!existingRejection) {
        throw new Error('Invalid pending rejection data: missing required fields');
      }

      // Update the rejection with creator's decision
      const updatedRejection: SubjectRejection = {
        ...existingRejection,
        status: publiclyList ? 'publicly_listed' : 'acknowledged',
        creatorRespondedAt: Timestamp.now(),
        publiclyListed: publiclyList,
      };

      const updatedRejections = [...rejections];
      updatedRejections[rejectionIndex] = updatedRejection;

      await updateDoc(recordRef, {
        subjectRejections: updatedRejections,
        lastModified: serverTimestamp(),
      });

      console.log(`✅ Rejection response recorded (publicly listed: ${publiclyList})`);

      return {
        success: true,
        recordId,
        subjectId,
        publiclyListed: publiclyList,
      };
    } catch (error) {
      console.error('❌ Error responding to rejection:', error);
      throw error;
    }
  }

  /**
   * Remove a subject from a record (by owner/admin)
   *
   * This is different from rejectSubjectStatus - this is when an owner
   * or admin removes someone else as subject, not the subject removing themselves.
   *
   * No rejection flow is triggered since this is an administrative action.
   *
   * @param recordId - The Firestore document ID of the record
   * @param subjectId - The userId of the subject to remove
   */
  static async removeSubjectByOwner(
    recordId: string,
    subjectId: string
  ): Promise<{ success: boolean }> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    // If user is removing themselves, use the rejection flow instead
    if (subjectId === user.uid) {
      const result = await this.rejectSubjectStatus(recordId);
      return { success: result.success };
    }

    console.log('🗑️ Owner/Admin removing subject from record:', { recordId, subjectId });

    try {
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      const recordData = recordDoc.data();

      // Check permissions: must be owner, or admin if no owners exist
      const isOwner = recordData.owners?.includes(user.uid);
      const isAdmin = recordData.administrators?.includes(user.uid);
      const hasOwners = recordData.owners && recordData.owners.length > 0;

      const canRemove = isOwner || (isAdmin && !hasOwners);

      if (!canRemove) {
        throw new Error(
          'Only record owners can remove subjects. Administrators can only remove subjects if no owners exist.'
        );
      }

      // Remove from subjects array
      await updateDoc(recordRef, {
        subjects: arrayRemove(subjectId),
        lastModified: serverTimestamp(),
      });

      console.log('✅ Subject removed from record by owner/admin');

      // TODO: Optionally notify the removed subject

      return { success: true };
    } catch (error) {
      console.error('❌ Error removing subject:', error);
      throw error;
    }
  }

  /**
   * Get all subjects for a record
   *
   * @param recordId - The Firestore document ID of the record
   * @returns Array of subject userIds
   */
  static async getRecordSubjects(recordId: string): Promise<string[]> {
    const db = getFirestore();

    try {
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      return recordDoc.data().subjects || [];
    } catch (error) {
      console.error('❌ Error getting record subjects:', error);
      throw error;
    }
  }

  /**
   * Get pending consent requests for a record
   *
   * Queries the subjectConsentRequests collection for pending requests
   * associated with this record.
   *
   * @param recordId - The Firestore document ID of the record
   * @returns Array of pending consent requests
   */
  static async getPendingRequestsForRecord(recordId: string): Promise<SubjectConsentRequest[]> {
    const db = getFirestore();

    try {
      const requestsRef = collection(db, 'subjectConsentRequests');
      const q = query(
        requestsRef,
        where('recordId', '==', recordId),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as SubjectConsentRequest);
    } catch (error) {
      console.error('❌ Error getting pending requests for record:', error);
      throw error;
    }
  }

  /**
   * Get incoming consent requests for the current user
   *
   * Queries the subjectConsentRequests collection for pending requests
   * where the current user is the target.
   *
   * @returns Array of incoming consent requests
   */
  static async getIncomingRequests(): Promise<IncomingSubjectRequest[]> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const requestsRef = collection(db, 'subjectConsentRequests');
      const q = query(
        requestsRef,
        where('subjectId', '==', user.uid),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data() as SubjectConsentRequest;
        return {
          id: doc.id,
          recordId: data.recordId,
          recordTitle: data.recordTitle,
          requestedBy: data.requestedBy,
          requestedSubjectRole: data.requestedSubjectRole,
          requestedAt: data.createdAt,
          status: data.status,
        };
      });
    } catch (error) {
      console.error('❌ Error getting incoming requests:', error);
      throw error;
    }
  }

  /**
   * Get pending rejection decisions for a record creator
   *
   * Returns rejections where the creator hasn't yet decided
   * whether to publicly list them.
   *
   * @param recordId - The Firestore document ID of the record
   * @returns Array of pending rejections
   */
  static async getPendingRejectionDecisions(recordId: string): Promise<SubjectRejection[]> {
    const db = getFirestore();

    try {
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      const rejections: SubjectRejection[] = recordDoc.data().subjectRejections || [];

      return rejections.filter(rej => rej.status === 'pending_creator_decision');
    } catch (error) {
      console.error('❌ Error getting pending rejection decisions:', error);
      throw error;
    }
  }

  /**
   * Get all rejections for a record (for audit purposes)
   *
   * @param recordId - The Firestore document ID of the record
   * @returns Array of all rejections
   */
  static async getAllRejections(recordId: string): Promise<SubjectRejection[]> {
    const db = getFirestore();

    try {
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      return recordDoc.data().subjectRejections || [];
    } catch (error) {
      console.error('❌ Error getting rejections:', error);
      throw error;
    }
  }
}

export default SubjectService;
