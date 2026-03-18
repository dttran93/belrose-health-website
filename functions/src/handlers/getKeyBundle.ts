/**
 * functions/src/getKeyBundle.ts
 *
 * Cloud Function: getKeyBundle
 *
 * Fetches a user's public Signal key bundle and atomically consumes
 * one one-time prekey (OPK) in a Firestore transaction.
 *
 * Why a Cloud Function instead of a direct Firestore read?
 *
 *   OPK consumption must be atomic — if two people message Bob simultaneously
 *   and both read his OPK list at the same time, they could grab the same OPK
 *   before either deletes it. That would give both sessions the same DH4 secret,
 *   undermining the per-session uniqueness that OPKs provide.
 *
 *   A Firestore transaction (runTransaction) guarantees that the read-and-delete
 *   is a single atomic operation. This cannot be done safely from the client.
 *
 * Security note:
 *   This function only returns PUBLIC key material.
 *   Private keys never leave the user's device (IndexedDB).
 *   Calling this function as an authenticated user is safe — you need
 *   someone's public keys to message them, and this is by design.
 */

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OPKEntry {
  keyId: number;
  publicKey: string; // base64
}

interface SignedPreKey {
  keyId: number;
  publicKey: string; // base64
  signature: string; // base64
}

interface KeyBundleDoc {
  registrationId: number;
  identityKey: string; // base64
  signedPreKey: SignedPreKey;
  oneTimePreKeys: OPKEntry[];
}

interface GetKeyBundleRequest {
  targetUserId: string;
}

interface GetKeyBundleResponse {
  registrationId: number;
  identityKey: string;
  signedPreKey: SignedPreKey;
  preKey?: OPKEntry; // undefined if OPKs exhausted
}

// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------

export const getKeyBundle = onCall(
  async (request: CallableRequest<GetKeyBundleRequest>): Promise<GetKeyBundleResponse> => {
    // -- Auth guard ----------------------------------------------------------
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated to fetch key bundles.');
    }

    const { targetUserId } = request.data;

    if (!targetUserId || typeof targetUserId !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUserId is required.');
    }

    const bundleRef = db
      .collection('users')
      .doc(targetUserId)
      .collection('signal')
      .doc('keyBundle');

    let consumedOPK: OPKEntry | undefined;
    let bundleData: KeyBundleDoc | undefined;

    // -- Atomic OPK consumption ----------------------------------------------
    // runTransaction guarantees no two callers consume the same OPK.
    // Firestore retries automatically on contention (up to 5 times).
    try {
      await db.runTransaction(async tx => {
        const snapshot = await tx.get(bundleRef);

        if (!snapshot.exists) {
          throw new HttpsError(
            'not-found',
            `No key bundle found for user ${targetUserId}. ` +
              'They may not have completed Signal registration.'
          );
        }

        bundleData = snapshot.data() as KeyBundleDoc;
        const preKeys = [...bundleData.oneTimePreKeys]; // copy — don't mutate snapshot

        if (preKeys.length > 0) {
          consumedOPK = preKeys.pop();
          tx.update(bundleRef, { oneTimePreKeys: preKeys });
        } else {
          console.warn(`⚠️ OPKs exhausted for user ${targetUserId}`);
        }
      });
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('Transaction failed fetching key bundle:', error);
      throw new HttpsError('internal', 'Failed to fetch key bundle. Please try again.');
    }

    if (!bundleData) {
      throw new HttpsError('internal', 'Bundle data unexpectedly undefined.');
    }

    // -- Build response ------------------------------------------------------
    const response: GetKeyBundleResponse = {
      registrationId: bundleData.registrationId,
      identityKey: bundleData.identityKey,
      signedPreKey: bundleData.signedPreKey,
    };

    if (consumedOPK) {
      response.preKey = consumedOPK;
    } else {
      console.warn(`⚠️ No OPK available for ${targetUserId} — X3DH proceeding without OPK`);
    }

    console.log(`✅ Key bundle served for ${targetUserId}`, {
      requestedBy: request.auth.uid,
      hadOPK: !!consumedOPK,
    });

    return response;
  }
);
