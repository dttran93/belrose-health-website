// src/features/Subject/services/subjectPreparationService.ts

/**
 * SubjectPreparationService
 *
 * Handles preparation and prerequisite verification for subject operations
 * (setting self as subject, accepting subject requests, removing subject status).
 *
 * This service builds on top of BlockchainPreparationService to add
 * subject-specific checks.
 *
 * Prerequisites for subject operations:
 * 1. [Generic] Caller's SmartAccount registered and active on-chain
 * 2. [Subject-specific] Caller has permission to modify the record (for setSubjectAsSelf)
 * 3. [Subject-specific] Record has a recordHash for blockchain anchoring
 *
 * Usage:
 *   // Before setting self as subject
 *   const prereqs = await SubjectPreparationService.verifyPrerequisites(recordId);
 *   if (!prereqs.ready) { ... show error: prereqs.reason ... }
 *
 *   // For accepting a subject request (no permission check needed - they were invited)
 *   const prereqs = await SubjectPreparationService.verifyAcceptPrerequisites(recordId);
 *
 *   // Ensure wallet is ready (auto-setup)
 *   await SubjectPreparationService.prepare();
 */

import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { BlockchainPreparationService } from '@/features/BlockchainWallet/services/blockchainPreparationService';

// ==================== TYPES ====================

export type SubjectOperationType =
  | 'setSubjectAsSelf'
  | 'acceptSubjectRequest'
  | 'rejectSubjectRequest'
  | 'rejectSubjectStatus'
  | 'removeSubjectByOwner';

export interface SubjectPrerequisites {
  /** Whether all prerequisites are met */
  ready: boolean;

  /** Human-readable reason if not ready */
  reason?: string;

  /** Caller's smart account address (if available) */
  callerSmartAccountAddress?: string;

  /** Detailed check results */
  checks?: {
    callerReady: boolean;
    hasRecordPermission: boolean;
    hasRecordHash: boolean;
  };

  /** Record information */
  recordInfo?: {
    recordHash: string;
    hasSubjects: boolean;
    subjectCount: number;
    isCallerAlreadySubject: boolean;
  };
}

export interface SubjectPreparationStatus {
  /** Whether everything is ready for subject operations */
  isReady: boolean;

  /** Caller's smart account address */
  smartAccountAddress: string;

  /** Whether caller's smart account is registered on-chain */
  isSmartAccountRegistered: boolean;

  /** Whether caller has permission to modify the record */
  hasRecordPermission: boolean;

  /** Caller's role on the record */
  callerRole?: 'owner' | 'administrator' | 'viewer' | 'subject' | 'uploader';

  /** Whether the record has a hash for anchoring */
  hasRecordHash: boolean;
}

export interface SubjectPreparationProgress {
  step: 'computing' | 'saving' | 'registering' | 'complete';
  message: string;
}

export type SubjectProgressCallback = (progress: SubjectPreparationProgress) => void;

// ==================== SERVICE ====================

export class SubjectPreparationService {
  // ============================================================================
  // VERIFICATION METHODS (Read-only checks before operations)
  // ============================================================================

  /**
   * Verify all prerequisites are met before setting self as subject.
   *
   * Use this before setSubjectAsSelf to fail fast with a clear message.
   *
   * Checks:
   * 1. Caller's SmartAccount is registered and active
   * 2. Caller has permission to modify the record (owner, admin, or uploader)
   * 3. Record has a recordHash for blockchain anchoring
   * 4. Caller is not already a subject
   *
   * @param recordId - The record to become a subject of
   */
  static async verifyPrerequisites(recordId: string): Promise<SubjectPrerequisites> {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      return {
        ready: false,
        reason: 'Please sign in to continue.',
        checks: {
          callerReady: false,
          hasRecordPermission: false,
          hasRecordHash: false,
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
            'Your blockchain wallet needs to be set up before you can become a subject. This is a one-time setup.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: false,
            hasRecordPermission: false,
            hasRecordHash: false,
          },
        };
      }

      // Step 2: Check record info and permissions
      const recordCheck = await this.checkRecordAndPermissions(recordId, user.uid);

      if (!recordCheck.exists) {
        return {
          ready: false,
          reason: 'Record not found.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: true,
            hasRecordPermission: false,
            hasRecordHash: false,
          },
        };
      }

      if (!recordCheck.hasPermission) {
        return {
          ready: false,
          reason:
            'You do not have permission to modify this record. Only owners, administrators, or the uploader can set themselves as subject.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: true,
            hasRecordPermission: false,
            hasRecordHash: recordCheck.hasRecordHash,
          },
          recordInfo: recordCheck.recordInfo,
        };
      }

      if (!recordCheck.hasRecordHash) {
        return {
          ready: false,
          reason:
            'This record does not have a hash for blockchain anchoring. Please ensure the record has been properly processed.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: true,
            hasRecordPermission: true,
            hasRecordHash: false,
          },
          recordInfo: recordCheck.recordInfo,
        };
      }

      if (recordCheck.recordInfo?.isCallerAlreadySubject) {
        return {
          ready: false,
          reason: 'You are already a subject of this record.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: true,
            hasRecordPermission: true,
            hasRecordHash: true,
          },
          recordInfo: recordCheck.recordInfo,
        };
      }

      // All checks passed
      return {
        ready: true,
        callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
        checks: {
          callerReady: true,
          hasRecordPermission: true,
          hasRecordHash: true,
        },
        recordInfo: recordCheck.recordInfo,
      };
    } catch (error) {
      console.error('❌ SubjectPreparationService: Error verifying prerequisites:', error);
      return {
        ready: false,
        reason: `Failed to verify prerequisites: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Verify prerequisites for accepting a subject request.
   *
   * This is simpler than verifyPrerequisites because:
   * - No permission check needed (they were explicitly invited)
   * - Just need wallet ready and record hash present
   *
   * @param recordId - The record to accept subject status for
   */
  static async verifyAcceptPrerequisites(recordId: string): Promise<SubjectPrerequisites> {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      return {
        ready: false,
        reason: 'Please sign in to continue.',
        checks: {
          callerReady: false,
          hasRecordPermission: true, // Not checked for accept
          hasRecordHash: false,
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
            'Your blockchain wallet needs to be set up before you can accept subject status. This is a one-time setup.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: false,
            hasRecordPermission: true,
            hasRecordHash: false,
          },
        };
      }

      // Step 2: Check record has a hash
      const recordCheck = await this.checkRecordAndPermissions(recordId, user.uid);

      if (!recordCheck.exists) {
        return {
          ready: false,
          reason: 'Record not found.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: true,
            hasRecordPermission: true,
            hasRecordHash: false,
          },
        };
      }

      if (!recordCheck.hasRecordHash) {
        return {
          ready: false,
          reason:
            'This record does not have a hash for blockchain anchoring. Please contact the record owner.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: true,
            hasRecordPermission: true,
            hasRecordHash: false,
          },
          recordInfo: recordCheck.recordInfo,
        };
      }

      // All checks passed
      return {
        ready: true,
        callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
        checks: {
          callerReady: true,
          hasRecordPermission: true,
          hasRecordHash: true,
        },
        recordInfo: recordCheck.recordInfo,
      };
    } catch (error) {
      console.error('❌ SubjectPreparationService: Error verifying accept prerequisites:', error);
      return {
        ready: false,
        reason: `Failed to verify prerequisites: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Verify prerequisites for removing/rejecting subject status.
   *
   * Checks:
   * 1. Caller's SmartAccount is registered (for unanchoring)
   * 2. Caller is currently a subject of the record
   *
   * @param recordId - The record to remove subject status from
   */
  static async verifyRemovePrerequisites(recordId: string): Promise<SubjectPrerequisites> {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      return {
        ready: false,
        reason: 'Please sign in to continue.',
        checks: {
          callerReady: false,
          hasRecordPermission: false,
          hasRecordHash: false,
        },
      };
    }

    try {
      // Step 1: Check caller's blockchain readiness
      const callerStatus = await BlockchainPreparationService.getStatus();

      if (!callerStatus.ready) {
        return {
          ready: false,
          reason: 'Your blockchain wallet needs to be set up before you can remove subject status.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: false,
            hasRecordPermission: false,
            hasRecordHash: false,
          },
        };
      }

      // Step 2: Check caller is a subject
      const recordCheck = await this.checkRecordAndPermissions(recordId, user.uid);

      if (!recordCheck.exists) {
        return {
          ready: false,
          reason: 'Record not found.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: true,
            hasRecordPermission: false,
            hasRecordHash: false,
          },
        };
      }

      if (!recordCheck.recordInfo?.isCallerAlreadySubject) {
        return {
          ready: false,
          reason: 'You are not a subject of this record.',
          callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
          checks: {
            callerReady: true,
            hasRecordPermission: false,
            hasRecordHash: recordCheck.hasRecordHash,
          },
          recordInfo: recordCheck.recordInfo,
        };
      }

      // All checks passed
      return {
        ready: true,
        callerSmartAccountAddress: callerStatus.smartAccountAddress || undefined,
        checks: {
          callerReady: true,
          hasRecordPermission: true,
          hasRecordHash: recordCheck.hasRecordHash,
        },
        recordInfo: recordCheck.recordInfo,
      };
    } catch (error) {
      console.error('❌ SubjectPreparationService: Error verifying remove prerequisites:', error);
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
   * Get detailed preparation status for subject operations.
   *
   * @param recordId - The record to check
   */
  static async getStatus(recordId: string): Promise<SubjectPreparationStatus> {
    const auth = getAuth();
    const user = auth.currentUser;

    // Get blockchain readiness
    const blockchainStatus = await BlockchainPreparationService.getStatus();

    // Get record-specific status
    let hasRecordPermission = false;
    let hasRecordHash = false;
    let callerRole: SubjectPreparationStatus['callerRole'];

    if (user) {
      const recordCheck = await this.checkRecordAndPermissions(recordId, user.uid);
      hasRecordPermission = recordCheck.hasPermission;
      hasRecordHash = recordCheck.hasRecordHash;
      callerRole = recordCheck.role;
    }

    return {
      smartAccountAddress: blockchainStatus.smartAccountAddress || '',
      isSmartAccountRegistered: blockchainStatus.checks.isRegisteredOnChain,
      hasRecordPermission,
      callerRole,
      hasRecordHash,
      isReady: blockchainStatus.ready && hasRecordPermission && hasRecordHash,
    };
  }

  /**
   * Prepare for subject operations.
   *
   * This ensures the caller's smart account is set up and registered.
   * Subject operations don't need record initialization (unlike permissions)
   * because anchoring IS the initialization for subjects.
   *
   * @param onProgress - Optional callback for progress updates
   * @returns The caller's smart account address
   */
  static async prepare(onProgress?: SubjectProgressCallback): Promise<string> {
    console.log('🔄 SubjectPreparationService: Starting preparation...');

    // Delegate to the generic blockchain preparation
    // Subject operations just need wallet readiness
    const address = await BlockchainPreparationService.ensureReady(progress => {
      onProgress?.(progress as SubjectPreparationProgress);
    });

    console.log('✅ SubjectPreparationService: Ready with address:', address);
    return address;
  }

  // ============================================================================
  // RECORD INFO HELPERS
  // ============================================================================

  /**
   * Get information about a record's subjects.
   *
   * @param recordId - The record to check
   */
  static async getRecordSubjectInfo(recordId: string): Promise<{
    subjects: string[];
    hasSubjects: boolean;
    recordHash: string | null;
  }> {
    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);
    const recordSnap = await getDoc(recordRef);

    if (!recordSnap.exists()) {
      return {
        subjects: [],
        hasSubjects: false,
        recordHash: null,
      };
    }

    const data = recordSnap.data();
    const subjects: string[] = data.subjects || [];

    return {
      subjects,
      hasSubjects: subjects.length > 0,
      recordHash: data.recordHash || null,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Check record existence, permissions, and hash status.
   */
  private static async checkRecordAndPermissions(
    recordId: string,
    userId: string
  ): Promise<{
    exists: boolean;
    hasPermission: boolean;
    hasRecordHash: boolean;
    role?: 'owner' | 'administrator' | 'viewer' | 'subject' | 'uploader';
    recordInfo?: {
      recordHash: string;
      hasSubjects: boolean;
      subjectCount: number;
      isCallerAlreadySubject: boolean;
    };
  }> {
    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);
    const recordSnap = await getDoc(recordRef);

    if (!recordSnap.exists()) {
      return {
        exists: false,
        hasPermission: false,
        hasRecordHash: false,
      };
    }

    const data = recordSnap.data();

    // Check roles
    const owners: string[] = data.owners || [];
    const administrators: string[] = data.administrators || [];
    const viewers: string[] = data.viewers || [];
    const subjects: string[] = data.subjects || [];
    const uploadedBy: string = data.uploadedBy || '';

    // Determine caller's role
    let role: 'owner' | 'administrator' | 'viewer' | 'subject' | 'uploader' | undefined;
    const isUploader = uploadedBy === userId;

    if (owners.includes(userId)) {
      role = 'owner';
    } else if (isUploader) {
      role = 'uploader';
    } else if (administrators.includes(userId)) {
      role = 'administrator';
    } else if (viewers.includes(userId)) {
      role = 'viewer';
    } else if (subjects.includes(userId)) {
      role = 'subject';
    }

    // Check if caller has permission to modify (set self as subject)
    // Uploader, owners, and administrators can do this
    const hasPermission = isUploader || owners.includes(userId) || administrators.includes(userId);

    // Check if record has a hash
    const recordHash = data.recordHash || '';
    const hasRecordHash = Boolean(recordHash);

    const recordInfo = {
      recordHash,
      hasSubjects: subjects.length > 0,
      subjectCount: subjects.length,
      isCallerAlreadySubject: subjects.includes(userId),
    };

    return {
      exists: true,
      hasPermission,
      hasRecordHash,
      role,
      recordInfo,
    };
  }
}
