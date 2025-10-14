// src/features/Sharing/services/keyManagementService.ts

export class KeyManagementService {
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
    const publicKeyBase64 = this.arrayBufferToBase64(publicKeyData);

    // Export private key (encrypt with user's master key and store!)
    const privateKeyData = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKeyBase64 = this.arrayBufferToBase64(privateKeyData);

    return {
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64,
    };
  }

  /**
   * Import public key from base64
   */
  static async importPublicKey(base64Key: string): Promise<CryptoKey> {
    const keyData = this.base64ToArrayBuffer(base64Key);
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
    const keyData = this.base64ToArrayBuffer(base64Key);
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
    return this.arrayBufferToBase64(wrappedKey);
  }

  /**
   * Unwrap a wrapped key using your RSA private key
   * This is what the doctor does to decrypt
   */
  static async unwrapKey(wrappedKeyBase64: string, rsaPrivateKey: CryptoKey): Promise<CryptoKey> {
    const wrappedKeyBytes = this.base64ToArrayBuffer(wrappedKeyBase64);

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

  // Helper functions
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = Array.from(bytes)
      .map(byte => String.fromCharCode(byte))
      .join('');
    return btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
