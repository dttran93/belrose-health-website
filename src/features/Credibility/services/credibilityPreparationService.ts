// src/features/Credibility/services/credibilityPreparationService.ts

/**
 * CredibilityPreparationService
 *
 * Handles preparation and prerequisite verification for credibility operations
 * (verify, dispute, react to disputes).
 *
 * This service builds on top of BlockchainPreparationService to add
 * credibility-specific checks.
 *
 * Prerequisites for credibility operations:
 * 1. [Generic] Caller's SmartAccount registered and active on-chain
 * 2. [Credibility-specific] Caller has an active role on the record
 *
 * Note: Unlike permissions, credibility operations do NOT require:
 * - The record to be anchored on-chain (providers can verify unanchored records)
 * - A target user to be registered (verification is about the record, not a person)
 *
 * Post-verification side effects (handled separately):
 * - If record has subjects who haven't anchored, notify them
 *
 */

import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import {
  BlockchainPreparationService,
  type ProgressCallback,
} from '@/features/BlockchainWallet/services/blockchainPreparationService';

// ==================== TYPES ====================

export type CredibilityOperationType =
  | 'verify'
  | 'dispute'
  | 'retractVerification'
  | 'retractDispute'
  | 'modifyVerification'
  | 'modifyDispute'
  | 'reactToDispute';

export interface CredibilityPrerequisites {
  ready: boolean;
  reason?: string;
  callerSmartAccountAddress?: string;
  checks?: {
    callerReady: boolean;
    hasRecordRole: boolean;
  };
  recordInfo?: {
    hasSubjects: boolean;
    subjectCount: number;
    isAnchored: boolean;
  };
}

export interface CredibilityPreparationStatus {
  isReady: boolean;
  smartAccountAddress: string;
  isSmartAccountRegistered: boolean;
  hasRecordRole: boolean;
  callerRole?: 'owner' | 'administrator' | 'viewer' | 'subject';
}

export interface CredibilityPreparationProgress {
  step: 'computing' | 'saving' | 'registering' | 'complete';
  message: string;
}

export type CredibilityProgressCallback = (progress: CredibilityPreparationProgress) => void;

// ==================== SERVICE ====================

export class CredibilityPreparationService {
  // ============================================================================
  // VERIFICATION METHODS (Read-only checks before operations)
  // ============================================================================

  /**
   * Verify all prerequisites are met before a credibility operation.
   *
   * Use this before verify/dispute/react operations to fail fast.
   *
   * Checks:
   * 1. Caller's SmartAccount is registered and active
   * 2. Caller has an active role on the record (any role counts)
   *
   * @param recordId - The record being verified/disputed
   */
  static async verifyPrerequisites(recordId: string): Promise<CredibilityPrerequisites> {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      return {
        ready: false,
        reason: 'Please sign in to continue.',
        checks: {
          callerReady: false,
          hasRecordRole: false,
        },
      };
    }

    try {
      // Step 1: Check caller's blockchain readiness
      const callerStatus = await BlockchainPreparationService.getStatus();

      if (!callerStatus.ready) {
        return {
          ready: false,
          reason:
            'Your blockchain wallet needs to be set up before you can verify records. This is a one-time setup.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: false,
            hasRecordRole: false,
          },
        };
      }

      // Step 2: Check if caller has a role on the record
      const roleCheck = await this.checkCallerRecordRole(recordId, user.uid);

      if (!roleCheck.hasRole) {
        return {
          ready: false,
          reason:
            'You do not have access to this record. Only participants (owners, administrators, viewers, or subjects) can verify records.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: true,
            hasRecordRole: false,
          },
          recordInfo: roleCheck.recordInfo,
        };
      }

      // All checks passed
      return {
        ready: true,
        callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
        checks: {
          callerReady: true,
          hasRecordRole: true,
        },
        recordInfo: roleCheck.recordInfo,
      };
    } catch (error) {
      console.error('❌ CredibilityPreparationService: Error verifying prerequisites:', error);
      return {
        ready: false,
        reason: `Failed to verify prerequisites: ${(error as Error).message}`,
      };
    }
  }

  // ============================================================================
  // STATUS & PREPARATION METHODS
  // ============================================================================

  /**
   * Get detailed preparation status for credibility operations.
   *
   * @param recordId - The record to check
   */
  static async getStatus(recordId: string): Promise<CredibilityPreparationStatus> {
    const auth = getAuth();
    const user = auth.currentUser;

    // Get blockchain readiness
    const blockchainStatus = await BlockchainPreparationService.getStatus();

    // Get role info
    let hasRecordRole = false;
    let callerRole: CredibilityPreparationStatus['callerRole'];

    if (user) {
      const roleCheck = await this.checkCallerRecordRole(recordId, user.uid);
      hasRecordRole = roleCheck.hasRole;
      callerRole = roleCheck.role;
    }

    return {
      smartAccountAddress: blockchainStatus.smartAccountAddress || '',
      isSmartAccountRegistered: blockchainStatus.checks.isRegisteredOnChain,
      hasRecordRole,
      callerRole,
      isReady: blockchainStatus.ready && hasRecordRole,
    };
  }

  /**
   * Prepare for credibility operations.
   *
   * This ensures the caller's smart account is set up and registered.
   * Unlike PermissionPreparationService, this does NOT initialize the record
   * on-chain (that's handled by anchoring).
   *
   * @param onProgress - Optional callback for progress updates
   * @returns The caller's smart account address
   */
  static async prepare(onProgress?: CredibilityProgressCallback): Promise<string> {
    console.log('🔄 CredibilityPreparationService: Starting preparation...');

    // Just delegate to the generic blockchain preparation
    // Credibility operations don't need any additional setup beyond wallet readiness
    const address = await BlockchainPreparationService.ensureReady(progress => {
      onProgress?.(progress as CredibilityPreparationProgress);
    });

    console.log('✅ CredibilityPreparationService: Ready with address:', address);
    return address;
  }

  // ============================================================================
  // RECORD INFO HELPERS
  // ============================================================================

  /**
   * Get information about a record's subjects and anchoring status.
   *
   * Useful for determining if post-verification notifications are needed.
   *
   * @param recordId - The record to check
   */
  static async getRecordSubjectInfo(recordId: string): Promise<{
    subjects: string[];
    hasSubjects: boolean;
    // Note: isAnchored would require a blockchain call to check
    // For now, we just return subject info from Firestore
  }> {
    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);
    const recordSnap = await getDoc(recordRef);

    if (!recordSnap.exists()) {
      return {
        subjects: [],
        hasSubjects: false,
      };
    }

    const data = recordSnap.data();
    const subjects: string[] = data.subjects || [];

    return {
      subjects,
      hasSubjects: subjects.length > 0,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Check if a user has any role on a record.
   *
   * Roles checked: owner, administrator, viewer, subject
   */
  private static async checkCallerRecordRole(
    recordId: string,
    userId: string
  ): Promise<{
    hasRole: boolean;
    role?: 'owner' | 'administrator' | 'viewer' | 'subject';
    recordInfo?: {
      hasSubjects: boolean;
      subjectCount: number;
      isAnchored: boolean;
    };
  }> {
    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);
    const recordSnap = await getDoc(recordRef);

    if (!recordSnap.exists()) {
      return { hasRole: false };
    }

    const data = recordSnap.data();

    // Check each role type
    const owners: string[] = data.owners || [];
    const administrators: string[] = data.administrators || [];
    const viewers: string[] = data.viewers || [];
    const subjects: string[] = data.subjects || [];

    // Also check uploadedBy as implicit owner
    const isUploader = data.uploadedBy === userId;

    let role: 'owner' | 'administrator' | 'viewer' | 'subject' | undefined;

    if (isUploader || owners.includes(userId)) {
      role = 'owner';
    } else if (administrators.includes(userId)) {
      role = 'administrator';
    } else if (viewers.includes(userId)) {
      role = 'viewer';
    } else if (subjects.includes(userId)) {
      role = 'subject';
    }

    const recordInfo = {
      hasSubjects: subjects.length > 0,
      subjectCount: subjects.length,
      isAnchored: false, // Would need blockchain call to determine
    };

    return {
      hasRole: role !== undefined,
      role,
      recordInfo,
    };
  }
}
