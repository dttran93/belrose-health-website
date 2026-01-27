// src/features/Credibility/components/ui/CredibilityActionDialog.tsx

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  FileX,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import type {
  CredibilityOperationType,
  CredibilityPreparationProgress,
} from '@/features/Credibility/services/credibilityPreparationService';
import {
  VerificationLevel,
  VERIFICATION_OPTIONS,
  getVerificationConfig,
  VerificationLevelOptions,
} from '../../services/verificationService';
import {
  DisputeCulpability,
  DisputeSeverity,
  getSeverityConfig,
  getCulpabilityConfig,
} from '../../services/disputeService';

// ============================================================================
// TYPES
// ============================================================================

export type DialogPhase = 'idle' | 'preparing' | 'confirming' | 'executing' | 'success' | 'error';

interface CredibilityActionDialogProps {
  isOpen: boolean;
  phase: DialogPhase;
  operationType: CredibilityOperationType;
  error?: string | null;
  preparationProgress?: CredibilityPreparationProgress | null;
  // Pre-selected values from the form (if any)
  pendingLevel?: VerificationLevelOptions;
  pendingSeverity?: DisputeSeverity;
  pendingCulpability?: DisputeCulpability;
  pendingNotes?: string;
  pendingReaction?: boolean;
  onClose: () => void;
  onConfirmVerification: (level: VerificationLevelOptions) => void;
  onConfirmModifyVerification: (level: VerificationLevelOptions) => void;
  onConfirmRetract: () => void;
  onConfirmDispute: () => void;
  onConfirmReaction: (supports: boolean) => void;
  onConfirmModifyDispute: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const CredibilityActionDialog: React.FC<CredibilityActionDialogProps> = ({
  isOpen,
  phase,
  operationType,
  error,
  preparationProgress,
  pendingLevel,
  pendingSeverity,
  pendingCulpability,
  pendingNotes,
  pendingReaction,
  onClose,
  onConfirmVerification,
  onConfirmModifyVerification,
  onConfirmRetract,
  onConfirmDispute,
  onConfirmReaction,
  onConfirmModifyDispute,
}) => {
  if (!isOpen) return null;

  const canClose = phase === 'confirming' || phase === 'error' || phase === 'success';

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && canClose && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 shadow-2xl z-[101] w-full max-w-md max-h-[90vh] overflow-y-auto">
          {/* Preparing Phase */}
          {phase === 'preparing' && <PreparingContent progress={preparationProgress} />}

          {/* Executing Phase */}
          {phase === 'executing' && <ExecutingContent operationType={operationType} />}

          {/* Error Phase */}
          {phase === 'error' && <ErrorContent error={error} onClose={onClose} />}

          {/* Success Phase */}
          {phase === 'success' && (
            <SuccessContent operationType={operationType} onClose={onClose} />
          )}

          {/* Confirming Phase - Verification - Creation or Modification */}
          {phase === 'confirming' &&
            (operationType === 'verify' || operationType === 'modifyVerification') && (
              <ConfirmVerificationContent
                level={pendingLevel}
                isModify={operationType === 'modifyVerification'}
                onConfirm={
                  operationType === 'modifyVerification'
                    ? onConfirmModifyVerification
                    : onConfirmVerification
                }
                onClose={onClose}
              />
            )}

          {/* Confirming Phase - Retract Verification */}
          {phase === 'confirming' && operationType === 'retractVerification' && (
            <ConfirmRetractContent
              title="Retract Verification"
              description="Are you sure you want to retract your verification of this record?"
              warning="Retracting your verification will remove your endorsement from this record. This action is recorded on the blockchain."
              onConfirm={onConfirmRetract}
              onClose={onClose}
            />
          )}

          {/* Confirming Phase - Retract Dispute */}
          {phase === 'confirming' && operationType === 'retractDispute' && (
            <ConfirmRetractContent
              title="Retract Dispute"
              description="Are you sure you want to retract your dispute of this record?"
              warning="Retracting your dispute will remove your complaint from this record. This action is recorded on the blockchain."
              onConfirm={onConfirmRetract}
              onClose={onClose}
            />
          )}

          {/* Confirming Phase - Dispute (New or Modify) */}
          {phase === 'confirming' &&
            (operationType === 'dispute' || operationType === 'modifyDispute') &&
            pendingSeverity !== undefined &&
            pendingCulpability !== undefined && (
              <ConfirmDisputeContent
                severity={pendingSeverity}
                culpability={pendingCulpability}
                notes={pendingNotes}
                isModify={operationType === 'modifyDispute'}
                onConfirm={
                  operationType === 'modifyDispute' ? onConfirmModifyDispute : onConfirmDispute
                }
                onClose={onClose}
              />
            )}

          {/* Confirming Phase - React */}
          {phase === 'confirming' &&
            operationType === 'reactToDispute' &&
            pendingReaction !== undefined && (
              <ConfirmReactionContent
                onConfirm={onConfirmReaction}
                pendingReaction={pendingReaction}
                onClose={onClose}
              />
            )}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

// ============================================================================
// PHASE CONTENT COMPONENTS
// ============================================================================

const PreparingContent: React.FC<{ progress?: CredibilityPreparationProgress | null }> = ({
  progress,
}) => (
  <div className="flex flex-col items-center gap-4 py-4">
    <Loader2 className="w-10 h-10 text-chart-3 animate-spin" />
    <AlertDialog.Title className="text-lg font-bold text-center">
      Preparing Secure Network
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      {progress?.message || 'Setting up your network account...'}
    </AlertDialog.Description>

    {/* Progress Steps */}
    <div className="w-full mt-2 space-y-2">
      <ProgressStep
        label="Computing wallet address"
        status={
          progress?.step === 'computing'
            ? 'active'
            : progress?.step && ['saving', 'registering', 'complete'].includes(progress.step)
              ? 'complete'
              : 'pending'
        }
      />
      <ProgressStep
        label="Saving to profile"
        status={
          progress?.step === 'saving'
            ? 'active'
            : progress?.step && ['registering', 'complete'].includes(progress.step)
              ? 'complete'
              : 'pending'
        }
      />
      <ProgressStep
        label="Registering on blockchain"
        status={
          progress?.step === 'registering'
            ? 'active'
            : progress?.step === 'complete'
              ? 'complete'
              : 'pending'
        }
      />
    </div>
  </div>
);

const ProgressStep: React.FC<{
  label: string;
  status: 'pending' | 'active' | 'complete';
}> = ({ label, status }) => (
  <div className="flex items-center gap-3">
    {status === 'complete' && <CheckCircle2 className="w-5 h-5 text-chart-3" />}
    {status === 'active' && <Loader2 className="w-5 h-5 text-chart-3 animate-spin" />}
    {status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-gray-300" />}
    <span
      className={`text-sm ${status === 'complete' ? 'text-chart-3' : status === 'active' ? 'text-chart-3' : 'text-gray-400'}`}
    >
      {label}
    </span>
  </div>
);

const ExecutingContent: React.FC<{ operationType: CredibilityOperationType }> = ({
  operationType,
}) => {
  const messages: Record<CredibilityOperationType, { title: string; description: string }> = {
    verify: {
      title: 'Submitting Verification',
      description: 'Recording your verification on the record...',
    },
    dispute: {
      title: 'Filing Dispute',
      description: 'Recording your dispute on the record...',
    },
    retractVerification: {
      title: 'Retracting Verification',
      description: 'Removing your verification from the record...',
    },
    retractDispute: {
      title: 'Retracting Dispute',
      description: 'Removing your dispute from the record...',
    },
    modifyVerification: {
      title: 'Modifying Verification',
      description: 'Updating your verification on the record...',
    },
    modifyDispute: {
      title: 'Modifying Dispute',
      description: 'Updating your dispute on the record...',
    },
    reactToDispute: {
      title: 'Submitting Reaction',
      description: 'Recording your reaction on the record...',
    },
  };

  const { title, description } = messages[operationType] || {
    title: 'Processing',
    description: 'Please wait...',
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <Loader2 className="w-10 h-10 text-chart-3 animate-spin" />
      <AlertDialog.Title className="text-lg font-bold text-center">{title}</AlertDialog.Title>
      <AlertDialog.Description className="text-sm text-gray-600 text-center">
        {description}
      </AlertDialog.Description>
    </div>
  );
};

const ErrorContent: React.FC<{ error?: string | null; onClose: () => void }> = ({
  error,
  onClose,
}) => (
  <div className="flex flex-col items-center gap-4 py-4">
    <XCircle className="w-10 h-10 text-red-500" />
    <AlertDialog.Title className="text-lg font-bold text-center text-red-700">
      Something Went Wrong
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      {error || 'An unexpected error occurred. Please try again.'}
    </AlertDialog.Description>
    <Button onClick={onClose} variant="outline" className="mt-2">
      Close
    </Button>
  </div>
);

const SuccessContent: React.FC<{
  operationType: CredibilityOperationType;
  onClose: () => void;
}> = ({ operationType, onClose }) => {
  const messages: Record<CredibilityOperationType, string> = {
    verify: 'Verification submitted successfully!',
    dispute: 'Dispute filed successfully!',
    retractVerification: 'Verification retracted successfully!',
    retractDispute: 'Dispute retracted successfully!',
    modifyVerification: 'Verification modified successfully!',
    modifyDispute: 'Dispute modified successfully!',
    reactToDispute: 'Reaction submitted successfully!',
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <CheckCircle2 className="w-10 h-10 text-chart-3" />
      <AlertDialog.Title className="text-lg font-bold text-center text-chart-3">
        Success
      </AlertDialog.Title>
      <AlertDialog.Description className="text-sm text-gray-600 text-center">
        {messages[operationType] || 'Operation completed successfully!'}
      </AlertDialog.Description>
      <Button onClick={onClose} className="mt-2 bg-chart-3 hover:bg-chart-3/90">
        Done
      </Button>
    </div>
  );
};

// ============================================================================
// CONFIRM VERIFICATION CONTENT
// ============================================================================

const ConfirmVerificationContent: React.FC<{
  level?: VerificationLevelOptions;
  isModify?: boolean;
  onConfirm: (level: VerificationLevelOptions) => void;
  onClose: () => void;
}> = ({ level, isModify, onConfirm, onClose }) => {
  const config = getVerificationConfig(level || 1);
  const Icon = config.icon;

  return (
    <>
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-chart-3" />
        {isModify ? 'Modify Verification' : 'Confirm Verification'}
      </AlertDialog.Title>

      <AlertDialog.Description className="mt-3 text-sm text-gray-600">
        Review your selection before it is recorded to the secure network.
      </AlertDialog.Description>

      {/* Confirm Card */}
      <div className="my-2 p-4 border rounded-lg bg-chart-3/5 border-chart-3/20 flex items-start gap-3">
        <Icon className="w-6 h-6 text-chart-3 mt-1" />
        <div>
          <p className="font-bold text-gray-900">{config.name} Level</p>
          <p className="text-sm text-gray-600 italic">"{config.declarative}"</p>
        </div>
      </div>

      {/* CONSOLIDATED FOOTER */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Note:</strong> By verifying this record, you are staking your personal and
          professional reputation on its accuracy.{' '}
          <span className="block mt-2">
            Belrose will report proven misconduct to the appropriate legal and professional
            authorities.
          </span>
        </p>
      </div>

      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
        <Button
          onClick={() => level && onConfirm(level)}
          className="flex-1 bg-chart-3 hover:bg-chart-3/90"
          disabled={!level}
        >
          {isModify ? 'Confirm Modification' : 'Submit Verification'}
        </Button>
      </div>
    </>
  );
};

// ============================================================================
// CONFIRM RETRACT CONTENT (Reusable for both verification and dispute)
// ============================================================================

const ConfirmRetractContent: React.FC<{
  title: string;
  description: string;
  warning: string;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ title, description, warning, onConfirm, onClose }) => (
  <>
    <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
      <FileX className="w-5 h-5 text-red-600" />
      {title}
    </AlertDialog.Title>

    <AlertDialog.Description className="mt-3 text-sm text-gray-600">
      {description}
    </AlertDialog.Description>

    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 my-4">
      <p className="text-xs text-amber-800">
        <strong>Note:</strong> {warning}
      </p>
    </div>

    <div className="flex gap-3">
      <AlertDialog.Cancel asChild>
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </AlertDialog.Cancel>
      <Button onClick={onConfirm} variant="destructive" className="flex-1">
        {title}
      </Button>
    </div>
  </>
);

// ============================================================================
// CONFIRM DISPUTE CONTENT
// ============================================================================

const ConfirmDisputeContent: React.FC<{
  severity: DisputeSeverity;
  culpability: DisputeCulpability;
  notes?: string;
  isModify?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ severity, culpability, notes, isModify, onConfirm, onClose }) => {
  const severityConfig = getSeverityConfig(severity || 1);
  const culpabilityConfig = getCulpabilityConfig(culpability || 1);

  return (
    <>
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-red-600" />
        {isModify ? 'Confirm Dispute Modification' : 'Confirm Dispute'}
      </AlertDialog.Title>

      <AlertDialog.Description className="mt-3 text-sm text-gray-600">
        Review your selection before it is recorded to the secure network.
      </AlertDialog.Description>

      {/* Dispute Details */}
      <div className="my-4 space-y-3">
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Severity</div>
          <div className="font-semibold text-gray-900">{severityConfig.name}</div>
          <div className="text-xs text-gray-500 mt-1">{severityConfig.declarative}</div>
        </div>

        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Culpability</div>
          <div className="font-semibold text-gray-900">{culpabilityConfig.name}</div>
          <div className="text-xs text-gray-500 mt-1">{culpabilityConfig.declarative}</div>
        </div>

        {notes && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</div>
          </div>
        )}
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-red-800">
          <strong>Warning:</strong> Filing a dispute is a serious action. This will be permanently
          recorded on a secured digital network and visible to all participants.
        </p>
      </div>

      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
        <Button onClick={onConfirm} variant="destructive" className="flex-1">
          {isModify ? 'Modify Dispute' : 'File Dispute'}
        </Button>
      </div>
    </>
  );
};

// ============================================================================
// CONFIRM REACTION CONTENT
// ============================================================================

const ConfirmReactionContent: React.FC<{
  pendingReaction: boolean;
  onConfirm: (supportsDispute: boolean) => void;
  onClose: () => void;
}> = ({ pendingReaction, onConfirm, onClose }) => {
  const [supports, setSupports] = useState<boolean | null>(pendingReaction);

  return (
    <>
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        React to Dispute
      </AlertDialog.Title>

      <AlertDialog.Description className="mt-3 text-sm text-gray-600">
        Do you support or oppose this dispute?
      </AlertDialog.Description>

      <div className="flex gap-3 my-4">
        <button
          onClick={() => setSupports(true)}
          className={`
            flex-1 flex flex-col items-center gap-2 p-4 border rounded-lg transition-colors
            ${supports === true ? 'border-chart-3 bg-chart-3/10' : 'border-gray-200 hover:border-gray-300'}
          `}
        >
          <ThumbsUp className={`w-8 h-8 ${supports === true ? 'text-chart-3' : 'text-gray-400'}`} />
          <span className={`font-medium ${supports === true ? 'text-chart-3' : 'text-gray-600'}`}>
            Support
          </span>
          <span className="text-xs text-gray-500">I agree with this dispute</span>
        </button>

        <button
          onClick={() => setSupports(false)}
          className={`
            flex-1 flex flex-col items-center gap-2 p-4 border rounded-lg transition-colors
            ${supports === false ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}
          `}
        >
          <ThumbsDown
            className={`w-8 h-8 ${supports === false ? 'text-red-600' : 'text-gray-400'}`}
          />
          <span className={`font-medium ${supports === false ? 'text-red-700' : 'text-gray-600'}`}>
            Oppose
          </span>
          <span className="text-xs text-gray-500">I disagree with this dispute</span>
        </button>
      </div>

      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
        <Button
          onClick={() => supports !== null && onConfirm(supports)}
          disabled={supports === null}
          className="flex-1 bg-chart-3 hover:bg-chart-3/90"
        >
          Submit Reaction
        </Button>
      </div>
    </>
  );
};

// ============================================================================
// CONFIRM MODIFY VERIFICATION
// ============================================================================

const ConfirmModifyVerification: React.FC<{
  previousLevel?: VerificationLevel;
  onConfirm: (level: VerificationLevel) => void;
  onClose: () => void;
}> = ({ previousLevel, onConfirm, onClose }) => {
  const [selectedLevel, setSelectedLevel] = useState<VerificationLevel>(previousLevel || 1);

  return (
    <>
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-chart-3" />
        Modify Verification
      </AlertDialog.Title>

      <AlertDialog.Description className="mt-3 text-sm text-gray-600">
        Select the level of verification you are changing to for this record.
      </AlertDialog.Description>

      <div className="space-y-2 my-4">
        {VERIFICATION_OPTIONS.map(config => {
          const isSelected = selectedLevel === config.value;
          const IconComponent = config.icon;

          return (
            <label
              key={config.value}
              className={`flex items-start gap-3 p-3 border rounded-lg transition-colors cursor-pointer
                    ${isSelected ? 'border-chart-3 bg-chart-3/10' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <input
                type="radio"
                name="verificationLevel"
                value={config.value}
                checked={isSelected}
                onChange={() => setSelectedLevel(config.value)}
                className="mt-1 w-4 h-4 accent-chart-3"
              />
              <IconComponent
                className={`w-5 h-5 mt-0.5 ${isSelected ? 'text-chart-3' : 'text-gray-400'}`}
              />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{config.name}</p>
                <p className="text-xs text-gray-500">{config.declarative}</p>
              </div>
            </label>
          );
        })}
      </div>

      {/* CONSOLIDATED FOOTER */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Note:</strong> By verifying this record, you are staking your personal and
          professional reputation on its accuracy.{' '}
          <span className="block mt-2">
            Belrose will report proven misconduct to the appropriate legal and professional
            authorities.
          </span>
        </p>
      </div>

      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
        <Button
          onClick={() => onConfirm(selectedLevel)}
          className="flex-1 bg-chart-3 hover:bg-chart-3/90"
        >
          Modify Verification
        </Button>
      </div>
    </>
  );
};

export default CredibilityActionDialog;
