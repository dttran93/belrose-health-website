// features/Subject/services/subjectService.ts

/**
 * SubjectService is an orchestrator for all subject-related operations
 *
 * Calls on Subject - Blockchain, Rejection, Consent, Membership, Permission services to orchestrate
 * - Setting yourself as subject
 * - Requesting someone else to be subject
 * - Rejecting/removing subject status
 * - Creator response to rejections
 * - Related blockchain anchoring/unanchoring
 *
 * Notifications are handled with functions/notifications/triggers -->
 * automatically send notifications for any updates within the records collections
 *
 * Access Permissions:
 * Access is handled in the useSubjectFlow with imports from PermissionService
 */

import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import SubjectBlockchainService from './subjectBlockchainService';
import { CreatorResponseStatus, SubjectRejectionService } from './subjectRejectionService';
import {
  getConsentRequestId,
  SubjectConsentRequest,
  SubjectConsentService,
} from './subjectConsentService';
import SubjectMembershipService from './subjectMembershipService';
import SubjectPermissionService from './subjectPermissionService';
import { FileObject } from '@/types/core';
import SubjectRemovalService from './subjectRemovalService';

// ============================================================================
// TYPES
// ============================================================================

export interface SetSubjectSelfResult {
  success: boolean;
  recordId: string;
  subjectId: string;
  blockchainAnchored?: boolean;
}

export interface RejectSubjectStatusResult {
  success: boolean;
  pendingCreatorDecision: boolean;
}

export interface RespondToRejectionResult {
  success: boolean;
  recordId: string;
  subjectId: string;
  response: CreatorResponseStatus;
}

export class SubjectService {
  // ============================================================================
  // PRIVATE HELPER
  // ============================================================================

  /**
   * Helper to ensure user is logged in and record exists/is accessible.
   * Centralizes the "Fetch-and-Authorize" logic.
   */
  private static async getAuthorizedRecord(recordId: string): Promise<{
    user: any;
    recordData: FileObject;
  }> {
    const user = getAuth().currentUser;
    if (!user) throw new Error('User not authenticated');

    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);
    const recordDoc = await getDoc(recordRef);

    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    // Standardize the data object with the ID
    const recordData = {
      id: recordDoc.id,
      ...recordDoc.data(),
    } as FileObject;

    // Check general management permissions
    if (!SubjectPermissionService.canManageRecord(recordData, user.uid)) {
      throw new Error('You do not have permission to modify this record');
    }

    return { user, recordData };
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
    const { user, recordData } = await this.getAuthorizedRecord(recordId);

    console.log('👤 Setting subject as self for record:', recordId);

    try {
      if (recordData.subjects?.includes(user.uid)) {
        return { success: true, recordId, subjectId: user.uid, blockchainAnchored: true };
      }

      if (!recordData.recordHash) {
        throw new Error('Record does not have a hash for blockchain anchoring');
      }

      await SubjectMembershipService.addSubject(recordId, user.uid);
      const blockchainAnchored = await SubjectBlockchainService.anchorSubject(
        recordId,
        recordData.recordHash,
        user.uid
      );

      return { success: true, recordId, subjectId: user.uid, blockchainAnchored };
    } catch (error) {
      console.error('❌ Error setting subject as self:', error);
      throw error;
    }
  }

  /**
   * Request another user to confirm they are the subject of a record
   *
   * This creates a pending request that the target user must respond to.
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
    }
  ): Promise<{ success: true }> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check: Fetch the record to verify permissions
    const recordRef = doc(db, 'records', recordId);
    const recordDoc = await getDoc(recordRef);

    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    // Permission checks. Must be owner/admin/uploader. target must not already be subject
    const recordData = recordDoc.data() as FileObject;

    if (!SubjectPermissionService.canManageRecord(recordData, user.uid)) {
      throw new Error('You do not have permission to modify this record');
    }

    if (recordData.subjects?.includes(subjectId)) {
      throw new Error('This user is already a subject of this record');
    }

    // Delegate to SubjectConsentService for creating the request
    const recordTitle = recordData.belroseFields?.title || recordData.fileName || 'Untitled Record';

    await SubjectConsentService.requestConsent({
      recordId,
      subjectId,
      requestedBy: user.uid,
      requestedSubjectRole: options?.role || 'viewer',
      recordTitle,
    });

    return { success: true };
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
  static async acceptSubjectRequest(recordId: string): Promise<{ success: true }> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('✅ Accepting subject request for record:', recordId);

    // Check 1: Find and update the consent request
    const requestId = getConsentRequestId(recordId, user.uid);
    const requestRef = doc(db, 'subjectConsentRequests', requestId);
    const requestDoc = await getDoc(requestRef);

    const requestData = requestDoc.data() as SubjectConsentRequest;

    if (
      !requestDoc.exists() ||
      requestDoc.data().status !== 'pending' ||
      requestData.subjectId !== user.uid
    ) {
      throw new Error('No pending subject request found for you');
    }

    // Check 2: Load record for permission array and blockchain updates
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

    // Step 1: Transition consent request to accepted
    await SubjectConsentService.acceptConsent(recordId, user.uid);

    // Step 2: Update record's subject array
    await SubjectMembershipService.addSubject(recordId, user.uid);

    // Step 3: Anchor on Blockchain
    await SubjectBlockchainService.anchorSubject(recordId, recordData.recordHash, user.uid);
    return { success: true };
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
  ): Promise<{ success: boolean }> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('❌ Rejecting subject request for record:', recordId);

    //Check: Must be the subject of the pending request
    const requestId = getConsentRequestId(recordId, user.uid);
    const requestRef = doc(db, 'subjectConsentRequests', requestId);
    const requestDoc = await getDoc(requestRef);
    const requestData = requestDoc.data() as SubjectConsentRequest;

    if (
      !requestDoc.exists() ||
      requestDoc.data().status !== 'pending' ||
      requestData.subjectId !== user.uid
    ) {
      throw new Error('No pending request found for you');
    }

    // Delegate to SubjectConsentService to reject the request
    await SubjectConsentService.rejectConsent(recordId, user.uid, reason);
    return { success: true };
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
   * 3. Creator is notified and must decide whether to escalate
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

      // Check if there was a consent flow by looking up the consent request
      const requestId = getConsentRequestId(recordId, user.uid);
      const requestRef = doc(db, 'subjectConsentRequests', requestId);
      const requestDoc = await getDoc(requestRef);

      const hadConsentFlow = requestDoc.exists() && requestDoc.data()?.status === 'accepted';

      // Remove from subjects array (common to both flows)
      await SubjectMembershipService.removeSubject(recordId, user.uid);

      // FLOW 1: SELF REMOVAL - No consent flow existed

      let pendingCreatorDecision = false;

      if (!hadConsentFlow) {
        console.log('✅ Self-removal complete (no consent flow existed)');
      } else {
        //Flow 2: Consent flow existed, capture the rejection data returned from the sub-service
        const rejectionData = await SubjectRejectionService.rejectAfterAcceptance({
          recordId,
          subjectId: user.uid,
          reason: options?.reason,
          signature: options?.signature,
        });

        pendingCreatorDecision =
          rejectionData.creatorResponse?.status === 'pending_creator_decision';
        console.log('✅ Subject status rejected after acceptance');
      }

      // Unanchor from blockchain
      await SubjectBlockchainService.unanchorSubject(recordId, user.uid);

      return {
        success: true,
        pendingCreatorDecision,
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
   * the rejection. Comes from subject rejection service. This completes the rejection flow.
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
    return SubjectRejectionService.respondToRejection(recordId, subjectId, response);
  }

  /**
   * Request a subject to remove themselves from a record (by owner/admin)
   *
   * This is different from rejectSubjectStatus - this is when an owner
   * or admin wants to remove someone else as subject, not the subject removing themselves.
   *
   * Only a subject can unanchor themselves from the blockchain. Therefore, it must be the subject
   * who removes themselves as a subject. This flow allows an owner or admin to request a subject remove
   * themselves as subject
   *
   * @param recordId - The Firestore document ID of the record
   * @param subjectId - The userId of the subject to remove
   */
  static async requestSubjectRemoval(
    recordId: string,
    subjectId: string
  ): Promise<{ success: boolean }> {
    const { user } = await this.getAuthorizedRecord(recordId);

    // If user is removing themselves, use the rejection flow instead
    if (subjectId === user.uid) {
      const result = await this.rejectSubjectStatus(recordId);
      return { success: result.success };
    }

    // Execute removal from subjects array
    await SubjectRemovalService.requestRemoval(recordId, subjectId);

    console.log('✅ Subject sent removal request');

    return { success: true };
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
  static async cancelSubjectConsentRequest(
    recordId: string,
    subjectId: string
  ): Promise<{ success: true }> {
    // 1. Fetch & Authorize
    const { user, recordData } = await this.getAuthorizedRecord(recordId);

    // 2. Permission check to make sure they can cancel request
    if (!SubjectPermissionService.canCancelRequest(recordData, user.uid)) {
      throw new Error('You do not have permission to cancel this request');
    }

    // 3. Cancel Request
    await SubjectConsentService.cancelConsent(recordId, subjectId);

    return { success: true };
  }
}

export default SubjectService;
