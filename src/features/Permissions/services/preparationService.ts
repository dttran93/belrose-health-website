// src/features/Permissions/services/preparationService.ts

/**
 * Service for preparing blockchain state before permission operations.
 *
 * Prerequisites for permission operations:
 * - Caller's SmartAccount registered and active on-chain
 * - Target's EOA wallet registered and linked to active identity on-chain
 * - Record initialized on-chain (has at least one owner or admin)
 */

import { createPublicClient, http, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { SmartAccountService } from '@/features/BlockchainWallet/services/smartAccountService';

// ==================== SMART CONTRACT CONFIG ====================

const ROLE_MANAGER_ADDRESS = '0x0FdDcE7EdebD73C6d1A11983bb6a759132543aaD' as const;

const ROLE_MANAGER_ABI = [
  {
    name: 'isActiveMember',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'getRecordRoleStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'recordId', type: 'string' }],
    outputs: [
      { name: 'ownerCount', type: 'uint256' },
      { name: 'adminCount', type: 'uint256' },
      { name: 'viewerCount', type: 'uint256' },
    ],
  },
] as const;

// ==================== TYPES ====================

export interface PreparationStatus {
  isSmartAccountRegistered: boolean;
  isRecordInitialized: boolean;
  smartAccountAddress: string;
  isReady: boolean;
}

export interface PermissionPrerequisites {
  ready: boolean;
  reason?: string;
  callerSmartAccountAddress?: string;
}

export type InitialRole = 'administrator' | 'owner';

export interface InitializeRecordResult {
  success: boolean;
  txHash: string;
  blockNumber: number;
  role: InitialRole;
}

// ==================== SERVICE ====================

export class PreparationService {
  private static publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  // ============================================================================
  // VERIFICATION METHODS (used by PermissionsService to fail fast)
  // ============================================================================

  /**
   * Verify all blockchain prerequisites are met before a permission operation.
   *
   * Checks:
   * 1. Caller's SmartAccount is registered and active (for signing tx)
   * 2. Target's EOA is registered and linked to active identity (for role assignment)
   * 3. Record is initialized on-chain
   *
   * @param recordId - The record being modified
   * @param targetWallet - The target user's wallet address (used for identity lookup)
   */
  static async verifyPermissionPrerequisites(
    recordId: string,
    targetWallet: string
  ): Promise<PermissionPrerequisites> {
    try {
      // Step 1: Get caller's SmartAccount address
      const callerSmartAccount = await SmartAccountService.getAddress();

      // Step 2: Run all on-chain checks in parallel
      const [isCallerActive, isTargetActive, roleStats] = await Promise.all([
        this.checkIsActiveMember(callerSmartAccount as Address),
        this.checkIsActiveMember(targetWallet as Address),
        this.getRecordRoleStats(recordId),
      ]);

      // Step 3: Validate each prerequisite
      if (!isCallerActive) {
        return {
          ready: false,
          reason:
            'Your SmartAccount is not registered or active on the blockchain. Please complete the preparation step.',
          callerSmartAccountAddress: callerSmartAccount,
        };
      }

      if (!isTargetActive) {
        return {
          ready: false,
          reason:
            'Target user is not registered or active on the blockchain. They must complete account setup first.',
          callerSmartAccountAddress: callerSmartAccount,
        };
      }

      const isRecordInitialized = roleStats.ownerCount > 0 || roleStats.adminCount > 0;
      if (!isRecordInitialized) {
        return {
          ready: false,
          reason:
            'Record has not been initialized on the blockchain. Please run preparation first.',
          callerSmartAccountAddress: callerSmartAccount,
        };
      }

      return {
        ready: true,
        callerSmartAccountAddress: callerSmartAccount,
      };
    } catch (error) {
      console.error('Error verifying permission prerequisites:', error);
      return {
        ready: false,
        reason: `Failed to verify blockchain prerequisites: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Simplified verification for self-only operations (like voluntarilyLeaveOwnership)
   */
  static async verifyCallerPrerequisites(recordId: string): Promise<PermissionPrerequisites> {
    try {
      const callerSmartAccount = await SmartAccountService.getAddress();

      const [isCallerActive, roleStats] = await Promise.all([
        this.checkIsActiveMember(callerSmartAccount as Address),
        this.getRecordRoleStats(recordId),
      ]);

      if (!isCallerActive) {
        return {
          ready: false,
          reason: 'Your SmartAccount is not registered or active on the blockchain.',
          callerSmartAccountAddress: callerSmartAccount,
        };
      }

      const isRecordInitialized = roleStats.ownerCount > 0 || roleStats.adminCount > 0;
      if (!isRecordInitialized) {
        return {
          ready: false,
          reason: 'Record has not been initialized on the blockchain.',
          callerSmartAccountAddress: callerSmartAccount,
        };
      }

      return {
        ready: true,
        callerSmartAccountAddress: callerSmartAccount,
      };
    } catch (error) {
      console.error('Error verifying caller prerequisites:', error);
      return {
        ready: false,
        reason: `Failed to verify blockchain prerequisites: ${(error as Error).message}`,
      };
    }
  }

  // ============================================================================
  // STATUS & PREPARATION METHODS
  // ============================================================================

  /**
   * Get preparation status for current user and a record.
   */
  static async getStatus(recordId: string): Promise<PreparationStatus> {
    const smartAccountStatus = await SmartAccountService.getStatus();
    const roleStats = await this.getRecordRoleStats(recordId);

    const isRecordInitialized = roleStats.ownerCount > 0 || roleStats.adminCount > 0;

    return {
      smartAccountAddress: smartAccountStatus.address,
      isSmartAccountRegistered: smartAccountStatus.isRegisteredOnChain,
      isRecordInitialized,
      isReady: smartAccountStatus.isRegisteredOnChain && isRecordInitialized,
    };
  }

  /**
   * Prepare blockchain state for permission operations.
   *
   * 1. Ensures smart account is computed, saved, and registered on-chain
   * 2. Initializes record with first role if needed
   */
  static async prepare(recordId: string, initialRole: InitialRole): Promise<void> {
    console.log('🔄 PreparationService: Starting preparation...');

    // Step 1: Ensure smart account is fully initialized (compute + save + register)
    const smartAccountAddress = await SmartAccountService.ensureFullyInitialized();
    console.log('✅ PreparationService: Smart account ready:', smartAccountAddress);

    // Step 2: Check if record needs initialization
    const roleStats = await this.getRecordRoleStats(recordId);
    const isRecordInitialized = roleStats.ownerCount > 0 || roleStats.adminCount > 0;

    if (!isRecordInitialized) {
      console.log('🚀 PreparationService: Initializing record...');
      await this.initializeRecordRole(recordId, smartAccountAddress, initialRole);
      console.log('✅ PreparationService: Record initialized');
    } else {
      console.log('ℹ️ PreparationService: Record already initialized');
    }

    // Step 3: Verify everything is ready
    const finalStatus = await this.getStatus(recordId);
    if (!finalStatus.isReady) {
      throw new Error('Preparation failed to verify on-chain.');
    }

    console.log('✅ PreparationService: All preparations complete');
  }

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

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private static async checkIsActiveMember(address: Address): Promise<boolean> {
    try {
      return await this.publicClient.readContract({
        address: ROLE_MANAGER_ADDRESS,
        abi: ROLE_MANAGER_ABI,
        functionName: 'isActiveMember',
        args: [address],
      });
    } catch (error) {
      console.error('Error checking isActiveMember:', error);
      return false;
    }
  }

  private static async getRecordRoleStats(recordId: string): Promise<{
    ownerCount: bigint;
    adminCount: bigint;
    viewerCount: bigint;
  }> {
    try {
      const result = await this.publicClient.readContract({
        address: ROLE_MANAGER_ADDRESS,
        abi: ROLE_MANAGER_ABI,
        functionName: 'getRecordRoleStats',
        args: [recordId],
      });

      return {
        ownerCount: result[0],
        adminCount: result[1],
        viewerCount: result[2],
      };
    } catch (error) {
      console.error('Error getting record role stats:', error);
      return { ownerCount: 0n, adminCount: 0n, viewerCount: 0n };
    }
  }
}
