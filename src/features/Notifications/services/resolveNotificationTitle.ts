// src/features/Notifications/utils/resolveNotificationTitle.ts

/**
 * Attempts to decrypt and return a human-readable record title from a
 * notification payload. Falls back gracefully at every step.
 *
 * Usage:
 *   const title = await resolveNotificationTitle(notification.payload);
 *   // "GP Records 2024" or "Record abc12345..."
 */

import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { base64ToArrayBuffer } from '@/utils/dataFormattingUtils';

export async function resolveNotificationTitle(payload: {
  recordId?: string;
  encryptedRecordTitle?: string;
  encryptedRecordTitleIv?: string;
}): Promise<string> {
  const fallback = payload.recordId ? `Record ${payload.recordId.slice(0, 8)}...` : 'A record';

  if (!payload.encryptedRecordTitle || !payload.encryptedRecordTitleIv || !payload.recordId) {
    return fallback;
  }

  try {
    const masterKey = await EncryptionKeyManager.getSessionKey();
    if (!masterKey) return fallback;

    // getRecordKey handles all paths: creator, shared user, guest
    // Returns fallback silently if user no longer has access (e.g. revoked)
    const dek = await RecordDecryptionService.getRecordKey(payload.recordId, masterKey);

    const decrypted = await EncryptionService.decryptText(
      base64ToArrayBuffer(payload.encryptedRecordTitle),
      dek,
      base64ToArrayBuffer(payload.encryptedRecordTitleIv)
    );

    return decrypted || fallback;
  } catch (error) {
    // Swallow silently — user may no longer have access, session may be inactive
    console.warn('⚠️ Could not decrypt notification title, using fallback:', error);
    return fallback;
  }
}
