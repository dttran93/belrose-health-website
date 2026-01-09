// src/services/encryptionService.ts

/**
 * encryptionService. Does the actual AES math for what needs to be encrypted and decrypted
 * different functions for different types of files (Type Safety and some differences here and there)
 */
import { ENCRYPTION_CONFIG } from '../encryptionConfig';
import * as bip39 from 'bip39';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';

export class EncryptionService {
  /**
   * Generate a random AES-256 key
   */
  static async generateFileKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        length: ENCRYPTION_CONFIG.keyLength,
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Export key to raw bytes for storage/sharing
   */
  static async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.exportKey('raw', key);
  }

  /**
   * Import key from raw bytes
   */
  static async importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: ENCRYPTION_CONFIG.algorithm, length: ENCRYPTION_CONFIG.keyLength },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt file data with AES-256-GCM
   */
  static async encryptFile(
    fileData: ArrayBuffer,
    key: CryptoKey
  ): Promise<{ encrypted: ArrayBuffer; iv: ArrayBuffer }> {
    // Generate random initialization vector
    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength)); // 96-bit IV for GCM

    const encrypted = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv,
      },
      key,
      fileData
    );

    return {
      encrypted,
      iv: iv.buffer,
    };
  }

  /**
   * Decrypt file data
   */
  static async decryptFile(
    encryptedData: ArrayBuffer,
    key: CryptoKey,
    iv: ArrayBuffer
  ): Promise<ArrayBuffer> {
    return await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv,
      },
      key,
      encryptedData
    );
  }

  /**
   * Encrypt a JSON object (for fhirData, belroseFields, etc.)
   */
  static async encryptJSON(
    data: any,
    key: CryptoKey
  ): Promise<{
    encrypted: ArrayBuffer;
    iv: ArrayBuffer;
  }> {
    // Convert JSON to string, then to bytes
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(jsonString);

    // Encrypt the bytes
    return await this.encryptFile(dataBytes.buffer, key);
  }

  /**
   * Decrypt JSON data
   */
  static async decryptJSON(
    encryptedData: ArrayBuffer,
    key: CryptoKey,
    iv: ArrayBuffer
  ): Promise<any> {
    //Decrypt to bytes
    const decryptedBytes = await this.decryptFile(encryptedData, key, iv);

    // Convert bytes back to string, then parse JSON
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBytes);
    return JSON.parse(jsonString);
  }

  /**
   * Encrypt a text string (for text stuff like file names, extracted text, original text)
   */
  static async encryptText(
    text: string,
    key: CryptoKey
  ): Promise<{
    encrypted: ArrayBuffer;
    iv: ArrayBuffer;
  }> {
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);
    return await this.encryptFile(textBytes.buffer, key);
  }

  /**
   * Decrypt text string
   */
  static async decryptText(
    encryptedData: ArrayBuffer,
    key: CryptoKey,
    iv: ArrayBuffer
  ): Promise<string> {
    const decryptedBytes = await this.decryptFile(encryptedData, key, iv);
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBytes);
  }

  /**
   * Encrypt ALL record data (fileName, file, extractedText, originalText, fhirData, BelroseFields, customData)
   * uses one key for all components of the record
   */
  static async encryptCompleteRecord(
    fileName: string,
    file: File | undefined,
    extractedText: string | undefined | null,
    originalText: string | undefined | null,
    contextText: string | undefined | null,
    fhirData: any | null,
    belroseFields: any | null,
    customData: any | null,
    userKey: CryptoKey
  ): Promise<{
    fileName: {
      encrypted: ArrayBuffer;
      iv: string;
    };
    file?: {
      encrypted: ArrayBuffer;
      iv: string;
    };
    extractedText: {
      encrypted: ArrayBuffer;
      iv: string;
    };
    originalText?: {
      encrypted: ArrayBuffer;
      iv: string;
    };
    contextText?: {
      encrypted: ArrayBuffer;
      iv: string;
    };
    fhirData?: {
      encrypted: ArrayBuffer;
      iv: string;
    };
    belroseFields?: {
      encrypted: ArrayBuffer;
      iv: string;
    };
    customData?: {
      encrypted: ArrayBuffer;
      iv: string;
    };
    encryptedKey: string; // Single key for all data
  }> {
    console.log('🔐 Starting complete record encryption...');
    console.log('  - FileName:', fileName ? 'Yes' : 'No');
    console.log('  - File:', file ? 'Yes' : 'No');
    console.log('  - ExtractedText:', extractedText ? 'Yes' : 'No');
    console.log('  - OriginalText:', originalText ? 'Yes' : 'No');
    console.log('  - contextText:', contextText ? 'Yes' : 'No');
    console.log('  - FHIR:', fhirData ? 'Yes' : 'No');
    console.log('  - BelroseFields:', belroseFields ? 'Yes' : 'No');
    console.log('  - CustomData:', customData ? 'Yes' : 'No');

    //Generate key for all data in this record
    const fileKey = await this.generateFileKey();

    const result: any = {};

    // Encrypt fileName (always exists and contains PII!)
    console.log('  🔒 Encrypting file name...');
    const fileNameResult = await this.encryptText(fileName, fileKey);
    result.fileName = {
      encrypted: arrayBufferToBase64(fileNameResult.encrypted),
      iv: arrayBufferToBase64(fileNameResult.iv),
    };
    console.log(`    ✓ File name encrypted (${fileNameResult.encrypted.byteLength} bytes)`);

    // Encrypt file if it exists
    if (file) {
      console.log('  🔒 Encrypting file...');
      const fileData = await file.arrayBuffer();
      const { encrypted, iv } = await this.encryptFile(fileData, fileKey);
      result.file = {
        encrypted,
        iv: arrayBufferToBase64(iv),
      };
      console.log(`    ✓ File encrypted (${encrypted.byteLength} bytes)`);
    }

    // Encrypt extracted text
    if (extractedText) {
      console.log('  🔒 Encrypting extracted text...');
      const textResult = await this.encryptText(extractedText, fileKey);
      result.extractedText = {
        encrypted: arrayBufferToBase64(textResult.encrypted),
        iv: arrayBufferToBase64(textResult.iv),
      };
      console.log(`    ✓ Extracted text encrypted (${textResult.encrypted.byteLength} bytes)`);
    }

    // Encrypt original text if it exists
    if (originalText && originalText.trim().length > 0) {
      console.log('  🔒 Encrypting original text...');
      const originalTextResult = await this.encryptText(originalText, fileKey);
      result.originalText = {
        encrypted: arrayBufferToBase64(originalTextResult.encrypted),
        iv: arrayBufferToBase64(originalTextResult.iv),
      };
      console.log(
        `    ✓ Original text encrypted (${originalTextResult.encrypted.byteLength} bytes)`
      );
    }

    // Encrypt context text if it exists
    if (contextText && contextText.trim().length > 0) {
      console.log('  🔒 Encrypting context text...');
      const contextTextResult = await this.encryptText(contextText, fileKey);
      result.contextText = {
        encrypted: arrayBufferToBase64(contextTextResult.encrypted),
        iv: arrayBufferToBase64(contextTextResult.iv),
      };
      console.log(`    ✓ Context text encrypted (${contextTextResult.encrypted.byteLength} bytes)`);
    }

    // Encrypt FHIR data if it exists
    if (fhirData) {
      console.log('  🔒 Encrypting FHIR data...');
      const fhirResult = await this.encryptJSON(fhirData, fileKey);
      result.fhirData = {
        encrypted: arrayBufferToBase64(fhirResult.encrypted),
        iv: arrayBufferToBase64(fhirResult.iv),
      };
      console.log(`    ✓ FHIR data encrypted (${fhirResult.encrypted.byteLength} bytes)`);
    }

    // Encrypt belroseFields if they exist
    if (belroseFields) {
      console.log('  🔒 Encrypting Belrose fields...');
      const belroseResult = await this.encryptJSON(belroseFields, fileKey);
      result.belroseFields = {
        encrypted: arrayBufferToBase64(belroseResult.encrypted),
        iv: arrayBufferToBase64(belroseResult.iv),
      };
      console.log(`    ✓ Belrose fields encrypted (${belroseResult.encrypted.byteLength} bytes)`);
    }

    // Encrypt customData if it exists
    if (customData) {
      console.log('  🔒 Encrypting custom data...');
      const customDataResult = await this.encryptJSON(customData, fileKey);
      result.customData = {
        encrypted: arrayBufferToBase64(customDataResult.encrypted),
        iv: arrayBufferToBase64(customDataResult.iv),
      };
      console.log(`    ✓ Custom data encrypted (${customDataResult.encrypted.byteLength} bytes)`);
    }

    // Encrypt the file key with user's master key
    console.log('  🔒 Encrypting file key with user master key...');
    const encryptedKeyData = await this.encryptKeyWithMasterKey(fileKey, userKey);
    result.encryptedKey = arrayBufferToBase64(encryptedKeyData);
    console.log('    ✓ File key encrypted');

    console.log('✅ Complete record encryption finished');
    return result;
  }

  /**
   * Decrypt ALL record data
   */
  static async decryptCompleteRecord(
    encryptedKey: string,
    encryptedData: any, // Use any here to handle missing properties safely
    userKey: CryptoKey
  ): Promise<any> {
    console.log('🔓 Starting complete record decryption...');

    // 1. Decrypt the file key
    const keyData = base64ToArrayBuffer(encryptedKey);
    const fileKeyData = await this.decryptKeyWithMasterKey(keyData, userKey);
    const fileKey = await this.importKey(fileKeyData);

    const result: any = {};

    // 2. Helper to handle the "Exists + Decrypt" logic
    const safeDecrypt = async (field: any, type: 'text' | 'json') => {
      // Check if the field and its inner encrypted data actually exist
      if (!field || !field.encrypted || !field.iv) return null;

      const iv = base64ToArrayBuffer(field.iv);
      const encrypted = base64ToArrayBuffer(field.encrypted);

      return type === 'text'
        ? await this.decryptText(encrypted, fileKey, iv)
        : await this.decryptJSON(encrypted, fileKey, iv);
    };

    // 3. Decrypt fields safely
    result.fileName = await safeDecrypt(encryptedData.fileName, 'text');
    result.extractedText = await safeDecrypt(encryptedData.extractedText, 'text');
    result.originalText = await safeDecrypt(encryptedData.originalText, 'text');
    result.contextText = await safeDecrypt(encryptedData.contextText, 'text');
    result.fhirData = await safeDecrypt(encryptedData.fhirData, 'json');
    result.belroseFields = await safeDecrypt(encryptedData.belroseFields, 'json');
    result.customData = await safeDecrypt(encryptedData.customData, 'json');

    console.log('✅ Complete record decryption finished');
    return result;
  }

  // =================== HELPER METHODS =========================

  /**
   * Generate a random salt for password-based key derivation
   */
  static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Convert Uint8Array to base64 for storage
   */
  static saltToString(salt: Uint8Array): string {
    return btoa(String.fromCharCode(...salt));
  }

  /**
   * Convert base64 string back to Uint8Array
   */
  static stringToSalt(saltString: string): Uint8Array {
    const binaryString = atob(saltString);
    return new Uint8Array([...binaryString].map(char => char.charCodeAt(0)));
  }

  static async encryptKeyWithMasterKey(
    fileKey: CryptoKey,
    masterKey: CryptoKey
  ): Promise<ArrayBuffer> {
    const keyData = await this.exportKey(fileKey);
    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));

    const encrypted = await crypto.subtle.encrypt(
      { name: ENCRYPTION_CONFIG.algorithm, iv },
      masterKey,
      keyData
    );

    // Prepend IV to encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return result.buffer;
  }

  public static async decryptKeyWithMasterKey(
    encryptedKeyData: ArrayBuffer,
    masterKey: CryptoKey
  ): Promise<ArrayBuffer> {
    const data = new Uint8Array(encryptedKeyData);
    const iv = data.slice(0, ENCRYPTION_CONFIG.ivLength);
    const encrypted = data.slice(ENCRYPTION_CONFIG.ivLength);

    return await crypto.subtle.decrypt(
      { name: ENCRYPTION_CONFIG.algorithm, iv },
      masterKey,
      encrypted
    );
  }

  // ========== ENCRYPTION KEY DERIVATION AND RECOVERY ============

  /**
   * Derive an encryption key from a password using PBKDF2
   */
  static async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();

    // Import password as key material
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive actual encryption key
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000, // OWASP recommendation for 2024
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false, // Not extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Create a verification hash of the password (for checking without exposing key)
   */
  static async hashPassword(password: string, salt: Uint8Array): Promise<string> {
    const encoder = new TextEncoder();
    const data = new Uint8Array([...encoder.encode(password), ...salt]);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate a 24-word recovery mnemonic
   */
  static generateRecoveryKey(): string {
    return bip39.generateMnemonic(256);
  }

  /**
   * Validate a recovery mnemonic
   */
  static validateRecoveryKey(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic);
  }

  /**
   * Derive encryption key from recovery mnemonic
   */
  static async deriveKeyFromRecoveryKey(mnemonic: string, salt: Uint8Array): Promise<CryptoKey> {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid recovery key');
    }

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    // Use first 32 bytes as password material
    const keyMaterial = Buffer.from(seed.slice(0, 32)).toString('hex');

    return this.deriveKeyFromPassword(keyMaterial, salt);
  }
}
