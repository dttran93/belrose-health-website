import { BlockchainRef } from './blockchainAddresses';
import { TimestampLike } from './timestamp';

export type SubjectRequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'self_consented' // subject added themselves via setSubjectAsSelf
  | 'controller_consented'; // controller anchored trustor via anchorSubjectAsController

/**
 * Document structure for subjectConsentRequests collection
 * Document ID format: {recordId}_{targetUserId}
 */
export interface SubjectConsentRequest {
  recordId: string;
  subjectId: string;
  requestedBy: string;
  requestedSubjectRole: 'sharer' | 'administrator' | 'owner';
  status: SubjectRequestStatus;
  createdAt: TimestampLike;
  respondedAt?: TimestampLike;
  grantedAccessOnSubjectRequest: boolean;
  rejection?: SubjectRejectionData;
  encryptedRecordTitle?: string;
  encryptedRecordTitleIv?: string;
  blockchainRef?: BlockchainRef;
}

export type SubjectRejectionType = 'request_rejected' | 'removed_after_acceptance';
export type CreatorResponseStatus = 'pending_creator_decision' | 'dropped' | 'escalated';

/**
 * Creator's response to a subject rejection
 * Nested within SubjectConsentRequest.rejection
 */
export interface CreatorResponse {
  status: CreatorResponseStatus;
  lastModified?: TimestampLike;
}

/**
 * Rejection data - nested within SubjectConsentRequest
 * Only populated when a subject removes themselves AFTER accepting
 */
export interface SubjectRejectionData {
  rejectionType: SubjectRejectionType;
  rejectedAt: TimestampLike;
  reason: RejectionReasons;
  creatorResponse?: CreatorResponse;
}

export type RejectionReasons =
  | 'identity_mismatch'
  | 'content_dispute'
  | 'privacy'
  | 'duplicate'
  | 'other';
