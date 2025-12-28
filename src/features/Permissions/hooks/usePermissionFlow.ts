// src/features/Permissions/hooks/usePermissionFlow.ts

import { useState, useCallback } from 'react';
import { PreparationService, InitialRole } from '../services/preparationService';
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
  recordId: string;
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
  const [phase, setPhase] = useState<DialogPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Reset to idle state
   */
  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setPendingOperation(null);
  }, []);

  /**
   * Get current user's role on the record (for initialization)
   */
  const getCurrentUserRole = useCallback(async (): Promise<InitialRole> => {
    try {
      const roles = await PermissionsService.getRecordRoles(recordId);
      const auth = getAuth();
      const userId = auth.currentUser?.uid;

      if (roles && userId && roles.owners.includes(userId)) {
        return 'owner';
      }
    } catch (err) {
      console.error('Error getting current user role:', err);
    }
    return 'administrator';
  }, [recordId]);

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
        // Check if prerequisites are already met
        const prereqs = await PreparationService.verifyPermissionPrerequisites(
          recordId,
          walletAddress
        );

        if (!prereqs.ready) {
          // Need to prepare - get caller's role for initialization
          const initialRole = await getCurrentUserRole();
          await PreparationService.prepare(recordId, initialRole);

          // Verify preparation succeeded
          const finalCheck = await PreparationService.verifyPermissionPrerequisites(
            recordId,
            walletAddress
          );

          if (!finalCheck.ready) {
            throw new Error(finalCheck.reason || 'Preparation failed');
          }
        }

        // Ready for confirmation
        setPhase('confirming');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Preparation failed';
        setError(message);
        setPhase('error');
      }
    },
    [recordId, getCurrentUserRole]
  );

  /**
   * Execute a confirmed grant
   * @param roleOverride - If provided, use this role instead of pendingOperation.role
   */
  const confirmGrant = useCallback(
    async (roleOverride?: Role) => {
      if (!pendingOperation || pendingOperation.type !== 'grant') return;

      setPhase('executing');

      try {
        const role = roleOverride || pendingOperation.role;
        const { targetUserId } = pendingOperation;

        switch (role) {
          case 'viewer':
            await PermissionsService.grantViewer(recordId, targetUserId);
            break;
          case 'administrator':
            await PermissionsService.grantAdmin(recordId, targetUserId);
            break;
          case 'owner':
            await PermissionsService.grantOwner(recordId, targetUserId);
            break;
        }

        toast.success(`${roleLabels[role]} added successfully`);
        reset();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to grant access';
        setError(message);
        setPhase('error');
        toast.error(message);
      }
    },
    [pendingOperation, recordId, reset, onSuccess]
  );

  // ==========================================================================
  // REVOKE FLOW
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
        const prereqs = await PreparationService.verifyPermissionPrerequisites(
          recordId,
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
    [recordId]
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
            await PermissionsService.removeViewer(recordId, targetUserId);
            break;

          case 'administrator':
            await PermissionsService.removeAdmin(recordId, targetUserId, {
              demoteToViewer: action === 'demote-viewer',
            });
            break;

          case 'owner':
            await PermissionsService.removeOwner(recordId, targetUserId, {
              demoteTo:
                action === 'demote-admin'
                  ? 'administrator'
                  : action === 'demote-viewer'
                    ? 'viewer'
                    : undefined,
            });
            break;
        }

        // Success message based on action
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
    [pendingOperation, recordId, reset, onSuccess]
  );

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Props to spread directly onto PermissionActionDialog
    dialogProps: {
      isOpen: phase !== 'idle',
      phase,
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
