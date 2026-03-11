// src/features/Trustee/hooks/useTrusteeFlow.ts

// Manages all trustee operation flows with a unified dialog:
// - invite: trustor invites a user (user pre-selected outside modal)
// - accept: trustee accepts an incoming invite
// - decline: trustee declines an incoming invite (no blockchain)
// - revoke: trustor revokes an active trustee
// - editLevel: trustor changes a trustee's trust level
// - resign: trustee resigns from an active relationship
//
// Phases:
// - idle: no dialog open
// - preparing: checking both wallets on-chain
// - confirming: user reviews and confirms
// - executing: blockchain tx + firestore in progress
// - error: something went wrong

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { BelroseUserProfile } from '@/types/core';
import {
  TrusteeRelationshipService,
  TrustLevel,
} from '@/features/Trustee/services/trusteeRelationshipService';
import { getUserProfile } from '@/features/Users/services/userProfileService';

// ============================================================================
// TYPES
// ============================================================================

export type TrusteeOperationType =
  | 'invite'
  | 'accept'
  | 'decline'
  | 'revoke'
  | 'editLevel'
  | 'resign';

export type TrusteeDialogPhase = 'idle' | 'preparing' | 'confirming' | 'executing' | 'error';

export interface UseTrusteeFlowOptions {
  onSuccess?: () => void;
}

interface PendingOperation {
  type: TrusteeOperationType;
  // The other party in the relationship
  targetUserId: string;
  targetUserProfile?: BelroseUserProfile;
  // Trust level context
  trustLevel?: TrustLevel; // current level (for revoke/resign/accept)
  newTrustLevel?: TrustLevel; // new level (for invite/editLevel)
}

// ============================================================================
// PREPARATION
// Checks both parties have active wallets before any blockchain operation
// ============================================================================

async function checkBothWalletsReady(
  currentUserId: string,
  targetUserId: string
): Promise<{ ready: boolean; reason?: string }> {
  const [currentProfile, targetProfile] = await Promise.all([
    getUserProfile(currentUserId),
    getUserProfile(targetUserId),
  ]);

  if (!currentProfile?.onChainIdentity?.linkedWallets?.some(w => w.isWalletActive)) {
    return { ready: false, reason: 'You do not have an active blockchain wallet.' };
  }

  if (!targetProfile?.onChainIdentity?.linkedWallets?.some(w => w.isWalletActive)) {
    return {
      ready: false,
      reason: 'The other user does not have an active blockchain wallet.',
    };
  }

  return { ready: true };
}

async function checkCurrentUserWalletReady(
  currentUserId: string
): Promise<{ ready: boolean; reason?: string }> {
  const profile = await getUserProfile(currentUserId);

  if (!profile?.onChainIdentity?.linkedWallets?.some(w => w.isWalletActive)) {
    return { ready: false, reason: 'You do not have an active blockchain wallet.' };
  }

  return { ready: true };
}

// ============================================================================
// HOOK
// ============================================================================

export function useTrusteeFlow({ onSuccess }: UseTrusteeFlowOptions = {}) {
  const [phase, setPhase] = useState<TrusteeDialogPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);

  // Selected trust level (for invite and editLevel confirming phase)
  const [selectedTrustLevel, setSelectedTrustLevel] = useState<TrustLevel>('observer');

  // ── Helpers ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setPendingOperation(null);
    setSelectedTrustLevel('observer');
  }, []);

  const requireCurrentUser = () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('You must be signed in');
    return user.uid;
  };

  // ── Shared preparation runner ──────────────────────────────────────────────

  const runPreparation = useCallback(
    async (currentUserId: string, targetUserId: string, checkBoth: boolean): Promise<boolean> => {
      setPhase('preparing');
      setError(null);

      try {
        const result = checkBoth
          ? await checkBothWalletsReady(currentUserId, targetUserId)
          : await checkCurrentUserWalletReady(currentUserId);

        if (!result.ready) {
          setError(result.reason || 'Wallet not ready');
          setPhase('error');
          return false;
        }

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Preparation failed';
        setError(message);
        setPhase('error');
        return false;
      }
    },
    []
  );

  // ==========================================================================
  // INVITE FLOW
  // ==========================================================================

  /**
   * Initiate an invite. Called after user has been selected externally.
   * Runs preparation (both wallets), then goes to confirming.
   */
  const initiateInvite = useCallback(
    async (targetUser: BelroseUserProfile) => {
      const currentUserId = requireCurrentUser();

      setPendingOperation({
        type: 'invite',
        targetUserId: targetUser.uid,
        targetUserProfile: targetUser,
      });
      setSelectedTrustLevel('observer');

      const ready = await runPreparation(currentUserId, targetUser.uid, true);
      if (ready) setPhase('confirming');
    },
    [runPreparation]
  );

  const confirmInvite = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'invite') return;

    setPhase('executing');

    try {
      await TrusteeRelationshipService.inviteTrustee(
        pendingOperation.targetUserId,
        selectedTrustLevel
      );

      toast.success('Trustee invite sent');
      reset();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send invite';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, selectedTrustLevel, reset, onSuccess]);

  // ==========================================================================
  // ACCEPT FLOW
  // ==========================================================================

  /**
   * Initiate accept. Runs preparation (both wallets), then goes to confirming.
   */
  const initiateAccept = useCallback(
    async (trustorId: string, trustorProfile: BelroseUserProfile, trustLevel: TrustLevel) => {
      const currentUserId = requireCurrentUser();

      setPendingOperation({
        type: 'accept',
        targetUserId: trustorId,
        targetUserProfile: trustorProfile,
        trustLevel,
      });

      const ready = await runPreparation(currentUserId, trustorId, true);
      if (ready) setPhase('confirming');
    },
    [runPreparation]
  );

  const confirmAccept = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'accept') return;

    setPhase('executing');

    try {
      await TrusteeRelationshipService.acceptInvite(pendingOperation.targetUserId);

      toast.success('Trustee invite accepted');
      reset();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept invite';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, reset, onSuccess]);

  // ==========================================================================
  // DECLINE FLOW (no blockchain)
  // ==========================================================================

  /**
   * Initiate decline. No preparation needed — goes straight to confirming.
   */
  const initiateDecline = useCallback(
    (trustorId: string, trustorProfile: BelroseUserProfile, trustLevel: TrustLevel) => {
      setPendingOperation({
        type: 'decline',
        targetUserId: trustorId,
        targetUserProfile: trustorProfile,
        trustLevel,
      });
      setPhase('confirming');
    },
    []
  );

  const confirmDecline = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'decline') return;

    setPhase('executing');

    try {
      await TrusteeRelationshipService.declineInvite(pendingOperation.targetUserId);

      toast.success('Invite declined');
      reset();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to decline invite';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, reset, onSuccess]);

  // ==========================================================================
  // REVOKE FLOW
  // ==========================================================================

  /**
   * Initiate revoke. Runs preparation (current user wallet only), then confirming.
   */
  const initiateRevoke = useCallback(
    async (trusteeId: string, trusteeProfile: BelroseUserProfile, trustLevel: TrustLevel) => {
      const currentUserId = requireCurrentUser();

      setPendingOperation({
        type: 'revoke',
        targetUserId: trusteeId,
        targetUserProfile: trusteeProfile,
        trustLevel,
      });

      const ready = await runPreparation(currentUserId, trusteeId, false);
      if (ready) setPhase('confirming');
    },
    [runPreparation]
  );

  const confirmRevoke = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'revoke') return;

    setPhase('executing');

    try {
      await TrusteeRelationshipService.revokeTrustee(pendingOperation.targetUserId);

      toast.success('Trustee revoked');
      reset();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke trustee';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, reset, onSuccess]);

  // ==========================================================================
  // EDIT LEVEL FLOW
  // ==========================================================================

  /**
   * Initiate edit level. Runs preparation (current user wallet only), then confirming.
   */
  const initiateEditLevel = useCallback(
    async (trusteeId: string, trusteeProfile: BelroseUserProfile, currentLevel: TrustLevel) => {
      const currentUserId = requireCurrentUser();

      setPendingOperation({
        type: 'editLevel',
        targetUserId: trusteeId,
        targetUserProfile: trusteeProfile,
        trustLevel: currentLevel,
      });
      setSelectedTrustLevel(currentLevel);

      const ready = await runPreparation(currentUserId, trusteeId, false);
      if (ready) setPhase('confirming');
    },
    [runPreparation]
  );

  const confirmEditLevel = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'editLevel') return;

    setPhase('executing');

    try {
      await TrusteeRelationshipService.editTrusteeRelationship(
        pendingOperation.targetUserId,
        selectedTrustLevel
      );

      toast.success('Trust level updated');
      reset();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update trust level';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, selectedTrustLevel, reset, onSuccess]);

  // ==========================================================================
  // RESIGN FLOW
  // ==========================================================================

  /**
   * Initiate resign. Runs preparation (current user wallet only), then confirming.
   */
  const initiateResign = useCallback(
    async (trustorId: string, trustorProfile: BelroseUserProfile, trustLevel: TrustLevel) => {
      const currentUserId = requireCurrentUser();

      setPendingOperation({
        type: 'resign',
        targetUserId: trustorId,
        targetUserProfile: trustorProfile,
        trustLevel,
      });

      const ready = await runPreparation(currentUserId, trustorId, false);
      if (ready) setPhase('confirming');
    },
    [runPreparation]
  );

  const confirmResign = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'resign') return;

    setPhase('executing');

    try {
      await TrusteeRelationshipService.resignAsTrustee(pendingOperation.targetUserId);

      toast.success('You have resigned as trustee');
      reset();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resign';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, reset, onSuccess]);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Dialog props — spread directly onto TrusteeActionDialog
    dialogProps: {
      isOpen: phase !== 'idle',
      phase,
      operationType: pendingOperation?.type ?? ('invite' as TrusteeOperationType),
      error,
      targetUser: pendingOperation?.targetUserProfile ?? null,
      trustLevel: pendingOperation?.trustLevel,
      selectedTrustLevel,
      setSelectedTrustLevel,
      onClose: reset,
      onConfirmInvite: confirmInvite,
      onConfirmAccept: confirmAccept,
      onConfirmDecline: confirmDecline,
      onConfirmRevoke: confirmRevoke,
      onConfirmEditLevel: confirmEditLevel,
      onConfirmResign: confirmResign,
    },

    // Initiators — call these from tab components
    initiateInvite,
    initiateAccept,
    initiateDecline,
    initiateRevoke,
    initiateEditLevel,
    initiateResign,

    // Convenience
    isLoading: phase === 'preparing' || phase === 'executing',
    isDialogOpen: phase !== 'idle',
    phase,
    reset,
  };
}
