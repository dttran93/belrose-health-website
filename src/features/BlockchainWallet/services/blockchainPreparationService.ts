// src/features/BlockchainWallet/services/blockchainPreparationService.ts

/**
 * BlockchainPreparationService
 *
 * Generic service for ensuring a user is ready to transact on the blockchain.
 * This handles the universal prerequisites needed before ANY blockchain write operation:
 *
 * 1. Smart Account computed (derived from user's EOA)
 * 2. Smart Account saved to Firestore (cached for quick lookup)
 * 3. Smart Account registered on MemberRoleManager (linked to user's identity on-chain)
 *
 * Feature-specific preparation services (PermissionPreparationService,
 * VerificationPreparationService, etc.) should call this service first,
 * then perform their own feature-specific checks.
 *
 */

import { createPublicClient, http, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { SmartAccountService } from './smartAccountService';

// ==================== SMART CONTRACT CONFIG ====================

const MEMBER_ROLE_MANAGER_ADDRESS = '0xC31477f563dC8f7529Ba6AE7E410ABdB84C27d7C' as const;

const MEMBER_ROLE_MANAGER_ABI = [
  {
    name: 'isActiveMember',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'wallets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [
      { name: 'userIdHash', type: 'bytes32' },
      { name: 'isWalletActive', type: 'bool' },
    ],
  },
] as const;

// ==================== TYPES ====================

export type BlockerType =
  | 'not_authenticated'
  | 'smart_account_not_computed'
  | 'smart_account_not_saved'
  | 'smart_account_not_registered';

export interface ReadinessBlocker {
  type: BlockerType;
  message: string;
  canAutoResolve: boolean;
}

export interface BlockchainReadinessStatus {
  /** Whether user is fully ready to transact on-chain */
  ready: boolean;

  /** Smart account address (null if not yet computed) */
  smartAccountAddress: string | null;

  /** Individual status checks */
  checks: {
    isComputed: boolean;
    isSavedToFirestore: boolean;
    isRegisteredOnChain: boolean;
  };

  /** List of issues preventing readiness (empty if ready) */
  blockers: ReadinessBlocker[];
}

export interface PreparationProgress {
  step: 'computing' | 'saving' | 'registering' | 'complete';
  message: string;
}

export type ProgressCallback = (progress: PreparationProgress) => void;

// ==================== SERVICE ====================

export class BlockchainPreparationService {
  private static publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  // ============================================================================
  // STATUS CHECK (Read-only)
  // ============================================================================

  /**
   * Get the current blockchain readiness status for the user.
   *
   * This is a read-only check that doesn't modify any state.
   * Use this for UI display (e.g., showing a "Setup Required" badge).
   *
   * @returns Current readiness status with detailed check results
   */
  static async getStatus(): Promise<BlockchainReadinessStatus> {
    const blockers: ReadinessBlocker[] = [];

    try {
      // Get smart account status from SmartAccountService
      const smartAccountStatus = await SmartAccountService.getStatus();

      const checks = {
        isComputed: smartAccountStatus.isComputedLocally,
        isSavedToFirestore: smartAccountStatus.isSavedToFirestore,
        isRegisteredOnChain: smartAccountStatus.isRegisteredOnChain,
      };

      // Build blockers list
      if (!checks.isComputed) {
        blockers.push({
          type: 'smart_account_not_computed',
          message: 'Smart account address needs to be computed from your wallet.',
          canAutoResolve: true,
        });
      }

      if (!checks.isSavedToFirestore) {
        blockers.push({
          type: 'smart_account_not_saved',
          message: 'Smart account address needs to be saved to your profile.',
          canAutoResolve: true,
        });
      }

      if (!checks.isRegisteredOnChain) {
        blockers.push({
          type: 'smart_account_not_registered',
          message: 'Smart account needs to be registered on the blockchain.',
          canAutoResolve: true,
        });
      }

      return {
        ready: blockers.length === 0,
        smartAccountAddress: smartAccountStatus.address || null,
        checks,
        blockers,
      };
    } catch (error) {
      console.error('❌ BlockchainPreparationService: Error getting status:', error);

      // If we can't even check status, user likely isn't authenticated
      return {
        ready: false,
        smartAccountAddress: null,
        checks: {
          isComputed: false,
          isSavedToFirestore: false,
          isRegisteredOnChain: false,
        },
        blockers: [
          {
            type: 'not_authenticated',
            message: 'Please sign in to continue.',
            canAutoResolve: false,
          },
        ],
      };
    }
  }

  // ============================================================================
  // ENSURE READY (Auto-fix)
  // ============================================================================

  /**
   * Ensure the user is ready to transact on the blockchain.
   *
   * This will automatically resolve any blockers that can be auto-resolved:
   * 1. Compute smart account address if needed
   * 2. Save to Firestore if needed
   * 3. Register on-chain if needed
   *
   * @param onProgress - Optional callback for progress updates (useful for UI)
   * @returns The user's smart account address
   * @throws Error if preparation fails or user isn't authenticated
   */
  static async ensureReady(onProgress?: ProgressCallback): Promise<string> {
    console.log('🔄 BlockchainPreparationService: Ensuring blockchain readiness...');

    try {
      // Report progress: computing
      onProgress?.({
        step: 'computing',
        message: 'Computing smart account address...',
      });

      // SmartAccountService.ensureFullyInitialized() handles all three steps:
      // 1. Compute address
      // 2. Save to Firestore
      // 3. Register on-chain
      //
      // It's idempotent - if any step is already done, it skips it.
      // We wrap it here to provide progress updates.

      const cachedAddress = await SmartAccountService.getCachedAddress();

      if (!cachedAddress) {
        // Need to compute and save
        onProgress?.({
          step: 'saving',
          message: 'Saving smart account to your profile...',
        });
      }

      // Check if registration is needed
      const status = await SmartAccountService.getStatus();
      if (!status.isRegisteredOnChain) {
        onProgress?.({
          step: 'registering',
          message: 'Registering smart account on blockchain...',
        });
      }

      // This does all the work
      const address = await SmartAccountService.ensureFullyInitialized();

      onProgress?.({
        step: 'complete',
        message: 'Blockchain setup complete!',
      });

      console.log('✅ BlockchainPreparationService: Ready with address:', address);
      return address;
    } catch (error) {
      console.error('❌ BlockchainPreparationService: Preparation failed:', error);
      throw new Error(`Failed to prepare for blockchain transaction: ${(error as Error).message}`);
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if a specific wallet address is an active member on-chain.
   *
   * This is useful for checking if a target user (not the current user)
   * is ready to receive roles or be referenced in blockchain operations.
   *
   * @param walletAddress - The wallet address to check
   * @returns Whether the wallet is registered and active
   */
  static async isActiveMember(walletAddress: string): Promise<boolean> {
    try {
      return await this.publicClient.readContract({
        address: MEMBER_ROLE_MANAGER_ADDRESS,
        abi: MEMBER_ROLE_MANAGER_ABI,
        functionName: 'isActiveMember',
        args: [walletAddress as Address],
      });
    } catch (error) {
      console.error('❌ BlockchainPreparationService: Error checking isActiveMember:', error);
      return false;
    }
  }

  /**
   * Get the userIdHash linked to a wallet address.
   *
   * Returns null if the wallet isn't registered.
   *
   * @param walletAddress - The wallet address to look up
   * @returns The userIdHash (bytes32) or null if not registered
   */
  static async getUserIdHashForWallet(walletAddress: string): Promise<string | null> {
    try {
      const result = await this.publicClient.readContract({
        address: MEMBER_ROLE_MANAGER_ADDRESS,
        abi: MEMBER_ROLE_MANAGER_ABI,
        functionName: 'wallets',
        args: [walletAddress as Address],
      });

      const [userIdHash, isActive] = result;

      // Check if it's the zero hash (not registered)
      const zeroHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
      if (userIdHash === zeroHash) {
        return null;
      }

      return userIdHash;
    } catch (error) {
      console.error('❌ BlockchainPreparationService: Error getting userIdHash:', error);
      return null;
    }
  }

  /**
   * Quick check: Is the current user ready to transact?
   *
   * This is a convenience method for simple boolean checks.
   * Use getStatus() if you need detailed information.
   *
   * @returns true if user can transact on-chain, false otherwise
   */
  static async isReady(): Promise<boolean> {
    const status = await this.getStatus();
    return status.ready;
  }
}
