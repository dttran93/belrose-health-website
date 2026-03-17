/**
 * Messaging feature — public exports
 *
 * Import from here, never from internal paths directly.
 * This keeps the crypto and Firestore layers encapsulated and swappable.
 */

// Primary hook — what components use
export { useMessaging } from './hooks/useMessaging';
export type { UseMessagingReturn, DecryptedMessage } from './hooks/useMessaging';

// Key generation — called during registration flow
export {
  generateKeyBundle,
  generateAdditionalOneTimePreKeys,
  rotateSignedPreKey,
} from './lib/keyGeneration';
export type { PublicKeyBundle } from './lib/keyGeneration';

// Service types — needed by components that display conversation lists
export type { Conversation, StoredMessage } from './services/messageService';

// Constants
export {
  ONE_TIME_PREKEY_BATCH_SIZE,
  ONE_TIME_PREKEY_REPLENISH_THRESHOLD,
  SIGNED_PREKEY_ROTATION_INTERVAL_MS,
  FIRESTORE_PATHS,
  MESSAGE_TYPE,
} from './lib/constants';
export type { MessageType } from './lib/constants';
