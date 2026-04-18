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
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { RequestNote } from '../components/Request/NewRequestForm';
import type { RecordRequest } from '@belrose/shared';
import { arrayBufferToBase64 } from '@/utils/dataFormattingUtils';
import { SharingKeyManagementService } from '@/features/Sharing/services/sharingKeyManagementService';
import { BelroseUserProfile } from '@/types/core';

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
  static async createRequest(
    input: CreateRequestInput,
    requesterProfile: BelroseUserProfile
  ): Promise<CreateRequestResult> {
    const db = getFirestore();

    // Check if target is a registered (non-guest) user
    const usersSnap = await getDocs(
      query(collection(db, 'users'), where('email', '==', input.targetEmail))
    );
    const targetUserDoc = usersSnap.docs[0];
    const isRegistered = targetUserDoc && !targetUserDoc.data().isGuest;

    if (isRegistered) {
      return RecordRequestService.createRequestForRegisteredUser(
        input,
        requesterProfile,
        targetUserDoc
      );
    } else {
      // Guest flow — cloud function handles account creation + email
      const functions = getFunctions();
      const createFn = httpsCallable<CreateRequestInput, CreateRequestResult>(
        functions,
        'createRecordRequest'
      );
      const result = await createFn(input);
      return result.data;
    }
  }

  private static async createRequestForRegisteredUser(
    input: CreateRequestInput,
    requesterProfile: BelroseUserProfile,
    targetUserDoc: any
  ): Promise<CreateRequestResult> {
    const db = getFirestore();
    const targetData = targetUserDoc.data();

    // Build encrypted note if provided
    let encryptedFields = {};
    if (input.requestNote) {
      const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ]);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const noteBytes = new TextEncoder().encode(JSON.stringify(input.requestNote));
      const encryptedNote = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, noteBytes);

      const providerKey = await SharingKeyManagementService.importPublicKey(
        targetData.encryption.publicKey
      );
      const requesterKey = await SharingKeyManagementService.importPublicKey(
        requesterProfile.encryption.publicKey
      );

      encryptedFields = {
        encryptedRequestNote: arrayBufferToBase64(encryptedNote),
        encryptedNoteIv: arrayBufferToBase64(iv.buffer),
        encryptedNoteKeyForProvider: await SharingKeyManagementService.wrapKey(aesKey, providerKey),
        encryptedNoteKeyForRequester: await SharingKeyManagementService.wrapKey(
          aesKey,
          requesterKey
        ),
      };
    }

    const inviteCode = crypto.randomUUID();
    const requestRef = doc(db, 'recordRequests', inviteCode);

    await setDoc(requestRef, {
      inviteCode,
      requesterId: requesterProfile.uid,
      requesterEmail: requesterProfile.email,
      requesterName: input.requesterName,
      requesterPublicKey: requesterProfile.encryption.publicKey,
      targetEmail: input.targetEmail,
      targetUserId: targetUserDoc.id,
      status: 'pending',
      createdAt: serverTimestamp(),
      deadline: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      readAt: null,
      lastRemindedAt: null,
      viewCount: 0,
      fulfilledRecordIds: [],
      ...encryptedFields,
    });

    return { success: true, requestId: inviteCode };
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
