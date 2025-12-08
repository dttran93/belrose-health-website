// src/components/auth/services/memberRegistryBlockchain.ts
// Frontend service for member registry blockchain operations.
// Calls backend Cloud Functions which use the admin wallet to write to blockchain.

import { getFunctions, httpsCallable } from 'firebase/functions';

// ==================== TYPES ====================

interface RegisterMemberResult {
  success: boolean;
  txHash: string;
  blockNumber: number;
}

interface UpdateStatusResult {
  success: boolean;
  txHash: string;
  blockNumber: number;
}

interface InitializeRecordResult {
  success: boolean;
  txHash: string;
  blockNumber: number;
}

export enum MemberStatus {
  Inactive = 0,
  Active = 1,
  Verified = 2,
}

// ==================== SERVICE ====================

export class MemberRegistryBlockchain {
  /**
   * Register a new member on the blockchain
   * Called after user completes registration with a wallet
   *
   * @param walletAddress - User's wallet address
   * @returns Transaction result
   */
  static async registerMember(walletAddress: string): Promise<RegisterMemberResult> {
    console.log('🔗 Registering member on blockchain...');

    try {
      const functions = getFunctions();
      const registerFn = httpsCallable<{ walletAddress: string }, RegisterMemberResult>(
        functions,
        'registerMemberOnChain'
      );

      const result = await registerFn({ walletAddress });

      console.log('✅ Member registered:', result.data.txHash);
      return result.data;
    } catch (error: any) {
      console.error('❌ Member registration failed:', error);

      // Handle "already exists" gracefully
      if (error.code === 'already-exists') {
        console.log('ℹ️ Member already registered on blockchain');
        return {
          success: true,
          txHash: '',
          blockNumber: 0,
        };
      }

      throw new Error(error.message || 'Failed to register on blockchain');
    }
  }

  /**
   * Update member status on the blockchain
   * Called after identity verification completes
   *
   * @param walletAddress - User's wallet address
   * @param status - New status (Active, Verified, etc.)
   * @returns Transaction result
   */
  static async updateMemberStatus(
    walletAddress: string,
    status: MemberStatus
  ): Promise<UpdateStatusResult> {
    console.log('🔗 Updating member status on blockchain...', { status });

    try {
      const functions = getFunctions();
      const updateFn = httpsCallable<{ walletAddress: string; status: number }, UpdateStatusResult>(
        functions,
        'updateMemberStatus'
      );

      const result = await updateFn({ walletAddress, status });

      console.log('✅ Status updated:', result.data.txHash);
      return result.data;
    } catch (error: any) {
      console.error('❌ Status update failed:', error);
      throw new Error(error.message || 'Failed to update status on blockchain');
    }
  }

  /**
   * Initialize a record's first administrator on the blockchain
   * Called when a new health record is created
   *
   * @param recordId - The record ID
   * @param adminWalletAddress - The first admin's wallet address
   * @returns Transaction result
   */
  static async initializeRecord(
    recordId: string,
    adminWalletAddress: string
  ): Promise<InitializeRecordResult> {
    console.log('🔗 Initializing record on blockchain...', { recordId });

    try {
      const functions = getFunctions();
      const initFn = httpsCallable<
        { recordId: string; adminWalletAddress: string },
        InitializeRecordResult
      >(functions, 'initializeRecordOnChain');

      const result = await initFn({ recordId, adminWalletAddress });

      console.log('✅ Record initialized:', result.data.txHash);
      return result.data;
    } catch (error: any) {
      console.error('❌ Record initialization failed:', error);

      // Handle "already exists" gracefully
      if (error.code === 'already-exists') {
        console.log('ℹ️ Record already initialized on blockchain');
        return {
          success: true,
          txHash: '',
          blockNumber: 0,
        };
      }

      throw new Error(error.message || 'Failed to initialize record on blockchain');
    }
  }

  /**
   * Mark member as verified after identity verification
   * Convenience method that calls updateMemberStatus with Verified status
   *
   * @param walletAddress - User's wallet address
   */
  static async markAsVerified(walletAddress: string): Promise<UpdateStatusResult> {
    return this.updateMemberStatus(walletAddress, MemberStatus.Verified);
  }
}
