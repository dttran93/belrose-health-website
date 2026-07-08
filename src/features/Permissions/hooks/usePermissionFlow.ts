// src/features/Permissions/hooks/usePermissionFlow.ts

import { useState, useCallback } from 'react';
import {
  PermissionPreparationService,
  InitialRole,
  PermissionPreparationProgress,
} from '../services/permissionPreparationService';
import { PermissionsService, Role } from '../services/permissionsService';
import { RoleEligibility } from '../components/ui/RoleSelector';
import { BelroseUserProfile, FileObject } from '@/types/core';
import { toast } from 'sonner';
import { getAuth } from 'firebase/auth';
import {
  DialogPhase,
  GrantVariant,
  OperationType,
  RevokeAction,
} from '../components/ui/PermissionActionDialog';
import { useOnChainActivityTray } from '@/features/OnChainActivityTray/OnChainActivityTrayContext';
import { getUserFacingErrorMessage } from '@/features/BlockchainWallet/services/blockchainSyncQueueService';

// ============================================================================
// TYPES
// ============================================================================

interface PendingOperation {
  type: OperationType;
  role: Role;
  targetUserId: string;
  targetWalletAddress: string;
  user: BelroseUserProfile;
  grantVariant: GrantVariant;
}

interface UsePermissionFlowOptions {
  /** Single record ID (string) or multiple (string[]) for batch operations */
  recordId: string | string[];
  recordTitle?: string; // Optional title for better notifications
  /** Needed to compute Modify Access eligibility (role arrays + subjects) */
  record?: FileObject;
  onSuccess?: () => void;
}

const roleLabels: Record<Role, string> = {
  viewer: 'Viewer',
  sharer: 'Sharer',
  administrator: 'Administrator',
  owner: 'Owner',
};

// ============================================================================
// HOOK
// ============================================================================

export function usePermissionFlow({
  recordId,
  recordTitle,
  record,
  onSuccess,
}: UsePermissionFlowOptions) {
  // Normalise to array once — everything below works with recordIds
  const recordIds = Array.isArray(recordId) ? recordId : [recordId];
  const recordLink = `/app/records/${recordIds[0]}?view=permissions`;

  // For single-record operations (revoke, backwards-compat) keep the first ID handy
  const primaryRecordId = recordIds[0] ?? '';
  const isBatch = recordIds.length > 1;

  const [phase, setPhase] = useState<DialogPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [preparationProgress, setPreparationProgress] =
    useState<PermissionPreparationProgress | null>(null);
  const [eligibility, setEligibility] = useState<Record<Role, RoleEligibility> | null>(null);
  const [canFullyRevoke, setCanFullyRevoke] = useState<RoleEligibility | null>(null);

  // OnChainActivityTray — UI display for blockchain processing in background
  const { addActivity, updateActivity } = useOnChainActivityTray();
  const [submittedLabel, setSubmittedLabel] = useState('');

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setPendingOperation(null);
    setPreparationProgress(null);
    setEligibility(null);
    setCanFullyRevoke(null);
  }, []);

  /**
   * Get current user's role on the PRIMARY record (used for single-record
   * revoke and as the fallback for batch initialization).
   */
  const getCurrentUserRole = useCallback(async (): Promise<InitialRole> => {
    try {
      const roles = await PermissionsService.getRecordRoles(primaryRecordId);
      const uid = getAuth().currentUser?.uid;
      if (roles && uid && roles.owners.includes(uid)) return 'owner';
    } catch (err) {
      console.error('Error getting current user role:', err);
    }
    return 'administrator';
  }, [primaryRecordId]);

  // ==========================================================================
  // GRANT FLOW
  // ==========================================================================

  /**
   * Start a grant operation
   * @param user - The user to grant access to
   * @param role - The role to grant (or default for select-role variant)
   * @param variant - 'confirm' for pre-selected role, 'select-role' for user selection
   */
  const initiateGrant = useCallback(
    async (user: BelroseUserProfile, role: Role, variant: GrantVariant = 'confirm') => {
      const walletAddress = user.wallet?.address;

      if (!walletAddress) {
        toast.error('User does not have a wallet address');
        return;
      }

      // Set pending operation and start preparing
      setPendingOperation({
        type: 'grant',
        role,
        targetUserId: user.uid,
        targetWalletAddress: walletAddress,
        user,
        grantVariant: variant,
      });
      setPhase('preparing');
      setError(null);

      try {
        if (isBatch) {
          // Batch path: prepareBatch handles smart account + per-record initialization
          await PermissionPreparationService.prepareBatch(recordIds, setPreparationProgress);
        } else {
          // Single-record path: unchanged from original
          const prereqs = await PermissionPreparationService.verifyPrerequisites(
            primaryRecordId,
            walletAddress
          );

          if (!prereqs.ready) {
            const initialRole = await getCurrentUserRole();
            await PermissionPreparationService.prepare(
              primaryRecordId,
              initialRole,
              setPreparationProgress
            );

            const finalCheck = await PermissionPreparationService.verifyPrerequisites(
              primaryRecordId,
              walletAddress
            );
            if (!finalCheck.ready) {
              throw new Error(finalCheck.reason || 'Preparation failed');
            }
          }
        }

        setPhase('confirming');
      } catch (err) {
        const message = getUserFacingErrorMessage(err, 'Preparation failed');
        setError(message);
        setPhase('error');
      }
    },
    [recordIds, primaryRecordId, isBatch, getCurrentUserRole]
  );

  /**
   * Execute a confirmed grant.
   * Blockchain write — fire-and-forget pattern:
   * tx fires, dialog closes immediately to submitted, tray tracks the rest.
   */
  const confirmGrant = useCallback(
    async (roleOverride?: Role) => {
      if (!pendingOperation || pendingOperation.type !== 'grant') return;

      // Capture before dialog closes
      const role = roleOverride || pendingOperation.role;
      const { targetUserId } = pendingOperation;

      const activityLabel = isBatch
        ? `Granting ${roleLabels[role]} access across ${recordIds.length} records`
        : `Granting ${roleLabels[role]} access`;

      const activityId = addActivity({ label: activityLabel, link: recordLink });

      // Fire tx — don't await
      const txPromise = isBatch
        ? PermissionsService.grantRoleBatch(
            recordIds,
            targetUserId,
            recordIds.map(() => role)
          )
        : role === 'viewer'
          ? PermissionsService.grantViewer(primaryRecordId, targetUserId, recordTitle)
          : role === 'sharer'
            ? PermissionsService.grantSharer(primaryRecordId, targetUserId, recordTitle)
            : role === 'administrator'
              ? PermissionsService.grantAdmin(primaryRecordId, targetUserId, recordTitle)
              : PermissionsService.grantOwner(primaryRecordId, targetUserId, recordTitle);

      // Close dialog immediately
      setSubmittedLabel(activityLabel);
      setPhase('submitted');

      // Resolve in background
      txPromise
        .then(async () => {
          updateActivity(activityId, { status: 'confirmed' });
          toast.success(
            isBatch
              ? `${roleLabels[role]} access granted across ${recordIds.length} records`
              : `${roleLabels[role]} added successfully`
          );
          await onSuccess?.();
        })
        .catch(err => {
          const message = getUserFacingErrorMessage(err, 'Failed to grant access');
          updateActivity(activityId, { status: 'failed', errorMessage: message });
        });
    },
    [
      pendingOperation,
      recordIds,
      primaryRecordId,
      recordTitle,
      isBatch,
      addActivity,
      updateActivity,
      onSuccess,
    ]
  );

  // ==========================================================================
  // MODIFY FLOW
  // Lets the caller pick a target role directly (rather than a fixed grant or
  // demote button) — dispatches to a grant or a demote under the hood via
  // PermissionsService.changeRole. Single-record only, like revoke.
  // ==========================================================================

  /**
   * Start a modify operation — computes which roles the caller may move this
   * user to (PermissionsService.getEligibleRoleTargets) before opening the picker.
   */
  const initiateModify = useCallback(
    async (user: BelroseUserProfile, currentRole: Role) => {
      const walletAddress = user.wallet?.address;
      if (!walletAddress) {
        toast.error('User does not have a wallet address');
        return;
      }

      setPendingOperation({
        type: 'modify',
        role: currentRole,
        targetUserId: user.uid,
        targetWalletAddress: walletAddress,
        user,
        grantVariant: 'confirm',
      });
      setPhase('preparing');
      setError(null);

      try {
        const callerId = getAuth().currentUser?.uid;
        if (record && callerId) {
          setEligibility(PermissionsService.getEligibleRoleTargets(record, callerId, user.uid));
        }

        // Prep covers the same ground as grant (upgrades may need it); revoke-only
        // prerequisites are a strict subset of this, so it's safe for either outcome.
        const prereqs = await PermissionPreparationService.verifyPrerequisites(
          primaryRecordId,
          walletAddress
        );

        if (!prereqs.ready) {
          const initialRole = await getCurrentUserRole();
          await PermissionPreparationService.prepare(
            primaryRecordId,
            initialRole,
            setPreparationProgress
          );

          const finalCheck = await PermissionPreparationService.verifyPrerequisites(
            primaryRecordId,
            walletAddress
          );
          if (!finalCheck.ready) {
            throw new Error(finalCheck.reason || 'Preparation failed');
          }
        }

        setPhase('confirming');
      } catch (err) {
        const message = getUserFacingErrorMessage(err, 'Preparation failed');
        setError(message);
        setPhase('error');
      }
    },
    [record, primaryRecordId, getCurrentUserRole]
  );

  /**
   * Execute a confirmed modify — dispatches to the right grant/demote call
   * via PermissionsService.changeRole based on current vs. new role.
   */
  const confirmModify = useCallback(
    async (newRole: Role) => {
      if (!pendingOperation || pendingOperation.type !== 'modify') return;

      const currentRole = pendingOperation.role;
      const { targetUserId } = pendingOperation;
      if (newRole === currentRole) {
        reset();
        return;
      }

      const activityLabel = `Changing access to ${roleLabels[newRole]}`;
      const activityId = addActivity({ label: activityLabel, link: recordLink });

      const txPromise = PermissionsService.changeRole(
        primaryRecordId,
        targetUserId,
        currentRole,
        newRole,
        recordTitle
      );

      setSubmittedLabel(activityLabel);
      setPhase('submitted');

      txPromise
        .then(async () => {
          updateActivity(activityId, { status: 'confirmed' });
          toast.success(`Access changed to ${roleLabels[newRole]}`);
          await onSuccess?.();
        })
        .catch(err => {
          const message = getUserFacingErrorMessage(err, 'Failed to change access');
          updateActivity(activityId, { status: 'failed', errorMessage: message });
        });
    },
    [pendingOperation, primaryRecordId, recordTitle, reset, addActivity, updateActivity, onSuccess]
  );

  // ==========================================================================
  // REVOKE FLOW
  // Revoke always operates on the primary record — batch revoke is a separate
  // concern handled by TrusteePermissionService / future bulk-action flows.
  // ==========================================================================

  /**
   * Start a revoke operation
   * @param user - The user to revoke access from
   * @param currentRole - Their current role on the record
   */
  const initiateRevoke = useCallback(
    async (user: BelroseUserProfile, currentRole: Role) => {
      const walletAddress = user.wallet?.address;
      if (!walletAddress) {
        toast.error('User does not have a wallet address');
        return;
      }

      setPendingOperation({
        type: 'revoke',
        role: currentRole,
        targetUserId: user.uid,
        targetWalletAddress: walletAddress,
        user,
        grantVariant: 'confirm', // Not used for revoke, but keeps type consistent
      });
      setPhase('preparing');
      setError(null);

      try {
        const callerId = getAuth().currentUser?.uid;
        if (record && callerId) {
          setEligibility(PermissionsService.getEligibleRoleTargets(record, callerId, user.uid));
          setCanFullyRevoke(PermissionsService.canRevokeAccess(record, callerId, user.uid));
        }

        // For revokes, just verify prerequisites (no new preparation needed)
        const prereqs = await PermissionPreparationService.verifyPrerequisites(
          primaryRecordId,
          walletAddress
        );
        if (!prereqs.ready) {
          throw new Error(prereqs.reason || 'Prerequisites not met');
        }
        setPhase('confirming');
      } catch (err) {
        const message = getUserFacingErrorMessage(err, 'Verification failed');
        setError(message);
        setPhase('error');
      }
    },
    [record, primaryRecordId]
  );

  /**
   * Execute a confirmed revoke
   * @param action - The revoke action to perform
   */
  const confirmRevoke = useCallback(
    async (action: RevokeAction) => {
      if (!pendingOperation || pendingOperation.type !== 'revoke') return;

      // Capture before dialog closes
      const { role, targetUserId } = pendingOperation;

      const activityLabel =
        action === 'full-revoke'
          ? 'Revoking access'
          : action === 'demote-admin'
            ? 'Demoting to Administrator'
            : action === 'demote-sharer'
              ? 'Demoting to Sharer'
              : 'Demoting to Viewer';

      const activityId = addActivity({ label: activityLabel, link: recordLink });

      // Fire tx — don't await
      const txPromise =
        role === 'viewer'
          ? PermissionsService.removeViewer(primaryRecordId, targetUserId, recordTitle)
          : role === 'sharer'
            ? PermissionsService.removeSharer(primaryRecordId, targetUserId, recordTitle, {
                demoteToViewer: action === 'demote-viewer',
              })
            : role === 'administrator'
              ? PermissionsService.removeAdmin(primaryRecordId, targetUserId, recordTitle, {
                  demoteTo:
                    action === 'demote-sharer'
                      ? 'sharer'
                      : action === 'demote-viewer'
                        ? 'viewer'
                        : undefined,
                })
              : PermissionsService.removeOwner(primaryRecordId, targetUserId, recordTitle, {
                  demoteTo:
                    action === 'demote-admin'
                      ? 'administrator'
                      : action === 'demote-sharer'
                        ? 'sharer'
                        : action === 'demote-viewer'
                          ? 'viewer'
                          : undefined,
                });

      // Close dialog immediately
      setSubmittedLabel(activityLabel);
      setPhase('submitted');

      // Resolve in background — action is captured in closure
      txPromise
        .then(async () => {
          updateActivity(activityId, { status: 'confirmed' });

          const successMessage =
            action === 'full-revoke'
              ? 'Access revoked successfully'
              : action === 'demote-admin'
                ? 'Demoted to Administrator'
                : action === 'demote-sharer'
                  ? 'Demoted to Sharer'
                  : 'Demoted to Viewer';

          toast.success(successMessage);
          await onSuccess?.();
        })
        .catch(err => {
          const message = getUserFacingErrorMessage(err, 'Failed to update access');
          updateActivity(activityId, { status: 'failed', errorMessage: message });
        });
    },
    [pendingOperation, primaryRecordId, addActivity, updateActivity, onSuccess]
  );

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    dialogProps: {
      isOpen: phase !== 'idle',
      phase,
      preparationProgress,
      operationType: (pendingOperation?.type || 'grant') as OperationType,
      role: pendingOperation?.role || 'viewer',
      user: pendingOperation?.user || null,
      error,
      grantVariant: pendingOperation?.grantVariant || 'confirm',
      eligibility: eligibility ?? undefined,
      canFullyRevoke: canFullyRevoke ?? undefined,
      onClose: reset,
      onConfirmGrant: confirmGrant,
      onConfirmRevoke: confirmRevoke,
      onConfirmModify: confirmModify,
      submittedLabel,
    },

    // Actions to initiate flows
    initiateGrant,
    initiateRevoke,
    initiateModify,

    // Convenience state
    isLoading: phase === 'executing',
    phase,
    error,
  };
}
