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
 * Blockchain integration:
 * - Anchoring subjects on-chain when they accept/set themselves as subject
 * - Unanchoring when subjects remove themselves
 * - Uses BlockchainSyncQueueService for retry on blockchain failures
 *
 * Access Permissions:
 * Access is handled in the useSubjectFlow with imports from PermissionService
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
  deleteDoc,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { blockchainHealthRecordService } from '@/features/Credibility/services/blockchainHealthRecordService';
import { BlockchainSyncQueueService } from '@/features/BlockchainWallet/services/blockchainSyncQueueService';

// ============================================================================
// TYPES
// ============================================================================

export type SubjectRequestStatus = 'pending' | 'accepted' | 'rejected';
export type SubjectRejectionType = 'request_rejected' | 'removed_after_acceptance';
export type CreatorResponseStatus = 'pending_creator_decision' | 'dropped' | 'escalated';

/**
 * Creator's response to a subject rejection
 * Nested within SubjectConsentRequest.rejection
 */
export interface CreatorResponse {
  status: CreatorResponseStatus;
  respondedAt?: Timestamp;
}

/**
 * Rejection data - now nested within SubjectConsentRequest
 * Only populated when a subject removes themselves AFTER accepting
 */
export interface SubjectRejectionData {
  rejectionType: SubjectRejectionType;
  rejectedAt: Timestamp;
  reason?: string;
  rejectionSignature?: string;
  creatorResponse?: CreatorResponse;
}

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

export interface SetSubjectSelfResult {
  success: boolean;
  recordId: string;
  subjectId: string;
  blockchainAnchored?: boolean;
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
  blockchainAnchored?: boolean;
}

export interface RejectSubjectStatusResult {
  success: boolean;
  recordId: string;
  rejectionType: SubjectRejectionType | 'self_removal';
  pendingCreatorDecision: boolean;
  blockchainUnanchored?: boolean;
}

export interface RespondToRejectionResult {
  success: boolean;
  recordId: string;
  subjectId: string;
  response: CreatorResponseStatus;
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
export const getConsentRequestId = (recordId: string, subjectId: string): string => {
  return `${recordId}_${subjectId}`;
};

export class SubjectService {
  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get user's wallet address from Firestore
   */
  private static async getUserWalletAddress(userId: string): Promise<string | null> {
    const db = getFirestore();
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();
    return userData.wallet?.address || null;
  }

  /**
   * Anchor a subject to a record on the blockchain
   * Logs to sync queue if blockchain call fails
   */
  private static async anchorSubjectOnChain(
    recordId: string,
    recordHash: string,
    userId: string,
    userWalletAddress: string
  ): Promise<boolean> {
    try {
      console.log('⛓️ Anchoring subject on blockchain...', { recordId, userId });
      await blockchainHealthRecordService.anchorRecord(recordId, recordHash);
      console.log('✅ Subject anchored on blockchain');
      return true;
    } catch (blockchainError) {
      const errorMessage =
        blockchainError instanceof Error ? blockchainError.message : String(blockchainError);

      console.error('⚠️ Blockchain anchoring failed:', blockchainError);
      await BlockchainSyncQueueService.logFailure({
        contract: 'HealthRecordCore',
        action: 'anchorRecord',
        userId: userId,
        userWalletAddress: userWalletAddress,
        error: errorMessage,
        context: {
          type: 'anchorRecord',
          recordId: recordId,
          recordHash: recordHash,
          subjectId: userId,
        },
      });
      return false;
    }
  }

  /**
   * Unanchor a subject from a record on the blockchain
   * Logs to sync queue if blockchain call fails
   */
  private static async unanchorSubjectOnChain(
    recordId: string,
    userId: string,
    userWalletAddress: string
  ): Promise<boolean> {
    try {
      console.log('⛓️ Unanchoring subject on blockchain...', { recordId, userId });
      await blockchainHealthRecordService.unanchorRecord(recordId);
      console.log('✅ Subject unanchored on blockchain');
      return true;
    } catch (blockchainError) {
      console.error('⚠️ Blockchain unanchoring failed:', blockchainError);
      const errorMessage =
        blockchainError instanceof Error ? blockchainError.message : String(blockchainError);

      await BlockchainSyncQueueService.logFailure({
        contract: 'HealthRecordCore',
        action: 'unanchorRecord',
        userId: userId,
        userWalletAddress: userWalletAddress,
        error: errorMessage,
        context: {
          type: 'unanchorRecord',
          recordId: recordId,
          subjectId: userId,
        },
      });
      return false;
    }
  }

  // ============================================================================
  // SET SUBJECT METHODS
  // ============================================================================

  /**
   * Set the current user as the subject of a record
   *
   * This is immediate - no consent flow needed when you're claiming
   * a record is about yourself.
   *
   * Also anchors the subject on the blockchain.
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

      // Check if already a subject
      if (recordData.subjects?.includes(user.uid)) {
        console.log('✓ User is already a subject of this record');
        return {
          success: true,
          recordId,
          subjectId: user.uid,
          blockchainAnchored: true, // Assume already anchored if already subject
        };
      }

      // Get user's wallet address for blockchain operations
      const userWalletAddress = await this.getUserWalletAddress(user.uid);
      if (!userWalletAddress) {
        throw new Error('You must have a linked wallet to set yourself as a subject');
      }

      // Get record hash for blockchain anchoring
      const recordHash = recordData.recordHash;
      if (!recordHash) {
        throw new Error('Record does not have a hash for blockchain anchoring');
      }

      // Step 1: Update Firestore
      await updateDoc(recordRef, {
        subjects: arrayUnion(user.uid),
        lastModified: serverTimestamp(),
      });
      console.log('✅ Successfully set self as subject in Firestore');

      // Step 2: Anchor on blockchain
      const blockchainAnchored = await this.anchorSubjectOnChain(
        recordId,
        recordHash,
        user.uid,
        userWalletAddress
      );

      return {
        success: true,
        recordId,
        subjectId: user.uid,
        blockchainAnchored,
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
   * Also grants the requested role immediately so they can preview the record
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

      // Check if a pending request already exists
      const requestId = getConsentRequestId(recordId, subjectId);
      const requestRef = doc(db, 'subjectConsentRequests', requestId);
      const existingRequest = await getDoc(requestRef);

      if (existingRequest.exists()) {
        const data = existingRequest.data();
        if (data.status === 'pending') {
          throw new Error('A pending request already exists for this user');
        }
      }

      // Create new consent request document
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
        grantedAccessOnSubjectRequest: false,
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
   * Also anchors the subject on the blockchain.
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
      // Step 1: Find and update the consent request
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

      // Get user's wallet address for blockchain operations
      const userWalletAddress = await this.getUserWalletAddress(user.uid);
      if (!userWalletAddress) {
        throw new Error('You must have a linked wallet to accept subject status');
      }

      // Get record data for hash
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      const recordData = recordDoc.data();
      const recordHash = recordData.recordHash;

      if (!recordHash) {
        throw new Error('Record does not have a hash for blockchain anchoring');
      }

      // Step 2: Update the consent request status
      await updateDoc(requestRef, {
        status: 'accepted',
        respondedAt: Timestamp.now(),
      });

      console.log('✅ Consent request updated to accepted');

      // Step 3: Add user to record's subjects array
      await updateDoc(recordRef, {
        subjects: arrayUnion(user.uid),
        lastModified: serverTimestamp(),
      });

      console.log('✅ User added to record subjects');

      // Step 4: Anchor on blockchain
      const blockchainAnchored = await this.anchorSubjectOnChain(
        recordId,
        recordHash,
        user.uid,
        userWalletAddress
      );

      return {
        success: true,
        recordId,
        accepted: true,
        signature,
        blockchainAnchored,
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

      // Update the consent request status with rejection data
      await updateDoc(requestRef, {
        status: 'rejected',
        respondedAt: Timestamp.now(),
        rejection: {
          rejectionType: 'request_rejected' as SubjectRejectionType,
          rejectedAt: Timestamp.now(),
          reason: reason ?? 'No reason provided',
          creatorResponse: {
            status: 'pending_creator_decision' as CreatorResponseStatus,
          },
        },
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
   * 2. The SubjectConsentRequest is updated with rejection data
   * 3. Creator is notified and must decide whether to publicly list the rejection
   *
   * Also unanchors the subject on the blockchain.
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
      if (!subjects.includes(user.uid)) {
        throw new Error('You are not a subject of this record');
      }

      // Get user's wallet address for blockchain operations
      const userWalletAddress = await this.getUserWalletAddress(user.uid);
      if (!userWalletAddress) {
        throw new Error('You must have a linked wallet to remove subject status');
      }

      // Check if there was a consent flow by looking up the consent request
      const requestId = getConsentRequestId(recordId, user.uid);
      const requestRef = doc(db, 'subjectConsentRequests', requestId);
      const requestDoc = await getDoc(requestRef);

      const hadConsentFlow = requestDoc.exists() && requestDoc.data()?.status === 'accepted';

      // Remove from subjects array (common to both flows)
      await updateDoc(recordRef, {
        subjects: arrayRemove(user.uid),
        lastModified: serverTimestamp(),
      });

      // FLOW 1: SELF REMOVAL - No consent flow existed
      if (!hadConsentFlow) {
        console.log('✅ Self-removal complete (no consent flow existed)');

        // Unanchor from blockchain
        const blockchainUnanchored = await this.unanchorSubjectOnChain(
          recordId,
          user.uid,
          userWalletAddress
        );

        return {
          success: true,
          recordId,
          rejectionType: 'self_removal',
          pendingCreatorDecision: false,
          blockchainUnanchored,
        };
      }

      // FLOW 2: REJECTION FLOW - Removing after consent was given
      const rejectionType: SubjectRejectionType = 'removed_after_acceptance';

      const rejectionData: SubjectRejectionData = {
        rejectionType,
        rejectedAt: Timestamp.now(),
        reason: options?.reason,
        rejectionSignature: options?.signature,
        creatorResponse: {
          status: 'pending_creator_decision',
        },
      };

      await updateDoc(requestRef, {
        rejection: rejectionData,
      });

      console.log(`✅ Subject status rejected (type: ${rejectionType})`);

      // Unanchor from blockchain
      const blockchainUnanchored = await this.unanchorSubjectOnChain(
        recordId,
        user.uid,
        userWalletAddress
      );

      return {
        success: true,
        recordId,
        rejectionType,
        pendingCreatorDecision: true,
        blockchainUnanchored,
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
   * @param response - Requester's response to the rejection
   */
  static async respondToSubjectRejection(
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

    console.log('📋 Responding to subject rejection:', { recordId, subjectId, response });

    try {
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) {
        throw new Error('Record not found');
      }

      const recordData = recordDoc.data();

      // Verify user is the record creator or owner or admin
      const canRespond =
        recordData.uploadedBy === user.uid ||
        recordData.owners?.includes(user.uid) ||
        recordData.administrators?.includes(user.uid);

      if (!canRespond) {
        throw new Error(
          'Only the record creator, owners, or administrators can respond to rejections'
        );
      }

      // Find and update the consent request document
      const requestId = getConsentRequestId(recordId, subjectId);
      const requestRef = doc(db, 'subjectConsentRequests', requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error('No consent request found for this subject');
      }

      const requestData = requestDoc.data() as SubjectConsentRequest;

      // Check if there's a pending rejection
      if (!requestData.rejection) {
        throw new Error('No rejection found for this subject');
      }

      if (requestData.rejection.creatorResponse?.status !== 'pending_creator_decision') {
        throw new Error('This rejection has already been responded to');
      }

      // Update the rejection with creator's decision
      const updatedCreatorResponse: CreatorResponse = {
        status: response,
        respondedAt: Timestamp.now(),
      };

      await updateDoc(requestRef, {
        'rejection.creatorResponse': updatedCreatorResponse,
      });

      console.log(`✅ Rejection response recorded: ${response}`);

      return {
        success: true,
        recordId,
        subjectId,
        response,
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
   * Note: This does NOT unanchor on blockchain - only the subject themselves
   * can unanchor their own record link.
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

      // Note: We do NOT unanchor on blockchain here.
      // The subject's on-chain anchor remains - only they can unanchor themselves.
      // This maintains the integrity of the blockchain record.

      return { success: true };
    } catch (error) {
      console.error('❌ Error removing subject:', error);
      throw error;
    }
  }

  /**
   * Cancel a pending subject consent request
   *
   * Called by the record owner/admin to cancel a request they sent.
   * Simply deletes the pending request document.
   *
   * @param recordId - The Firestore document ID of the record
   * @param subjectId - The userId of the proposed subject
   */
  static async cancelPendingRequest(
    recordId: string,
    subjectId: string
  ): Promise<{ success: boolean }> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('🚫 Canceling pending subject request:', { recordId, subjectId });

    try {
      const requestId = getConsentRequestId(recordId, subjectId);
      const requestRef = doc(db, 'subjectConsentRequests', requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error('No pending request found');
      }

      const requestData = requestDoc.data() as SubjectConsentRequest;

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

      const recordData = recordDoc.data();
      const canCancel =
        requestData.requestedBy === user.uid ||
        recordData.uploadedBy === user.uid ||
        recordData.owners?.includes(user.uid) ||
        recordData.administrators?.includes(user.uid);

      if (!canCancel) {
        throw new Error('You do not have permission to cancel this request');
      }

      // Delete the request document
      await deleteDoc(requestRef);

      console.log('✅ Pending request canceled');

      return { success: true };
    } catch (error) {
      console.error('❌ Error canceling pending request:', error);
      throw error;
    }
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

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
  static async getPendingRejectionDecisions(recordId: string): Promise<SubjectRejectionData[]> {
    const db = getFirestore();

    try {
      // Query all consent requests for this record that have rejections
      const requestsRef = collection(db, 'subjectConsentRequests');
      const q = query(requestsRef, where('recordId', '==', recordId));

      const snapshot = await getDocs(q);

      const pendingRejections: SubjectRejectionData[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data() as SubjectConsentRequest;
        if (
          data.rejection &&
          data.rejection.creatorResponse?.status === 'pending_creator_decision'
        ) {
          pendingRejections.push(data.rejection);
        }
      });

      return pendingRejections;
    } catch (error) {
      console.error('❌ Error getting pending rejection decisions:', error);
      throw error;
    }
  }

  /**
   * Get all rejections for a record (for audit purposes)
   *
   * @param recordId - The Firestore document ID of the record
   * @returns Array of all rejections with subject info
   */
  static async getAllRejections(
    recordId: string
  ): Promise<Array<SubjectRejectionData & { subjectId: string }>> {
    const db = getFirestore();

    try {
      const requestsRef = collection(db, 'subjectConsentRequests');
      const q = query(requestsRef, where('recordId', '==', recordId));

      const snapshot = await getDocs(q);

      const rejections: Array<SubjectRejectionData & { subjectId: string }> = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data() as SubjectConsentRequest;
        if (data.rejection) {
          rejections.push({
            ...data.rejection,
            subjectId: data.subjectId,
          });
        }
      });

      return rejections;
    } catch (error) {
      console.error('❌ Error getting rejections:', error);
      throw error;
    }
  }

  /**
   * Get all consent requests for a record (includes accepted, rejected, pending)
   *
   * Useful for viewing the complete consent history of a record.
   *
   * @param recordId - The Firestore document ID of the record
   * @returns Array of all consent requests
   */
  static async getAllConsentRequestsForRecord(recordId: string): Promise<SubjectConsentRequest[]> {
    const db = getFirestore();

    try {
      const requestsRef = collection(db, 'subjectConsentRequests');
      const q = query(requestsRef, where('recordId', '==', recordId));

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as SubjectConsentRequest);
    } catch (error) {
      console.error('❌ Error getting all consent requests for record:', error);
      throw error;
    }
  }
}

export default SubjectService;
