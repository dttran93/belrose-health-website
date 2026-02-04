// src/features/Auth/services/walletGenerationService.ts

import { auth } from '@/firebase/config';

/**
 * WalletGenerationService
 *
 * Handles blockchain wallet generation during user registration.
 * Calls the backend cloud function to securely generate and encrypt
 * the wallet using the user's master encryption key.
 */

export interface GenerateWalletParams {
  userId: string;
  masterKey: CryptoKey;
}

export interface GenerateWalletResult {
  walletAddress: string;
  encryptedPrivateKey: string;
  encryptedPrivateKeyIV: string;
  authTag: string;
}

export class WalletGenerationService {
  /**
   * Generate a new blockchain wallet for the user
   *
   * @param params - User ID and master encryption key
   * @returns Wallet address and encrypted private key data
   * @throws Error if wallet generation fails
   */
  static async generateWallet(params: GenerateWalletParams): Promise<GenerateWalletResult> {
    const { userId, masterKey } = params;

    try {
      console.log('💼 Generating blockchain wallet for user:', userId);

      // 1. Get authentication token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const token = await user.getIdToken();

      // 2. Convert master key to hex format for backend
      const masterKeyHex = await this.convertMasterKeyToHex(masterKey);

      // 3. Call cloud function to generate wallet
      const walletData = await this.callCreateWalletEndpoint(userId, masterKeyHex, token);

      console.log('✅ Wallet generated successfully:', walletData.walletAddress);

      return walletData;
    } catch (error) {
      console.error('❌ Wallet generation failed:', error);
      throw new Error(
        `Failed to generate wallet: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert CryptoKey to hex string for backend encryption
   */
  private static async convertMasterKeyToHex(masterKey: CryptoKey): Promise<string> {
    const masterKeyBytes = await window.crypto.subtle.exportKey('raw', masterKey);
    const masterKeyArray = new Uint8Array(masterKeyBytes);
    const masterKeyHex = Array.from(masterKeyArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return masterKeyHex;
  }

  /**
   * Call the createWallet cloud function
   */
  private static async callCreateWalletEndpoint(
    userId: string,
    masterKeyHex: string,
    token: string
  ): Promise<GenerateWalletResult> {
    const endpoint = import.meta.env.DEV
      ? 'http://127.0.0.1:5001/belrose-757fe/us-central1/createWallet'
      : 'https://us-central1-belrose-757fe.cloudfunctions.net/createWallet';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId,
        masterKeyHex,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      walletAddress: data.walletAddress,
      encryptedPrivateKey: data.encryptedPrivateKey,
      encryptedPrivateKeyIV: data.encryptedPrivateKeyIV,
      authTag: data.authTag,
    };
  }
}
