// src/features/ViewEditRecord/service/userWalletService.ts
import { doc, updateDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { WalletService, AuthMethod } from '@/features/BlockchainVerification/service/walletService';
import { UserService } from '@/components/auth/services/userService';

export class UserWalletService {
  /**
   * Link current wallet connection to user account
   */
  static async linkWalletToAccount(userId: string): Promise<void> {
    // Check if wallet is connected
    if (!WalletService.isConnected()) {
      throw new Error('No wallet connected');
    }

    // Get current wallet info
    const walletInfo = await WalletService.getWalletInfo();
    if (!walletInfo) {
      throw new Error('Unable to get wallet information');
    }

    // Check if user document exists
    const userProfile = await UserService.getUserProfile(userId);
    if (!userProfile) {
      throw new Error('User profile not found');
    }

    const db = getFirestore();
    const userRef = doc(db, 'users', userId);

    const walletData = {
      address: walletInfo.address,
      authMethod: AuthMethod.METAMASK, // Since we're only using MetaMask now
      connectedAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      balance: walletInfo.balance || undefined,
    };

    try {
      await updateDoc(userRef, {
        connectedWallet: walletData,
        updatedAt: serverTimestamp(),
      });

      console.log('Wallet linked to account:', walletInfo.address);
    } catch (error) {
      console.error('Failed to link wallet:', error);
      throw new Error('Failed to link wallet to account');
    }
  }

  /**
   * Update last used timestamp when wallet is used
   */
  static async updateWalletLastUsed(userId: string): Promise<void> {
    const db = getFirestore();
    const userRef = doc(db, 'users', userId);

    try {
      await updateDoc(userRef, {
        'connectedWallet.lastUsed': new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn('Failed to update wallet last used:', error);
    }
  }

  /**
   * Unlink wallet from account
   */
  static async unlinkWalletFromAccount(userId: string): Promise<void> {
    const db = getFirestore();
    const userRef = doc(db, 'users', userId);

    try {
      await updateDoc(userRef, {
        connectedWallet: null,
        updatedAt: serverTimestamp(),
      });

      console.log('Wallet unlinked from account');
    } catch (error) {
      console.error('Failed to unlink wallet:', error);
      throw new Error('Failed to unlink wallet from account');
    }
  }

  /**
   * Get user's linked wallet info
   */
  static async getUserWallet(userId: string): Promise<any> {
    const userProfile = await UserService.getUserProfile(userId);
    return userProfile?.connectedWallet || null;
  }

  /**
   * Check if user has a linked wallet
   */
  static async hasLinkedWallet(userId: string): Promise<boolean> {
    const wallet = await this.getUserWallet(userId);
    return !!wallet;
  }

  /**
   * Enable/disable blockchain verification preference
   */
  static async updateBlockchainPreference(userId: string, enabled: boolean): Promise<void> {
    const db = getFirestore();
    const userRef = doc(db, 'users', userId);

    try {
      await updateDoc(userRef, {
        'preferences.blockchainVerificationEnabled': enabled,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to update blockchain preference:', error);
      throw new Error('Failed to update preference');
    }
  }

  /**
   * Verify that the currently connected wallet matches the user's linked wallet
   */
  static async verifyWalletMatch(userId: string): Promise<boolean> {
    try {
      // Get linked wallet from user profile
      const linkedWallet = await this.getUserWallet(userId);
      if (!linkedWallet) {
        return false; // No linked wallet
      }

      // Get current wallet connection
      if (!WalletService.isConnected()) {
        return false; // No current connection
      }

      const currentWalletInfo = await WalletService.getWalletInfo();
      if (!currentWalletInfo) {
        return false; // Can't get current wallet info
      }

      // Compare addresses (case-insensitive)
      return linkedWallet.address.toLowerCase() === currentWalletInfo.address.toLowerCase();
    } catch (error) {
      console.error('Failed to verify wallet match:', error);
      return false;
    }
  }

  /**
   * Update wallet balance in user profile
   */
  static async updateWalletBalance(userId: string): Promise<void> {
    if (!WalletService.isConnected()) {
      return;
    }

    const walletInfo = await WalletService.getWalletInfo();
    if (!walletInfo) {
      return;
    }

    const db = getFirestore();
    const userRef = doc(db, 'users', userId);

    try {
      await updateDoc(userRef, {
        'connectedWallet.balance': walletInfo.balance || null,
        'connectedWallet.lastUsed': new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn('Failed to update wallet balance:', error);
    }
  }
}
