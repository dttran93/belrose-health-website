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
import { useOnChainActivityTray } from '@/features/OnChainActivityTray/OnChainActivityTrayContext';

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

  // OnChainActivityTray — UI display for blockchain processing in background
  const { addActivity, updateActivity } = useOnChainActivityTray();
  const [submittedLabel, setSubmittedLabel] = useState('');

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

      // Wallet is ready but something else failed (e.g., no role access)
      // This can't be fixed by prepare(), so fail now
      if (!prereqs.ready && prereqs.checks?.callerReady) {
        throw new Error(prereqs.reason || 'Prerequisites not met');
      }

      await CredibilityPreparationService.prepare(recordId, recordHash, progress => {
        setPreparationProgress(progress);
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Preparation failed';
      setError(message);
      setPhase('error');
      return false;
    }
  }, [recordId, recordHash]);

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
      if (ready) setPhase('confirming');
    },
    [recordId, recordHash, runPreparation]
  );

  /**
   * Execute a confirmed verification
   */
  const confirmVerification = useCallback(
    async (level: VerificationLevelOptions) => {
      if (!pendingOperation || pendingOperation.type !== 'verify') return;

      const auth = getAuth();
      const verifierId = auth.currentUser?.uid;

      if (!verifierId) {
        setError('You must be signed in to verify records');
        setPhase('error');
        return;
      }

      // Capture before dialog closes
      const levelInfo = getVerificationConfig(level);
      const activityId = addActivity({ label: 'Submitting verification' });

      // Fire tx — don't await
      const txPromise = createVerification(recordId, recordHash, verifierId, level);

      // Close dialog immediately
      setSubmittedLabel('Submitting verification');
      setPhase('submitted');

      // Resolve in background
      txPromise
        .then(async () => {
          updateActivity(activityId, { status: 'confirmed' });
          toast.success(`Record verified at ${levelInfo.name} level`);
          await refetchAll();
          onSuccess?.();
        })
        .catch(err => {
          const message = err instanceof Error ? err.message : 'Failed to verify record';
          updateActivity(activityId, { status: 'failed', errorMessage: message });
        });
    },
    [pendingOperation, recordId, recordHash, addActivity, updateActivity, refetchAll, onSuccess]
  );

  // ==========================================================================
  // RETRACT VERIFICATION FLOW
  // ==========================================================================

  const initiateRetractVerification = useCallback(
    async (verificationRecordHash?: string) => {
      setPendingOperation({
        type: 'retractVerification',
        recordId,
        recordHash: verificationRecordHash || recordHash,
      });

      const ready = await runPreparation();
      if (ready) setPhase('confirming');
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

    const activityId = addActivity({ label: 'Retracting verification' });

    // Fire tx — don't await
    const txPromise = retractVerification(verificationRecordHash, verifierId);

    // Close dialog immediately
    setSubmittedLabel('Retracting verification');
    setPhase('submitted');

    // Resolve in background
    txPromise
      .then(async () => {
        updateActivity(activityId, { status: 'confirmed' });
        toast.success('Verification retracted');
        await refetchAll();
        onSuccess?.();
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to retract verification';
        updateActivity(activityId, { status: 'failed', errorMessage: message });
      });
  }, [pendingOperation, addActivity, updateActivity, refetchAll, onSuccess]);

  // ==========================================================================
  // MODIFY VERIFICATION FLOW
  // ==========================================================================

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
      if (ready) setPhase('confirming');
    },
    [recordId, runPreparation]
  );

  /**
   * Execute the confirmed verification modification (Phase 2: Execution)
   */
  const confirmModifyVerification = useCallback(async () => {
    if (!pendingOperation || pendingOperation.type !== 'modifyVerification') return;

    const { recordHash: verificationRecordHash, verificationLevel } = pendingOperation;
    const auth = getAuth();
    const verifierId = auth.currentUser?.uid;

    if (!verifierId || !verificationRecordHash || verificationLevel === undefined) {
      setError('Missing required verification data');
      setPhase('error');
      return;
    }

    // Capture before dialog closes
    const levelInfo = getVerificationConfig(verificationLevel);
    const activityId = addActivity({ label: 'Updating verification' });

    // Fire tx — don't await
    const txPromise = modifyVerificationLevel(
      verificationRecordHash,
      verifierId,
      verificationLevel
    );

    // Close dialog immediately
    setSubmittedLabel('Updating verification');
    setPhase('submitted');

    // Resolve in background
    txPromise
      .then(async () => {
        updateActivity(activityId, { status: 'confirmed' });
        toast.success(`Verification updated to ${levelInfo.name} level`);
        await refetchAll();
        onSuccess?.();
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to modify verification';
        updateActivity(activityId, { status: 'failed', errorMessage: message });
      });
  }, [pendingOperation, addActivity, updateActivity, refetchAll, onSuccess]);

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
      if (ready) setPhase('confirming');
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

    // Capture before dialog closes
    const { disputeSeverity, disputeCulpability, disputeNotes } = pendingOperation;
    const severityInfo = getSeverityConfig(disputeSeverity);
    const activityId = addActivity({ label: 'Filing dispute' });

    // Fire tx — don't await
    const txPromise = createDispute(
      recordId,
      recordHash,
      disputerId,
      disputeSeverity,
      disputeCulpability,
      disputeNotes
    );

    // Close dialog immediately
    setSubmittedLabel('Filing dispute');
    setPhase('submitted');

    // Resolve in background
    txPromise
      .then(async () => {
        updateActivity(activityId, { status: 'confirmed' });
        toast.success(`Dispute filed with ${severityInfo.name} severity`);
        await refetchAll();
        onSuccess?.();
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to file dispute';
        updateActivity(activityId, { status: 'failed', errorMessage: message });
      });
  }, [pendingOperation, recordId, recordHash, addActivity, updateActivity, refetchAll, onSuccess]);

  // ==========================================================================
  // RETRACT DISPUTE FLOW
  // ==========================================================================

  const initiateRetractDispute = useCallback(
    async (disputeRecordHash?: string) => {
      setPendingOperation({
        type: 'retractDispute',
        recordId,
        recordHash: disputeRecordHash || recordHash,
      });

      const ready = await runPreparation();
      if (ready) setPhase('confirming');
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

    const activityId = addActivity({ label: 'Retracting dispute' });

    // Fire tx — don't await
    const txPromise = retractDispute(disputeRecordHash, disputerId);

    // Close dialog immediately
    setSubmittedLabel('Retracting dispute');
    setPhase('submitted');

    // Resolve in background
    txPromise
      .then(async () => {
        updateActivity(activityId, { status: 'confirmed' });
        toast.success('Dispute retracted');
        await refetchAll();
        onSuccess?.();
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to retract dispute';
        updateActivity(activityId, { status: 'failed', errorMessage: message });
      });
  }, [pendingOperation, addActivity, updateActivity, refetchAll, onSuccess]);

  // ==========================================================================
  // MODIFY DISPUTE FLOW
  // ==========================================================================

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
      if (ready) setPhase('confirming');
    },
    [recordId, runPreparation]
  );

  /**
   * Execute a confirmed dispute modification (Phase 2)
   */
  const confirmModifyDispute = useCallback(async () => {
    // Guard: Ensure we have the right operation pending
    if (!pendingOperation || pendingOperation.type !== 'modifyDispute') return;

    const { recordHash: disputeRecordHash, disputeSeverity, disputeCulpability } = pendingOperation;
    const auth = getAuth();
    const disputerId = auth.currentUser?.uid;

    if (!disputeRecordHash || !disputerId || !disputeSeverity || !disputeCulpability) {
      setError('Missing required dispute information');
      setPhase('error');
      return;
    }

    // Capture before dialog closes
    const severityInfo = getSeverityConfig(disputeSeverity);
    const culpabilityInfo = getCulpabilityConfig(disputeCulpability);
    const activityId = addActivity({ label: 'Updating dispute' });

    // Fire tx — don't await
    const txPromise = modifyDispute(
      disputeRecordHash,
      disputerId,
      disputeSeverity,
      disputeCulpability
    );

    // Close dialog immediately
    setSubmittedLabel('Updating dispute');
    setPhase('submitted');

    // Resolve in background
    txPromise
      .then(async () => {
        updateActivity(activityId, { status: 'confirmed' });
        toast.success(
          `Dispute updated to ${severityInfo.name} severity and ${culpabilityInfo.name} culpability`
        );
        await refetchAll();
        onSuccess?.();
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : 'Failed to modify dispute';
        updateActivity(activityId, { status: 'failed', errorMessage: message });
      });
  }, [pendingOperation, addActivity, updateActivity, refetchAll, onSuccess]);

  // ==========================================================================
  // REACT TO DISPUTE FLOW
  // ==========================================================================

  /**
   * Start a reaction flow (support or oppose a dispute)
   */
  const initiateReaction = useCallback(
    async (reactionRecordHash: string, disputerId: string, supports: boolean) => {
      setPendingOperation({
        type: 'reactToDispute',
        recordId,
        recordHash: reactionRecordHash,
        disputerId,
        reactionSupport: supports,
      });

      const ready = await runPreparation();
      if (ready) setPhase('confirming');
    },
    [recordId, runPreparation]
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

      const label = supports ? 'Supporting dispute' : 'Opposing dispute';
      const activityId = addActivity({ label });

      // Fire tx — don't await
      const txPromise = reactToDispute(
        recordId,
        disputeRecordHash,
        disputerId,
        reactorId,
        supports
      );

      // Close dialog immediately
      setSubmittedLabel('Submitting reaction');
      setPhase('submitted');

      // Resolve in background
      txPromise
        .then(() => {
          updateActivity(activityId, { status: 'confirmed' });
          toast.success(supports ? 'Supported dispute' : 'Opposed dispute');
          onSuccess?.();
        })
        .catch(err => {
          const message = err instanceof Error ? err.message : 'Failed to submit reaction';
          updateActivity(activityId, { status: 'failed', errorMessage: message });
        });
    },
    [pendingOperation, recordId, addActivity, updateActivity, onSuccess]
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
      submittedLabel,
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
    isLoading: phase === 'preparing',
    isDialogOpen: phase !== 'idle',
    phase,
    error,
    reset,
  };
}
