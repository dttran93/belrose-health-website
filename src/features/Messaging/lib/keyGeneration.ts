/**
 * keyGeneration.ts
 *
 * Generates all Signal Protocol keys at user registration.
 *
 * Called ONCE when a user creates their Belrose account. After this:
 *   - Private keys are saved to IndexedDB via BelroseSignalStore
 *   - Public keys are returned for upload to Firestore
 *
 * Key hierarchy reminder:
 *   password → masterKey (AES) → encrypts → identityKeyPair (permanent DH)
 *                                                    ↓ signs
 *                                             signedPreKey (rotating)
 *                                             oneTimePreKeys (batch, single use)
 */

import { KeyHelper } from '@privacyresearch/libsignal-protocol-typescript';
import { BelroseSignalStore } from './BelroseSignalStore';
import { ONE_TIME_PREKEY_BATCH_SIZE, SIGNED_PREKEY_ID_INITIAL } from './constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The public-facing key bundle uploaded to Firestore.
 * Contains ONLY public keys — private keys never leave IndexedDB.
 */
export interface PublicKeyBundle {
  /** Identifies this device — used by Signal Protocol for multi-device support */
  registrationId: number;
  /** Public half of the permanent identity keypair */
  identityKey: ArrayBuffer;
  signedPreKey: {
    keyId: number;
    publicKey: ArrayBuffer;
    /** Signature over the SPK public key, made with the identity private key */
    signature: ArrayBuffer;
  };
  /** Batch of single-use public prekeys */
  oneTimePreKeys: Array<{
    keyId: number;
    publicKey: ArrayBuffer;
  }>;
}

// ---------------------------------------------------------------------------
// Key Generation
// ---------------------------------------------------------------------------

/**
 * Generates a complete Signal Protocol key bundle for a new user.
 *
 * Steps:
 *   1. Generate identity keypair + registration ID
 *   2. Generate signed prekey (signed with identity private key)
 *   3. Generate batch of one-time prekeys
 *   4. Persist ALL private keys to IndexedDB
 *   5. Return public keys for Firestore upload
 *
 * @returns PublicKeyBundle — safe to upload to Firestore, no private key material
 */
export async function generateKeyBundle(): Promise<PublicKeyBundle> {
  const store = new BelroseSignalStore();

  // -- 1. Identity keypair + registration ID --------------------------------
  //
  // identityKeyPair.pubKey  → goes to Firestore
  // identityKeyPair.privKey → stays in IndexedDB forever
  //
  // This is the cryptographic root of the user's identity on this device.
  // The private key is what makes signatures verifiable and DH exchanges work.

  const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  const registrationId = await KeyHelper.generateRegistrationId();

  await store.saveIdentityKeyPair(identityKeyPair);
  await store.saveLocalRegistrationId(registrationId);

  // -- 2. Signed prekey -----------------------------------------------------
  //
  // Signed by the identity private key so recipients can verify:
  // "this SPK was genuinely created by whoever owns this identity key"
  //
  // Rotates weekly/monthly — rotation schedule handled in keyRotation.ts (future)

  const signedPreKeyId = SIGNED_PREKEY_ID_INITIAL;
  const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, signedPreKeyId);

  await store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);

  // -- 3. One-time prekeys --------------------------------------------------
  //
  // Generated in a batch. Each one is used exactly once in X3DH then deleted.
  // Generating 100 upfront means we don't need to regenerate immediately —
  // the server will notify us when supply runs low (handled in keyBundleService)

  const oneTimePreKeyPairs = await Promise.all(
    Array.from({ length: ONE_TIME_PREKEY_BATCH_SIZE }, (_, i) => KeyHelper.generatePreKey(i + 1))
  );

  // Store all private keys locally
  await Promise.all(
    oneTimePreKeyPairs.map(preKey => store.storePreKey(preKey.keyId, preKey.keyPair))
  );

  // -- 4. Build public bundle -----------------------------------------------
  //
  // Strip all private key material before returning.
  // This is what gets uploaded to Firestore — safe for the server to store.

  return {
    registrationId,
    identityKey: identityKeyPair.pubKey,
    signedPreKey: {
      keyId: signedPreKeyId,
      publicKey: signedPreKey.keyPair.pubKey,
      signature: signedPreKey.signature,
    },
    oneTimePreKeys: oneTimePreKeyPairs.map(preKey => ({
      keyId: preKey.keyId,
      publicKey: preKey.keyPair.pubKey,
    })),
  };
}

// ---------------------------------------------------------------------------
// OPK Replenishment
// ---------------------------------------------------------------------------

/**
 * Generates a fresh batch of one-time prekeys to replenish supply.
 *
 * Called when Firestore notifies us that the user's OPK supply is running low
 * (typically when < 10 remain). The keyBundleService handles the upload.
 *
 * @param startingKeyId - The next keyId to use (must be higher than all existing)
 * @returns Array of public OPKs safe to upload to Firestore
 */
export async function generateAdditionalOneTimePreKeys(
  startingKeyId: number
): Promise<Array<{ keyId: number; publicKey: ArrayBuffer }>> {
  const store = new BelroseSignalStore();

  const newPreKeys = await Promise.all(
    Array.from({ length: ONE_TIME_PREKEY_BATCH_SIZE }, (_, i) =>
      KeyHelper.generatePreKey(startingKeyId + i)
    )
  );

  // Store private keys locally
  await Promise.all(newPreKeys.map(preKey => store.storePreKey(preKey.keyId, preKey.keyPair)));

  // Return only public keys for Firestore
  return newPreKeys.map(preKey => ({
    keyId: preKey.keyId,
    publicKey: preKey.keyPair.pubKey,
  }));
}

// ---------------------------------------------------------------------------
// SPK Rotation
// ---------------------------------------------------------------------------

/**
 * Generates a new signed prekey for rotation.
 *
 * The old SPK should be kept in IndexedDB for a grace period (~1 week)
 * to allow decryption of any in-flight messages that used it before rotation.
 * After the grace period, removeSignedPreKey can be called on the old keyId.
 *
 * @param newKeyId - Must be higher than the previous SPK keyId
 * @returns New public SPK data safe to upload to Firestore
 */
export async function rotateSignedPreKey(newKeyId: number): Promise<{
  keyId: number;
  publicKey: ArrayBuffer;
  signature: ArrayBuffer;
}> {
  const store = new BelroseSignalStore();
  const identityKeyPair = await store.getIdentityKeyPair();

  if (!identityKeyPair) {
    throw new Error('No identity key found — has this device been registered?');
  }

  const newSignedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, newKeyId);

  await store.storeSignedPreKey(newKeyId, newSignedPreKey.keyPair);

  return {
    keyId: newKeyId,
    publicKey: newSignedPreKey.keyPair.pubKey,
    signature: newSignedPreKey.signature,
  };
}
