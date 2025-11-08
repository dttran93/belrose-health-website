// src/features/Sharing/services/sharingKeyManagementService.ts
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';

export class SharingKeyManagementService {
  /**
   * Generate RSA key pair for a new user
   * Call this during user registration
   */
  static async generateUserKeyPair(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true, // extractable
      ['wrapKey', 'unwrapKey']
    );

    // Export public key (store in Firestore - public!)
    const publicKeyData = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = arrayBufferToBase64(publicKeyData);

    // Export private key (encrypt with user's master key and store!)
    const privateKeyData = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKeyBase64 = arrayBufferToBase64(privateKeyData);

    return {
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64,
    };
  }

  /**
   * Import public key from base64
   */
  static async importPublicKey(base64Key: string): Promise<CryptoKey> {
    const keyData = base64ToArrayBuffer(base64Key);
    return await crypto.subtle.importKey(
      'spki',
      keyData,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      true,
      ['wrapKey']
    );
  }

  /**
   * Import private key from base64
   */
  static async importPrivateKey(base64Key: string): Promise<CryptoKey> {
    const keyData = base64ToArrayBuffer(base64Key);
    return await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      true,
      ['unwrapKey']
    );
  }

  /**
   * Wrap an AES key with someone's RSA public key
   * This is what you do when sharing
   */
  static async wrapKey(aesKey: CryptoKey, rsaPublicKey: CryptoKey): Promise<string> {
    const wrappedKey = await crypto.subtle.wrapKey('raw', aesKey, rsaPublicKey, {
      name: 'RSA-OAEP',
    });
    return arrayBufferToBase64(wrappedKey);
  }

  /**
   * Unwrap a wrapped key using your RSA private key
   * This is what the doctor does to decrypt
   */
  static async unwrapKey(wrappedKeyBase64: string, rsaPrivateKey: CryptoKey): Promise<CryptoKey> {
    const wrappedKeyBytes = base64ToArrayBuffer(wrappedKeyBase64);

    return await crypto.subtle.unwrapKey(
      'raw',
      wrappedKeyBytes,
      rsaPrivateKey,
      {
        name: 'RSA-OAEP',
      },
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }
}
