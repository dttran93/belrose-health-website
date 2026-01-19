//src/features/Subject/services/subjectBlockchainService.ts

/**
 * This service owns all the blockchain interactions within the Subject feature.
 * Including: wallet lookup
 * Anchor/unachor calls
 * Sync queue logging
 * Error normalization
 */

import { BlockchainSyncQueueService } from '@/features/BlockchainWallet/services/blockchainSyncQueueService';
import { blockchainHealthRecordService } from '@/features/Credibility/services/blockchainHealthRecordService';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

export class SubjectBlockchainService {
  // =======================================================================
  // USER WALLET HELPERS
  // ============================================================================

  /**
   * Get user's wallet address from Firestore
   */
  static async getUserWalletAddress(userId: string): Promise<string | null> {
    const db = getFirestore();
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      return null;
    }

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

  // =======================================================================
  // ANCHORING FUNCTIONS
  // =======================================================================

  /**
   * Anchor a subject to a record on the blockchain
   * Logs to sync queue if blockchain call fails
   */
  static async anchorSubject(
    recordId: string,
    recordHash: string,
    userId: string
  ): Promise<boolean> {
    const walletAddress = await this.requireUserWalletAddress(userId);

    try {
      console.log('⛓️ Anchoring subject on blockchain...', { recordId, userId });

      await blockchainHealthRecordService.anchorRecord(recordId, recordHash);

      console.log('✅ Subject anchored on blockchain');
      return true;
    } catch (error) {
      await this.logAnchorFailure({
        action: 'anchorRecord',
        recordId,
        recordHash,
        userId,
        walletAddress,
        error,
      });

      return false;
    }
  }

  /**
   * Unanchor a subject from a record on the blockchain
   * Logs to sync queue if blockchain call fails
   */
  static async unanchorSubject(recordId: string, userId: string): Promise<boolean> {
    const walletAddress = await this.requireUserWalletAddress(userId);

    try {
      console.log('⛓️ Unanchoring subject on blockchain...', { recordId, userId });

      await blockchainHealthRecordService.unanchorRecord(recordId);

      console.log('✅ Subject unanchored on blockchain');
      return true;
    } catch (error) {
      await this.logUnanchorFailure({
        action: 'unanchorRecord',
        recordId,
        userId,
        walletAddress,
        error,
      });

      return false;
    }
  }

  // =======================================================================
  // ERROR LOGGING
  // =======================================================================

  private static async logAnchorFailure(params: {
    action: 'anchorRecord';
    recordId: string;
    recordHash: string;
    userId: string;
    walletAddress: string;
    error: unknown;
  }) {
    const { recordId, recordHash, userId, walletAddress, error } = params;

    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('⚠️ Blockchain anchor failed:', error);

    await BlockchainSyncQueueService.logFailure({
      contract: 'HealthRecordCore',
      action: 'anchorRecord',
      userId,
      userWalletAddress: walletAddress ?? 'unknown',
      error: errorMessage,
      context: {
        type: 'anchorRecord',
        recordId,
        recordHash,
        subjectId: userId,
      },
    });
  }

  private static async logUnanchorFailure(params: {
    action: 'unanchorRecord';
    recordId: string;
    userId: string;
    walletAddress: string;
    error: unknown;
  }) {
    const { recordId, userId, walletAddress, error } = params;

    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('⚠️ Blockchain unanchor failed:', error);

    await BlockchainSyncQueueService.logFailure({
      contract: 'HealthRecordCore',
      action: 'unanchorRecord',
      userId,
      userWalletAddress: walletAddress ?? 'unknown',
      error: errorMessage,
      context: {
        type: 'unanchorRecord',
        recordId,
        subjectId: userId,
      },
    });
  }
}
export default SubjectBlockchainService;
