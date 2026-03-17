/**
 * constants.ts
 *
 * Configuration constants for the Messaging feature.
 * Centralised here so thresholds and IDs are easy to tune without
 * hunting through the codebase.
 */

// ---------------------------------------------------------------------------
// One-Time Prekeys
// ---------------------------------------------------------------------------

/** Number of OPKs generated in each batch (initial + replenishment) */
export const ONE_TIME_PREKEY_BATCH_SIZE = 100;

/**
 * When Firestore reports fewer than this many OPKs remaining,
 * trigger a replenishment upload.
 */
export const ONE_TIME_PREKEY_REPLENISH_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Signed Prekey Rotation
// ---------------------------------------------------------------------------

/** keyId used for the very first SPK generated at registration */
export const SIGNED_PREKEY_ID_INITIAL = 1;

/**
 * How long to keep an old SPK in IndexedDB after rotation (ms).
 * Gives in-flight messages time to be delivered and decrypted before
 * the private key is deleted.
 * Default: 7 days
 */
export const SIGNED_PREKEY_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How often to rotate the SPK (ms).
 * Default: 30 days
 */
export const SIGNED_PREKEY_ROTATION_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Firestore collection paths
// Centralised here so a schema change only requires one edit.
// ---------------------------------------------------------------------------

export const FIRESTORE_PATHS = {
  /** Public key bundles: /users/{userId}/keyBundle/public */
  keyBundle: (userId: string) => `users/${userId}/keyBundle/public`,

  /** Conversations: /conversations/{conversationId} */
  conversation: (conversationId: string) => `conversations/${conversationId}`,

  /** Messages: /conversations/{conversationId}/messages/{messageId} */
  messages: (conversationId: string) => `conversations/${conversationId}/messages`,
} as const;

// ---------------------------------------------------------------------------
// Message types
// Used to distinguish X3DH session-initiating messages from normal messages
// so the receiver knows which decryption path to use.
// ---------------------------------------------------------------------------

export const MESSAGE_TYPE = {
  /** First message in a conversation — carries X3DH prekey bundle */
  PREKEY: 'prekey',
  /** All subsequent messages — uses Double Ratchet only */
  WHISPER: 'whisper',
} as const;

export type MessageType = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];
