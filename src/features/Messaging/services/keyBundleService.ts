/**
 * keyBundleService.ts
 *
 * Handles all Firestore operations for Signal Protocol public key bundles.
 *
 * Responsibilities:
 *   - Upload a user's public key bundle at registration
 *   - Fetch another user's key bundle when starting a conversation (via Cloud Function)
 *   - Replenish one-time prekeys when supply runs low
 *   - Update the signed prekey on rotation
 *
 * Security model:
 *   This service ONLY ever touches public keys.
 *   Private keys live exclusively in IndexedDB (BelroseSignalStore) and
 *   never pass through this file. Firestore only ever sees encrypted blobs
 *   and public key material — consistent with Belrose's zero-knowledge architecture.
 *
 * Firestore schema:
 *   /users/{userId}/signal/keyBundle
 *     registrationId:    number
 *     identityKey:       string  (base64 public key)
 *     signedPreKey:      { keyId, publicKey, signature }  (all base64)
 *     oneTimePreKeys:    Array<{ keyId, publicKey }>       (all base64)
 *     updatedAt:         Timestamp
 */

import { doc, setDoc, getDoc, updateDoc, serverTimestamp, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';
import { ONE_TIME_PREKEY_REPLENISH_THRESHOLD } from '../lib/constants';
import { PublicKeyBundle } from '../lib/keyGeneration';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Raw shape stored in Firestore — all ArrayBuffers serialised to base64 strings.
 * Firestore cannot store ArrayBuffers directly.
 */
interface FirestoreKeyBundle {
  registrationId: number;
  identityKey: string;
  signedPreKey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  oneTimePreKeys: Array<{
    keyId: number;
    publicKey: string;
  }>;
  updatedAt: ReturnType<typeof serverTimestamp>;
}

/**
 * Deserialized key bundle returned to callers — ArrayBuffers restored from base64.
 * This is the shape the Signal library expects for processPreKey().
 */
export interface ReceivedKeyBundle {
  registrationId: number;
  identityKey: ArrayBuffer;
  signedPreKey: {
    keyId: number;
    publicKey: ArrayBuffer;
    signature: ArrayBuffer;
  };
  /** Single OPK — already atomically consumed from Firestore by the Cloud Function */
  preKey?: {
    keyId: number;
    publicKey: ArrayBuffer;
  };
}

// ---------------------------------------------------------------------------
// KeyBundleService
// ---------------------------------------------------------------------------

export class KeyBundleService {
  private static db = getFirestore(getApp());
  private static functions = getFunctions(getApp());

  // -------------------------------------------------------------------------
  // Upload
  // -------------------------------------------------------------------------

  /**
   * Uploads a user's full public key bundle to Firestore at registration.
   *
   * Called once during the registration flow, immediately after
   * generateKeyBundle() returns. All ArrayBuffers are serialised to
   * base64 before writing — Firestore doesn't support binary types directly.
   *
   * @param userId  - Firebase Auth UID
   * @param bundle  - Public key bundle from generateKeyBundle()
   */
  static async uploadKeyBundle(userId: string, bundle: PublicKeyBundle): Promise<void> {
    console.log('📤 Uploading Signal key bundle for user:', userId);

    const firestoreBundle: FirestoreKeyBundle = {
      registrationId: bundle.registrationId,

      // Serialise all ArrayBuffers → base64
      identityKey: arrayBufferToBase64(bundle.identityKey),
      signedPreKey: {
        keyId: bundle.signedPreKey.keyId,
        publicKey: arrayBufferToBase64(bundle.signedPreKey.publicKey),
        signature: arrayBufferToBase64(bundle.signedPreKey.signature),
      },
      oneTimePreKeys: bundle.oneTimePreKeys.map(opk => ({
        keyId: opk.keyId,
        publicKey: arrayBufferToBase64(opk.publicKey),
      })),

      updatedAt: serverTimestamp(),
    };

    // Path: /users/{userId}/signal/keyBundle
    // Nested under /signal/ to keep Signal keys separate from other user profile data
    const bundleRef = doc(this.db, 'users', userId, 'signal', 'keyBundle');
    await setDoc(bundleRef, firestoreBundle);

    console.log('✅ Signal key bundle uploaded:', {
      userId,
      registrationId: bundle.registrationId,
      oneTimePreKeyCount: bundle.oneTimePreKeys.length,
    });
  }

  // -------------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------------

  /**
   * Fetches a recipient's key bundle to initiate an X3DH session.
   *
   * Calls the `getKeyBundle` Cloud Function rather than reading Firestore
   * directly — the Cloud Function atomically consumes one OPK in a
   * transaction, ensuring no two callers get the same OPK.
   *
   * @param recipientUserId - The Firebase Auth UID of the person to message
   * @returns Deserialized key bundle ready for SessionBuilder.processPreKey()
   */
  static async fetchKeyBundle(recipientUserId: string): Promise<ReceivedKeyBundle> {
    console.log('📥 Fetching key bundle for recipient:', recipientUserId);

    // Cloud Function handles the atomic OPK consumption
    const getKeyBundle = httpsCallable<
      { targetUserId: string },
      {
        registrationId: number;
        identityKey: string;
        signedPreKey: { keyId: number; publicKey: string; signature: string };
        preKey?: { keyId: number; publicKey: string };
      }
    >(this.functions, 'getKeyBundle');

    const result = await getKeyBundle({ targetUserId: recipientUserId });
    const raw = result.data;

    // Deserialise base64 → ArrayBuffer for the Signal library
    const bundle: ReceivedKeyBundle = {
      registrationId: raw.registrationId,
      identityKey: base64ToArrayBuffer(raw.identityKey),
      signedPreKey: {
        keyId: raw.signedPreKey.keyId,
        publicKey: base64ToArrayBuffer(raw.signedPreKey.publicKey),
        signature: base64ToArrayBuffer(raw.signedPreKey.signature),
      },
    };

    // preKey is optional — server may have run out of OPKs
    // X3DH can proceed without an OPK but with slightly reduced security.
    // The missing OPK case should be rare if replenishment is working correctly.
    if (raw.preKey) {
      bundle.preKey = {
        keyId: raw.preKey.keyId,
        publicKey: base64ToArrayBuffer(raw.preKey.publicKey),
      };
    } else {
      console.warn(
        '⚠️ No one-time prekey available for recipient. ' +
          'X3DH proceeding without OPK — consider prompting recipient to replenish.'
      );
    }

    console.log('✅ Key bundle fetched:', {
      recipientUserId,
      hasPreKey: !!bundle.preKey,
    });

    return bundle;
  }

  // -------------------------------------------------------------------------
  // OPK Replenishment
  // -------------------------------------------------------------------------

  /**
   * Checks whether the user's OPK supply is running low and replenishes if needed.
   *
   * Called after each message send (cheap Firestore read, not a write).
   * If below the replenish threshold, generates new OPKs and appends them
   * to the Firestore bundle.
   *
   * @param userId      - Firebase Auth UID of the current user
   * @param newPreKeys  - Fresh public OPKs from generateAdditionalOneTimePreKeys()
   */
  static async checkAndReplenishPreKeys(
    userId: string,
    newPreKeys: Array<{ keyId: number; publicKey: ArrayBuffer }>
  ): Promise<void> {
    const bundleRef = doc(this.db, 'users', userId, 'signal', 'keyBundle');
    const snapshot = await getDoc(bundleRef);

    if (!snapshot.exists()) {
      console.warn('⚠️ Key bundle not found for user:', userId);
      return;
    }

    const data = snapshot.data() as FirestoreKeyBundle;
    const remaining = data.oneTimePreKeys.length;

    console.log(
      `🔑 OPK supply check: ${remaining} remaining (threshold: ${ONE_TIME_PREKEY_REPLENISH_THRESHOLD})`
    );

    if (remaining >= ONE_TIME_PREKEY_REPLENISH_THRESHOLD) return;

    // Below threshold — append new batch
    console.log('📤 Replenishing OPK supply...');

    const serialisedNewKeys = newPreKeys.map(opk => ({
      keyId: opk.keyId,
      publicKey: arrayBufferToBase64(opk.publicKey),
    }));

    await updateDoc(bundleRef, {
      // arrayUnion would be cleaner but Signal OPKs aren't simple primitives —
      // we append manually to the existing array
      oneTimePreKeys: [...data.oneTimePreKeys, ...serialisedNewKeys],
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ OPK supply replenished: added ${newPreKeys.length} new keys`);
  }

  // -------------------------------------------------------------------------
  // SPK Rotation
  // -------------------------------------------------------------------------

  /**
   * Updates the signed prekey in Firestore after rotation.
   *
   * Called from the SPK rotation flow in keyGeneration.ts after the new
   * SPK private key has been saved to IndexedDB. Only the public key and
   * signature are written here — the private key stays local.
   *
   * @param userId    - Firebase Auth UID
   * @param newSPK    - New signed prekey public data from rotateSignedPreKey()
   */
  static async updateSignedPreKey(
    userId: string,
    newSPK: { keyId: number; publicKey: ArrayBuffer; signature: ArrayBuffer }
  ): Promise<void> {
    console.log('🔄 Updating signed prekey for user:', userId);

    const bundleRef = doc(this.db, 'users', userId, 'signal', 'keyBundle');

    await updateDoc(bundleRef, {
      signedPreKey: {
        keyId: newSPK.keyId,
        publicKey: arrayBufferToBase64(newSPK.publicKey),
        signature: arrayBufferToBase64(newSPK.signature),
      },
      updatedAt: serverTimestamp(),
    });

    console.log('✅ Signed prekey updated:', { userId, keyId: newSPK.keyId });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Returns true if a key bundle exists for the given user.
   * Used during registration to detect if a device has already been registered
   * (e.g. user reinstalling the app).
   */
  static async hasKeyBundle(userId: string): Promise<boolean> {
    const bundleRef = doc(this.db, 'users', userId, 'signal', 'keyBundle');
    const snapshot = await getDoc(bundleRef);
    return snapshot.exists();
  }
}
