/**
 * sessionManager.ts
 *
 * Manages Signal Protocol sessions for the Belrose messaging layer.
 *
 * Handles two distinct operations:
 *
 *   1. SESSION INITIATION (X3DH)
 *      When Alice sends Bob her first ever message, we need to:
 *        - Fetch Bob's public key bundle from Firestore (via Cloud Function)
 *        - Run X3DH via SessionBuilder.processPreKey() to establish a shared secret
 *        - Encrypt the message — the result is a PreKeyWhisperMessage (type 3)
 *        - Bob's client runs the same X3DH in reverse on first decrypt
 *
 *   2. SUBSEQUENT MESSAGES (Double Ratchet)
 *      Once a session exists, SessionCipher handles everything:
 *        - encrypt() advances the KDF chain, produces a WhisperMessage (type 1)
 *        - decryptWhisperMessage() advances the ratchet on receive
 *        - Ratchet state in IndexedDB is overwritten after every operation
 *
 * The library (SessionBuilder + SessionCipher) handles all cryptographic math.
 * This file's job is wiring the library to our store and Firestore layer.
 */

import {
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
} from '@privacyresearch/libsignal-protocol-typescript';
import type { DeviceType } from '@privacyresearch/libsignal-protocol-typescript';
import { BelroseSignalStore } from './BelroseSignalStore';
import { KeyBundleService } from '../services/keyBundleService';
import type { ReceivedKeyBundle } from '../services/keyBundleService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Belrose uses a single device ID per user for now.
 * Multi-device support (linked devices) can be layered on later.
 */
const DEVICE_ID = 1;

/**
 * Message type values from the Signal Protocol.
 * type === 3 → PreKeyWhisperMessage (first message in a session, carries X3DH data)
 * type === 1 → WhisperMessage       (all subsequent messages, Double Ratchet only)
 */
export const SIGNAL_MESSAGE_TYPE = {
  PREKEY_WHISPER: 3,
  WHISPER: 1,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The encrypted payload stored in Firestore.
 * `type` tells the receiver which decryption path to use.
 * `body` is the base64-encoded ciphertext produced by SessionCipher.
 */
export interface EncryptedMessage {
  /** 3 = PreKeyWhisperMessage (session init), 1 = WhisperMessage (subsequent) */
  type: 1 | 3;
  /** Base64-encoded encrypted message body */
  body: string;
  /** Signal registration ID of the sender's device */
  registrationId: number;
}

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

export class SessionManager {
  // -------------------------------------------------------------------------
  // Encrypt
  // -------------------------------------------------------------------------

  /**
   * Encrypts a plaintext message for a recipient.
   *
   * Handles both cases transparently:
   *   - No existing session → fetches key bundle, runs X3DH, encrypts as PreKeyWhisperMessage
   *   - Existing session    → encrypts directly as WhisperMessage, advances Double Ratchet
   *
   * The caller doesn't need to know which case applies — this method handles it.
   *
   * @param recipientUserId - Firebase Auth UID of the recipient
   * @param plaintext       - The message text to encrypt
   * @returns EncryptedMessage ready to store in Firestore
   */
  static async encryptMessage(
    recipientUserId: string,
    plaintext: string
  ): Promise<EncryptedMessage> {
    const store = new BelroseSignalStore();
    const recipientAddress = new SignalProtocolAddress(recipientUserId, DEVICE_ID);

    // -- Check for existing session -----------------------------------------
    const cipher = new SessionCipher(store, recipientAddress);
    const hasSession = await cipher.hasOpenSession();

    if (!hasSession) {
      // No session yet — need to run X3DH first
      await SessionManager.initSession(recipientUserId, store);
    }

    // -- Encrypt -------------------------------------------------------------
    // SessionCipher.encrypt() handles both PreKeyWhisperMessage (first message)
    // and WhisperMessage (subsequent) automatically based on session state.
    // It also advances the Double Ratchet KDF chain and updates IndexedDB.
    const encrypted = await cipher.encrypt(new TextEncoder().encode(plaintext).buffer);

    if (!encrypted.body) {
      throw new Error('Encryption produced empty body — session state may be corrupted.');
    }

    return {
      type: encrypted.type as 1 | 3,
      body: encrypted.body,
      registrationId: encrypted.registrationId ?? 0,
    };
  }

  // -------------------------------------------------------------------------
  // Decrypt
  // -------------------------------------------------------------------------

  /**
   * Decrypts an incoming message.
   *
   * Routes to the correct decryption path based on message type:
   *   - type 3 (PreKeyWhisperMessage) → runs X3DH on Bob's side, establishes session
   *   - type 1 (WhisperMessage)       → advances Double Ratchet, decrypts normally
   *
   * After decryption, the ratchet state in IndexedDB is updated automatically.
   *
   * @param senderUserId     - Firebase Auth UID of the message sender
   * @param encryptedMessage - The encrypted payload from Firestore
   * @returns Decrypted plaintext string
   */
  static async decryptMessage(
    senderUserId: string,
    encryptedMessage: EncryptedMessage
  ): Promise<string> {
    const store = new BelroseSignalStore();
    const senderAddress = new SignalProtocolAddress(senderUserId, DEVICE_ID);
    const cipher = new SessionCipher(store, senderAddress);

    let plaintextBuffer: ArrayBuffer;

    if (encryptedMessage.type === SIGNAL_MESSAGE_TYPE.PREKEY_WHISPER) {
      // First message from this sender:
      //   - Library extracts Alice's EK and IK from the PreKeyWhisperMessage
      //   - Runs X3DH to derive the shared masterSecret
      //   - Consumes the local OPK private key from IndexedDB (via store.removePreKey)
      //   - Initialises the Double Ratchet
      //   - Decrypts the message
      // All of this happens inside this single call.
      plaintextBuffer = await cipher.decryptPreKeyWhisperMessage(encryptedMessage.body, 'binary');
    } else {
      // Subsequent message:
      //   - Advances the Double Ratchet KDF chain
      //   - Derives the message key, decrypts, destroys the message key
      //   - If sender replied (new DH ratchet key in header), injects fresh
      //     randomness into the root key — this is the break-in recovery step
      plaintextBuffer = await cipher.decryptWhisperMessage(encryptedMessage.body, 'binary');
    }

    return new TextDecoder().decode(plaintextBuffer);
  }

  // -------------------------------------------------------------------------
  // Session initialisation (X3DH)
  // -------------------------------------------------------------------------

  /**
   * Fetches the recipient's key bundle and runs X3DH to establish a session.
   *
   * Called internally by encryptMessage() when no session exists.
   * Separated out so it can also be called proactively (e.g. pre-warm a
   * session when a user opens a conversation before typing their first message).
   *
   * @param recipientUserId - Firebase Auth UID of the recipient
   * @param store           - Optional pre-constructed store (avoids double instantiation)
   */
  static async initSession(recipientUserId: string, store?: BelroseSignalStore): Promise<void> {
    const signalStore = store ?? new BelroseSignalStore();
    const recipientAddress = new SignalProtocolAddress(recipientUserId, DEVICE_ID);

    // Fetch recipient's public key bundle — OPK consumed atomically by Cloud Function
    const keyBundle = await KeyBundleService.fetchKeyBundle(recipientUserId);

    // Convert our ReceivedKeyBundle into the DeviceType shape the library expects
    const device = bundleToDeviceType(keyBundle);

    // SessionBuilder.processPreKey() runs the full X3DH:
    //   DH1 = DH(our IK,   their SPK)
    //   DH2 = DH(our EK,   their IK)
    //   DH3 = DH(our EK,   their SPK)
    //   DH4 = DH(our EK,   their OPK)  ← omitted if no OPK available
    //   masterSecret = KDF(DH1 || DH2 || DH3 || DH4)
    //
    // The resulting session (including rootKey for the Double Ratchet) is
    // saved to IndexedDB via store.storeSession() automatically.
    const builder = new SessionBuilder(signalStore, recipientAddress);
    await builder.processPreKey(device);

    console.log('✅ X3DH session established with:', recipientUserId);
  }

  // -------------------------------------------------------------------------
  // Session state helpers
  // -------------------------------------------------------------------------

  /**
   * Returns true if an open session exists with the given user.
   * Used to decide whether to show "secure session established" UI indicators.
   */
  static async hasSession(recipientUserId: string): Promise<boolean> {
    const store = new BelroseSignalStore();
    const recipientAddress = new SignalProtocolAddress(recipientUserId, DEVICE_ID);
    const cipher = new SessionCipher(store, recipientAddress);
    return cipher.hasOpenSession();
  }

  /**
   * Closes and deletes the session with a given user.
   * Called on logout or when a user explicitly resets their messaging keys.
   * After this, the next message will trigger a fresh X3DH exchange.
   */
  static async closeSession(recipientUserId: string): Promise<void> {
    const store = new BelroseSignalStore();
    const recipientAddress = new SignalProtocolAddress(recipientUserId, DEVICE_ID);
    const cipher = new SessionCipher(store, recipientAddress);
    await cipher.closeOpenSessionForDevice();
    console.log('🔒 Session closed with:', recipientUserId);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts our ReceivedKeyBundle (from Firestore) into the DeviceType shape
 * that SessionBuilder.processPreKey() expects.
 *
 * The main difference is field naming — SignedPublicPreKeyType uses
 * { keyId, publicKey, signature } which maps directly from our bundle.
 */
function bundleToDeviceType(bundle: ReceivedKeyBundle): DeviceType {
  const device: DeviceType = {
    registrationId: bundle.registrationId,
    identityKey: bundle.identityKey,
    signedPreKey: {
      keyId: bundle.signedPreKey.keyId,
      publicKey: bundle.signedPreKey.publicKey,
      signature: bundle.signedPreKey.signature,
    },
  };

  // OPK is optional — X3DH proceeds without it if supply was exhausted
  if (bundle.preKey) {
    device.preKey = {
      keyId: bundle.preKey.keyId,
      publicKey: bundle.preKey.publicKey,
    };
  }

  return device;
}
