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
import {
  createDispute,
  retractDispute,
  modifyDispute,
  getDispute,
  type DisputeSeverity,
  type DisputeCulpability,
  type DisputeDocDecrypted,
  SEVERITY_MAPPING,
  CULPABILITY_MAPPING,
} from '../services/disputeService';
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
  disputeSeverity?: DisputeSeverity;
  disputeCulpability?: DisputeCulpability;
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
  const [dispute, setDispute] = useState<DisputeDocDecrypted | null>(null);
  const [isLoadingDispute, setIsLoadingDispute] = useState(true);

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
      console.debug('Error fetching verification:', err);
      setVerification(null);
    } finally {
      setIsLoadingVerification(false);
    }
  }, [recordHash]);

  const fetchDispute = useCallback(async () => {
    const auth = getAuth();
    const disputerId = auth.currentUser?.uid;

    if (!disputerId || !recordHash) {
      setDispute(null);
      setIsLoadingDispute(false);
      return;
    }

    setIsLoadingDispute(true);
    try {
      const existing = await getDispute(recordHash, disputerId);
      setDispute(existing);
    } catch (err) {
      console.debug('Error fetching dispute:', err);
      setDispute(null);
    } finally {
      setIsLoadingDispute(false);
    }
  }, [recordHash]);

  // Fetch on mount and when recordHash changes
  useEffect(() => {
    fetchVerification();
    fetchDispute();
  }, [fetchVerification, fetchDispute]);

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
    await Promise.all([fetchVerification(), fetchDispute()]);
  }, [fetchVerification, fetchDispute]);

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
   * @param level - Optional pre-selected verification level
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
      type: 'retractDispute',
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
    if (!pendingOperation || pendingOperation.type !== 'retractVerification') return;

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
   */
  const initiateModifyVerification = useCallback(
    async (newLevel: VerificationLevel) => {
      setPendingOperation({
        type: 'verify',
        recordId,
        recordHash,
        verificationLevel: newLevel,
      });

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
   * @param culpability - Dispute culpability (0-5)
   * @param notes - Optional notes
   */
  const initiateDispute = useCallback(
    async (severity: DisputeSeverity, culpability: DisputeCulpability, notes?: string) => {
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
      await createDispute(
        recordId,
        recordHash,
        disputerId,
        pendingOperation.disputeSeverity,
        pendingOperation.disputeCulpability,
        pendingOperation.disputeNotes
      );

      const severityLabel = SEVERITY_MAPPING[pendingOperation.disputeSeverity];
      toast.success(`Dispute filed with ${severityLabel} severity`);
      reset();
      await refetchAll();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to file dispute';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, recordId, recordHash, reset, refetchAll, onSuccess]);

  /**
   * Start a retract dispute flow
   */
  const initiateRetractDispute = useCallback(async () => {
    setPendingOperation({
      type: 'retractDispute',
      recordId,
      recordHash,
    });

    const ready = await runPreparation();
    if (ready) {
      setPhase('confirming');
    }
  }, [recordId, recordHash, runPreparation]);

  /**
   * Execute a confirmed dispute retraction
   */
  const confirmRetractDispute = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'retractDispute') return;

    const auth = getAuth();
    const disputerId = auth.currentUser?.uid;

    if (!disputerId) {
      setError('You must be signed in to retract disputes');
      setPhase('error');
      return;
    }

    setPhase('executing');

    try {
      await retractDispute(recordHash, disputerId);
      toast.success('Dispute retracted');
      reset();
      await refetchAll();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to retract dispute';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, recordHash, reset, refetchAll, onSuccess]);

  /**
   * Start a modify dispute flow
   */
  const initiateModifyDispute = useCallback(
    async (newSeverity: DisputeSeverity, newCulpability: DisputeCulpability) => {
      setPendingOperation({
        type: 'dispute',
        recordId,
        recordHash,
        disputeSeverity: newSeverity,
        disputeCulpability: newCulpability,
      });

      const auth = getAuth();
      const disputerId = auth.currentUser?.uid;

      if (!disputerId) {
        setError('You must be signed in to modify disputes');
        setPhase('error');
        return;
      }

      const ready = await runPreparation();
      if (!ready) return;

      setPhase('executing');

      try {
        await modifyDispute(recordHash, disputerId, newSeverity, newCulpability);
        const severityLabel = SEVERITY_MAPPING[newSeverity];
        const culpabilityLabel = CULPABILITY_MAPPING[newCulpability];
        toast.success(`Dispute updated to ${severityLabel} severity, ${culpabilityLabel}`);
        reset();
        await refetchAll();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to modify dispute';
        setError(message);
        setPhase('error');
        toast.error(message);
      }
    },
    [recordId, recordHash, runPreparation, reset, refetchAll, onSuccess]
  );

  // ==========================================================================
  // REACT TO DISPUTE FLOW
  // ==========================================================================

  /**
   * Start a reaction flow (support or oppose a dispute)
   */
  const initiateReaction = useCallback(async () => {
    setPendingOperation({
      type: 'reactToDispute',
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
      if (!pendingOperation || pendingOperation.type !== 'reactToDispute') return;

      setPhase('executing');

      try {
        // TODO: Call reactToDispute from disputeService when ready
        // await reactToDispute(recordHash, disputerIdHash, reactorId, supportsDispute);

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
      onConfirmRetractDispute: confirmRetractDispute,
      onConfirmReaction: confirmReaction,
    },

    // Existing data
    verification,
    isLoadingVerification,
    dispute,
    isLoadingDispute,

    // Verification actions
    initiateVerification,
    initiateRetractVerification,
    initiateModifyVerification,

    // Dispute actions
    initiateDispute,
    initiateRetractDispute,
    initiateModifyDispute,

    // Reaction actions
    initiateReaction,

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
