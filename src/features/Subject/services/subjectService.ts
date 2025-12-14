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
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// ============================================================================
// TYPES
// ============================================================================

export type SubjectRequestStatus = 'pending' | 'accepted' | 'rejected';
export type SubjectRejectionType = 'request_rejected' | 'removed_after_acceptance';
export type SubjectRejectionStatus =
  | 'pending_creator_decision'
  | 'acknowledged'
  | 'publicly_listed';

export interface PendingSubjectRequest {
  subjectId: string;
  requestedBy: string;
  requestedAt: Timestamp;
  status: SubjectRequestStatus;
  consentSignature?: string;
  consentSignedAt?: Timestamp;
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
  recordId: string;
  firestoreId: string;
  fileName: string;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: Timestamp;
  status: SubjectRequestStatus;
}

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
    subjectId: string
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

      const existingRequests = recordData.pendingSubjectRequests || [];
      const existingRequest = existingRequests.find(
        (req: PendingSubjectRequest) => req.subjectId === subjectId && req.status === 'pending'
      );

      if (existingRequest) {
        throw new Error('A pending request already exists for this user');
      }

      const newRequest: PendingSubjectRequest = {
        subjectId: subjectId,
        requestedBy: user.uid,
        requestedAt: Timestamp.now(),
        status: 'pending',
      };

      await updateDoc(recordRef, {
        pendingSubjectRequests: arrayUnion(newRequest),
        lastModified: serverTimestamp(),
      });

      console.log('✅ Subject consent request created');

      return {
        success: true,
        recordId,
        subjectId,
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
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      const recordData = recordDoc.data();
      const pendingRequests: PendingSubjectRequest[] = recordData.pendingSubjectRequests || [];

      const requestIndex = pendingRequests.findIndex(
        req => req.subjectId === user.uid && req.status === 'pending'
      );

      if (requestIndex === -1) {
        throw new Error('No pending subject request found for you');
      }

      const existingRequest = pendingRequests[requestIndex];

      if (
        !existingRequest ||
        !existingRequest.subjectId ||
        !existingRequest.requestedBy ||
        !existingRequest.requestedAt
      ) {
        throw new Error('Invalid pending request data: missing required fields');
      }

      const updatedRequest: PendingSubjectRequest = {
        subjectId: existingRequest.subjectId,
        requestedBy: existingRequest.requestedBy,
        requestedAt: existingRequest.requestedAt,
        status: 'accepted',
        consentSignature: signature,
        consentSignedAt: signature ? Timestamp.now() : undefined,
      };

      const updatedRequests = [...pendingRequests];
      updatedRequests[requestIndex] = updatedRequest;

      await updateDoc(recordRef, {
        subjects: arrayUnion(user.uid),
        pendingSubjectRequests: updatedRequests,
        lastModified: serverTimestamp(),
      });

      console.log('✅ Subject request accepted, user added to subjects');

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
   * Reject or remove subject status
   *
   * Unified function that handles both:
   * - Rejecting a pending subject request (never accepted)
   * - Removing oneself as subject (previously accepted)
   *
   * In both cases:
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
      const pendingRequests: PendingSubjectRequest[] = recordData.pendingSubjectRequests || [];
      const existingRejections: SubjectRejection[] = recordData.subjectRejections || [];

      // Determine rejection type based on current state
      const isCurrentSubject = subjects.includes(user.uid);
      const pendingRequestIndex = pendingRequests.findIndex(
        req => req.subjectId === user.uid && req.status === 'pending'
      );
      const hasPendingRequest = pendingRequestIndex !== -1;

      if (!isCurrentSubject && !hasPendingRequest) {
        throw new Error('You are not a subject or pending subject of this record');
      }

      const rejectionType: SubjectRejectionType = isCurrentSubject
        ? 'removed_after_acceptance'
        : 'request_rejected';

      // Get original consent signature if removing after acceptance
      let originalConsentSignature: string | undefined;
      if (isCurrentSubject) {
        const acceptedRequest = pendingRequests.find(
          req => req.subjectId === user.uid && req.status === 'accepted'
        );
        originalConsentSignature = acceptedRequest?.consentSignature;
      }

      // Create the rejection record
      const rejection: SubjectRejection = {
        subjectId: user.uid,
        rejectionType,
        rejectedAt: Timestamp.now(),
        reason: options?.reason,
        status: 'pending_creator_decision',
        publiclyListed: false,
        originalConsentSignature,
        rejectionSignature: options?.signature,
      };

      // Build the update object
      const updateData: Record<string, any> = {
        subjectRejections: [...existingRejections, rejection],
        lastModified: serverTimestamp(),
      };

      // Remove from subjects if currently a subject
      if (isCurrentSubject) {
        updateData.subjects = arrayRemove(user.uid);
      }

      // Update pending request status if rejecting a pending request
      if (hasPendingRequest) {
        const existingRequest = pendingRequests[pendingRequestIndex];

        if (
          !existingRequest ||
          !existingRequest.subjectId ||
          !existingRequest.requestedBy ||
          !existingRequest.requestedAt
        ) {
          throw new Error('Invalid pending request data: missing required fields');
        }

        const updatedRequest: PendingSubjectRequest = {
          subjectId: existingRequest.subjectId,
          requestedBy: existingRequest.requestedBy,
          requestedAt: existingRequest.requestedAt,
          status: 'rejected',
        };

        const updatedRequests = [...pendingRequests];
        updatedRequests[pendingRequestIndex] = updatedRequest;
        updateData.pendingSubjectRequests = updatedRequests;
      }

      await updateDoc(recordRef, updateData);

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
   * Get pending subject requests for a record
   *
   * @param recordId - The Firestore document ID of the record
   * @returns Array of pending requests
   */
  static async getPendingRequests(recordId: string): Promise<PendingSubjectRequest[]> {
    const db = getFirestore();

    try {
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      const requests: PendingSubjectRequest[] = recordDoc.data().pendingSubjectRequests || [];

      return requests.filter(req => req.status === 'pending');
    } catch (error) {
      console.error('❌ Error getting pending requests:', error);
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
