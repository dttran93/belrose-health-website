/**
 * BelroseSignalStore.ts
 *
 * IndexedDB storage adapter for the Signal Protocol library.
 *
 * The @privacyresearch/libsignal-protocol-typescript library calls these
 * methods automatically during X3DH and Double Ratchet operations.
 * Your job is just to implement the StorageType interface — the library
 * handles all cryptographic logic internally.
 *
 * Four things stored here:
 *   1. identityKeyPair  — permanent keypair, generated once at registration
 *   2. preKeys          — one-time prekeys (OPKs), deleted after single use
 *   3. signedPreKey     — rotating signed prekey (SPK)
 *   4. sessions         — Double Ratchet state per conversation
 */

import { openDB, IDBPDatabase } from 'idb';
import type {
  StorageType,
  KeyPairType,
  SessionRecordType,
} from '@privacyresearch/libsignal-protocol-typescript';
import { Direction } from '@privacyresearch/libsignal-protocol-typescript';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_NAME = 'belrose-signal';
const DB_VERSION = 1;

const STORES = {
  IDENTITY: 'identity',
  PRE_KEYS: 'preKeys',
  SIGNED_PRE_KEYS: 'signedPreKeys',
  SESSIONS: 'sessions',
} as const;

// ---------------------------------------------------------------------------
// DB initialisation
// ---------------------------------------------------------------------------

/**
 * Opens (or creates) the IndexedDB database.
 * Called lazily — only when a store method is first invoked.
 */
async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // createObjectStore is idempotent-guarded — safe to call on every upgrade
      if (!db.objectStoreNames.contains(STORES.IDENTITY)) {
        db.createObjectStore(STORES.IDENTITY);
      }
      if (!db.objectStoreNames.contains(STORES.PRE_KEYS)) {
        db.createObjectStore(STORES.PRE_KEYS);
      }
      if (!db.objectStoreNames.contains(STORES.SIGNED_PRE_KEYS)) {
        db.createObjectStore(STORES.SIGNED_PRE_KEYS);
      }
      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        db.createObjectStore(STORES.SESSIONS);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// BelroseSignalStore
// ---------------------------------------------------------------------------

export class BelroseSignalStore implements StorageType {
  // -------------------------------------------------------------------------
  // 1. Identity Key
  //
  //    The permanent keypair that cryptographically represents this user
  //    on this device. Private key NEVER leaves IndexedDB.
  //    Public key is uploaded to Firestore on registration.
  //
  //    Also stores remote users' public identity keys so we can detect
  //    if they ever change (which would indicate a potential MITM attack).
  // -------------------------------------------------------------------------

  async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
    const db = await getDB();
    return db.get(STORES.IDENTITY, 'identityKeyPair');
  }

  async saveIdentityKeyPair(keyPair: KeyPairType): Promise<void> {
    const db = await getDB();
    await db.put(STORES.IDENTITY, keyPair, 'identityKeyPair');
  }

  /**
   * Registration ID: a random number that identifies this specific device.
   * Allows the protocol to distinguish multiple devices per user account.
   */
  async getLocalRegistrationId(): Promise<number | undefined> {
    const db = await getDB();
    return db.get(STORES.IDENTITY, 'registrationId');
  }

  async saveLocalRegistrationId(registrationId: number): Promise<void> {
    const db = await getDB();
    await db.put(STORES.IDENTITY, registrationId, 'registrationId');
  }

  /**
   * Stores the PUBLIC identity key of a remote user we've communicated with.
   * Returns true if this is a new or changed key — a changed key is a
   * security signal worth surfacing to the user (potential key compromise).
   *
   * @param identifier - "{userId}.{deviceId}" format used by Signal Protocol
   * @param identityKey - Remote user's public identity key
   */
  async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
    const db = await getDB();
    const existing = await db.get(STORES.IDENTITY, `remote_${identifier}`);
    const isNewOrChanged = !existing || !buffersAreEqual(existing, identityKey);
    await db.put(STORES.IDENTITY, identityKey, `remote_${identifier}`);
    return isNewOrChanged;
  }

  /**
   * Checks whether a remote user's identity key matches what we have stored.
   *
   * Uses TOFU (Trust On First Use) — if we've never seen this identity before,
   * we trust it. This is the same model Signal uses. For Belrose, you could
   * strengthen this by cross-referencing against Firebase Auth at registration
   * time, which is actually stronger than Signal's approach since you have
   * verified user identities.
   */
  async isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer,
    _direction: Direction // SENDING or RECEIVING — reserved for future directional trust logic
  ): Promise<boolean> {
    const db = await getDB();
    const trusted = await db.get(STORES.IDENTITY, `remote_${identifier}`);

    // First contact — trust and store
    if (!trusted) return true;

    // Subsequent contact — must match exactly
    return buffersAreEqual(trusted, identityKey);
  }

  async loadIdentityKey(identifier: string): Promise<ArrayBuffer | undefined> {
    const db = await getDB();
    return db.get(STORES.IDENTITY, `remote_${identifier}`);
  }

  // -------------------------------------------------------------------------
  // 2. One-Time PreKeys (OPKs)
  //
  //    Generated in batches of ~100 at registration.
  //    Public keys uploaded to Firestore. Private keys stay here.
  //    Each prekey is used exactly ONCE then deleted — this is what prevents
  //    replay attacks and makes each session initiation cryptographically unique.
  //
  //    removePreKey is called automatically by the library after consumption.
  // -------------------------------------------------------------------------

  async loadPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const db = await getDB();
    return db.get(STORES.PRE_KEYS, keyId);
  }

  async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    const db = await getDB();
    await db.put(STORES.PRE_KEYS, keyPair, keyId);
  }

  async removePreKey(keyId: number | string): Promise<void> {
    const db = await getDB();
    await db.delete(STORES.PRE_KEYS, keyId);
  }

  // -------------------------------------------------------------------------
  // 3. Signed PreKey (SPK)
  //
  //    Rotates on a schedule (weekly or monthly).
  //    Signed by the identity key so recipients can verify it's genuine.
  //    Rotation limits blast radius: compromising one SPK only exposes
  //    sessions initiated during that rotation window.
  //
  //    Private key stays here. Public key + signature go to Firestore.
  // -------------------------------------------------------------------------

  // loadSignedPreKey returns KeyPairType (not SignedPreKeyPairType) per StorageType interface
  async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const db = await getDB();
    return db.get(STORES.SIGNED_PRE_KEYS, keyId);
  }

  async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    const db = await getDB();
    await db.put(STORES.SIGNED_PRE_KEYS, keyPair, keyId);
  }

  async removeSignedPreKey(keyId: number | string): Promise<void> {
    const db = await getDB();
    await db.delete(STORES.SIGNED_PRE_KEYS, keyId);
  }

  // -------------------------------------------------------------------------
  // 4. Sessions (Double Ratchet State)
  //
  //    The most critical store. Each conversation has one session record
  //    containing the full Double Ratchet state:
  //      - rootKey (evolves with each DH ratchet step)
  //      - chainKey (evolves with each message sent)
  //      - sending/receiving ratchet keypairs
  //      - message counters
  //
  //    This record is OVERWRITTEN after every single message send/receive.
  //    That overwrite IS forward secrecy — the old state is gone and cannot
  //    be used to decrypt past messages even if the current state is stolen.
  //
  //    The library manages all of this internally — you just persist whatever
  //    it gives you after each operation.
  // -------------------------------------------------------------------------

  async loadSession(identifier: string): Promise<SessionRecordType | undefined> {
    const db = await getDB();
    return db.get(STORES.SESSIONS, identifier);
  }

  /**
   * Called automatically after every message send/receive.
   * Overwrites previous ratchet state — this is where forward secrecy happens.
   */
  async storeSession(identifier: string, record: SessionRecordType): Promise<void> {
    const db = await getDB();
    await db.put(STORES.SESSIONS, record, identifier);
  }

  async removeSession(identifier: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORES.SESSIONS, identifier);
  }

  /**
   * Removes all sessions for a given user — used on logout or account reset.
   * Sessions are keyed as "{userId}.{deviceId}" so we filter by userId prefix.
   */
  async removeAllSessions(userId: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORES.SESSIONS, 'readwrite');
    const keys = await tx.store.getAllKeys();
    const userSessionKeys = keys.filter(k => String(k).startsWith(`${userId}.`));
    await Promise.all(userSessionKeys.map(k => tx.store.delete(k)));
    await tx.done;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deep equality check for ArrayBuffers.
 * JavaScript's === compares references not contents, so two ArrayBuffers
 * with identical bytes will still fail === comparison. We need byte-level
 * comparison for identity key verification to work correctly.
 */
function buffersAreEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const viewA = new Uint8Array(a);
  const viewB = new Uint8Array(b);
  return viewA.every((byte, i) => byte === viewB[i]);
}
