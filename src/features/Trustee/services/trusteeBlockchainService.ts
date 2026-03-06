// src/features/Trustee/services/trusteeBlockchainService.ts

import { ethers } from 'ethers';
import { BlockchainRoleManagerService } from '@/features/Permissions/services/blockchainRoleManagerService';
import { BlockchainSyncQueueService } from '@/features/BlockchainWallet/services/blockchainSyncQueueService';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { Result } from 'postcss';

interface ControllerResult {
  success: boolean;
  txHash: string | null;
}

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
  // CONTROLLER FUNCTIONS
  // ==========================================================================

  /**
   * Trustor proposes a controller relationship on-chain (Step 1)
   * msg.sender = trustor's wallet via PaymasterService
   */
  static async proposeController(trustorId: string, trusteeId: string): Promise<ControllerResult> {
    const walletAddress = await this.requireUserWalletAddress(trustorId);

    try {
      console.log('⛓️ Proposing controller on blockchain...', { trustorId, trusteeId });
      const controllerIdHash = ethers.id(trusteeId);
      const result = await BlockchainRoleManagerService.proposeController(controllerIdHash);
      console.log('✅ Controller proposed on blockchain');
      return { success: true, txHash: result.txHash };
    } catch (error) {
      await this.logControllerFailure({
        action: 'proposeController',
        trustorId,
        trusteeId,
        callerId: trustorId,
        walletAddress,
        error,
      });
      return { success: false, txHash: null };
    }
  }

  /**
   * Trustee accepts a pending controller proposal on-chain (Step 2)
   * msg.sender = trustee's wallet via PaymasterService
   */
  static async acceptController(trustorId: string, trusteeId: string): Promise<ControllerResult> {
    const walletAddress = await this.requireUserWalletAddress(trusteeId);

    try {
      console.log('⛓️ Accepting controller on blockchain...', { trustorId, trusteeId });
      const trustorIdHash = ethers.id(trustorId);
      const result = await BlockchainRoleManagerService.acceptController(trustorIdHash);
      console.log('✅ Controller accepted on blockchain');
      return { success: true, txHash: result.txHash };
    } catch (error) {
      await this.logControllerFailure({
        action: 'acceptController',
        trustorId,
        trusteeId,
        callerId: trusteeId,
        walletAddress,
        error,
      });
      return { success: false, txHash: null };
    }
  }

  /**
   * Revoke a controller relationship on-chain
   * Callable by either party — callerId determines whose wallet signs
   */
  static async revokeController(
    trustorId: string,
    trusteeId: string,
    callerId: string
  ): Promise<ControllerResult> {
    const walletAddress = await this.requireUserWalletAddress(callerId);

    try {
      console.log('⛓️ Revoking controller on blockchain...', { trustorId, trusteeId });
      const trustorIdHash = ethers.id(trustorId);
      const controllerIdHash = ethers.id(trusteeId);
      const result = await BlockchainRoleManagerService.revokeController(
        trustorIdHash,
        controllerIdHash
      );
      console.log('✅ Controller revoked on blockchain');
      return { success: true, txHash: result.txHash };
    } catch (error) {
      await this.logControllerFailure({
        action: 'revokeController',
        trustorId,
        trusteeId,
        callerId,
        walletAddress,
        error,
      });
      return { success: false, txHash: null };
    }
  }

  // ==========================================================================
  // ERROR LOGGING
  // ==========================================================================

  private static async logControllerFailure(params: {
    action: 'proposeController' | 'acceptController' | 'revokeController';
    trustorId: string;
    trusteeId: string;
    callerId: string;
    walletAddress: string;
    error: unknown;
  }) {
    const { action, trustorId, trusteeId, callerId, walletAddress, error } = params;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`⚠️ Blockchain ${action} failed:`, error);

    const contextTypeMap = {
      proposeController: 'controller-propose',
      acceptController: 'controller-accept',
      revokeController: 'controller-revoke',
    } as const;

    await BlockchainSyncQueueService.logFailure({
      contract: 'MemberRoleManager',
      action,
      userId: callerId,
      userWalletAddress: walletAddress,
      error: errorMessage,
      context: {
        type: contextTypeMap[action],
        trustorId,
        trusteeId,
      },
    });
  }
}
