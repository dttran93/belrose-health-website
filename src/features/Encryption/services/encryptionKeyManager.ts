// features/Encryption/services/encryptionKeyManager.ts
import * as bip39 from 'bip39';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';

/**
 * Manages the user's master encryption key lifecycle
 * Handles key generation, password wrapping, recovery keys, and session storage
 */
export class EncryptionKeyManager {
  private static sessionKey: CryptoKey | null = null;
  private static lastActivityTime: number = Date.now();
  private static SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  // =================== SALT GENERATION ===================
  /**
   * Generate and store salt along side encryptedKey and IV
   */
  static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Convert salt to string for storage
   */
  static saltToString(salt: Uint8Array): string {
    return arrayBufferToBase64(salt.buffer);
  }

  /**
   * Convert stored base64 string back to Uint8Array
   */
  static stringToSalt(saltString: string): Uint8Array {
    return new Uint8Array(base64ToArrayBuffer(saltString));
  }

  // =================== MASTER KEY GENERATION ===================

  /**
   * Generate a new master encryption key during registration
   * This is the key that will encrypt all user health data
   */
  static async generateMasterKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true, // extractable so we can wrap it with password
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Derive a Key Encryption Key (KEK) from user's login password
   * This is the "big safe" that protects the master key
   */
  static async deriveKEKFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, [
      'deriveBits',
      'deriveKey',
    ]);

    // Derive the KEK
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // Not extractable for security
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Wrap (encrypt) the master key with the KEK derived from password
   * "Put the key in the big safe"
   */
  static async wrapMasterKeyWithPassword(
    masterKey: CryptoKey,
    password: string,
    salt?: Uint8Array //Optional - will generate if not provided
  ): Promise<{ encryptedKey: string; iv: string; salt: string }> {
    //Generate salt if not provided during registration
    const actualSalt = salt ?? this.generateSalt();

    // Derive KEK from password
    const kek = await this.deriveKEKFromPassword(password, actualSalt);

    // Export master key to raw format
    const keyData = await crypto.subtle.exportKey('raw', masterKey);

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the key data with KEK
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      kek,
      keyData
    );

    return {
      encryptedKey: arrayBufferToBase64(encryptedData),
      iv: arrayBufferToBase64(iv.buffer),
      salt: this.saltToString(actualSalt),
    };
  }

  /**
   * Unwrap (decrypt) the master key using password
   * "Unlock the big safe to get the key"
   */
  static async unwrapMasterKeyWithPassword(
    encryptedKeyData: string,
    ivData: string,
    password: string,
    saltData: string
  ): Promise<CryptoKey> {
    // Convert salt from stored string back to Uint8Array
    const salt = this.stringToSalt(saltData);

    // Derive KEK from password
    const kek = await this.deriveKEKFromPassword(password, salt);

    const encryptedKey = base64ToArrayBuffer(encryptedKeyData);
    const iv = base64ToArrayBuffer(ivData);

    // Decrypt the key data
    const decryptedKeyData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      kek,
      encryptedKey
    );

    // Import back as CryptoKey
    return await crypto.subtle.importKey(
      'raw',
      decryptedKeyData,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // =================== RECOVERY KEY METHODS ===================

  /**
   * Generate a 24-word recovery key from the master key
   * This is the human-readable backup
   */
  static async generateRecoveryKeyFromMasterKey(masterKey: CryptoKey): Promise<string> {
    // Export the master key
    const keyData = await crypto.subtle.exportKey('raw', masterKey);

    // Convert to entropy for BIP39 (32 bytes = 24 words)
    const entropy = Buffer.from(keyData);

    // Generate mnemonic from entropy
    return bip39.entropyToMnemonic(entropy);
  }

  /**
   * Recover master key from 24-word recovery key
   */
  static async recoverMasterKeyFromRecoveryKey(recoveryKey: string): Promise<CryptoKey> {
    // Validate the mnemonic
    if (!bip39.validateMnemonic(recoveryKey)) {
      throw new Error('Invalid recovery key');
    }

    // Convert mnemonic back to entropy
    const entropy = bip39.mnemonicToEntropy(recoveryKey);
    const keyData = Buffer.from(entropy, 'hex');

    // Import as CryptoKey
    return await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
  }

  /**
   * Validate a recovery key without importing it
   */
  static validateRecoveryKey(recoveryKey: string): boolean {
    return bip39.validateMnemonic(recoveryKey);
  }

  static async hashRecoveryKey(recoveryKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(recoveryKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // =================== SESSION MANAGEMENT (UPDATED) ===================

  /**
   * Initialize encryption session by unwrapping master key with password
   * Use this during login
   */
  static async initializeSessionWithPassword(
    encryptedKeyData: string,
    ivData: string,
    password: string,
    saltData: string
  ): Promise<void> {
    this.sessionKey = await this.unwrapMasterKeyWithPassword(
      encryptedKeyData,
      ivData,
      password,
      saltData
    );
    this.lastActivityTime = Date.now();

    console.log('🔑 Encryption session initialized from password');
  }

  /**
   * Initialize encryption session from recovery key
   * Use this during account recovery
   */
  static async initializeSessionWithRecoveryKey(recoveryKey: string): Promise<void> {
    this.sessionKey = await this.recoverMasterKeyFromRecoveryKey(recoveryKey);
    this.lastActivityTime = Date.now();

    console.log('🔑 Encryption session initialized from recovery key');
  }

  /**
   * Directly set the session key (for registration flow)
   */
  static setSessionKey(key: CryptoKey): void {
    this.sessionKey = key;
    this.lastActivityTime = Date.now();
    console.log('🔑 Encryption session key set');
  }

  /**
   * Get the current session key (returns null if not initialized or expired)
   */
  static getSessionKey(): CryptoKey | null {
    // Check if session has expired
    if (this.sessionKey && this.isSessionExpired()) {
      console.log('⏰ Encryption session expired');
      this.clearSession();
      return null;
    }

    // Update activity time when key is accessed
    if (this.sessionKey) {
      this.lastActivityTime = Date.now();
    }

    return this.sessionKey;
  }

  /**
   * Clear the session (logout or timeout)
   */
  static clearSession(): void {
    this.sessionKey = null;
    this.lastActivityTime = 0;
    console.log('🔒 Encryption session cleared');
  }

  /**
   * Check if user has an active encryption session
   */
  static hasActiveSession(): boolean {
    return this.sessionKey !== null && !this.isSessionExpired();
  }

  /**
   * Check if session has expired due to inactivity
   */
  private static isSessionExpired(): boolean {
    const timeSinceLastActivity = Date.now() - this.lastActivityTime;
    return timeSinceLastActivity > this.SESSION_TIMEOUT_MS;
  }

  /**
   * Get remaining session time in milliseconds
   */
  static getRemainingSessionTime(): number {
    if (!this.sessionKey) return 0;

    const elapsed = Date.now() - this.lastActivityTime;
    const remaining = this.SESSION_TIMEOUT_MS - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Extend session timeout (call when user is active)
   */
  static extendSession(): void {
    if (this.sessionKey) {
      this.lastActivityTime = Date.now();
    }
  }

  /**
   * Update session timeout duration (in minutes)
   */
  static setSessionTimeout(minutes: number): void {
    this.SESSION_TIMEOUT_MS = minutes * 60 * 1000;
    console.log(`⚙️ Session timeout set to ${minutes} minutes`);
  }

  // =================== HELPER METHODS ===================

  /**
   * Export session key to store temporarily (e.g., for registration flow)
   */
  static async exportSessionKey(): Promise<string | null> {
    if (!this.sessionKey) return null;

    const keyData = await crypto.subtle.exportKey('raw', this.sessionKey);
    return arrayBufferToBase64(keyData);
  }

  /**
   * Import and set session key from exported string
   */
  static async importAndSetSessionKey(exportedKey: string): Promise<void> {
    const keyData = base64ToArrayBuffer(exportedKey);

    this.sessionKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    this.lastActivityTime = Date.now();
  }
}
