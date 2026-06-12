// src/features/Dependents/components/CreateDependentProgressDialog.tsx

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Loader2, XCircle, CheckCircle2, KeyRound, Network } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export type DependentCreationDialogPhase = 'idle' | 'keys' | 'registering' | 'error';

interface CreateDependentProgressDialogProps {
  phase: DependentCreationDialogPhase;
  error?: string | null;
  onClose: () => void;
}

export const CreateDependentProgressDialog: React.FC<CreateDependentProgressDialogProps> = ({
  phase,
  error,
  onClose,
}) => {
  const isOpen = phase !== 'idle';
  const canClose = phase === 'error';

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && canClose && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 shadow-2xl z-[101] w-full max-w-md">
          {(phase === 'keys' || phase === 'registering') && (
            <SubmittingContent phase={phase} />
          )}
          {phase === 'error' && <ErrorContent error={error} onClose={onClose} />}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

const SubmittingContent: React.FC<{ phase: 'keys' | 'registering' }> = ({ phase }) => (
  <div className="flex flex-col items-center gap-4 py-4">
    <Loader2 className="w-10 h-10 text-primary animate-spin" />
    <AlertDialog.Title className="text-lg font-bold text-center">
      Creating Account
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      {phase === 'keys'
        ? 'Generating encryption keys...'
        : 'Registering on the distributed network...'}
    </AlertDialog.Description>

    <div className="w-full mt-2 space-y-2">
      <ProgressStep
        label="Generating encryption keys"
        icon={KeyRound}
        status={phase === 'keys' ? 'active' : 'complete'}
      />
      <ProgressStep
        label="Registering on network"
        icon={Network}
        status={phase === 'registering' ? 'active' : 'pending'}
      />
    </div>

    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2 w-full">
      <p className="text-xs text-blue-800 leading-relaxed">
        <strong>What's happening:</strong> The account is being anonymously registered on a secure
        distributed network. This takes a moment — please don't close this window.
      </p>
    </div>
  </div>
);

const ProgressStep: React.FC<{
  label: string;
  icon: React.ElementType;
  status: 'pending' | 'active' | 'complete';
}> = ({ label, icon: Icon, status }) => (
  <div className="flex items-center gap-3">
    {status === 'complete' && <CheckCircle2 className="w-5 h-5 text-complement-3 flex-shrink-0" />}
    {status === 'active' && <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />}
    {status === 'pending' && <Icon className="w-5 h-5 text-gray-300 flex-shrink-0" />}
    <span
      className={`text-sm ${
        status === 'complete'
          ? 'text-complement-3'
          : status === 'active'
            ? 'text-primary font-medium'
            : 'text-gray-400'
      }`}
    >
      {label}
    </span>
  </div>
);

const ErrorContent: React.FC<{ error?: string | null; onClose: () => void }> = ({
  error,
  onClose,
}) => (
  <div className="flex flex-col items-center gap-4 py-4">
    <XCircle className="w-10 h-10 text-red-500" />
    <AlertDialog.Title className="text-lg font-bold text-center text-red-700">
      Account Creation Failed
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      {error || 'An unexpected error occurred. Please try again.'}
    </AlertDialog.Description>
    <Button onClick={onClose} variant="outline" className="mt-2">
      Close
    </Button>
  </div>
);

export default CreateDependentProgressDialog;
