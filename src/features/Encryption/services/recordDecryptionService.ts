// src/features/Encryption/services/recordDecryptionService.ts

import { EncryptionService } from './encryptionService';
import { EncryptionKeyManager } from './encryptionKeyManager';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { SharingKeyManagementService } from '@/features/Sharing/services/sharingKeyManagementService';

export interface EncryptedRecord {
  id: string;
  isEncrypted: boolean;
  encryptedKey?: string;
  fileName?: string;
  encryptedFileName?: { encrypted: string; iv: string };
  encryptedExtractedText?: { encrypted: string; iv: string };
  encryptedOriginalText?: { encrypted: string; iv: string };
  encryptedContextText?: { encrypted: string; iv: string };
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
      return encryptedRecord as DecryptedRecord;
    }

    console.log('🔓 Decrypting record...');

    // Get the master key from session
    const masterKey = EncryptionKeyManager.getSessionKey();
    if (!masterKey) {
      throw new Error('Encryption session not active. Please unlock your encryption.');
    }

    try {
      // Use getRecordKey to handle either original uploader key (EncryptedKey in FileObject)
      // or Admin/Viewer key (wrapped key in database)
      const fileKey = await this.getRecordKey(encryptedRecord.id, encryptedRecord, masterKey);

      console.log('✓ File key decrypted');

      // 2. Decrypt all the fields
      const decryptedData: DecryptedRecord = {
        ...encryptedRecord, // Start with all fields
      };

      // Decrypt file name
      if (encryptedRecord.encryptedFileName) {
        decryptedData.fileName = await EncryptionService.decryptText(
          base64ToArrayBuffer(encryptedRecord.encryptedFileName.encrypted),
          fileKey,
          base64ToArrayBuffer(encryptedRecord.encryptedFileName.iv)
        );
        console.log('✓ File name decrypted');
      }

      // Decrypt extracted text
      if (encryptedRecord.encryptedExtractedText) {
        decryptedData.extractedText = await EncryptionService.decryptText(
          base64ToArrayBuffer(encryptedRecord.encryptedExtractedText.encrypted),
          fileKey,
          base64ToArrayBuffer(encryptedRecord.encryptedExtractedText.iv)
        );
        console.log('✓ Extracted text decrypted');
      }

      // Decrypt original text
      if (encryptedRecord.encryptedOriginalText) {
        decryptedData.originalText = await EncryptionService.decryptText(
          base64ToArrayBuffer(encryptedRecord.encryptedOriginalText.encrypted),
          fileKey,
          base64ToArrayBuffer(encryptedRecord.encryptedOriginalText.iv)
        );
        console.log('✓ Original text decrypted');
      }

      // Decrypt context text
      if (encryptedRecord.encryptedContextText) {
        decryptedData.contextText = await EncryptionService.decryptText(
          base64ToArrayBuffer(encryptedRecord.encryptedContextText.encrypted),
          fileKey,
          base64ToArrayBuffer(encryptedRecord.encryptedContextText.iv)
        );
        console.log('✓ Context text decrypted');
      }

      // Decrypt FHIR data
      if (encryptedRecord.encryptedFhirData) {
        decryptedData.fhirData = await EncryptionService.decryptJSON(
          base64ToArrayBuffer(encryptedRecord.encryptedFhirData.encrypted),
          fileKey,
          base64ToArrayBuffer(encryptedRecord.encryptedFhirData.iv)
        );
        console.log('✓ FHIR data decrypted');
      }

      // Decrypt Belrose fields
      if (encryptedRecord.encryptedBelroseFields) {
        decryptedData.belroseFields = await EncryptionService.decryptJSON(
          base64ToArrayBuffer(encryptedRecord.encryptedBelroseFields.encrypted),
          fileKey,
          base64ToArrayBuffer(encryptedRecord.encryptedBelroseFields.iv)
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

  /**
   * Get the decryption key for a record
   * Handles both original uploader (uses encryptedKey) and shared/admin access (uses wrappedKey)
   * @param recordId - The record ID
   * @param recordData - The record data from Firestore to pull the encryption key if you're an owner
   * @param masterKey - The current user's master key from session
   * @returns The decrypted record AES key
   */
  static async getRecordKey(
    recordId: string,
    recordData: any,
    masterKey: CryptoKey
  ): Promise<CryptoKey> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('🔍 Determining decryption method for record:', recordId);

    // Check if we have a wrapped key (meaning we're an admin/viewer, not original uploader)
    const wrappedKeyId = `${recordId}_${user.uid}`;
    const wrappedKeyRef = doc(db, 'wrappedKeys', wrappedKeyId);
    const wrappedKeyDoc = await getDoc(wrappedKeyRef);

    if (wrappedKeyDoc.exists() && wrappedKeyDoc.data().isActive) {
      // We're an admin/viewer who was added later - use our wrapped key
      console.log('ℹ️  Using wrapped key (shared/admin access)');

      const wrappedKeyData = wrappedKeyDoc.data();

      // Get our encrypted RSA private key from our user profile
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }

      const userData = userDoc.data();

      if (!userData.encryption?.encryptedPrivateKey) {
        throw new Error('Private key not found. Please contact support.');
      }

      // Decrypt our RSA private key using our master key (remember master key is in session memory, decrypted when you login. KEK structure)
      const encryptedPrivateKeyData = base64ToArrayBuffer(userData.encryption.encryptedPrivateKey);
      const privateKeyIv = base64ToArrayBuffer(userData.encryption.encryptedPrivateKeyIV);

      const privateKeyBytes = await EncryptionService.decryptFile(
        encryptedPrivateKeyData,
        masterKey,
        privateKeyIv
      );

      // Import the RSA private key
      const rsaPrivateKey = await SharingKeyManagementService.importPrivateKey(
        arrayBufferToBase64(privateKeyBytes)
      );

      // Unwrap the record key using our RSA private key
      const recordKey = await SharingKeyManagementService.unwrapKey(
        wrappedKeyData.wrappedKey,
        rsaPrivateKey
      );

      console.log('✅ Record key unwrapped from wrapped key');
      return recordKey;
    } else {
      // We're the original uploader (or an owner with the original master key)
      console.log('ℹ️  Using original encrypted key (original uploader/owner)');

      if (!recordData.encryptedKey) {
        throw new Error('Record encryption key not found');
      }

      // Decrypt using the record's encryptedKey
      const encryptedKeyData = base64ToArrayBuffer(recordData.encryptedKey);
      const recordKey = await EncryptionService.importKey(
        await EncryptionService.decryptKeyWithMasterKey(encryptedKeyData, masterKey)
      );

      console.log('✅ Record key decrypted from original encrypted key');
      return recordKey;
    }
  }
}
