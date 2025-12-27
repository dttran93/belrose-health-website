// src/features/Permissions/services/recordInitializationService.ts
//
// Frontend service for initializing record roles on the blockchain.
// Calls backend Cloud Function which uses the admin wallet.
//
// This is separate from BlockchainRoleManagerService because:
// 1. initializeRecordRole is admin-only (requires backend)
// 2. It's a one-time operation when a record is first shared
// 3. Keeps the concern of "role creation" separate from "role management"

import { getFunctions, httpsCallable } from 'firebase/functions';

// ==================== TYPES ====================

export type InitialRole = 'administrator' | 'owner';

export interface InitializeRecordResult {
  success: boolean;
  txHash: string;
  blockNumber: number;
  role: InitialRole;
}

// ==================== SERVICE ====================

export class RoleInitializationService {
  /**
   * Initialize a record's first role on the blockchain.
   * Called when the uploader first wants to share a record.
   *
   * This sets up the role hierarchy for a record by assigning the first
   * administrator or owner. After this, that user can grant additional
   * roles using BlockchainRoleManagerService.
   *
   * @param recordId - The Firestore document ID of the record
   * @param walletAddress - Wallet address of the first admin/owner
   * @param role - The initial role: 'administrator' or 'owner'
   * @returns Transaction result with txHash, blockNumber, and role
   */
  static async initializeRecordRole(
    recordId: string,
    walletAddress: string,
    role: InitialRole
  ): Promise<InitializeRecordResult> {
    console.log('🔗 Initializing record on blockchain...', { recordId, role });

    try {
      const functions = getFunctions();
      const initFn = httpsCallable<
        { recordId: string; walletAddress: string; role: InitialRole },
        InitializeRecordResult
      >(functions, 'initializeRoleOnChain');

      const result = await initFn({ recordId, walletAddress, role });

      console.log('✅ Record initialized:', result.data.txHash);
      return result.data;
    } catch (error: any) {
      console.log('Error code:', error.code);
      console.error('❌ Record initialization failed:', error);

      // Handle "already exists" gracefully - not really an error
      if (
        error.code === 'already-exists' ||
        error.code === 'functions/already-exists' ||
        error.message?.includes('already initialized')
      ) {
        console.log('ℹ️ Record already initialized on blockchain');
        return {
          success: true,
          txHash: '',
          blockNumber: 0,
          role: role,
        };
      }

      throw new Error(error.message || 'Failed to initialize record on blockchain');
    }
  }

  /**
   * Convenience method to initialize as administrator
   */
  static async initializeAsAdmin(
    recordId: string,
    walletAddress: string
  ): Promise<InitializeRecordResult> {
    return this.initializeRecordRole(recordId, walletAddress, 'administrator');
  }

  /**
   * Convenience method to initialize as owner
   */
  static async initializeAsOwner(
    recordId: string,
    walletAddress: string
  ): Promise<InitializeRecordResult> {
    return this.initializeRecordRole(recordId, walletAddress, 'owner');
  }
}
