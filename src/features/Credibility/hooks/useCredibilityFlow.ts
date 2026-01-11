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
  getVerificationConfig,
  VerificationLevelOptions,
} from '../services/verificationService';
import {
  createDispute,
  retractDispute,
  modifyDispute,
  getDispute,
  type DisputeSeverity,
  type DisputeCulpability,
  type DisputeDocDecrypted,
  getSeverityConfig,
  getCulpabilityConfig,
  reactToDispute,
} from '../services/disputeService';
import { toast } from 'sonner';
import { DialogPhase } from '../components/ui/CredibilityActionDialog';

// ============================================================================
// TYPES
// ============================================================================

export type { CredibilityOperationType, VerificationLevelOptions };

export interface UseCredibilityFlowOptions {
  recordId: string;
  recordHash: string;
  onSuccess?: () => void;
}

interface PendingOperation {
  type: CredibilityOperationType;
  recordId: string;
  recordHash: string;
  disputerId?: string;
  // Verification-specific
  verificationLevel?: VerificationLevelOptions;
  // Dispute-specific
  disputeSeverity?: DisputeSeverity;
  disputeCulpability?: DisputeCulpability;
  disputeNotes?: string;
  reactionSupport?: boolean;
}

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
    async (level?: VerificationLevelOptions) => {
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
    async (level: VerificationLevelOptions) => {
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

        const levelInfo = getVerificationConfig(level);
        toast.success(`Record verified at ${levelInfo.name} level`);
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
  const initiateRetractVerification = useCallback(
    async (verificationRecordHash?: string) => {
      setPendingOperation({
        type: 'retractVerification',
        recordId,
        recordHash: verificationRecordHash || recordHash,
      });

      const ready = await runPreparation();
      if (ready) {
        setPhase('confirming');
      }
    },
    [recordId, recordHash, runPreparation]
  );

  /**
   * Execute a confirmed retraction
   */
  const confirmRetractVerification = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'retractVerification') return;

    const verificationRecordHash = pendingOperation.recordHash;

    if (!verificationRecordHash) {
      setError('Verification hash missing');
      setPhase('error');
      return;
    }

    const auth = getAuth();
    const verifierId = auth.currentUser?.uid;

    if (!verifierId) {
      setError('You must be signed in to retract verifications');
      setPhase('error');
      return;
    }

    setPhase('executing');

    try {
      await retractVerification(verificationRecordHash, verifierId);
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
  }, [pendingOperation, reset, refetchAll, onSuccess]);

  /**
   * Start a modify verification flow (Phase 1: Setup)
   */
  const initiateModifyVerification = useCallback(
    async (verificationRecordHash: string, newLevel: VerificationLevelOptions) => {
      // Stage the data for the confirmation dialog
      setPendingOperation({
        type: 'modifyVerification',
        recordId,
        recordHash: verificationRecordHash,
        verificationLevel: newLevel,
      });

      const auth = getAuth();
      if (!auth.currentUser?.uid) {
        setError('You must be signed in to modify verifications');
        setPhase('error');
        return;
      }

      // Run network/wallet preparation
      const ready = await runPreparation();
      if (ready) {
        // Transition to confirmation phase in the UI
        setPhase('confirming');
      }
    },
    [recordId, runPreparation]
  );

  /**
   * Execute the confirmed verification modification (Phase 2: Execution)
   */
  const confirmModifyVerification = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'modifyVerification') return;

    const { recordHash, verificationLevel } = pendingOperation;
    const auth = getAuth();
    const verifierId = auth.currentUser?.uid;

    if (!verifierId || !recordHash || verificationLevel === undefined) {
      setError('Missing required verification data');
      setPhase('error');
      return;
    }

    setPhase('executing');

    try {
      await modifyVerificationLevel(recordHash, verifierId, verificationLevel);

      const levelInfo = getVerificationConfig(verificationLevel);
      toast.success(`Verification updated to ${levelInfo.name} level`);

      setPhase('success');
      await refetchAll();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to modify verification';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, refetchAll, onSuccess]);

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

      const severityInfo = getSeverityConfig(pendingOperation.disputeSeverity);
      toast.success(`Dispute filed with ${severityInfo.name} severity`);
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
  const initiateRetractDispute = useCallback(
    async (disputeRecordHash?: string) => {
      setPendingOperation({
        type: 'retractDispute',
        recordId,
        recordHash: disputeRecordHash || recordHash,
      });

      const ready = await runPreparation();
      if (ready) {
        setPhase('confirming');
      }
    },
    [recordId, recordHash, runPreparation]
  );

  /**
   * Execute a confirmed dispute retraction
   */
  const confirmRetractDispute = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'retractDispute') return;

    const disputeRecordHash = pendingOperation.recordHash;

    if (!disputeRecordHash) {
      setError('Dispute hash missing');
      setPhase('error');
      return;
    }

    const auth = getAuth();
    const disputerId = auth.currentUser?.uid;

    if (!disputerId) {
      setError('You must be signed in to retract disputes');
      setPhase('error');
      return;
    }

    setPhase('executing');

    try {
      await retractDispute(disputeRecordHash, disputerId);
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
  }, [pendingOperation, reset, refetchAll, onSuccess]);

  /**
   * Start a modify dispute flow
   */
  const initiateModifyDispute = useCallback(
    async (
      disputeRecordHash: string,
      newSeverity?: DisputeSeverity,
      newCulpability?: DisputeCulpability
    ) => {
      // 1. Stage the data
      setPendingOperation({
        type: 'modifyDispute', // Updated type to match dialog logic
        recordId,
        recordHash: disputeRecordHash,
        disputeSeverity: newSeverity,
        disputeCulpability: newCulpability,
      });

      // 2. Auth check before starting prep
      const auth = getAuth();
      if (!auth.currentUser?.uid) {
        setError('You must be signed in to modify disputes');
        setPhase('error');
        return;
      }

      // 3. Run preparation (e.g., blockchain wallet setup)
      const ready = await runPreparation();
      if (ready) {
        // 4. Move to confirmation UI
        setPhase('confirming');
      }
    },
    [recordId, runPreparation]
  );

  /**
   * Execute a confirmed dispute modification (Phase 2)
   */
  const confirmModifyDispute = useCallback(async () => {
    // Guard: Ensure we have the right operation pending
    if (!pendingOperation || pendingOperation.type !== 'modifyDispute') return;

    const { recordHash, disputeSeverity, disputeCulpability } = pendingOperation;
    const auth = getAuth();
    const disputerId = auth.currentUser?.uid;

    // Validation
    if (!recordHash || !disputerId || !disputeSeverity || !disputeCulpability) {
      setError('Missing required dispute information');
      setPhase('error');
      return;
    }

    setPhase('executing');

    try {
      await modifyDispute(recordHash, disputerId, disputeSeverity, disputeCulpability);

      const severityInfo = getSeverityConfig(disputeSeverity);
      // Culpability is optional in some logic, handle accordingly
      const culpabilityInfo = disputeCulpability
        ? getCulpabilityConfig(disputeCulpability)
        : { name: 'unspecified' };

      toast.success(
        `Dispute updated to ${severityInfo.name} severity and ${culpabilityInfo.name} culpability`
      );

      setPhase('success');
      await refetchAll();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to modify dispute';
      setError(message);
      setPhase('error');
      toast.error(message);
    }
  }, [pendingOperation, refetchAll, onSuccess]);

  // ==========================================================================
  // REACT TO DISPUTE FLOW
  // ==========================================================================

  /**
   * Start a reaction flow (support or oppose a dispute)
   */
  const initiateReaction = useCallback(
    async (recordHash: string, disputerId: string, supports: boolean) => {
      setPendingOperation({
        type: 'reactToDispute',
        recordId,
        recordHash,
        disputerId,
        reactionSupport: supports,
      });

      const ready = await runPreparation();
      if (ready) {
        setPhase('confirming');
      }
    },
    [recordId, recordHash, runPreparation]
  );

  /**
   * Execute a confirmed reaction
   */
  const confirmReaction = useCallback(
    async (supports: boolean) => {
      const disputerId = pendingOperation?.disputerId;
      const disputeRecordHash = pendingOperation?.recordHash;

      if (
        !pendingOperation ||
        pendingOperation.type !== 'reactToDispute' ||
        !disputerId ||
        !disputeRecordHash
      ) {
        setError('Dispute information missing.');
        return;
      }

      const auth = getAuth();
      const reactorId = auth.currentUser?.uid;

      if (!reactorId) {
        setError('You must be signed in to react to disputes');
        setPhase('error');
        return;
      }

      setPhase('executing');

      try {
        await reactToDispute(recordId, disputeRecordHash, disputerId, reactorId, supports);
        toast.success(supports ? 'Supported dispute' : 'Opposed dispute');
        reset();
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit reaction';
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
      pendingReaction: pendingOperation?.reactionSupport,
      onClose: reset,
      onConfirmVerification: confirmVerification,
      onConfirmModifyVerification: confirmModifyVerification,
      onConfirmDispute: confirmDispute,
      onConfirmModifyDispute: confirmModifyDispute,
      onConfirmReaction: confirmReaction,
      onConfirmRetract:
        pendingOperation?.type === 'retractVerification'
          ? confirmRetractVerification
          : confirmRetractDispute,
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
