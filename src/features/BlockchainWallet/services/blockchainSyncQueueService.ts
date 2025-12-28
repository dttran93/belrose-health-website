// src/features/Blockchain/services/blockchainSyncQueueService.ts
/**
 * Service to capture when blockchain fails to update. Used for auditing and debugging.
 * Captures universal information, contract, function, user, error message. And adds
 * custom data based on context
 */

import { collection, addDoc, serverTimestamp, getFirestore } from 'firebase/firestore';

// The contract being written to
export type BlockchainContract = 'MemberRoleManager' | 'HealthRecordCore' | 'BelrosePaymaster';

// Base interface - always required
interface BaseSyncFailure {
  contract: BlockchainContract;
  action: string; // e.g., 'grantRole', 'anchorRecord', 'addMember'
  userId: string;
  userWalletAddress: string;
  error: string;
}

// Context payload varies by operation type
type SyncContext =
  | {
      type: 'permission';
      targetUserId: string;
      targetWalletAddress: string;
      role: string;
      recordId: string;
    }
  | { type: 'memberRegistry'; newStatus?: string }
  | { type: 'recordAnchor'; recordId: string; recordHash: string; subject: string };

export interface BlockchainSyncFailure extends BaseSyncFailure {
  context: SyncContext;
}

export class BlockchainSyncQueueService {
  /**
   * Log any blockchain write failure for retry
   */
  static async logFailure(failure: BlockchainSyncFailure): Promise<void> {
    try {
      const db = getFirestore();
      await addDoc(collection(db, 'blockchainSyncQueue'), {
        ...failure,
        status: 'pending',
        retryCount: 0,
        createdAt: serverTimestamp(),
        lastAttemptAt: serverTimestamp(),
      });
      console.log(`📝 Logged ${failure.contract}.${failure.action} failure for retry`);
    } catch (logError) {
      console.error('❌ Failed to log blockchain sync failure:', logError);
    }
  }
}
