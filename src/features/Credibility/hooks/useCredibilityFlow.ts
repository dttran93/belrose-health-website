// src/features/Credibility/hooks/useCredibilityFlow.ts

import { useState, useCallback, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import {
  CredibilityPreparationService,
  type CredibilityOperationType,
  type CredibilityPreparationProgress,
} from '../services/credibilityPreparationService';
import {
  createVerification,
  retractVerification,
  modifyVerificationLevel,
  getVerification,
  type VerificationLevel,
  type VerificationDoc,
} from '../services/verificationService';
import { toast } from 'sonner';
import { DialogPhase } from '../component/ui/CredibilityActionDialog';

// ============================================================================
// TYPES
// ============================================================================

export type { CredibilityOperationType, VerificationLevel };

export interface UseCredibilityFlowOptions {
  recordId: string;
  recordHash: string;
  onSuccess?: () => void;
}

interface PendingOperation {
  type: CredibilityOperationType;
  recordId: string;
  recordHash: string;
  // Verification-specific
  verificationLevel?: VerificationLevel;
  // Dispute-specific
  disputeSeverity?: 1 | 2 | 3;
  disputeCulpability?: 1 | 2 | 3 | 4 | 5;
  disputeNotes?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LEVEL_LABELS: Record<VerificationLevel, string> = {
  1: 'Provenance',
  2: 'Content',
  3: 'Full',
};

const SEVERITY_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Negligible',
  2: 'Moderate',
  3: 'Major',
};

// ============================================================================
// HOOK
// ============================================================================

export function useCredibilityFlow({ recordId, recordHash, onSuccess }: UseCredibilityFlowOptions) {
  const [phase, setPhase] = useState<DialogPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [preparationProgress, setPreparationProgress] =
    useState<CredibilityPreparationProgress | null>(null);

  // Existing data state
  const [verification, setVerification] = useState<VerificationDoc | null>(null);
  const [isLoadingVerification, setIsLoadingVerification] = useState(true);
  // TODO: Add dispute state when disputeService is ready
  // const [dispute, setDispute] = useState<DisputeDoc | null>(null);
  // const [isLoadingDispute, setIsLoadingDispute] = useState(true);

  // ==========================================================================
  // FETCH EXISTING DATA
  // ==========================================================================

  const fetchVerification = useCallback(async () => {
    const auth = getAuth();
    const verifierId = auth.currentUser?.uid;

    if (!verifierId || !recordHash) {
      setVerification(null);
      setIsLoadingVerification(false);
      return;
    }

    setIsLoadingVerification(true);
    try {
      const existing = await getVerification(recordHash, verifierId);
      setVerification(existing);
    } catch (err) {
      console.error('Error fetching verification:', err);
      setVerification(null);
    } finally {
      setIsLoadingVerification(false);
    }
  }, [recordHash]);

  // Fetch on mount and when recordHash changes
  useEffect(() => {
    fetchVerification();
  }, [fetchVerification]);

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
  }, []);

  /**
   * Refetch all data after a successful operation
   */
  const refetchAll = useCallback(async () => {
    await fetchVerification();
    // TODO: await fetchDispute();
  }, [fetchVerification]);

  /**
   * Handle preparation with progress updates
   */
  const runPreparation = useCallback(async (): Promise<boolean> => {
    setPhase('preparing');
    setError(null);

    try {
      // First check if already ready
      const prereqs = await CredibilityPreparationService.verifyPrerequisites(recordId);

      if (prereqs.ready) {
        // Already ready, no preparation needed
        return true;
      }

      // Not ready - check why
      if (!prereqs.checks?.callerReady) {
        // Wallet not set up - prepare it
        await CredibilityPreparationService.prepare(progress => {
          setPreparationProgress(progress);
        });

        // Verify again after preparation
        const finalCheck = await CredibilityPreparationService.verifyPrerequisites(recordId);
        if (!finalCheck.ready) {
          // Still not ready after wallet setup - must be a different issue
          throw new Error(finalCheck.reason || 'Preparation failed');
        }

        // Wallet setup successful, we're ready!
        return true;
      } else {
        // Wallet is ready but failed for another reason (no role access, etc.)
        throw new Error(prereqs.reason || 'Prerequisites not met');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Preparation failed';
      setError(message);
      setPhase('error');
      return false;
    }
  }, [recordId]);

  // ==========================================================================
  // VERIFICATION FLOW
  // ==========================================================================

  /**
   * Start a verification flow
   * @param level - Optional pre-selected verification level. If not provided, dialog will show level picker.
   */
  const initiateVerification = useCallback(
    async (level?: VerificationLevel) => {
      setPendingOperation({
        type: 'verify',
        recordId,
        recordHash,
        verificationLevel: level,
      });

      const ready = await runPreparation();
      if (ready) {
        setPhase('confirming');
      }
    },
    [recordId, recordHash, runPreparation]
  );

  /**
   * Execute a confirmed verification
   * @param level - The verification level (passed from dialog, may differ from pendingOperation if user changed it)
   */
  const confirmVerification = useCallback(
    async (level: VerificationLevel) => {
      if (!pendingOperation || pendingOperation.type !== 'verify') {
        return;
      }

      const auth = getAuth();
      const verifierId = auth.currentUser?.uid;

      if (!verifierId) {
        setError('You must be signed in to verify records');
        setPhase('error');
        return;
      }

      setPhase('executing');

      try {
        await createVerification(recordId, recordHash, verifierId, level);

        toast.success(`Record verified at ${LEVEL_LABELS[level]} level`);
        reset();
        await refetchAll();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to verify record';
        setError(message);
        setPhase('error');
        toast.error(message);
      }
    },
    [pendingOperation, recordId, recordHash, reset, refetchAll, onSuccess]
  );

  /**
   * Start a retract verification flow
   */
  const initiateRetractVerification = useCallback(async () => {
    setPendingOperation({
      type: 'retract',
      recordId,
      recordHash,
    });

    const ready = await runPreparation();
    if (ready) {
      setPhase('confirming');
    }
  }, [recordId, recordHash, runPreparation]);

  /**
   * Execute a confirmed retraction
   */
  const confirmRetractVerification = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'retract') return;

    const auth = getAuth();
    const verifierId = auth.currentUser?.uid;

    if (!verifierId) {
      setError('You must be signed in to retract verifications');
      setPhase('error');
      return;
    }

    setPhase('executing');

    try {
      await retractVerification(recordHash, verifierId);
      toast.success('Verification retracted');
      reset();
      await refetchAll();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to retract verification';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, recordHash, reset, refetchAll, onSuccess]);

  /**
   * Start a modify verification flow
   * @param newLevel - The new verification level
   */
  const initiateModifyVerification = useCallback(
    async (newLevel: VerificationLevel) => {
      setPendingOperation({
        type: 'verify',
        recordId,
        recordHash,
        verificationLevel: newLevel,
      });

      // For modify, we go straight to executing (no confirmation needed)
      const auth = getAuth();
      const verifierId = auth.currentUser?.uid;

      if (!verifierId) {
        setError('You must be signed in to modify verifications');
        setPhase('error');
        return;
      }

      const ready = await runPreparation();
      if (!ready) return;

      setPhase('executing');

      try {
        await modifyVerificationLevel(recordHash, verifierId, newLevel);
        toast.success(`Verification updated to ${LEVEL_LABELS[newLevel]} level`);
        reset();
        await refetchAll();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to modify verification';
        setError(message);
        setPhase('error');
        toast.error(message);
      }
    },
    [recordId, recordHash, runPreparation, reset, refetchAll, onSuccess]
  );

  // ==========================================================================
  // DISPUTE FLOW
  // ==========================================================================

  /**
   * Start a dispute flow
   * @param severity - Dispute severity (1-3)
   * @param culpability - Dispute culpability (1-5)
   * @param notes - Optional notes
   */
  const initiateDispute = useCallback(
    async (severity: 1 | 2 | 3, culpability: 1 | 2 | 3 | 4 | 5, notes?: string) => {
      setPendingOperation({
        type: 'dispute',
        recordId,
        recordHash,
        disputeSeverity: severity,
        disputeCulpability: culpability,
        disputeNotes: notes,
      });

      const ready = await runPreparation();
      if (ready) {
        setPhase('confirming');
      }
    },
    [recordId, recordHash, runPreparation]
  );

  /**
   * Execute a confirmed dispute
   */
  const confirmDispute = useCallback(async () => {
    if (
      !pendingOperation ||
      pendingOperation.type !== 'dispute' ||
      !pendingOperation.disputeSeverity ||
      !pendingOperation.disputeCulpability
    ) {
      return;
    }

    const auth = getAuth();
    const disputerId = auth.currentUser?.uid;

    if (!disputerId) {
      setError('You must be signed in to file disputes');
      setPhase('error');
      return;
    }

    setPhase('executing');

    try {
      // TODO: Call disputeService.createDispute when implemented
      // await createDispute(
      //   recordId,
      //   recordHash,
      //   disputerId,
      //   pendingOperation.disputeSeverity,
      //   pendingOperation.disputeCulpability,
      //   pendingOperation.disputeNotes
      // );

      toast.success(
        `Dispute filed with ${SEVERITY_LABELS[pendingOperation.disputeSeverity]} severity`
      );
      reset();
      await refetchAll();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to file dispute';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, reset, refetchAll, onSuccess]);

  // ==========================================================================
  // REACT TO DISPUTE FLOW
  // ==========================================================================

  /**
   * Start a reaction flow (support or oppose a dispute)
   */
  const initiateReaction = useCallback(async () => {
    setPendingOperation({
      type: 'react',
      recordId,
      recordHash,
    });

    const ready = await runPreparation();
    if (ready) {
      setPhase('confirming');
    }
  }, [recordId, recordHash, runPreparation]);

  /**
   * Execute a confirmed reaction
   */
  const confirmReaction = useCallback(
    async (disputerIdHash: string, supportsDispute: boolean) => {
      if (!pendingOperation || pendingOperation.type !== 'react') return;

      setPhase('executing');

      try {
        // TODO: Call reactionService when implemented
        // await reactToDispute(recordHash, disputerIdHash, supportsDispute);

        toast.success(supportsDispute ? 'Supported dispute' : 'Opposed dispute');
        reset();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit reaction';
        setError(message);
        setPhase('error');
        toast.error(message);
      }
    },
    [pendingOperation, reset, onSuccess]
  );

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Dialog props to spread onto CredibilityActionDialog
    dialogProps: {
      isOpen: phase !== 'idle',
      phase,
      operationType: (pendingOperation?.type || 'verify') as CredibilityOperationType,
      error,
      preparationProgress,
      pendingLevel: pendingOperation?.verificationLevel,
      pendingSeverity: pendingOperation?.disputeSeverity,
      pendingCulpability: pendingOperation?.disputeCulpability,
      pendingNotes: pendingOperation?.disputeNotes,
      onClose: reset,
      onConfirmVerification: confirmVerification,
      onConfirmRetract: confirmRetractVerification,
      onConfirmDispute: confirmDispute,
      onConfirmReaction: confirmReaction,
    },

    // Existing data
    verification,
    isLoadingVerification,
    // TODO: dispute, isLoadingDispute

    // Verification actions
    initiateVerification,
    initiateRetractVerification,
    initiateModifyVerification,

    // Dispute actions
    initiateDispute,

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
