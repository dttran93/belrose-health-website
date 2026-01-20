//src/features/Subject/services/subjectMembershipService.ts

/**
 * SubjectQueryService
 *
 * Centralized query service for all subject-related data:
 * - Record subjects
 * - Consent requests (pending, incoming, history)
 * - Removal requests (pending, incoming, outgoing)
 * - Rejection decisions
 *
 * Keeps all read operations in one place for consistency and maintainability.
 */

import {
  collection,
  doc,
  DocumentData,
  FirestoreDataConverter,
  getDoc,
  getDocs,
  getFirestore,
  query,
  QueryDocumentSnapshot,
  Timestamp,
  where,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { SubjectConsentRequest, SubjectRequestStatus } from './subjectConsentService';
import { SubjectRejectionData } from './subjectRejectionService';
import { SubjectRemovalRequest, RemovalRequestStatus } from './subjectRemovalService';

// ============================================================================
// TYPES
// ============================================================================

export interface IncomingSubjectRequest {
  id: string;
  recordId: string;
  recordTitle?: string;
  requestedBy: string;
  requestedSubjectRole: 'viewer' | 'administrator' | 'owner';
  requestedAt: Timestamp;
  status: SubjectRequestStatus;
}

export interface IncomingRemovalRequest {
  id: string;
  recordId: string;
  recordTitle?: string;
  requestedBy: string;
  reason?: string;
  requestedAt: Timestamp;
  status: RemovalRequestStatus;
}

// ============================================================================
// FIRESTORE CONVERTERS
// ============================================================================

/**
 * Converter for SubjectConsentRequest documents
 */
const consentRequestConverter: FirestoreDataConverter<SubjectConsentRequest> = {
  toFirestore: (data: SubjectConsentRequest): DocumentData => data,
  fromFirestore: (snapshot: QueryDocumentSnapshot): SubjectConsentRequest => {
    return { ...snapshot.data(), id: snapshot.id } as unknown as SubjectConsentRequest;
  },
};

/**
 * Converter for SubjectRemovalRequest documents
 */
const removalRequestConverter: FirestoreDataConverter<SubjectRemovalRequest> = {
  toFirestore: (data: SubjectRemovalRequest): DocumentData => data,
  fromFirestore: (snapshot: QueryDocumentSnapshot): SubjectRemovalRequest => {
    return { ...snapshot.data(), id: snapshot.id } as unknown as SubjectRemovalRequest;
  },
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class SubjectQueryService {
  private static db = getFirestore();

  // ==========================================================================
  // RECORD SUBJECTS
  // ==========================================================================

  /**
   * Get all subjects for a record
   */
  static async getRecordSubjects(recordId: string): Promise<string[]> {
    const recordRef = doc(this.db, 'records', recordId);
    const recordDoc = await getDoc(recordRef);
    if (!recordDoc.exists()) throw new Error('Record not found');
    return recordDoc.data().subjects || [];
  }

  // ==========================================================================
  // CONSENT REQUEST QUERIES
  // ==========================================================================

  /**
   * Get pending consent requests for a specific record
   */
  static async getPendingConsentRequestsForRecord(
    recordId: string
  ): Promise<SubjectConsentRequest[]> {
    const q = query(
      collection(this.db, 'subjectConsentRequests').withConverter(consentRequestConverter),
      where('recordId', '==', recordId),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get rejected consent requests for a specific record
   * Excludes requests that have been dropped
   */
  static async getRejectedConsentRequestsForRecord(
    recordId: string
  ): Promise<SubjectConsentRequest[]> {
    const q = query(
      collection(this.db, 'subjectConsentRequests').withConverter(consentRequestConverter),
      where('recordId', '==', recordId),
      where('status', '==', 'rejected')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => doc.data())
      .filter(req => req.rejection?.creatorResponse?.status !== 'dropped');
  }

  /**
   * Get incoming consent requests for the current user
   */
  static async getIncomingConsentRequests(): Promise<IncomingSubjectRequest[]> {
    const user = getAuth().currentUser;
    if (!user) throw new Error('User not authenticated');

    const q = query(
      collection(this.db, 'subjectConsentRequests').withConverter(consentRequestConverter),
      where('subjectId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
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
  }

  /**
   * Get history of all consent requests for a record
   */
  static async getAllConsentRequestsForRecord(recordId: string): Promise<SubjectConsentRequest[]> {
    const q = query(
      collection(this.db, 'subjectConsentRequests').withConverter(consentRequestConverter),
      where('recordId', '==', recordId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get a specific consent request
   */
  static async getConsentRequest(
    recordId: string,
    subjectId: string
  ): Promise<SubjectConsentRequest | null> {
    const requestId = `${recordId}_${subjectId}`;
    const requestRef = doc(this.db, 'subjectConsentRequests', requestId).withConverter(
      consentRequestConverter
    );
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) return null;
    return requestDoc.data();
  }

  // ==========================================================================
  // REMOVAL REQUEST QUERIES
  // ==========================================================================

  /**
   * Get pending removal requests for a specific record
   *
   * Used by owners/admins to see what removal requests are outstanding.
   */
  static async getPendingRemovalRequestsForRecord(
    recordId: string
  ): Promise<SubjectRemovalRequest[]> {
    const q = query(
      collection(this.db, 'subjectRemovalRequests').withConverter(removalRequestConverter),
      where('recordId', '==', recordId),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get incoming removal requests for the current user
   *
   * Used by subjects to see who is requesting they remove themselves.
   */
  static async getIncomingRemovalRequests(): Promise<IncomingRemovalRequest[]> {
    const user = getAuth().currentUser;
    if (!user) throw new Error('User not authenticated');

    const q = query(
      collection(this.db, 'subjectRemovalRequests').withConverter(removalRequestConverter),
      where('subjectId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        recordId: data.recordId,
        recordTitle: data.recordTitle,
        requestedBy: data.requestedBy,
        reason: data.reason,
        requestedAt: data.createdAt,
        status: data.status,
      };
    });
  }

  /**
   * Get outgoing removal requests made by the current user
   *
   * Used by owners/admins to track their requests.
   */
  static async getOutgoingRemovalRequests(): Promise<SubjectRemovalRequest[]> {
    const user = getAuth().currentUser;
    if (!user) throw new Error('User not authenticated');

    const q = query(
      collection(this.db, 'subjectRemovalRequests').withConverter(removalRequestConverter),
      where('requestedBy', '==', user.uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Get a specific removal request
   */
  static async getRemovalRequest(
    recordId: string,
    subjectId: string
  ): Promise<SubjectRemovalRequest | null> {
    const requestId = `${recordId}_${subjectId}`;
    const requestRef = doc(this.db, 'subjectRemovalRequests', requestId).withConverter(
      removalRequestConverter
    );
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) return null;
    return requestDoc.data();
  }

  /**
   * Get all removal requests for a record (any status)
   *
   * Useful for showing history/audit trail.
   */
  static async getAllRemovalRequestsForRecord(recordId: string): Promise<SubjectRemovalRequest[]> {
    const q = query(
      collection(this.db, 'subjectRemovalRequests').withConverter(removalRequestConverter),
      where('recordId', '==', recordId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  }

  // ==========================================================================
  // REJECTION QUERIES
  // ==========================================================================

  /**
   * Get rejections awaiting creator decision
   */
  static async getPendingRejectionDecisions(recordId: string): Promise<SubjectRejectionData[]> {
    const q = query(
      collection(this.db, 'subjectConsentRequests').withConverter(consentRequestConverter),
      where('recordId', '==', recordId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => doc.data())
      .filter(data => data.rejection?.creatorResponse?.status === 'pending_creator_decision')
      .map(data => data.rejection!);
  }

  // ==========================================================================
  // COMBINED / CONVENIENCE QUERIES
  // ==========================================================================

  /**
   * Get all incoming requests (both consent and removal) for the current user
   *
   * Useful for a unified "inbox" view showing everything the user needs to respond to.
   */
  static async getAllIncomingRequests(): Promise<{
    consentRequests: IncomingSubjectRequest[];
    removalRequests: IncomingRemovalRequest[];
  }> {
    const [consentRequests, removalRequests] = await Promise.all([
      this.getIncomingConsentRequests(),
      this.getIncomingRemovalRequests(),
    ]);

    return { consentRequests, removalRequests };
  }

  /**
   * Get all pending requests for a record (both consent and removal)
   *
   * Useful for showing owners/admins all outstanding requests.
   */
  static async getAllPendingRequestsForRecord(recordId: string): Promise<{
    consentRequests: SubjectConsentRequest[];
    removalRequests: SubjectRemovalRequest[];
  }> {
    const [consentRequests, removalRequests] = await Promise.all([
      this.getPendingConsentRequestsForRecord(recordId),
      this.getPendingRemovalRequestsForRecord(recordId),
    ]);

    return { consentRequests, removalRequests };
  }
}

export default SubjectQueryService;
