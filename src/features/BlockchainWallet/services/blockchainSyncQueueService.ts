// src/features/Blockchain/services/blockchainSyncQueueService.ts
/**
 * Service to capture when blockchain fails to update. Used for auditing and debugging.
 * Captures universal information, contract, function, user, error message. And adds
 * custom data based on context
 */

import {
  DisputeCulpability,
  DisputeSeverityOptions,
  VerificationLevelOptions,
  TimestampLike,
} from '@belrose/shared';
import { collection, addDoc, serverTimestamp, getFirestore } from 'firebase/firestore';

// The contract being written to
export type BlockchainContract = 'MemberRoleManager' | 'HealthRecordCore' | 'BelrosePaymaster';

// Base interface - always required
interface BaseSyncFailure {
  contract: BlockchainContract;
  action: string; // e.g., 'grantRole', 'anchorRecord', 'addMember'
  userId: string;
  userWalletAddress?: string;
  error: string;
}

// Context payload varies by operation type
export type SyncContext =
  | {
      type: 'permission';
      targetUserId: string;
      targetWalletAddress: string;
      role: string | string[];
      recordId: string | string[];
      recordIdHash: string | string[];
    }
  | { type: 'memberRegistry'; newStatus?: string }
  | { type: 'anchorRecord'; recordId: string; recordHash: string; subjectId: string }
  | { type: 'unanchorRecord'; recordId: string; subjectId: string }
  | { type: 'reanchorRecord'; recordId: string; recordHash: string; subjectId: string }
  | { type: 'addRecordHash'; recordId: string; recordHash: string }
  | { type: 'verification'; recordId: string; recordHash: string; level: VerificationLevelOptions }
  | { type: 'verification-retraction'; recordId: string; recordHash: string }
  | {
      type: 'verification-modification';
      recordId: string;
      recordHash: string;
      oldLevel: VerificationLevelOptions;
      newLevel: VerificationLevelOptions;
    }
  | {
      type: 'dispute';
      recordId: string;
      recordHash: string;
      severity: DisputeSeverityOptions;
      culpability: DisputeCulpability;
    }
  | { type: 'dispute-retraction'; recordId: string; recordHash: string }
  | {
      type: 'dispute-modification';
      recordId: string;
      recordHash: string;
      oldSeverity: DisputeSeverityOptions;
      oldCulpability: DisputeCulpability;
      newSeverity: DisputeSeverityOptions;
      newCulpability: DisputeCulpability;
    }
  | { type: 'flagUnacceptedUpdate'; recordId: string; recordHash: string; disputeId: string }
  | { type: 'resolveUnacceptedUpdate'; recordId: string; recordHash: string; disputeId: string }
  | {
      type: 'trustee-propose';
      trustorId: string;
      trustorIdHash: string;
      trusteeId: string;
      trusteeIdHash: string;
    }
  | {
      type: 'trustee-accept';
      trustorId: string;
      trustorIdHash: string;
      trusteeId: string;
      trusteeIdHash: string;
    }
  | {
      type: 'trustee-revoke';
      trustorId: string;
      trustorIdHash: string;
      trusteeId: string;
      trusteeIdHash: string;
    }
  | {
      type: 'trustee-decline';
      trustorId: string;
      trustorIdHash: string;
      trusteeId: string;
      trusteeIdHash: string;
    }
  | {
      type: 'trustee-level-update';
      trustorId: string;
      trustorIdHash: string;
      trusteeId: string;
      trusteeIdHash: string;
    };

export interface BlockchainSyncFailure extends BaseSyncFailure {
  context: SyncContext;
}

// Shape of a BlockchainSyncFailure document as read from Firestore —
// extends the write type with the fields added at write time.
export type SyncQueueRecord = BlockchainSyncFailure & {
  id: string;
  status?: string;
  retryCount?: number;
  createdAt?: TimestampLike;
  lastAttemptAt?: TimestampLike;
};

// Decodes a standard Error(string) ABI revert: selector 0x08c379a0 + ABI-encoded string.
// Returns the human-readable reason, or null if the error doesn't contain one.
export function decodeRevertReason(error: string): string | null {
  const data = error.match(/0x08c379a0([0-9a-f]+)/i)?.[1];
  if (!data || data.length < 128) return null;
  try {
    const length = parseInt(data.slice(64, 128), 16);
    if (length === 0 || length > 1024) return null;
    const stringHex = data.slice(128, 128 + length * 2);
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = parseInt(stringHex.slice(i * 2, i * 2 + 2), 16);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
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
