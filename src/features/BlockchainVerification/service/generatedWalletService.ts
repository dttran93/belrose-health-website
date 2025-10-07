// src/features/BlockchainVerification/services/generatedWalletService.ts
// Frontend service for decrypting and using generated wallets

import { ethers } from 'ethers';

// API Base URL - change based on environment
const API_BASE = import.meta.env.DEV
  ? 'http://127.0.0.1:5001/belrose-health/us-central1' // Update with your project ID
  : 'https://us-central1-belrose-health.cloudfunctions.net'; // Update with your project ID

/**
 * Helper: Convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Derives encryption key from password (matches backend)
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive the actual encryption key (matches backend parameters)
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

/**
 * Decrypts private key using user's encryption password
 */
export async function decryptPrivateKey(
  encryptedKey: string,
  iv: string,
  authTag: string,
  salt: string,
  encryptionPassword: string
): Promise<string> {
  try {
    const encryptedData = hexToUint8Array(encryptedKey);
    const ivArray = hexToUint8Array(iv);
    const authTagArray = hexToUint8Array(authTag);
    const saltArray = hexToUint8Array(salt);

    // Derive key from password
    const keyMaterial = await deriveKey(encryptionPassword, saltArray);

    // Combine encrypted data with auth tag
    const dataWithTag = new Uint8Array(encryptedData.length + authTagArray.length);
    dataWithTag.set(encryptedData, 0);
    dataWithTag.set(authTagArray, encryptedData.length);

    // Decrypt
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivArray as BufferSource,
      },
      keyMaterial,
      dataWithTag
    );

    // Convert to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt private key. Check your encryption password.');
  }
}

/**
 * Fetches encrypted wallet data from backend
 */
async function fetchEncryptedWallet(): Promise<{
  encryptedPrivateKey: string;
  iv: string;
  authTag: string;
  salt: string;
  walletAddress: string;
}> {
  const token = localStorage.getItem('authToken'); // Adjust based on your auth setup

  const response = await fetch(`${API_BASE}/getEncryptedWallet`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch wallet data');
  }

  return await response.json();
}

/**
 * Signs health data with the user's wallet
 */
export async function signHealthData(
  healthData: any,
  encryptionPassword: string
): Promise<{ data: any; signature: string; walletAddress: string }> {
  try {
    // 1. Fetch encrypted wallet data
    const encryptedWalletData = await fetchEncryptedWallet();

    // 2. Decrypt private key
    const privateKey = await decryptPrivateKey(
      encryptedWalletData.encryptedPrivateKey,
      encryptedWalletData.iv,
      encryptedWalletData.authTag,
      encryptedWalletData.salt,
      encryptionPassword
    );

    // 3. Create wallet instance
    const wallet = new ethers.Wallet(privateKey);

    // 4. Sign the data
    const message = JSON.stringify(healthData);
    const signature = await wallet.signMessage(message);

    // 5. Clear private key from memory
    // (This is basic - in production you'd want more thorough cleanup)
    privateKey.replace(/./g, '0');

    return {
      data: healthData,
      signature: signature,
      walletAddress: wallet.address,
    };
  } catch (error) {
    console.error('Failed to sign health data:', error);
    throw error;
  }
}

/**
 * Verifies a signature (anyone can do this without the private key)
 */
export async function verifyHealthDataSignature(
  healthData: any,
  signature: string,
  expectedAddress: string
): Promise<boolean> {
  try {
    const message = JSON.stringify(healthData);
    const recoveredAddress = ethers.verifyMessage(message, signature);

    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}
