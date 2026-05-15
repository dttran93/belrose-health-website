// src/features/Encryption/services/recordDecryptionService.ts

import { EncryptionService } from './encryptionService';
import { EncryptionKeyManager } from './encryptionKeyManager';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { SharingKeyManagementService } from '@/features/Sharing/services/sharingKeyManagementService';
import { FileObject } from '@/types/core';
import { EncryptedSnapshot } from '@/features/ViewEditRecord/services/versionControlService.types';

export class RecordDecryptionService {
  /**
   * Decrypt a record fetched from Firestore
   */
  static async decryptRecord(
    encryptedRecord: FileObject | EncryptedSnapshot,
    encryptedRecordKey?: string, //For the cases where the key IS provided within the component, optimized so there aren't multiple firebase reads, see VersionControlService
    isCreator?: boolean
  ): Promise<FileObject> {
    console.log('🔓 Decrypting record:', encryptedRecord.id);

    // Get the master key from session
    const masterKey = await EncryptionKeyManager.getSessionKey();
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
      const decryptedData: Partial<FileObject> & { id: string } = {
        ...encryptedRecord, // Start with all fields
        fileName: await this.safeDecrypt(encryptedRecord.encryptedFileName, fileKey, 'text'),
        extractedText: await this.safeDecrypt(
          encryptedRecord.encryptedExtractedText,
          fileKey,
          'text'
        ),
        originalText: await this.safeDecrypt(
          encryptedRecord.encryptedOriginalText,
          fileKey,
          'text'
        ),
        contextText: await this.safeDecrypt(encryptedRecord.encryptedContextText, fileKey, 'text'),
        fhirData: await this.safeDecrypt(encryptedRecord.encryptedFhirData, fileKey, 'json'),
        belroseFields: await this.safeDecrypt(
          encryptedRecord.encryptedBelroseFields,
          fileKey,
          'json'
        ),
        customData: await this.safeDecrypt(encryptedRecord.encryptedCustomData, fileKey, 'json'),
      };

      console.log('✅ Record decryption complete');
      return decryptedData as FileObject;
    } catch (error) {
      console.error('❌ Failed to decrypt record:', error);
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decrypt ALL record data using an already-unwrapped file key
   * Use this when the file key has been already been unwrapped.
   * This avoids redundant firestore reads. Used in Versioning for example.
   * - Shared users (RSA-unwrapped keys)
   * - When you already have the wrapped key in memory
   * - update operations where key is wrapped once and reused
   * - Expects fileName/extractedText/originalText, unlike decryptRecord where it uses encryptedFields
   */
  static async decryptRecordWithKey(fileKey: CryptoKey, encryptedData: any): Promise<any> {
    console.log('🔓 Starting complete record decryption with unwrapped key...');

    const result: any = {};

    // Decrypt all fields
    result.fileName = await this.safeDecrypt(encryptedData.fileName, fileKey, 'text');
    result.extractedText = await this.safeDecrypt(encryptedData.extractedText, fileKey, 'text');
    result.originalText = await this.safeDecrypt(encryptedData.originalText, fileKey, 'text');
    result.contextText = await this.safeDecrypt(encryptedData.contextText, fileKey, 'text');
    result.fhirData = await this.safeDecrypt(encryptedData.fhirData, fileKey, 'json');
    result.belroseFields = await this.safeDecrypt(encryptedData.belroseFields, fileKey, 'json');
    result.customData = await this.safeDecrypt(encryptedData.customData, fileKey, 'json');

    console.log('✅ Complete record decryption finished');
    return result;
  }

  /**
   * Decrypt multiple records
   */
  static async decryptRecords(encryptedRecords: FileObject[]): Promise<FileObject[]> {
    console.log(`🔓 Decrypting ${encryptedRecords.length} records...`);

    const results = await Promise.allSettled(
      encryptedRecords.map(record => this.decryptRecord(record))
    );

    const decryptedRecords: FileObject[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        decryptedRecords.push(result.value);
      } else {
        // Log the record ID so you can track down the problem record
        console.warn(
          `⚠️ Skipping record ${encryptedRecords[index]?.id}: ${result.reason?.message}`
        );
      }
    });

    console.log(`✅ Decrypted ${decryptedRecords.length}/${encryptedRecords.length} records`);
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
    // Guest sessions pre-load file keys via RSA unwrapping in GuestInvitePage.
    // Check here first so we never attempt AES decryption with the throwaway key.
    const guestFileKey = EncryptionKeyManager.getGuestFileKey(recordId);
    if (guestFileKey) {
      console.log('ℹ️  Decrypting as guest (pre-loaded file key)');
      return guestFileKey;
    }

    // Standard user flow for creators and shared users: fetch from wrappedKeys collection
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
      console.error('🚫 Revoked record ID:', recordId);
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

  private static async safeDecrypt(
    field: { encrypted: string; iv: string } | null | undefined,
    key: CryptoKey,
    type: 'text' | 'json'
  ): Promise<any> {
    if (!field?.encrypted || !field?.iv) return null;
    const iv = base64ToArrayBuffer(field.iv);
    const encrypted = base64ToArrayBuffer(field.encrypted);
    return type === 'text'
      ? await EncryptionService.decryptText(encrypted, key, iv)
      : await EncryptionService.decryptJSON(encrypted, key, iv);
  }
}
