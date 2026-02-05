// src/features/Auth/components/RegistrationProgressDialog.tsx

/**
 * This is a Registration Progress Dialog that is created during the Complete Registration Process
 * The dialog overlay is designed to prime the user that they're updating the blockchain
 * It also serves as a loading screen since loading usually takes a while
 */

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Loader2, XCircle, CheckCircle2, Wallet, Network } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ============================================================================
// TYPES
// ============================================================================

export type RegistrationPhase = 'idle' | 'registering' | 'success' | 'error';

export interface RegistrationProgress {
  step: 'eoa_registration' | 'smart_account_registration' | 'firestore_update' | 'complete';
  message: string;
}

interface RegistrationProgressDialogProps {
  isOpen: boolean;
  phase: RegistrationPhase;
  progress?: RegistrationProgress | null;
  error?: string | null;
  onClose: () => void;
  onRetry?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const RegistrationProgressDialog: React.FC<RegistrationProgressDialogProps> = ({
  isOpen,
  phase,
  progress,
  error,
  onClose,
  onRetry,
}) => {
  if (!isOpen) return null;

  const canClose = phase === 'error' || phase === 'success';

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && canClose && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 shadow-2xl z-[101] w-full max-w-md">
          {/* Registering Phase */}
          {phase === 'registering' && <RegisteringContent progress={progress} />}

          {/* Success Phase */}
          {phase === 'success' && <SuccessContent onClose={onClose} />}

          {/* Error Phase */}
          {phase === 'error' && <ErrorContent error={error} onClose={onClose} onRetry={onRetry} />}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

// ============================================================================
// PHASE CONTENT COMPONENTS
// ============================================================================

const RegisteringContent: React.FC<{ progress?: RegistrationProgress | null }> = ({ progress }) => (
  <div className="flex flex-col items-center gap-4 py-4">
    <Loader2 className="w-10 h-10 text-primary animate-spin" />
    <AlertDialog.Title className="text-lg font-bold text-center">
      Securing Your Account
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      {progress?.message || 'Setting up your anonymous network identity...'}
    </AlertDialog.Description>

    {/* Progress Steps */}
    <div className="w-full mt-2 space-y-2">
      <ProgressStep
        label="Registering Belrose account on distributed network"
        icon={Wallet}
        status={getStepStatus(progress?.step, ['eoa_registration'])}
      />
      <ProgressStep
        label="Registering smart account for network automation"
        icon={Network}
        status={getStepStatus(progress?.step, ['smart_account_registration'])}
      />
      <ProgressStep
        label="Finalizing account setup"
        icon={CheckCircle2}
        status={getStepStatus(progress?.step, ['firestore_update', 'complete'])}
      />
    </div>

    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4 w-full">
      <p className="text-xs text-blue-800 leading-relaxed">
        <strong>What's happening:</strong> Your account is being anonymously registered on a secure
        network distributed across thousands of computers around the world. This allows you to own
        credible health records independent of third parties like the government or big tech.
      </p>
    </div>
  </div>
);

function getStepStatus(
  currentStep: string | undefined,
  stepNames: string[]
): 'pending' | 'active' | 'complete' {
  if (!currentStep) return 'pending';

  const steps = ['eoa_registration', 'smart_account_registration', 'firestore_update', 'complete'];
  const currentIndex = steps.indexOf(currentStep);
  const stepIndices = stepNames.map(s => steps.indexOf(s));
  const maxStepIndex = Math.max(...stepIndices);

  if (stepNames.includes(currentStep)) return 'active';
  if (currentIndex > maxStepIndex) return 'complete';

  return 'pending';
}

const ProgressStep: React.FC<{
  label: string;
  icon: React.ElementType;
  status: 'pending' | 'active' | 'complete';
}> = ({ label, icon: Icon, status }) => (
  <div className="flex items-center gap-3">
    {status === 'complete' && <CheckCircle2 className="w-5 h-5 text-chart-3" />}
    {status === 'active' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
    {status === 'pending' && <Icon className="w-5 h-5 text-gray-300" />}
    <span
      className={`text-sm ${
        status === 'complete'
          ? 'text-chart-3'
          : status === 'active'
            ? 'text-primary font-medium'
            : 'text-gray-400'
      }`}
    >
      {label}
    </span>
  </div>
);

const SuccessContent: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="flex flex-col items-center gap-4 py-4">
    <CheckCircle2 className="w-10 h-10 text-chart-3" />
    <AlertDialog.Title className="text-lg font-bold text-center text-chart-3">
      Account Created Successfully!
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      Your network account has been secured. You're now ready to verify your account.
    </AlertDialog.Description>
    <Button onClick={onClose} className="mt-2 bg-chart-3 hover:bg-chart-3/90">
      Continue to Verification
    </Button>
  </div>
);

const ErrorContent: React.FC<{
  error?: string | null;
  onClose: () => void;
  onRetry?: () => void;
}> = ({ error, onClose, onRetry }) => (
  <div className="flex flex-col items-center gap-4 py-4">
    <XCircle className="w-10 h-10 text-red-500" />
    <AlertDialog.Title className="text-lg font-bold text-center text-red-700">
      Registration Failed
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      {error || 'An unexpected error occurred during registration.'}
    </AlertDialog.Description>
    <div className="flex gap-3 w-full mt-2">
      <Button onClick={onClose} variant="outline" className="flex-1">
        Cancel
      </Button>
      {onRetry && (
        <Button onClick={onRetry} className="flex-1">
          Try Again
        </Button>
      )}
    </div>
  </div>
);

export default RegistrationProgressDialog;
