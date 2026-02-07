// src/features/Permissions/services/permissionPreparationService.ts

/**
 * PermissionPreparationService
 *
 * Handles preparation and prerequisite verification for permission operations.
 * This service builds on top of BlockchainPreparationService to add
 * permission-specific checks.
 *
 * Prerequisites for permission operations:
 * 1. [Generic] Caller's SmartAccount registered and active on-chain
 * 2. [Permission-specific] Target's wallet registered and linked to active identity
 * 3. [Permission-specific] Record initialized on-chain (has at least one owner or admin)
 *
 * Usage:
 *   // Before granting a role to someone
 *   const prereqs = await PermissionPreparationService.verifyPrerequisites(recordId, targetWallet);
 *   if (!prereqs.ready) { ... show error: prereqs.reason ... }
 *
 *   // First-time setup for a record
 *   await PermissionPreparationService.prepare(recordId, 'owner');
 */

import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  BlockchainPreparationService,
  type ProgressCallback,
} from '@/features/BlockchainWallet/services/blockchainPreparationService';

// ==================== SMART CONTRACT CONFIG ====================

const ROLE_MANAGER_ADDRESS = '0xC31477f563dC8f7529Ba6AE7E410ABdB84C27d7C' as const;

const ROLE_MANAGER_ABI = [
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

export interface PermissionPrerequisites {
  /** Whether all prerequisites are met */
  ready: boolean;

  /** Human-readable reason if not ready */
  reason?: string;

  /** Caller's smart account address (if available) */
  callerSmartAccountAddress?: string;

  /** Detailed check results */
  checks?: {
    callerReady: boolean;
    targetReady: boolean;
    recordInitialized: boolean;
  };
}

export interface PermissionPreparationStatus {
  /** Whether everything is ready for permission operations */
  isReady: boolean;

  /** Caller's smart account address */
  smartAccountAddress: string;

  /** Whether caller's smart account is registered on-chain */
  isSmartAccountRegistered: boolean;

  /** Whether record has been initialized on-chain */
  isRecordInitialized: boolean;

  /** Current role counts for the record */
  roleStats: {
    ownerCount: number;
    adminCount: number;
    viewerCount: number;
  };
}

export type InitialRole = 'administrator' | 'owner';

export interface InitializeRecordResult {
  success: boolean;
  txHash: string;
  blockNumber: number;
  role: InitialRole;
}

export interface PermissionPreparationProgress {
  step: 'computing' | 'saving' | 'registering' | 'initializing_record' | 'complete';
  message: string;
}

export type PermissionProgressCallback = (progress: PermissionPreparationProgress) => void;

// ==================== SERVICE ====================

export class PermissionPreparationService {
  private static publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  // ============================================================================
  // VERIFICATION METHODS (Read-only checks before operations)
  // ============================================================================

  /**
   * Verify all prerequisites are met before a permission operation.
   *
   * Use this before granting/revoking roles to fail fast with a clear message.
   *
   * Checks:
   * 1. Caller's SmartAccount is registered and active
   * 2. Target's wallet is registered and active (for role assignment)
   * 3. Record is initialized on-chain
   *
   * @param recordId - The record being modified
   * @param targetWallet - The target user's wallet address
   */
  static async verifyPrerequisites(
    recordId: string,
    targetWallet: string
  ): Promise<PermissionPrerequisites> {
    try {
      // Step 1: Check caller readiness using generic service
      const callerStatus = await BlockchainPreparationService.getStatus();

      if (!callerStatus.ready) {
        return {
          ready: false,
          reason:
            'Your blockchain wallet is not fully set up. Please complete the preparation step.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: false,
            targetReady: false,
            recordInitialized: false,
          },
        };
      }

      // Step 2: Check target wallet and record in parallel
      const [isTargetActive, roleStats] = await Promise.all([
        BlockchainPreparationService.isActiveMember(targetWallet),
        this.getRecordRoleStats(recordId),
      ]);

      // Step 3: Validate target
      if (!isTargetActive) {
        return {
          ready: false,
          reason:
            'The target user has not completed their blockchain setup. They must set up their wallet before receiving permissions.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: true,
            targetReady: false,
            recordInitialized: roleStats.ownerCount > 0 || roleStats.adminCount > 0,
          },
        };
      }

      // Step 4: Validate record initialization
      const isRecordInitialized = roleStats.ownerCount > 0 || roleStats.adminCount > 0;
      if (!isRecordInitialized) {
        return {
          ready: false,
          reason:
            'This record has not been initialized on the blockchain. Please run preparation first.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: true,
            targetReady: true,
            recordInitialized: false,
          },
        };
      }

      // All checks passed
      return {
        ready: true,
        callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
        checks: {
          callerReady: true,
          targetReady: true,
          recordInitialized: true,
        },
      };
    } catch (error) {
      console.error('❌ PermissionPreparationService: Error verifying prerequisites:', error);
      return {
        ready: false,
        reason: `Failed to verify blockchain prerequisites: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Simplified verification for self-only operations.
   *
   * Use this for operations where the caller is the only participant
   * (e.g., voluntarilyLeaveOwnership, revoking own role).
   *
   * @param recordId - The record being modified
   */
  static async verifyCallerPrerequisites(recordId: string): Promise<PermissionPrerequisites> {
    try {
      // Check caller readiness
      const callerStatus = await BlockchainPreparationService.getStatus();

      if (!callerStatus.ready) {
        return {
          ready: false,
          reason: 'Your blockchain wallet is not fully set up.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
        };
      }

      // Check record initialization
      const roleStats = await this.getRecordRoleStats(recordId);
      const isRecordInitialized = roleStats.ownerCount > 0 || roleStats.adminCount > 0;

      if (!isRecordInitialized) {
        return {
          ready: false,
          reason: 'This record has not been initialized on the blockchain.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
        };
      }

      return {
        ready: true,
        callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
      };
    } catch (error) {
      console.error(
        '❌ PermissionPreparationService: Error verifying caller prerequisites:',
        error
      );
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
   * Get detailed preparation status for current user and a record.
   *
   * @param recordId - The record to check
   */
  static async getStatus(recordId: string): Promise<PermissionPreparationStatus> {
    // Get generic blockchain status
    const blockchainStatus = await BlockchainPreparationService.getStatus();

    // Get record-specific status
    const roleStats = await this.getRecordRoleStats(recordId);
    const isRecordInitialized = roleStats.ownerCount > 0 || roleStats.adminCount > 0;

    return {
      smartAccountAddress: blockchainStatus.smartAccountAddress || '',
      isSmartAccountRegistered: blockchainStatus.checks.isRegisteredOnChain,
      isRecordInitialized,
      isReady: blockchainStatus.ready && isRecordInitialized,
      roleStats: {
        ownerCount: Number(roleStats.ownerCount),
        adminCount: Number(roleStats.adminCount),
        viewerCount: Number(roleStats.viewerCount),
      },
    };
  }

  /**
   * Prepare blockchain state for permission operations.
   *
   * This handles:
   * 1. Smart account setup (via BlockchainPreparationService)
   * 2. Record initialization (permission-specific)
   *
   * @param recordId - The record to prepare
   * @param initialRole - The role to assign to the caller ('owner' or 'administrator')
   * @param onProgress - Optional callback for progress updates
   */
  static async prepare(
    recordId: string,
    initialRole: InitialRole,
    onProgress?: PermissionProgressCallback
  ): Promise<void> {
    console.log('🔄 PermissionPreparationService: Starting preparation...');

    // Step 1: Ensure smart account is ready (generic preparation)
    const smartAccountAddress = await BlockchainPreparationService.ensureReady(progress => {
      // Forward progress updates
      onProgress?.(progress as PermissionPreparationProgress);
    });

    console.log('✅ PermissionPreparationService: Smart account ready:', smartAccountAddress);

    // Step 2: Check if record needs initialization
    const roleStats = await this.getRecordRoleStats(recordId);
    const isRecordInitialized = roleStats.ownerCount > 0 || roleStats.adminCount > 0;

    if (!isRecordInitialized) {
      onProgress?.({
        step: 'initializing_record',
        message: 'Initializing record on blockchain...',
      });

      console.log('🚀 PermissionPreparationService: Initializing record...');
      await this.initializeRecordRole(recordId, smartAccountAddress, initialRole);
      console.log('✅ PermissionPreparationService: Record initialized');
    } else {
      console.log('ℹ️ PermissionPreparationService: Record already initialized');
    }

    onProgress?.({
      step: 'complete',
      message: 'Preparation complete!',
    });

    // Step 3: Verify everything is ready
    const finalStatus = await this.getStatus(recordId);
    if (!finalStatus.isReady) {
      throw new Error('Preparation completed but verification failed. Please try again.');
    }

    console.log('✅ PermissionPreparationService: All preparations complete');
  }

  /**
   * Initialize a record's first role on the blockchain.
   *
   * This sets up the role hierarchy for a record by assigning the first
   * administrator or owner. After this, that user can grant additional
   * roles using the permission service.
   *
   * @param recordId - The Firestore document ID of the record
   * @param walletAddress - Wallet address of the first admin/owner
   * @param role - The initial role: 'administrator' or 'owner'
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
      // Handle "already exists" gracefully - not really an error
      if (
        error.code === 'already-exists' ||
        error.code === 'functions/already-exists' ||
        error.message?.includes('already initialized') ||
        error.message?.includes('Conflict')
      ) {
        console.log('ℹ️ Record already initialized on blockchain');
        return {
          success: true,
          txHash: '',
          blockNumber: 0,
          role: role,
        };
      }

      console.error('❌ Record initialization failed:', error);
      throw new Error(error.message || 'Failed to initialize record on blockchain');
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Get role statistics for a record from the blockchain.
   */
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
      console.error('❌ PermissionPreparationService: Error getting record role stats:', error);
      return { ownerCount: 0n, adminCount: 0n, viewerCount: 0n };
    }
  }
}
