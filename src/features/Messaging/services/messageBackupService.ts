/**
 * messageBackupService.ts
 *
 * Stores an encrypted backup of decrypted message history in Firestore,
 * keyed to the user's master encryption key.
 *
 * Why this exists:
 *   Signal Protocol's Double Ratchet provides forward secrecy by design —
 *   plaintext is never persisted. But this means clearing IndexedDB (via
 *   CCleaner, browser reset, new device, incognito mode) permanently
 *   destroys message history. For a healthcare app where patients need
 *   reliable access to provider conversations, this is unacceptable.
 *
 * Security model:
 *   Messages are encrypted with AES-256-GCM using the user's master key
 *   before storage — the same key used for health records. Firestore never
 *   sees plaintext. An attacker who breaches Firestore gets encrypted blobs.
 *   An attacker who also has the master key gets message history but not
 *   future messages (forward secrecy still holds for new messages).
 *
 * Firestore schema:
 *   /users/{userId}/messageBackups/{conversationId}
 *     data:      string    — AES-GCM encrypted JSON array of BackedUpMessage
 *     iv:        string    — base64 IV for decryption
 *     updatedAt: timestamp
 *
 * Usage:
 *   // Save after decrypting incoming messages
 *   await MessageBackupService.saveBackup(conversationId, messages, masterKey);
 *
 *   // Restore on mount before first Firestore snapshot
 *   const cached = await MessageBackupService.loadBackup(conversationId, masterKey);
 */

import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/firebase/config';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';
import type { DecryptedMessage } from '../hooks/useMessaging';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives a backup-specific AES-GCM key from the master key using HKDF.
 *
 * Using a separate derived key rather than the master key directly limits
 * blast radius — a backup key compromise doesn't expose health records,
 * wallet keys, or any other master-key-encrypted data.
 */
async function deriveBackupKey(masterKey: CryptoKey): Promise<CryptoKey> {
  const rawKey = await crypto.subtle.exportKey('raw', masterKey);

  const keyMaterial = await crypto.subtle.importKey('raw', rawKey, { name: 'HKDF' }, false, [
    'deriveKey',
  ]);

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('belrose-message-backup-salt-v1'),
      info: new TextEncoder().encode('message-backup-v1'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The shape stored in the backup — a subset of DecryptedMessage,
 * only the fields needed for display. We don't store isOwn (derived
 * from senderId) or receipt timestamps (not critical for history).
 */
export interface BackedUpMessage {
  id: string;
  senderId: string;
  text: string;
  sentAt: { seconds: number; nanoseconds: number } | Timestamp;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MessageBackupService {
  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------

  /**
   * Encrypts and saves the current message list to Firestore.
   *
   * Called after every successful batch decrypt in useMessaging.
   * Non-blocking — failures are logged but don't affect the send/receive flow.
   *
   * @param conversationId - The conversation to back up
   * @param messages       - Decrypted messages to store
   */
  static async saveBackup(conversationId: string, messages: DecryptedMessage[]): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const masterKey = await EncryptionKeyManager.getSessionKey();
    if (!masterKey) {
      console.warn('⚠️ No master key in session — skipping message backup');
      return;
    }

    try {
      const backupKey = await deriveBackupKey(masterKey);

      // Strip to just what we need for display
      const toBackUp: BackedUpMessage[] = messages
        .filter(m => m.text !== '[Unable to decrypt message]') // don't persist failures
        .map(m => ({
          id: m.id,
          senderId: m.senderId,
          text: m.text,
          sentAt: {
            seconds: m.sentAt?.seconds ?? Math.floor(Date.now() / 1000),
            nanoseconds: m.sentAt?.nanoseconds ?? 0,
          },
        }));

      // Encrypt the array as JSON using the derived backup key
      const { encrypted, iv } = await EncryptionService.encryptJSON(toBackUp, backupKey);

      const backupRef = doc(db, 'users', currentUser.uid, 'messageBackups', conversationId);

      await setDoc(backupRef, {
        data: arrayBufferToBase64(encrypted),
        iv: arrayBufferToBase64(iv),
        updatedAt: serverTimestamp(),
      });

      console.log(`💾 Message backup saved: ${toBackUp.length} messages`);
    } catch (err) {
      // Non-fatal — the live Signal session still works without backup
      console.warn('⚠️ Failed to save message backup:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  /**
   * Loads and decrypts the message backup for a conversation.
   *
   * Called on mount before the Firestore onSnapshot fires, so the UI
   * shows history immediately rather than waiting for decryption.
   * Returns null if no backup exists or decryption fails.
   *
   * @param conversationId - The conversation to restore
   * @returns Array of backed-up messages, or null
   */
  static async loadBackup(conversationId: string): Promise<BackedUpMessage[] | null> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    const masterKey = await EncryptionKeyManager.getSessionKey();
    if (!masterKey) return null;

    try {
      const backupKey = await deriveBackupKey(masterKey);

      const backupRef = doc(db, 'users', currentUser.uid, 'messageBackups', conversationId);

      const snapshot = await getDoc(backupRef);
      if (!snapshot.exists()) return null;

      const { data, iv } = snapshot.data();
      if (!data || !iv) return null;

      const encrypted = base64ToArrayBuffer(data);
      const ivBuffer = base64ToArrayBuffer(iv);

      const messages = await EncryptionService.decryptJSON(encrypted, backupKey, ivBuffer);

      //2. Convert plain objects back into real timestamp so .toDate() works in the MessageThread/Bubble
      const rehydratedMessages = (messages as any[]).map(msg => ({
        ...msg,
        sentAt: msg.sentAt ? new Timestamp(msg.sentAt.seconds, msg.sentAt.nanoseconds) : null,
      }));

      console.log(
        `📂 Message backup restored and rehydrated: ${rehydratedMessages.length} messages`
      );
      return rehydratedMessages as BackedUpMessage[];
    } catch (err) {
      // Backup may be from a different key (e.g. password change) — not fatal
      console.warn('⚠️ Failed to load message backup:', err);
      return null;
    }
  }
}
