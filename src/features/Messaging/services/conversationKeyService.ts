/**
 * conversationKeyService.ts
 *
 * Manages the AES-256-GCM conversation key for each messaging conversation.
 *
 * Security model:
 *   Each conversation gets a single AES-256-GCM key generated on first message.
 *   That key is wrapped (RSA-OAEP) separately for each participant using their
 *   existing RSA public keys (the same keys used for health record sharing) and
 *   stored in the conversation document in Firestore. Neither participant's
 *   wrapped copy can decrypt the other's.
 *
 *   This reuses the existing SharingKeyManagementService infrastructure —
 *   no new key material or key management concepts are introduced.
 *
 * Firestore schema addition to /conversations/{conversationId}:
 *   encryptedKeys: {
 *     [userId]: string   — base64 RSA-OAEP wrapped AES-256 conversation key
 *     [userId]: string   — same key wrapped for the other participant
 *   }
 *
 * Key lifecycle:
 *   - Generated once by the sender when sending the first message
 *   - Stored wrapped for both participants atomically with the conversation doc
 *   - Retrieved and unwrapped on each session (in-memory only, never persisted)
 *   - If a key is missing for a participant (e.g. new device), they cannot read
 *     old messages — same behaviour as the record sharing flow
 */

import { doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { SharingKeyManagementService } from '@/features/Sharing/services/sharingKeyManagementService';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';

// ---------------------------------------------------------------------------
// Module-level in-memory cache
// ---------------------------------------------------------------------------

/**
 * Caches unwrapped CryptoKey objects by conversationId for the current session.
 *
 * Unwrapping RSA keys on every encrypt/decrypt would be expensive and
 * requires the master key each time. Cache after first unwrap so subsequent
 * messages in the same conversation are fast.
 *
 * Cleared on logout (page unload) since it's module-level memory only.
 */
const keyCache = new Map<string, CryptoKey>();

// ---------------------------------------------------------------------------
// ConversationKeyService
// ---------------------------------------------------------------------------

export class ConversationKeyService {
  private static db = getFirestore();

  // -------------------------------------------------------------------------
  // Get or create conversation key
  // -------------------------------------------------------------------------

  /**
   * Returns the AES-256-GCM conversation key for the given conversation.
   *
   * If the conversation already has wrapped keys in Firestore, unwraps the
   * current user's copy using their RSA private key.
   *
   * If no keys exist yet (first message ever), generates a fresh AES key,
   * wraps it for both participants, and writes to Firestore.
   *
   * @param conversationId - Firestore conversation document ID
   * @param participantIds - Both participant UIDs (order doesn't matter)
   * @returns Unwrapped AES-256-GCM CryptoKey ready for encrypt/decrypt
   */
  static async getOrCreateKey(
    conversationId: string,
    participantIds: [string, string]
  ): Promise<CryptoKey> {
    // Return cached key if available — avoids RSA unwrap on every message
    const cached = keyCache.get(conversationId);
    if (cached) return cached;

    const currentUserId = getAuth().currentUser?.uid;
    if (!currentUserId) throw new Error('Not authenticated');

    const masterKey = await EncryptionKeyManager.getSessionKey();
    if (!masterKey) throw new Error('Encryption session not active');

    const convRef = doc(this.db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);

    if (!convSnap.exists()) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const convData = convSnap.data();
    const encryptedKeys: Record<string, string> = convData.encryptedKeys ?? {};

    if (encryptedKeys[currentUserId]) {
      // Keys already exist — unwrap current user's copy
      const conversationKey = await ConversationKeyService.unwrapKeyForCurrentUser(
        encryptedKeys[currentUserId],
        masterKey
      );
      keyCache.set(conversationId, conversationKey);
      return conversationKey;
    }

    // No keys yet — this is the first message. Generate and store for both parties.
    console.log('🔑 Generating new conversation key for:', conversationId);
    const conversationKey = await EncryptionService.generateFileKey();

    const newEncryptedKeys = await ConversationKeyService.wrapKeyForParticipants(
      conversationKey,
      participantIds,
      masterKey
    );

    // Atomic write — both wrapped copies land in the same document update
    await updateDoc(convRef, { encryptedKeys: newEncryptedKeys });

    console.log('✅ Conversation key generated and stored');
    keyCache.set(conversationId, conversationKey);
    return conversationKey;
  }

  // -------------------------------------------------------------------------
  // Cache management
  // -------------------------------------------------------------------------

  /**
   * Removes a conversation key from the in-memory cache.
   * Call this when closing a conversation or on logout.
   */
  static clearCachedKey(conversationId: string): void {
    keyCache.delete(conversationId);
  }

  /**
   * Clears all cached conversation keys.
   * Call on logout to ensure no key material lingers in memory.
   */
  static clearAllCachedKeys(): void {
    keyCache.clear();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Wraps the conversation key for each participant using their RSA public key.
   *
   * Fetches each participant's public key from Firestore
   * (stored at users/{uid}/encryption.publicKey — same as record sharing).
   *
   * Returns a map of { [userId]: base64WrappedKey } for both participants.
   */
  private static async wrapKeyForParticipants(
    conversationKey: CryptoKey,
    participantIds: [string, string],
    _masterKey: CryptoKey // reserved for future use (e.g. self-wrap fallback)
  ): Promise<Record<string, string>> {
    const encryptedKeys: Record<string, string> = {};

    await Promise.all(
      participantIds.map(async userId => {
        const userRef = doc(this.db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          throw new Error(`User ${userId} not found — cannot wrap conversation key`);
        }

        const publicKeyBase64 = userSnap.data()?.encryption?.publicKey;
        if (!publicKeyBase64) {
          throw new Error(
            `User ${userId} has no RSA public key — encryption setup may be incomplete`
          );
        }

        const rsaPublicKey = await SharingKeyManagementService.importPublicKey(publicKeyBase64);
        encryptedKeys[userId] = await SharingKeyManagementService.wrapKey(
          conversationKey,
          rsaPublicKey
        );
      })
    );

    return encryptedKeys;
  }

  /**
   * Unwraps the current user's wrapped conversation key using their RSA private key.
   *
   * The RSA private key is stored encrypted in Firestore and must be decrypted
   * with the master key first — same flow as record decryption.
   */
  private static async unwrapKeyForCurrentUser(
    wrappedKeyBase64: string,
    masterKey: CryptoKey
  ): Promise<CryptoKey> {
    const currentUserId = getAuth().currentUser?.uid;
    if (!currentUserId) throw new Error('Not authenticated');

    const userRef = doc(this.db, 'users', currentUserId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) throw new Error('User profile not found');

    const userData = userSnap.data();
    if (!userData?.encryption?.encryptedPrivateKey) {
      throw new Error('RSA private key not found — please complete account setup');
    }

    // Decrypt the RSA private key using the master key
    const privateKeyBytes = await EncryptionService.decryptFile(
      base64ToArrayBuffer(userData.encryption.encryptedPrivateKey),
      masterKey,
      base64ToArrayBuffer(userData.encryption.encryptedPrivateKeyIV)
    );

    const rsaPrivateKey = await SharingKeyManagementService.importPrivateKey(
      arrayBufferToBase64(privateKeyBytes)
    );

    return await SharingKeyManagementService.unwrapKey(wrappedKeyBase64, rsaPrivateKey);
  }
}
