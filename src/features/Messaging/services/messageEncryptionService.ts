/**
 * messageEncryptionService.ts
 *
 * Encrypts and decrypts individual messages using the conversation's
 * AES-256-GCM key (retrieved via ConversationKeyService).
 *
 *
 * Encryption model:
 *   - Each message gets a fresh random 96-bit IV (AES-GCM requirement)
 *   - The IV is stored alongside the ciphertext in Firestore (not secret)
 *   - The conversation key is shared between participants and never changes
 *   - Firestore stores only: { body: base64(ciphertext), iv: base64(iv) }
 *
 * Why per-message IVs matter:
 *   AES-GCM's security guarantee breaks completely if the same IV is ever
 *   reused with the same key. crypto.getRandomValues() on a 12-byte IV has
 *   a collision probability of ~1 in 2^96 — negligible for any realistic
 *   message volume. This is the standard approach used by Signal's backup
 *   layer, WhatsApp's media encryption, and iMessage.
 */

import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { ConversationKeyService } from './conversationKeyService';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The encrypted payload stored in Firestore per message.
 * Replaces the Signal-era EncryptedMessage type (which had type/registrationId).
 */
export interface EncryptedMessage {
  /** Base64-encoded AES-GCM ciphertext */
  body: string;
  /** Base64-encoded 12-byte IV — unique per message, not secret */
  iv: string;
}

// ---------------------------------------------------------------------------
// MessageEncryptionService
// ---------------------------------------------------------------------------

export class MessageEncryptionService {
  /**
   * Encrypts a plaintext message for a conversation.
   *
   * Retrieves (or generates) the conversation key via ConversationKeyService,
   * then encrypts with a fresh IV using AES-256-GCM.
   *
   * @param plaintext      - The message text to encrypt
   * @param conversationId - Firestore conversation document ID
   * @param participantIds - Both participant UIDs (needed if key doesn't exist yet)
   * @returns EncryptedMessage ready to store in Firestore
   */
  static async encryptMessage(
    plaintext: string,
    conversationId: string,
    participantIds: [string, string]
  ): Promise<EncryptedMessage> {
    const conversationKey = await ConversationKeyService.getOrCreateKey(
      conversationId,
      participantIds
    );

    const plaintextBytes = new TextEncoder().encode(plaintext);

    // EncryptionService.encryptFile generates a fresh random IV internally
    const { encrypted, iv } = await EncryptionService.encryptFile(
      plaintextBytes.buffer,
      conversationKey
    );

    return {
      body: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv),
    };
  }

  /**
   * Decrypts an incoming message.
   *
   * Retrieves the conversation key (from cache or Firestore) and decrypts
   * with the stored IV. Throws if the key is missing or decryption fails
   * (wrong key, corrupted ciphertext, or tampered IV — AES-GCM detects all three).
   *
   * @param encryptedMessage - The { body, iv } payload from Firestore
   * @param conversationId   - Firestore conversation document ID
   * @param participantIds   - Both participant UIDs
   * @returns Decrypted plaintext string
   */
  static async decryptMessage(
    encryptedMessage: EncryptedMessage,
    conversationId: string,
    participantIds: [string, string]
  ): Promise<string> {
    const conversationKey = await ConversationKeyService.getOrCreateKey(
      conversationId,
      participantIds
    );

    const decryptedBuffer = await EncryptionService.decryptFile(
      base64ToArrayBuffer(encryptedMessage.body),
      conversationKey,
      base64ToArrayBuffer(encryptedMessage.iv)
    );

    return new TextDecoder().decode(decryptedBuffer);
  }
}
