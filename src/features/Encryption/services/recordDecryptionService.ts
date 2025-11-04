// src/features/Encryption/services/recordDecryptionService.ts

import { EncryptionService } from './encryptionService';
import { EncryptionKeyManager } from './encryptionKeyManager';

export interface EncryptedRecord {
  isEncrypted: boolean;
  encryptedKey?: string;
  encryptedFileName?: { encrypted: string; iv: string };
  encryptedExtractedText?: { encrypted: string; iv: string };
  encryptedOriginalText?: { encrypted: string; iv: string };
  encryptedFhirData?: { encrypted: string; iv: string };
  encryptedBelroseFields?: { encrypted: string; iv: string };
  // ... plus all the regular fields
  [key: string]: any;
}

export interface DecryptedRecord {
  fileName?: string;
  extractedText?: string;
  originalText?: string;
  fhirData?: any;
  belroseFields?: any;
  // ... all other fields pass through
  [key: string]: any;
}

export class RecordDecryptionService {
  /**
   * Decrypt a record fetched from Firestore
   */
  static async decryptRecord(encryptedRecord: EncryptedRecord): Promise<DecryptedRecord> {
    // If not encrypted, return as-is
    if (!encryptedRecord.isEncrypted || !encryptedRecord.encryptedKey) {
      console.log('📄 Record is not encrypted, returning as-is');
      return encryptedRecord as unknown as DecryptedRecord;
    }

    console.log('🔓 Decrypting record...');

    // Get the master key from session
    const masterKey = EncryptionKeyManager.getSessionKey();
    if (!masterKey) {
      throw new Error('Encryption session not active. Please unlock your encryption.');
    }

    try {
      // 1. Decrypt the file's AES key using the master key
      const encryptedKeyData = EncryptionService.base64ToArrayBuffer(encryptedRecord.encryptedKey);
      const fileKeyData = await EncryptionService.decryptKeyWithMasterKey(
        encryptedKeyData,
        masterKey
      );
      const fileKey = await EncryptionService.importKey(fileKeyData);
      console.log('✓ File key decrypted');

      // 2. Decrypt all the fields
      const decryptedData: DecryptedRecord = {
        ...encryptedRecord, // Start with all fields
      };

      // Decrypt file name
      if (encryptedRecord.encryptedFileName) {
        decryptedData.fileName = await EncryptionService.decryptText(
          EncryptionService.base64ToArrayBuffer(encryptedRecord.encryptedFileName.encrypted),
          fileKey,
          EncryptionService.base64ToArrayBuffer(encryptedRecord.encryptedFileName.iv)
        );
        console.log('✓ File name decrypted');
      }

      // Decrypt extracted text
      if (encryptedRecord.encryptedExtractedText) {
        decryptedData.extractedText = await EncryptionService.decryptText(
          EncryptionService.base64ToArrayBuffer(encryptedRecord.encryptedExtractedText.encrypted),
          fileKey,
          EncryptionService.base64ToArrayBuffer(encryptedRecord.encryptedExtractedText.iv)
        );
        console.log('✓ Extracted text decrypted');
      }

      // Decrypt original text
      if (encryptedRecord.encryptedOriginalText) {
        decryptedData.originalText = await EncryptionService.decryptText(
          EncryptionService.base64ToArrayBuffer(encryptedRecord.encryptedOriginalText.encrypted),
          fileKey,
          EncryptionService.base64ToArrayBuffer(encryptedRecord.encryptedOriginalText.iv)
        );
        console.log('✓ Original text decrypted');
      }

      // Decrypt FHIR data
      if (encryptedRecord.encryptedFhirData) {
        decryptedData.fhirData = await EncryptionService.decryptJSON(
          EncryptionService.base64ToArrayBuffer(encryptedRecord.encryptedFhirData.encrypted),
          fileKey,
          EncryptionService.base64ToArrayBuffer(encryptedRecord.encryptedFhirData.iv)
        );
        console.log('✓ FHIR data decrypted');
      }

      // Decrypt Belrose fields
      if (encryptedRecord.encryptedBelroseFields) {
        decryptedData.belroseFields = await EncryptionService.decryptJSON(
          EncryptionService.base64ToArrayBuffer(encryptedRecord.encryptedBelroseFields.encrypted),
          fileKey,
          EncryptionService.base64ToArrayBuffer(encryptedRecord.encryptedBelroseFields.iv)
        );
        console.log('✓ Belrose fields decrypted');
      }

      console.log('✅ Record decryption complete');
      return decryptedData;
    } catch (error) {
      console.error('❌ Failed to decrypt record:', error);
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decrypt multiple records
   */
  static async decryptRecords(encryptedRecords: EncryptedRecord[]): Promise<DecryptedRecord[]> {
    console.log(`🔓 Decrypting ${encryptedRecords.length} records...`);

    const decryptedRecords = await Promise.all(
      encryptedRecords.map(record => this.decryptRecord(record))
    );

    console.log(`✅ Decrypted ${decryptedRecords.length} records`);
    return decryptedRecords;
  }
}
