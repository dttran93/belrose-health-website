// src/features/Trustee/services/trusteeBlockchainService.ts

import { ethers, id } from 'ethers';
import {
  BlockchainRoleManagerService,
  RoleType,
  TrusteeLevel,
} from '@/features/Permissions/services/blockchainRoleManagerService';
import {
  BlockchainSyncQueueService,
  SyncContext,
} from '@/features/BlockchainWallet/services/blockchainSyncQueueService';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import { BlockchainRef, buildMemberRegistryRef } from '@belrose/shared';

interface TrusteeResult {
  success: boolean;
  blockchainRef: BlockchainRef | null;
}

type TrusteeAction =
  | 'proposeTrustee'
  | 'acceptTrustee'
  | 'revokeTrustee'
  | 'grantRoleAsTrusteeBatch'
  | 'updateTrusteeLevel';

export class TrusteeBlockchainService {
  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  static async getUserWalletAddress(userId: string): Promise<string | null> {
    const db = getFirestore();
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;
    const userData = userDoc.data();
    return userData.wallet?.address || null;
  }

  static async requireUserWalletAddress(userId: string): Promise<string> {
    const walletAddress = await this.getUserWalletAddress(userId);
    if (!walletAddress) {
      throw new Error('You must have a linked wallet to perform blockchain actions');
    }
    return walletAddress;
  }

  // ==========================================================================
  // TRUSTEE FUNCTIONS
  // ==========================================================================

  /**
   * Trustor proposes a trustee relationship on-chain (Step 1)
   * msg.sender = trustor's wallet via PaymasterService
   */
  static async proposeTrustee(
    trustorId: string,
    trusteeId: string,
    level: TrusteeLevel
  ): Promise<TrusteeResult> {
    const walletAddress = await this.requireUserWalletAddress(trustorId);

    try {
      console.log('⛓️ Proposing trustee on blockchain...', { trustorId, trusteeId, level });

      const result = await BlockchainRoleManagerService.proposeTrustee(trusteeId, level);
      const blockchainRef = buildMemberRegistryRef(result.txHash, result.blockNumber);
      console.log('✅ Trustee proposed on blockchain');
      return { success: true, blockchainRef };
    } catch (error) {
      await this.logTrusteeFailure({
        action: 'proposeTrustee',
        trustorId, //blockchain ID hashes calculated in function. Fewer arguments needed
        trusteeId,
        callerId: trustorId,
        walletAddress,
        error,
      });
      return { success: false, blockchainRef: null };
    }
  }

  /**
   * Trustee accepts a pending proposal on-chain (Step 2)
   * msg.sender = trustee's wallet via PaymasterService
   */
  static async acceptTrustee(trustorId: string, trusteeId: string): Promise<TrusteeResult> {
    const walletAddress = await this.requireUserWalletAddress(trusteeId);

    try {
      console.log('⛓️ Accepting trustee proposal on blockchain...', { trustorId, trusteeId });
      const result = await BlockchainRoleManagerService.acceptTrustee(trustorId);
      const blockchainRef = buildMemberRegistryRef(result.txHash, result.blockNumber);
      console.log('✅ Trustee accepted on blockchain');
      return { success: true, blockchainRef };
    } catch (error) {
      await this.logTrusteeFailure({
        action: 'acceptTrustee',
        trustorId,
        trusteeId,
        callerId: trusteeId,
        walletAddress,
        error,
      });
      return { success: false, blockchainRef: null };
    }
  }

  /**
   * Revoke a trustee relationship on-chain
   * Callable by either party — callerId determines whose wallet signs
   */
  static async revokeTrustee(
    trustorId: string,
    trusteeId: string,
    callerId: string
  ): Promise<TrusteeResult> {
    const walletAddress = await this.requireUserWalletAddress(callerId);

    try {
      console.log('⛓️ Revoking trustee on blockchain...', { trustorId, trusteeId });
      const result = await BlockchainRoleManagerService.revokeTrustee(trustorId, trusteeId);
      const blockchainRef = buildMemberRegistryRef(result.txHash, result.blockNumber);
      console.log('✅ Trustee revoked on blockchain');
      return { success: true, blockchainRef };
    } catch (error) {
      await this.logTrusteeFailure({
        action: 'revokeTrustee',
        trustorId,
        trusteeId,
        callerId,
        walletAddress,
        error,
      });
      return { success: false, blockchainRef: null };
    }
  }

  /**
   * Trustee grants themselves access to the trustor's records in one transaction.
   * Called after acceptTrustee — trustee fans out access to all trustor's records.
   * The contract resolves the correct role per record based on trust level.
   */
  static async grantRoleAsTrusteeBatch(
    trustorId: string,
    trusteeId: string,
    recordIds: string[],
    roles: string[]
  ): Promise<TrusteeResult> {
    let trusteeWallet: string | undefined;

    try {
      // Need trustee's wallet address for grantRoleBatch
      const trusteeProfile = await getUserProfile(trusteeId);
      trusteeWallet = trusteeProfile?.onChainIdentity?.linkedWallets.find(
        w => w.isWalletActive
      )?.address;

      if (!trusteeWallet) throw new Error('Trustee has no active wallet');

      const result = await BlockchainRoleManagerService.grantRoleBatch(
        recordIds,
        trusteeWallet,
        roles as RoleType[]
      );
      const blockchainRef = buildMemberRegistryRef(result.txHash, result.blockNumber);
      return { success: true, blockchainRef };
    } catch (error) {
      await this.logTrusteeFailure({
        action: 'grantRoleAsTrusteeBatch',
        trustorId,
        trusteeId,
        callerId: trusteeId,
        walletAddress: trusteeWallet ?? '',
        error,
        recordIds,
      });
      return { success: false, blockchainRef: null };
    }
  }

  static async updateTrusteeLevel(
    trustorId: string,
    trusteeId: string,
    newLevel: TrusteeLevel
  ): Promise<TrusteeResult> {
    const walletAddress = await this.requireUserWalletAddress(trustorId);

    try {
      console.log('⛓️ Updating trustee level on blockchain...', { trustorId, trusteeId, newLevel });
      const result = await BlockchainRoleManagerService.updateTrusteeLevel(trusteeId, newLevel);
      const blockchainRef = buildMemberRegistryRef(result.txHash, result.blockNumber);
      console.log('✅ Trustee level updated on blockchain');
      return { success: true, blockchainRef };
    } catch (error) {
      await this.logTrusteeFailure({
        action: 'updateTrusteeLevel',
        trustorId,
        trusteeId,
        callerId: trustorId,
        walletAddress,
        error,
      });
      return { success: false, blockchainRef: null };
    }
  }

  // ==========================================================================
  // ERROR LOGGING
  // ==========================================================================

  private static async logTrusteeFailure(params: {
    action: TrusteeAction;
    trustorId: string;
    trusteeId: string;
    callerId: string;
    walletAddress: string;
    error: unknown;
    recordIds?: string[];
  }) {
    const { action, trustorId, trusteeId, callerId, walletAddress, error, recordIds } = params;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`⚠️ Blockchain ${action} failed:`, error);

    const contextTypeMap = {
      proposeTrustee: 'trustee-propose',
      acceptTrustee: 'trustee-accept',
      revokeTrustee: 'trustee-revoke',
      grantRoleAsTrusteeBatch: 'trustee-grant',
      updateTrusteeLevel: 'trustee-level-update',
    } as const;

    const context: SyncContext =
      action === 'grantRoleAsTrusteeBatch'
        ? {
            type: 'trustee-grant',
            trustorId,
            trustorIdHash: id(trustorId),
            trusteeId,
            trusteeIdHash: id(trusteeId),
            recordIds: recordIds ?? [],
          }
        : {
            type: contextTypeMap[action],
            trustorId,
            trustorIdHash: id(trustorId),
            trusteeId,
            trusteeIdHash: id(trusteeId),
          };

    await BlockchainSyncQueueService.logFailure({
      contract: 'MemberRoleManager',
      action,
      userId: callerId,
      userWalletAddress: walletAddress,
      error: errorMessage,
      context,
    });
  }
}
