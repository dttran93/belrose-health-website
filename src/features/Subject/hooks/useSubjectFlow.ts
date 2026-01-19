// src/features/Subject/hooks/useSubjectFlow.ts

/**
 * useSubjectFlow Hook
 *
 * Manages all subject operations with a unified dialog flow:
 * - Adding subjects (self or others)
 * - Accepting/rejecting subject requests
 * - Removing subject status
 *
 * Phases:
 * - idle: No dialog open
 * - selecting: Choose self vs other, role selection
 * - searching: User search for "other" flow
 * - preparing: Wallet setup
 * - confirming: Final confirmation
 * - executing: Operation in progress
 * - success: Operation completed
 * - error: Operation failed
 */

import { useState, useCallback, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import {
  SubjectPreparationService,
  type SubjectOperationType,
  type SubjectPreparationProgress,
} from '../services/subjectPreparationService';
import { SubjectService } from '../services/subjectService';
import { PermissionsService } from '@/features/Permissions/services/permissionsService';
import { FileObject, BelroseUserProfile } from '@/types/core';
import { doc, getDoc, getFirestore, updateDoc } from 'firebase/firestore';
import SubjectQueryService, { IncomingSubjectRequest } from '../services/subjectQueryService';
import { SubjectConsentRequest } from '../services/subjectConsentService';

// ============================================================================
// TYPES
// ============================================================================

export type SubjectRole = 'viewer' | 'administrator' | 'owner';
export type SubjectChoice = 'self' | 'other';

export type SubjectDialogPhase =
  | 'idle'
  | 'selecting' // Choose self vs other
  | 'searching' // User search for "other" flow
  | 'preparing'
  | 'confirming'
  | 'executing'
  | 'success'
  | 'error';

export interface UseSubjectFlowOptions {
  /** The record to operate on */
  record: FileObject;
  /** Callback when an operation succeeds */
  onSuccess?: () => void;
}

interface PendingOperation {
  type: SubjectOperationType;
  recordId: string;
  // For set subject flows
  subjectChoice?: SubjectChoice;
  selectedRole?: SubjectRole;
  selectedUser?: BelroseUserProfile;
  // For remove/reject flows
  reason?: string;
  revokeAccess?: boolean;
}

// Role hierarchy for comparison
const ROLE_HIERARCHY: Record<SubjectRole | 'none', number> = {
  none: 0,
  viewer: 1,
  administrator: 2,
  owner: 3,
};

// ============================================================================
// HELPER FUNCTIONS (exported for use in components)
// ============================================================================

/**
 * Get the user's current highest role for a record
 */
export const getUserRoleForRecord = (userId: string, record: FileObject): SubjectRole | null => {
  if (record.owners?.includes(userId)) return 'owner';
  if (record.administrators?.includes(userId)) return 'administrator';
  if (record.uploadedBy === userId) return 'administrator';
  if (record.viewers?.includes(userId)) return 'viewer';
  return null;
};

/**
 * Check if selecting a role would be a downgrade
 */
export const isRoleDowngrade = (
  currentRole: SubjectRole | null,
  selectedRole: SubjectRole
): boolean => {
  const currentLevel = ROLE_HIERARCHY[currentRole || 'none'];
  const selectedLevel = ROLE_HIERARCHY[selectedRole];
  return selectedLevel < currentLevel;
};

/**
 * Get the minimum allowed role for a user (their current role or viewer if none)
 */
export const getMinimumAllowedRole = (userId: string, record: FileObject): SubjectRole => {
  const currentRole = getUserRoleForRecord(userId, record);
  return currentRole || 'viewer';
};

// ============================================================================
// HOOK
// ============================================================================

export function useSubjectFlow({ record, onSuccess }: UseSubjectFlowOptions) {
  const recordId = record.id;

  // Dialog state
  const [phase, setPhase] = useState<SubjectDialogPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [preparationProgress, setPreparationProgress] = useState<SubjectPreparationProgress | null>(
    null
  );

  // Selection state (for the selecting/searching phases)
  const [subjectChoice, setSubjectChoice] = useState<SubjectChoice>('self');
  const [selectedRole, setSelectedRole] = useState<SubjectRole>('viewer');
  const [selectedUser, setSelectedUser] = useState<BelroseUserProfile | null>(null);
  const [revokeAccess, setRevokeAccess] = useState<boolean>(true);

  // Subject status state
  const [isSubject, setIsSubject] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [currentSubjects, setCurrentSubjects] = useState<string[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingSubjectRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  // ==========================================================================
  // FETCH CURRENT STATUS
  // ==========================================================================

  /**
   * Check if current user is a subject of the record
   */
  const fetchSubjectStatus = useCallback(async () => {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;

    if (!userId || !recordId) {
      setIsSubject(false);
      setCurrentSubjects([]);
      setIsLoadingStatus(false);
      return;
    }

    setIsLoadingStatus(true);
    try {
      const subjects = await SubjectQueryService.getRecordSubjects(recordId);
      setCurrentSubjects(subjects);
      setIsSubject(subjects.includes(userId));
    } catch (err) {
      console.error('Error fetching subject status:', err);
      setIsSubject(false);
      setCurrentSubjects([]);
    } finally {
      setIsLoadingStatus(false);
    }
  }, [recordId]);

  /**
   * Fetch incoming subject requests for the current user
   */
  const fetchIncomingRequests = useCallback(async () => {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;

    if (!userId) {
      setIncomingRequests([]);
      setIsLoadingRequests(false);
      return;
    }

    setIsLoadingRequests(true);
    try {
      const requests = await SubjectQueryService.getIncomingConsentRequests();
      setIncomingRequests(requests);
    } catch (err) {
      console.error('Error fetching incoming requests:', err);
      setIncomingRequests([]);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  // Fetch on mount and when recordId changes
  useEffect(() => {
    fetchSubjectStatus();
    fetchIncomingRequests();
  }, [fetchSubjectStatus, fetchIncomingRequests]);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Reset dialog to idle state
   */
  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setPendingOperation(null);
    setPreparationProgress(null);
    setSubjectChoice('self');
    setSelectedRole('viewer');
    setSelectedUser(null);
    setRevokeAccess(true);
  }, []);

  /**
   * Refetch all data after a successful operation
   */
  const refetchAll = useCallback(async () => {
    await Promise.all([fetchSubjectStatus(), fetchIncomingRequests()]);
  }, [fetchSubjectStatus, fetchIncomingRequests]);

  /**
   * Get the pending request for the current record (if any)
   */
  const getPendingRequestForRecord = useCallback(() => {
    return incomingRequests.find(req => req.recordId === recordId);
  }, [incomingRequests, recordId]);

  // ==========================================================================
  // PREPARATION
  // ==========================================================================

  /**
   * Run preparation with progress updates
   * Returns true if ready to proceed, false if failed
   */
  const runPreparation = useCallback(
    async (operationType: SubjectOperationType): Promise<boolean> => {
      setPhase('preparing');
      setError(null);

      try {
        // Choose the right verification method based on operation type
        let prereqs;
        switch (operationType) {
          case 'setSubjectAsSelf':
            prereqs = await SubjectPreparationService.verifyPrerequisites(recordId);
            break;
          case 'acceptSubjectRequest':
            prereqs = await SubjectPreparationService.verifyAcceptPrerequisites(recordId);
            break;
          case 'rejectSubjectStatus':
            prereqs = await SubjectPreparationService.verifyRemovePrerequisites(recordId);
            break;
          default:
            // For other operations (rejectSubjectRequest, removeSubjectByOwner),
            // just check basic wallet readiness
            prereqs = await SubjectPreparationService.verifyAcceptPrerequisites(recordId);
        }

        if (prereqs.ready) {
          // Already ready, no preparation needed
          return true;
        }

        // Not ready - check why
        if (!prereqs.checks?.callerReady) {
          // Wallet not set up - prepare it
          await SubjectPreparationService.prepare(recordId, progress => {
            setPreparationProgress(progress);
          });

          // Verify again after preparation
          const finalCheck =
            operationType === 'setSubjectAsSelf'
              ? await SubjectPreparationService.verifyPrerequisites(recordId)
              : operationType === 'rejectSubjectStatus'
                ? await SubjectPreparationService.verifyRemovePrerequisites(recordId)
                : await SubjectPreparationService.verifyAcceptPrerequisites(recordId);

          if (!finalCheck.ready) {
            // Still not ready after wallet setup - must be a different issue
            throw new Error(finalCheck.reason || 'Preparation failed');
          }

          return true;
        } else {
          // Wallet is ready but failed for another reason
          throw new Error(prereqs.reason || 'Prerequisites not met');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Preparation failed';
        setError(message);
        setPhase('error');
        return false;
      }
    },
    [recordId]
  );

  // ==========================================================================
  // ADD SUBJECT FLOW (unified entry point)
  // ==========================================================================

  /**
   * Open the dialog to add a subject (starts at selection phase)
   */
  const initiateAddSubject = useCallback(() => {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;

    // Pre-set the minimum role based on user's current role
    if (userId) {
      const minRole = getMinimumAllowedRole(userId, record);
      setSelectedRole(minRole);
    }

    // Check if user is already a subject
    if (userId && currentSubjects.includes(userId)) {
      setSubjectChoice('other');
    } else {
      setSubjectChoice('self');
    }

    setSelectedUser(null);
    setPhase('selecting');
  }, [record, currentSubjects]);

  /**
   * Move from selecting to next phase based on choice
   */
  const proceedFromSelection = useCallback(async () => {
    if (subjectChoice === 'self') {
      // For self, run preparation then go to confirming
      setPendingOperation({
        type: 'setSubjectAsSelf',
        recordId,
        subjectChoice: 'self',
        selectedRole,
      });

      const ready = await runPreparation('setSubjectAsSelf');
      if (ready) {
        setPhase('confirming');
      }
    } else {
      // For other, go to user search phase
      setPhase('searching');
    }
  }, [subjectChoice, selectedRole, recordId, runPreparation]);

  /**
   * Select a user in the "other" flow and proceed to confirmation
   */
  const selectUserAndProceed = useCallback(
    async (user: BelroseUserProfile) => {
      setSelectedUser(user);
      setPendingOperation({
        type: 'acceptSubjectRequest', // Will actually be requestSubjectConsent
        recordId,
        subjectChoice: 'other',
        selectedRole,
        selectedUser: user,
      });

      // No blockchain preparation needed for consent requests
      setPhase('confirming');
    },
    [recordId, selectedRole]
  );

  /**
   * Go back from searching to selection
   */
  const goBackToSelection = useCallback(() => {
    setSelectedUser(null);
    setPhase('selecting');
  }, []);

  // ==========================================================================
  // CONFIRM SET SELF AS SUBJECT
  // ==========================================================================

  const confirmSetSubjectAsSelf = useCallback(async () => {
    if (!pendingOperation || pendingOperation.subjectChoice !== 'self') return;

    const auth = getAuth();
    const userId = auth.currentUser?.uid;

    if (!userId) {
      setError('You must be signed in');
      setPhase('error');
      return;
    }

    setPhase('executing');

    try {
      // Step 1: Add as subject (includes blockchain anchoring)
      const result = await SubjectService.setSubjectAsSelf(recordId);

      // Step 2: Grant role if needed
      const currentRole = getUserRoleForRecord(userId, record);
      const targetRole = pendingOperation.selectedRole || 'viewer';

      if (!currentRole || ROLE_HIERARCHY[targetRole] > ROLE_HIERARCHY[currentRole]) {
        console.log(`🔐 Granting ${targetRole} role...`);
        await PermissionsService.grantRole(recordId, userId, targetRole);
      }

      if (result.blockchainAnchored) {
        toast.success('You are now a subject of this record');
      } else {
        toast.success('You are now a subject of this record (blockchain sync pending)');
      }

      reset();
      await refetchAll();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set subject status';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, recordId, record, reset, refetchAll, onSuccess]);

  // ==========================================================================
  // CONFIRM REQUEST CONSENT
  // ==========================================================================

  const confirmRequestConsent = useCallback(async () => {
    if (!pendingOperation || pendingOperation.subjectChoice !== 'other' || !selectedUser) return;

    const auth = getAuth();
    const userId = auth.currentUser?.uid;

    if (!userId) {
      setError('You must be signed in');
      setPhase('error');
      return;
    }

    setPhase('executing');

    try {
      // Step 1: Run preparation for wallet readiness and initializing on-chain
      console.log('🔄 Step 1: Running preparation...');
      await SubjectPreparationService.prepare(recordId, progress => {
        setPreparationProgress(progress);
      });
      console.log('✅ Step 1 complete');

      //Step 2: Create the consent request
      console.log('🔄 Step 2: Creating consent request...');
      await SubjectService.requestSubjectConsent(recordId, selectedUser.uid, {
        role: pendingOperation.selectedRole || 'viewer',
      });
      console.log('✅ Step 2 complete');

      // Step 3: Grant the role so the subject can preview the record
      console.log('🔄 Step 3: Checking/granting role...');
      const targetRole = pendingOperation.selectedRole || 'viewer';
      const currentRole = getUserRoleForRecord(selectedUser.uid, record);
      const targetRoleLevel = ROLE_HIERARCHY[targetRole];
      const currentRoleLevel = ROLE_HIERARCHY[currentRole || 'none'];
      console.log('📊 Role check:', {
        targetRole,
        currentRole,
        targetRoleLevel,
        currentRoleLevel,
        selectedUserUid: selectedUser.uid,
      });

      if (!currentRole || targetRoleLevel > currentRoleLevel) {
        console.log(`🔐 Granting ${targetRole} for selected user...`);
        await PermissionsService.grantRole(recordId, selectedUser.uid, targetRole);

        //Track that we granted access with this request
        const requestId = `${recordId}_${selectedUser.uid}`;
        const requestRef = doc(getFirestore(), 'subjectConsentRequests', requestId);
        await updateDoc(requestRef, {
          grantedAccessOnSubjectRequest: true,
        });
      } else {
        console.log(`ℹ️ User already has ${currentRole} (target: ${targetRole}), skipping grant`);
      }
      console.log('✅ Step 3 complete');

      toast.success('Consent request sent. The user will be notified.');
      reset();
      await refetchAll();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send consent request';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, selectedUser, recordId, record, reset, refetchAll, onSuccess]);

  // ==========================================================================
  // ACCEPT SUBJECT REQUEST FLOW
  // ==========================================================================

  /**
   * Start the "accept subject request" flow
   */
  const initiateAcceptRequest = useCallback(
    async (requestRecordId?: string) => {
      const targetRecordId = requestRecordId || recordId;

      setPendingOperation({
        type: 'acceptSubjectRequest',
        recordId: targetRecordId,
      });

      const ready = await runPreparation('acceptSubjectRequest');
      if (ready) {
        setPhase('confirming');
      }
    },
    [recordId, runPreparation]
  );

  /**
   * Execute the confirmed "accept subject request" operation
   */
  const confirmAcceptRequest = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'acceptSubjectRequest') return;

    const auth = getAuth();
    if (!auth.currentUser?.uid) {
      setError('You must be signed in');
      setPhase('error');
      return;
    }

    setPhase('executing');

    try {
      const result = await SubjectService.acceptSubjectRequest(pendingOperation.recordId);

      if (result) {
        toast.success('Subject request accepted');
      }

      reset();
      await refetchAll();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept request';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, reset, refetchAll, onSuccess]);

  // ==========================================================================
  // REJECT SUBJECT REQUEST FLOW
  // ==========================================================================

  /**
   * Start the "reject subject request" flow
   * Note: This is for rejecting an incoming request, not removing existing subject status
   */
  const initiateRejectRequest = useCallback(
    (requestRecordId?: string, reason?: string) => {
      const targetRecordId = requestRecordId || recordId;

      setPendingOperation({
        type: 'rejectSubjectRequest',
        recordId: targetRecordId,
        reason,
      });

      // No blockchain operation needed for rejecting a request
      // Just go straight to confirming
      setPhase('confirming');
    },
    [recordId]
  );

  /**
   * Execute the confirmed "reject subject request" operation
   */
  const confirmRejectRequest = useCallback(
    async (reason?: string) => {
      if (!pendingOperation || pendingOperation.type !== 'rejectSubjectRequest') return;

      const auth = getAuth();
      const userId = auth.currentUser?.uid;

      if (!userId) {
        setError('You must be signed in');
        setPhase('error');
        return;
      }

      setPhase('executing');

      try {
        // Get the request data to check if access was granted
        const db = getFirestore();
        const requestId = `${pendingOperation.recordId}_${userId}`;
        const requestRef = doc(db, 'subjectConsentRequests', requestId);
        const requestDoc = await getDoc(requestRef);
        const requestData = requestDoc.data() as SubjectConsentRequest | undefined;

        // Reject the request
        await SubjectService.rejectSubjectRequest(
          pendingOperation.recordId,
          reason || pendingOperation.reason
        );

        // Revoke access if it was granted with the request
        if (requestData?.grantedAccessOnSubjectRequest) {
          const role = requestData.requestedSubjectRole;
          await PermissionsService.removeRole(pendingOperation.recordId, userId, role);
          toast.success('Subject request declined and access revoked');
        } else {
          toast.success('Subject request declined');
        }

        reset();
        await refetchAll();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reject request';
        setError(message);
        setPhase('error');
        toast.error(message);
      }
    },
    [pendingOperation, reset, refetchAll, onSuccess]
  );

  // ==========================================================================
  // REMOVE SUBJECT STATUS FLOW
  // ==========================================================================

  /**
   * Start the "remove subject status" flow (self-removal)
   */
  const initiateRemoveSubjectStatus = useCallback(
    async (options?: { reason?: string; revokeAccess?: boolean }) => {
      setPendingOperation({
        type: 'rejectSubjectStatus',
        recordId,
        reason: options?.reason,
        revokeAccess: options?.revokeAccess,
      });

      const ready = await runPreparation('rejectSubjectStatus');
      if (ready) {
        setPhase('confirming');
      }
    },
    [recordId, runPreparation]
  );

  /**
   * Execute the confirmed "remove subject status" operation
   */
  const confirmRemoveSubjectStatus = useCallback(
    async (reason?: string) => {
      if (!pendingOperation || pendingOperation.type !== 'rejectSubjectStatus') return;

      const auth = getAuth();
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setError('You must be signed in');
        setPhase('error');
        return;
      }

      setPhase('executing');

      try {
        const result = await SubjectService.rejectSubjectStatus(recordId, {
          reason: reason || pendingOperation.reason,
        });

        // Optionally revoke access if user chose to
        let accessRevoked = false;
        if (pendingOperation.revokeAccess) {
          const db = getFirestore();
          const requestId = `${recordId}_${userId}`;
          const requestRef = doc(db, 'subjectConsentRequests', requestId);
          const requestDoc = await getDoc(requestRef);
          const requestData = requestDoc.data() as SubjectConsentRequest | undefined;

          if (requestData?.grantedAccessOnSubjectRequest) {
            const role = requestData.requestedSubjectRole;
            await PermissionsService.removeRole(recordId, userId, role);
            accessRevoked = true;
          }
        }

        // Show appropriate success message
        if (accessRevoked) {
          toast.success('You have been removed as a subject and your access has been revoked');
        } else if (result) {
          toast.success('You have been removed as a subject');
        }

        if (result.pendingCreatorDecision) {
          toast.info('The record creator will be notified of your removal');
        }

        reset();
        await refetchAll();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove subject status';
        setError(message);
        setPhase('error');
        toast.error(message);
      }
    },
    [pendingOperation, recordId, revokeAccess, reset, refetchAll, onSuccess]
  );

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================

  const pendingRequestForRecord = getPendingRequestForRecord();
  const hasPendingRequest = Boolean(pendingRequestForRecord);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Dialog props
    dialogProps: {
      isOpen: phase !== 'idle',
      phase,
      operationType: pendingOperation?.type || 'setSubjectAsSelf',
      error,
      preparationProgress,
      // Selection state
      subjectChoice,
      setSubjectChoice,
      selectedRole,
      setSelectedRole,
      selectedUser,
      setSelectedUser,
      revokeAccess,
      setRevokeAccess,
      // Record info
      record,
      currentSubjects,
      isSubject,
      // Callbacks
      onClose: reset,
      onProceedFromSelection: proceedFromSelection,
      onSelectUser: selectUserAndProceed,
      onGoBackToSelection: goBackToSelection,
      onConfirmSetSubjectAsSelf: confirmSetSubjectAsSelf,
      onConfirmRequestConsent: confirmRequestConsent,
      onConfirmAcceptRequest: confirmAcceptRequest,
      onConfirmRejectRequest: confirmRejectRequest,
      onConfirmRemoveSubjectStatus: confirmRemoveSubjectStatus,
    },

    // Current status
    isSubject,
    isLoadingStatus,
    currentSubjects,
    hasPendingRequest,
    pendingRequest: pendingRequestForRecord,
    incomingRequests,
    isLoadingRequests,

    // Actions
    initiateAddSubject,
    initiateAcceptRequest,
    initiateRejectRequest,

    // Remove subject status
    initiateRemoveSubjectStatus,

    // Refetch
    refetch: refetchAll,

    // State
    isLoading: phase === 'preparing' || phase === 'executing',
    isDialogOpen: phase !== 'idle',
    phase,
    error,
    reset,
  };
}
