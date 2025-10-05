// features/Encryption/services/encryptionKeyManager.ts
import { EncryptionService } from './encryptionService';

/**
 * Manages the user's encryption session key in memory
 * Key is derived from password and exists only during the session
 */
export class EncryptionKeyManager {
  private static sessionKey: CryptoKey | null = null;
  private static userSalt: Uint8Array | null = null;
  private static lastActivityTime: number = Date.now();
  private static SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Initialize encryption session from user password
   */
  static async initializeFromPassword(password: string, saltString: string): Promise<void> {
    const salt = EncryptionService.stringToSalt(saltString);
    this.userSalt = salt;
    this.sessionKey = await EncryptionService.deriveKeyFromPassword(password, salt);
    this.lastActivityTime = Date.now();

    console.log('🔑 Encryption session initialized');
  }

  /**
   * Initialize encryption session from recovery key mnemonic
   */
  static async initializeFromRecoveryKey(mnemonic: string, saltString: string): Promise<void> {
    const salt = EncryptionService.stringToSalt(saltString);
    this.userSalt = salt;
    this.sessionKey = await EncryptionService.deriveKeyFromRecoveryKey(mnemonic, salt);
    this.lastActivityTime = Date.now();

    console.log('🔑 Encryption session initialized from recovery key');
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
    this.userSalt = null;
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
   * Get user's salt (for re-deriving key)
   */
  static getUserSalt(): Uint8Array | null {
    return this.userSalt;
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
      console.log('⏱️ Session extended');
    }
  }

  /**
   * Update session timeout duration (in minutes)
   */
  static setSessionTimeout(minutes: number): void {
    this.SESSION_TIMEOUT_MS = minutes * 60 * 1000;
    console.log(`⚙️ Session timeout set to ${minutes} minutes`);
  }
}
