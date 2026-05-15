// src/features/Notifications/utils/encryptNotificationTitle.ts

/**
 * This function encrypts a record title using the record's DEK for storage in event
 * documents and notification payloads. Called client-side before writing
 * any event document that references a record title. Keeps E2E encryption intact for notifications.
 */

import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { arrayBufferToBase64 } from '@/utils/dataFormattingUtils';

interface EncryptedTitle {
  encryptedRecordTitle: string;
  encryptedRecordTitleIv: string;
}

/**
 * Encrypts a record title using the record's DEK for storage in event
 * documents and notification payloads. Called client-side before writing
 * any event document that references a record title.
 *
 * Returns null if encryption session is inactive or key unavailable —
 * callers should omit the title fields in that case.
 */
export async function encryptNotificationTitle(
  recordTitle: string,
  recordId: string
): Promise<EncryptedTitle | null> {
  try {
    const masterKey = await EncryptionKeyManager.getSessionKey();
    if (!masterKey) return null;

    const dek = await RecordDecryptionService.getRecordKey(recordId, masterKey);
    const { encrypted, iv } = await EncryptionService.encryptText(recordTitle, dek);

    return {
      encryptedRecordTitle: arrayBufferToBase64(encrypted),
      encryptedRecordTitleIv: arrayBufferToBase64(iv),
    };
  } catch (error) {
    console.warn('⚠️ Could not encrypt notification title:', error);
    return null;
  }
}
