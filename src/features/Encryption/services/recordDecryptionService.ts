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
  contextText?: string;
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
  static async decryptRecord(
    encryptedRecord: EncryptedRecord,
    encryptedRecordKey?: string, //For the cases where the key IS provided within the component, optimized so there aren't multiple firebase reads, see VersionControlService
    isCreator?: boolean
  ): Promise<DecryptedRecord> {
    // If not encrypted, return as-is
    if (!encryptedRecord.isEncrypted) {
      console.log('📄 Record is not encrypted, returning as-is');
      return encryptedRecord as DecryptedRecord;
    }

    console.log('🔓 Decrypting record:', encryptedRecord.id);

    // Get the master key from session
    const masterKey = EncryptionKeyManager.getSessionKey();
    if (!masterKey) {
      throw new Error('Encryption session not active. Please unlock your encryption.');
    }

    let fileKey: CryptoKey;

    try {
      if (encryptedRecordKey && isCreator !== undefined) {
        // PATH 1: Key is provided (e.g., from VersionControlService for efficiency)
        if (isCreator) {
          console.log('ℹ️ Unwrapping as creator (master key)...');
          const keyData = base64ToArrayBuffer(encryptedRecordKey);
          const fileKeyData = await EncryptionService.decryptKeyWithMasterKey(keyData, masterKey);
          fileKey = await EncryptionService.importKey(fileKeyData);
          console.log('✓ File key unwrapped successfully');
        } else {
          // PATH 2: Shared user: RSA-wrapped key to be fetched
          console.log('ℹ️ Fetching and decrypting record key with shared user RSA...');
          const rsaPrivateKey = await this.getUserPrivateKey(getAuth().currentUser!.uid, masterKey);
          fileKey = await SharingKeyManagementService.unwrapKey(encryptedRecordKey, rsaPrivateKey);
          console.log('✓ File key fetched and decrypted');
        }
      } else {
        // PATH 3: No key provided, fetch via getRecordKey
        fileKey = await this.getRecordKey(encryptedRecord.id, masterKey);
        console.log('✓ File key fetched and decrypted');
      }

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
   * All users (creators and shared users) have their key in wrappedKeys:
   * - Creator: isCreator=true, key encrypted with master key (AES)
   * - Shared user: isCreator=false, key wrapped with RSA public key
   * @param recordId - The record ID
   * @param masterKey - The current user's master key from session
   * @returns The decrypted record AES key
   */
  static async getRecordKey(recordId: string, masterKey: CryptoKey): Promise<CryptoKey> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('🔍 Getting decryption key for record:', recordId);

    // Get key from wrappedKeys collection
    const wrappedKeyId = `${recordId}_${user.uid}`;
    const wrappedKeyRef = doc(db, 'wrappedKeys', wrappedKeyId);
    const wrappedKeyDoc = await getDoc(wrappedKeyRef);

    if (!wrappedKeyDoc.exists()) {
      throw new Error('You do not have access to this record');
    }

    const wrappedKeyData = wrappedKeyDoc.data();

    if (!wrappedKeyData.isActive) {
      throw new Error('Your access to this record has been revoked');
    }

    if (wrappedKeyData.isCreator) {
      // Creator: key is encrypted with their master key (AES)
      console.log('ℹ️  Decrypting as creator (master key)');
      const encryptedKeyData = base64ToArrayBuffer(wrappedKeyData.wrappedKey);
      const fileKeyData = await EncryptionService.decryptKeyWithMasterKey(
        encryptedKeyData,
        masterKey
      );
      console.log('✅ Record key decrypted');
      return await EncryptionService.importKey(fileKeyData);
    } else {
      // Shared user: key is wrapped with their RSA public key
      console.log('ℹ️  Unwrapping as shared user (RSA)');
      const rsaPrivateKey = await this.getUserPrivateKey(user.uid, masterKey);
      const recordKey = await SharingKeyManagementService.unwrapKey(
        wrappedKeyData.wrappedKey,
        rsaPrivateKey
      );
      console.log('✅ Record key unwrapped');
      return recordKey;
    }
  }

  /**
   * Helper: Get user's RSA private key
   */
  private static async getUserPrivateKey(userId: string, masterKey: CryptoKey): Promise<CryptoKey> {
    const db = getFirestore();
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User profile not found');
    }

    const userData = userDoc.data();

    if (!userData?.encryption?.encryptedPrivateKey) {
      throw new Error('Private key not found. Please contact support.');
    }

    const encryptedPrivateKeyData = base64ToArrayBuffer(userData.encryption.encryptedPrivateKey);
    const privateKeyIv = base64ToArrayBuffer(userData.encryption.encryptedPrivateKeyIV);

    const privateKeyBytes = await EncryptionService.decryptFile(
      encryptedPrivateKeyData,
      masterKey,
      privateKeyIv
    );

    return await SharingKeyManagementService.importPrivateKey(arrayBufferToBase64(privateKeyBytes));
  }
}
