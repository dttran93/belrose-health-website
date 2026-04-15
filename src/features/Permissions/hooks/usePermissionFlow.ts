// src/features/Permissions/hooks/usePermissionFlow.ts

import { useState, useCallback } from 'react';
import {
  PermissionPreparationService,
  InitialRole,
  PermissionPreparationProgress,
} from '../services/permissionPreparationService';
import { PermissionsService, Role } from '../services/permissionsService';
import { BelroseUserProfile } from '@/types/core';
import { toast } from 'sonner';
import { getAuth } from 'firebase/auth';
import type {
  DialogPhase,
  OperationType,
  RevokeAction,
  GrantVariant,
} from '@/features/Permissions/component/ui/PermissionActionDialog';

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
  onSuccess?: () => void;
}

const roleLabels: Record<Role, string> = {
  viewer: 'Viewer',
  administrator: 'Administrator',
  owner: 'Owner',
};

// ============================================================================
// HOOK
// ============================================================================

export function usePermissionFlow({ recordId, onSuccess }: UsePermissionFlowOptions) {
  // Normalise to array once — everything below works with recordIds
  const recordIds = Array.isArray(recordId) ? recordId : [recordId];
  // For single-record operations (revoke, backwards-compat) keep the first ID handy
  const primaryRecordId = recordIds[0] ?? '';
  const isBatch = recordIds.length > 1;

  const [phase, setPhase] = useState<DialogPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [preparationProgress, setPreparationProgress] =
    useState<PermissionPreparationProgress | null>(null);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setPendingOperation(null);
    setPreparationProgress(null);
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
        const message = err instanceof Error ? err.message : 'Preparation failed';
        setError(message);
        setPhase('error');
      }
    },
    [recordIds, primaryRecordId, isBatch, getCurrentUserRole]
  );

  const confirmGrant = useCallback(
    async (roleOverride?: Role) => {
      if (!pendingOperation || pendingOperation.type !== 'grant') return;

      setPhase('executing');

      try {
        const role = roleOverride || pendingOperation.role;
        const { targetUserId } = pendingOperation;

        if (isBatch) {
          // Single blockchain tx for all records
          await PermissionsService.grantRoleBatch(
            recordIds,
            targetUserId,
            recordIds.map(() => role) // same role for all records in this flow
          );
        } else {
          // Single-record path: unchanged
          switch (role) {
            case 'viewer':
              await PermissionsService.grantViewer(primaryRecordId, targetUserId);
              break;
            case 'administrator':
              await PermissionsService.grantAdmin(primaryRecordId, targetUserId);
              break;
            case 'owner':
              await PermissionsService.grantOwner(primaryRecordId, targetUserId);
              break;
          }
        }

        toast.success(
          isBatch
            ? `${roleLabels[role]} access granted across ${recordIds.length} records`
            : `${roleLabels[role]} added successfully`
        );
        reset();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to grant access';
        setError(message);
        setPhase('error');
        toast.error(message);
      }
    },
    [pendingOperation, recordIds, primaryRecordId, isBatch, reset, onSuccess]
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
        const message = err instanceof Error ? err.message : 'Verification failed';
        setError(message);
        setPhase('error');
      }
    },
    [primaryRecordId]
  );

  /**
   * Execute a confirmed revoke
   * @param action - The revoke action to perform
   */
  const confirmRevoke = useCallback(
    async (action: RevokeAction) => {
      if (!pendingOperation || pendingOperation.type !== 'revoke') return;

      setPhase('executing');

      try {
        const { role, targetUserId } = pendingOperation;

        switch (role) {
          case 'viewer':
            await PermissionsService.removeViewer(primaryRecordId, targetUserId);
            break;
          case 'administrator':
            await PermissionsService.removeAdmin(primaryRecordId, targetUserId, {
              demoteToViewer: action === 'demote-viewer',
            });
            break;
          case 'owner':
            await PermissionsService.removeOwner(primaryRecordId, targetUserId, {
              demoteTo:
                action === 'demote-admin'
                  ? 'administrator'
                  : action === 'demote-viewer'
                    ? 'viewer'
                    : undefined,
            });
            break;
        }

        const successMessage =
          action === 'full-revoke'
            ? 'Access revoked successfully'
            : action === 'demote-admin'
              ? 'Demoted to Administrator'
              : 'Demoted to Viewer';

        toast.success(successMessage);
        reset();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update access';
        setError(message);
        setPhase('error');
        toast.error(message);
      }
    },
    [pendingOperation, primaryRecordId, reset, onSuccess]
  );

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Props to spread directly onto PermissionActionDialog
    dialogProps: {
      isOpen: phase !== 'idle',
      phase,
      preparationProgress,
      operationType: (pendingOperation?.type || 'grant') as OperationType,
      role: pendingOperation?.role || 'viewer',
      user: pendingOperation?.user || null,
      error,
      grantVariant: pendingOperation?.grantVariant || 'confirm',
      onClose: reset,
      onConfirmGrant: confirmGrant,
      onConfirmRevoke: confirmRevoke,
    },

    // Actions to initiate flows
    initiateGrant,
    initiateRevoke,

    // Convenience state
    isLoading: phase === 'preparing' || phase === 'executing',
    phase,
    error,
  };
}
