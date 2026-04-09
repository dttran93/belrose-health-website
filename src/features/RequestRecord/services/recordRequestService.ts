// src/features/RecordRequest/services/recordRequestService.ts

/**
 * Frontend service for the RecordRequest feature.
 *
 * Responsibilities:
 *   - Call the createRecordRequest Cloud Function
 *   - Client-side Firestore writes (cancel)
 *   - Resend email (calls Cloud Function)
 *   - Fetch requests for the current user
 */

import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { RecordRequest } from './fulfillRequestService';
import { RequestNote } from '../components/Request/NewRequestForm';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreateRequestInput {
  targetEmail: string;
  requesterName: string;
  requestNote?: RequestNote;
}

interface CreateRequestResult {
  success: boolean;
  requestId: string;
}

interface ResendRequestResult {
  success: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class RecordRequestService {
  // ── Create ────────────────────────────────────────────────────────────────

  /**
   * Call the createRecordRequest Cloud Function.
   * Returns the inviteCode which is also the Firestore document ID.
   */
  static async createRequest(input: CreateRequestInput): Promise<CreateRequestResult> {
    const functions = getFunctions();
    const createFn = httpsCallable<CreateRequestInput, CreateRequestResult>(
      functions,
      'createRecordRequest'
    );
    const result = await createFn(input);
    return result.data;
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  /**
   * Cancel a pending request. Firestore rules enforce:
   *   - Only the requester can cancel
   *   - Status must be 'pending' to cancel
   */
  static async cancelRequest(requestId: string): Promise<void> {
    const db = getFirestore();
    await updateDoc(doc(db, 'recordRequests', requestId), {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
    });
  }

  // ── Resend ────────────────────────────────────────────────────────────────

  /**
   * Resend the request email for a pending request.
   * Useful if the provider's email went to spam.
   * Calls a Cloud Function that re-sends using the existing inviteCode —
   * the link stays the same, no new document is created.
   */
  static async resendRequest(requestId: string): Promise<ResendRequestResult> {
    const functions = getFunctions();
    const resendFn = httpsCallable<{ requestId: string }, ResendRequestResult>(
      functions,
      'resendRecordRequest'
    );
    const result = await resendFn({ requestId });
    return result.data;
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────

  /**
   * Fetch all record requests made by the current user, newest first.
   */
  static async getMyRequests(): Promise<RecordRequest[]> {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const db = getFirestore();
    const q = query(
      collection(db, 'recordRequests'),
      where('requesterId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), inviteCode: d.id }) as RecordRequest);
  }
}
