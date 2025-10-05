// src/services/encryptionService.ts
import { ENCRYPTION_CONFIG } from '../encryptionConfig';

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
    extractedText: string | undefined,
    originalText: string | undefined,
    fhirData: any | null,
    belroseFields: any | null,
    customData: any | null
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
    console.log('  - FHIR:', fhirData ? 'Yes' : 'No');
    console.log('  - BelroseFields:', belroseFields ? 'Yes' : 'No');
    console.log('  - CustomData:', customData ? 'Yes' : 'No');

    //Generate key for all data in this record
    const fileKey = await this.generateFileKey();
    const userKey = await this.getUserMasterKey();

    const result: any = {};

    // Encrypt fileName (always exists and contains PII!)
    console.log('  🔒 Encrypting file name...');
    const fileNameResult = await this.encryptText(fileName, fileKey);
    result.fileName = {
      encrypted: fileNameResult.encrypted,
      iv: this.arrayBufferToBase64(fileNameResult.iv),
    };
    console.log(`    ✓ File name encrypted (${fileNameResult.encrypted.byteLength} bytes)`);

    // Encrypt file if it exists
    if (file) {
      console.log('  🔒 Encrypting file...');
      const fileData = await file.arrayBuffer();
      const { encrypted, iv } = await this.encryptFile(fileData, fileKey);
      result.file = {
        encrypted,
        iv: this.arrayBufferToBase64(iv),
      };
      console.log(`    ✓ File encrypted (${encrypted.byteLength} bytes)`);
    }

    // Encrypt extracted text (always exists)
    if (extractedText) {
      console.log('  🔒 Encrypting extracted text...');
      const textResult = await this.encryptText(extractedText, fileKey);
      result.extractedText = {
        encrypted: textResult.encrypted,
        iv: this.arrayBufferToBase64(textResult.iv),
      };
      console.log(`    ✓ Extracted text encrypted (${textResult.encrypted.byteLength} bytes)`);
    }

    // Encrypt original text if it exists
    if (originalText && originalText.trim().length > 0) {
      console.log('  🔒 Encrypting original text...');
      const originalTextResult = await this.encryptText(originalText, fileKey);
      result.originalText = {
        encrypted: originalTextResult.encrypted,
        iv: this.arrayBufferToBase64(originalTextResult.iv),
      };
      console.log(
        `    ✓ Original text encrypted (${originalTextResult.encrypted.byteLength} bytes)`
      );
    }

    // Encrypt FHIR data if it exists
    if (fhirData) {
      console.log('  🔒 Encrypting FHIR data...');
      const fhirResult = await this.encryptJSON(fhirData, fileKey);
      result.fhirData = {
        encrypted: fhirResult.encrypted,
        iv: this.arrayBufferToBase64(fhirResult.iv),
      };
      console.log(`    ✓ FHIR data encrypted (${fhirResult.encrypted.byteLength} bytes)`);
    }

    // Encrypt belroseFields if they exist
    if (belroseFields) {
      console.log('  🔒 Encrypting Belrose fields...');
      const belroseResult = await this.encryptJSON(belroseFields, fileKey);
      result.belroseFields = {
        encrypted: belroseResult.encrypted,
        iv: this.arrayBufferToBase64(belroseResult.iv),
      };
      console.log(`    ✓ Belrose fields encrypted (${belroseResult.encrypted.byteLength} bytes)`);
    }

    // Encrypt customData if it exists
    if (customData) {
      console.log('  🔒 Encrypting custom data...');
      const customDataResult = await this.encryptJSON(customData, fileKey);
      result.customData = {
        encrypted: customDataResult.encrypted,
        iv: this.arrayBufferToBase64(customDataResult.iv),
      };
      console.log(`    ✓ Custom data encrypted (${customDataResult.encrypted.byteLength} bytes)`);
    }

    // Encrypt the file key with user's master key
    console.log('  🔒 Encrypting file key with user master key...');
    const encryptedKeyData = await this.encryptKeyForUser(fileKey, userKey);
    result.encryptedKey = this.arrayBufferToBase64(encryptedKeyData);
    console.log('    ✓ File key encrypted');

    console.log('✅ Complete record encryption finished');
    return result;
  }

  /**
   * Decrypt ALL record data
   */
  static async decryptCompleteRecord(
    encryptedKey: string,
    encryptedData: {
      fileName: { encrypted: ArrayBuffer; iv: string };
      file?: { encrypted: ArrayBuffer; iv: string };
      extractedText?: { encrypted: ArrayBuffer; iv: string };
      originalText?: { encrypted: ArrayBuffer; iv: string };
      fhirData?: { encrypted: ArrayBuffer; iv: string };
      belroseFields?: { encrypted: ArrayBuffer; iv: string };
      customData?: { encrypted: ArrayBuffer; iv: string };
    }
  ): Promise<{
    fileName: string;
    file?: ArrayBuffer;
    extractedText?: string;
    originalText?: string;
    fhirData?: any;
    belroseFields?: any;
    customData?: any;
  }> {
    console.log('🔓 Starting complete record decryption...');

    // Decrypt the file key
    const userKey = await this.getUserMasterKey();
    const keyData = this.base64ToArrayBuffer(encryptedKey);
    const fileKeyData = await this.decryptKeyForUser(keyData, userKey);
    const fileKey = await this.importKey(fileKeyData);
    console.log('  ✓ File key decrypted');

    const result: any = {};
    // Decrypt fileName (always exists)
    console.log('  🔓 Decrypting file name...');
    result.fileName = await this.decryptText(
      encryptedData.fileName.encrypted,
      fileKey,
      this.base64ToArrayBuffer(encryptedData.fileName.iv)
    );
    console.log(`    ✓ File name decrypted: ${result.fileName}`);

    // Decrypt file if it exists
    if (encryptedData.file) {
      console.log('  🔓 Decrypting file...');
      result.file = await this.decryptFile(
        encryptedData.file.encrypted,
        fileKey,
        this.base64ToArrayBuffer(encryptedData.file.iv)
      );
      console.log(`    ✓ File decrypted (${result.file.byteLength} bytes)`);
    }

    // Decrypt extracted text
    if (encryptedData.extractedText) {
      console.log('  🔓 Decrypting extracted text...');
      result.extractedText = await this.decryptText(
        encryptedData.extractedText.encrypted,
        fileKey,
        this.base64ToArrayBuffer(encryptedData.extractedText.iv)
      );
      console.log(`    ✓ Extracted text decrypted (${result.extractedText.length} chars)`);
    }

    // Decrypt original text if it exists
    if (encryptedData.originalText) {
      console.log('  🔓 Decrypting original text...');
      result.originalText = await this.decryptText(
        encryptedData.originalText.encrypted,
        fileKey,
        this.base64ToArrayBuffer(encryptedData.originalText.iv)
      );
      console.log(`    ✓ Original text decrypted (${result.originalText.length} chars)`);
    }

    // Decrypt FHIR data if it exists
    if (encryptedData.fhirData) {
      console.log('  🔓 Decrypting FHIR data...');
      result.fhirData = await this.decryptJSON(
        encryptedData.fhirData.encrypted,
        fileKey,
        this.base64ToArrayBuffer(encryptedData.fhirData.iv)
      );
      console.log('    ✓ FHIR data decrypted');
    }

    // Decrypt belroseFields if they exist
    if (encryptedData.belroseFields) {
      console.log('  🔓 Decrypting Belrose fields...');
      result.belroseFields = await this.decryptJSON(
        encryptedData.belroseFields.encrypted,
        fileKey,
        this.base64ToArrayBuffer(encryptedData.belroseFields.iv)
      );
      console.log('    ✓ Belrose fields decrypted');
    }

    // Decrypt customData if it exists
    if (encryptedData.customData) {
      console.log('  🔓 Decrypting custom data...');
      result.customData = await this.decryptJSON(
        encryptedData.customData.encrypted,
        fileKey,
        this.base64ToArrayBuffer(encryptedData.customData.iv)
      );
      console.log('    ✓ Custom data decrypted');
    }

    console.log('✅ Complete record decryption finished');
    return result;
  }

  // =================== HELPER METHODS =========================
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // ================== USER KEY MANAGEMENT ======================

  // Placeholder methods - you'll implement these based on your auth system
  private static async getUserMasterKey(): Promise<CryptoKey> {
    // This should derive a key from the user's password/PIN
    // For now, using a hardcoded key for testing
    const password = 'user-password-123'; // Replace with actual user auth
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('salt-should-be-random-per-user'),
        iterations: ENCRYPTION_CONFIG.pbkdf2.iterations,
        hash: ENCRYPTION_CONFIG.pbkdf2.hash,
      },
      keyMaterial,
      { name: ENCRYPTION_CONFIG.algorithm, length: ENCRYPTION_CONFIG.keyLength },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private static async encryptKeyForUser(
    fileKey: CryptoKey,
    userKey: CryptoKey
  ): Promise<ArrayBuffer> {
    const keyData = await this.exportKey(fileKey);
    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));

    const encrypted = await crypto.subtle.encrypt(
      { name: ENCRYPTION_CONFIG.algorithm, iv },
      userKey,
      keyData
    );

    // Prepend IV to encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return result.buffer;
  }

  private static async decryptKeyForUser(
    encryptedKeyData: ArrayBuffer,
    userKey: CryptoKey
  ): Promise<ArrayBuffer> {
    const data = new Uint8Array(encryptedKeyData);
    const iv = data.slice(0, ENCRYPTION_CONFIG.ivLength);
    const encrypted = data.slice(ENCRYPTION_CONFIG.ivLength);

    return await crypto.subtle.decrypt(
      { name: ENCRYPTION_CONFIG.algorithm, iv },
      userKey,
      encrypted
    );
  }
}
