// features/Encryption/services/encryptionSetupService.ts
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { EncryptionService } from './encryptionService';
import { KeyManagementService } from '@/features/Sharing/services/keyManagementService';

export class EncryptionSetupService {
  /**
   * Initialize encryption for a user, including RSA key for sharing
   */
  static async setupEncryption(password: string): Promise<string> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Generate salt
    const salt = EncryptionService.generateSalt();
    const saltString = EncryptionService.saltToString(salt);

    // Hash password for verification
    const passwordHash = await EncryptionService.hashPassword(password, salt);

    // Generate recovery key
    const recoveryKey = EncryptionService.generateRecoveryKey();
    const recoveryHash = await EncryptionService.hashPassword(recoveryKey, salt);

    // Generate RSA key pair for Sharing
    const { publicKey, privateKey } = await KeyManagementService.generateUserKeyPair();

    // Encrypt the RSA private key with the user's password
    const masterKey = await EncryptionService.deriveKeyFromPassword(password, salt);
    const encryptedPrivateKeyData = await EncryptionService.encryptText(privateKey, masterKey);

    // Save to Firestore
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      'encryption.enabled': true,
      'encryption.salt': saltString,
      'encryption.passwordHash': passwordHash,
      'encryption.recoveryKeyHash': recoveryHash,
      'encryption.setupAt': new Date().toISOString(),
      publicKey: publicKey, // Public key (anyone can see)
      encryptedPrivateKey: EncryptionService.arrayBufferToBase64(encryptedPrivateKeyData.encrypted),
      privateKeyIV: EncryptionService.arrayBufferToBase64(encryptedPrivateKeyData.iv),
    });

    console.log('Encryption and RSA setup completed for user:', user.uid);

    // Return recovery key to show user ONE TIME
    return recoveryKey;
  }

  /**
   * Verify encryption password
   */
  static async verifyPassword(password: string): Promise<boolean> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const userData = userDoc.data();
    const encryptionData = userData.encryption;

    if (!encryptionData?.enabled) {
      throw new Error('Encryption not enabled for this user');
    }

    // Derive hash from provided password
    const salt = EncryptionService.stringToSalt(encryptionData.salt);
    const providedHash = await EncryptionService.hashPassword(password, salt);

    // Compare with stored hash
    return providedHash === encryptionData.passwordHash;
  }

  /**
   * Verify recovery key
   */
  static async verifyRecoveryKey(recoveryKey: string): Promise<boolean> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const userData = userDoc.data();
    const encryptionData = userData.encryption;

    if (!encryptionData?.enabled) {
      throw new Error('Encryption not enabled for this user');
    }

    // Validate mnemonic format
    if (!EncryptionService.validateRecoveryKey(recoveryKey)) {
      return false;
    }

    // Derive hash from provided recovery key
    const salt = EncryptionService.stringToSalt(encryptionData.salt);
    const providedHash = await EncryptionService.hashPassword(recoveryKey, salt);

    // Compare with stored hash
    return providedHash === encryptionData.recoveryKeyHash;
  }

  /**
   * Get user's encryption metadata
   */
  static async getEncryptionMetadata() {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return null;
    }

    return userDoc.data().encryption || null;
  }

  /**
   * Update last unlocked timestamp
   */
  static async updateLastUnlocked(): Promise<void> {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      'encryption.lastUnlockedAt': new Date().toISOString(),
    });
  }
}
