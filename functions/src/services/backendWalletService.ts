// functions/src/services/backendWalletService.ts
import { ethers } from 'ethers';
import * as crypto from 'crypto';

/**
 * Generates a new Ethereum wallet
 */
export function generateWallet() {
  const wallet = ethers.Wallet.createRandom();

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase,
  };
}

/**
 * Encrypts a private key with user's encryption password
 * Uses AES-256-GCM encryption with PBKDF2 key derivation
 */
export function encryptPrivateKey(privateKey: string, encryptionPassword: string) {
  const algorithm = 'aes-256-gcm';

  // Generate salt for key derivation
  const salt = crypto.randomBytes(32);

  // Derive key from password using PBKDF2 (matches frontend)
  const key = crypto.pbkdf2Sync(encryptionPassword, salt, 100000, 32, 'sha256');

  // Generate initialization vector
  const iv = crypto.randomBytes(16);

  // Encrypt
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get auth tag for verification
  const authTag = cipher.getAuthTag();

  return {
    encryptedKey: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt.toString('hex'),
  };
}
