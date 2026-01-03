// src/features/Credibility/components/CredibilityActionDialog.tsx

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import {
  Shield,
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
import { VerificationLevel, VerificationLevelName } from '../../services/verificationService';

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
  pendingLevel?: VerificationLevel;
  pendingSeverity?: 1 | 2 | 3;
  pendingCulpability?: 1 | 2 | 3 | 4 | 5;
  pendingNotes?: string;
  onClose: () => void;
  onConfirmVerification: (level: VerificationLevel) => void;
  onConfirmRetract: () => void;
  onConfirmDispute: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================
const VERIFICATION_LEVEL_CONFIGS: {
  level: VerificationLevel;
  label: VerificationLevelName;
  description: string;
  color: string;
}[] = [
  {
    level: 1,
    label: 'Provenance',
    description: 'I verify the source and origin of this record.',
    color: 'text-primary bg-primary/20 border-primary',
  },
  {
    level: 2,
    label: 'Content',
    description: 'I verify the accuracy of the content in this record.',
    color: 'text-chart-3 bg-chart-3/20 border-chart-3',
  },
  {
    level: 3,
    label: 'Full',
    description: 'I fully verify both the provenance and content accuracy.',
    color: 'text-chart-5 bg-chart-5/20 border-chart-5',
  },
];

const VERIFICATION_LEVELS = VERIFICATION_LEVEL_CONFIGS.reduce(
  (acc, config) => {
    acc[config.level] = config;
    return acc;
  },
  {} as Record<VerificationLevel, (typeof VERIFICATION_LEVEL_CONFIGS)[number]>
);

const SEVERITY_LABELS: Record<1 | 2 | 3, { label: string; color: string }> = {
  1: { label: 'Negligible', color: 'text-yellow-600' },
  2: { label: 'Moderate', color: 'text-orange-600' },
  3: { label: 'Major', color: 'text-red-600' },
};

const CULPABILITY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'No Fault',
  2: 'Systemic',
  3: 'Preventable',
  4: 'Reckless',
  5: 'Intentional',
};

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
  onClose,
  onConfirmVerification,
  onConfirmRetract,
  onConfirmDispute,
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

          {/* Confirming Phase - Verification */}
          {phase === 'confirming' && operationType === 'verify' && (
            <ConfirmVerificationContent
              preSelectedLevel={pendingLevel}
              onConfirm={onConfirmVerification}
              onClose={onClose}
            />
          )}

          {/* Confirming Phase - Retract */}
          {phase === 'confirming' && operationType === 'retract' && (
            <ConfirmRetractContent onConfirm={onConfirmRetract} onClose={onClose} />
          )}

          {/* Confirming Phase - Dispute */}
          {phase === 'confirming' &&
            operationType === 'dispute' &&
            pendingSeverity &&
            pendingCulpability && (
              <ConfirmDisputeContent
                severity={pendingSeverity}
                culpability={pendingCulpability}
                notes={pendingNotes}
                onConfirm={onConfirmDispute}
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
    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
    <AlertDialog.Title className="text-lg font-bold text-center">
      Preparing Blockchain
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      {progress?.message || 'Setting up your blockchain wallet...'}
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
    {status === 'complete' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
    {status === 'active' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
    {status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-gray-300" />}
    <span
      className={`text-sm ${status === 'complete' ? 'text-green-700' : status === 'active' ? 'text-blue-700' : 'text-gray-400'}`}
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
      description: 'Recording your verification on the blockchain...',
    },
    dispute: {
      title: 'Filing Dispute',
      description: 'Recording your dispute on the blockchain...',
    },
    react: {
      title: 'Submitting Reaction',
      description: 'Recording your reaction on the blockchain...',
    },
    retract: {
      title: 'Retracting',
      description: 'Removing your verification from the blockchain...',
    },
  };

  const { title, description } = messages[operationType];

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
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
    react: 'Reaction submitted successfully!',
    retract: 'Successfully retracted!',
  };

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <CheckCircle2 className="w-10 h-10 text-green-500" />
      <AlertDialog.Title className="text-lg font-bold text-center text-green-700">
        Success
      </AlertDialog.Title>
      <AlertDialog.Description className="text-sm text-gray-600 text-center">
        {messages[operationType]}
      </AlertDialog.Description>
      <Button onClick={onClose} className="mt-2">
        Done
      </Button>
    </div>
  );
};

// ============================================================================
// CONFIRM VERIFICATION CONTENT
// ============================================================================

const ConfirmVerificationContent: React.FC<{
  preSelectedLevel?: VerificationLevel;
  onConfirm: (level: VerificationLevel) => void;
  onClose: () => void;
}> = ({ preSelectedLevel, onConfirm, onClose }) => {
  const [selectedLevel, setSelectedLevel] = useState<VerificationLevel>(preSelectedLevel || 1);
  const isPreSelected = preSelectedLevel !== undefined;

  const currentConfig = VERIFICATION_LEVELS[selectedLevel];
  const [textColor, bgColor, borderColor] = currentConfig.color.split(' ');

  return (
    <>
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-green-600" />
        {isPreSelected ? 'Confirm Verification' : 'Verify Record'}
      </AlertDialog.Title>

      <AlertDialog.Description className="mt-3 text-sm text-gray-600">
        {isPreSelected
          ? 'You are about to submit a verification for this record.'
          : 'Select the level of verification you are providing for this record.'}
      </AlertDialog.Description>

      {/* CONDITIONAL BODY: Confirmation Card OR Selection List */}
      <div className="my-4">
        {isPreSelected ? (
          /* Single Card Mode */
          <div className={`p-4 border rounded-lg ${bgColor} ${borderColor}`}>
            <div className="flex items-center gap-2 mb-1">
              <FileCheck className={`w-5 h-5 ${textColor}`} />
              <span className={`font-semibold ${textColor}`}>
                {currentConfig.label} Verification
              </span>
            </div>
            <p className="text-sm text-gray-600">{currentConfig.description}</p>
          </div>
        ) : (
          /* Selection List Mode */
          <div className="space-y-2">
            {VERIFICATION_LEVEL_CONFIGS.map(({ level, label, description, color }) => {
              const isSelected = selectedLevel === level;
              const [optText, optBg, optBorder] = color.split(' ');
              return (
                <label
                  key={level}
                  className={`flex items-start gap-3 p-3 border rounded-lg transition-colors cursor-pointer
                    ${isSelected ? `${optBorder} ${optBg}` : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <input
                    type="radio"
                    name="verificationLevel"
                    value={level}
                    checked={isSelected}
                    onChange={() => setSelectedLevel(level)}
                    className="mt-1 w-4 h-4"
                  />
                  <FileCheck className={`w-5 h-5 mt-0.5 ${optText}`} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
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
        <Button onClick={() => onConfirm(selectedLevel)} className="flex-1">
          {isPreSelected ? 'Confirm Verification' : 'Verify Record'}
        </Button>
      </div>
    </>
  );
};

// ============================================================================
// CONFIRM RETRACT CONTENT
// ============================================================================

const ConfirmRetractContent: React.FC<{
  onConfirm: () => void;
  onClose: () => void;
}> = ({ onConfirm, onClose }) => (
  <>
    <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
      <FileX className="w-5 h-5 text-red-600" />
      Retract Verification
    </AlertDialog.Title>

    <AlertDialog.Description className="mt-3 text-sm text-gray-600">
      Are you sure you want to retract your verification of this record?
    </AlertDialog.Description>

    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 my-4">
      <p className="text-xs text-amber-800">
        <strong>Note:</strong> Retracting your verification will remove your endorsement from this
        record. This action is recorded on the blockchain.
      </p>
    </div>

    <div className="flex gap-3">
      <AlertDialog.Cancel asChild>
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </AlertDialog.Cancel>
      <Button onClick={onConfirm} variant="destructive" className="flex-1">
        Retract Verification
      </Button>
    </div>
  </>
);

// ============================================================================
// CONFIRM DISPUTE CONTENT
// ============================================================================

const ConfirmDisputeContent: React.FC<{
  severity: 1 | 2 | 3;
  culpability: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ severity, culpability, notes, onConfirm, onClose }) => {
  const severityConfig = SEVERITY_LABELS[severity];

  return (
    <>
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-red-600" />
        Confirm Dispute
      </AlertDialog.Title>

      <AlertDialog.Description className="mt-3 text-sm text-gray-600">
        You are about to file a dispute against this record.
      </AlertDialog.Description>

      {/* Dispute Details */}
      <div className="my-4 space-y-3">
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Severity</div>
          <div className={`font-semibold ${severityConfig.color}`}>{severityConfig.label}</div>
        </div>

        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Culpability</div>
          <div className="font-semibold text-gray-900">{CULPABILITY_LABELS[culpability]}</div>
        </div>

        {notes && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</div>
            <div className="text-sm text-gray-700">{notes}</div>
          </div>
        )}
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-red-800">
          <strong>Warning:</strong> Filing a dispute is a serious action. This will be permanently
          recorded on the blockchain and visible to all participants.
        </p>
      </div>

      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
        <Button onClick={onConfirm} variant="destructive" className="flex-1">
          File Dispute
        </Button>
      </div>
    </>
  );
};

// ============================================================================
// CONFIRM REACTION CONTENT
// ============================================================================

const ConfirmReactionContent: React.FC<{
  onConfirm: (disputerIdHash: string, supportsDispute: boolean) => void;
  onClose: () => void;
}> = ({ onConfirm, onClose }) => {
  // TODO: This would need to receive the dispute info to display
  // For now, just a placeholder
  const [supports, setSupports] = useState<boolean | null>(null);

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
            ${supports === true ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}
          `}
        >
          <ThumbsUp
            className={`w-8 h-8 ${supports === true ? 'text-green-600' : 'text-gray-400'}`}
          />
          <span className={`font-medium ${supports === true ? 'text-green-700' : 'text-gray-600'}`}>
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
          onClick={() => supports !== null && onConfirm('TODO_DISPUTER_ID', supports)}
          disabled={supports === null}
          className="flex-1"
        >
          Submit Reaction
        </Button>
      </div>
    </>
  );
};

export default CredibilityActionDialog;
