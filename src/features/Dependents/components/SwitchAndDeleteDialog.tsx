// src/features/Dependents/components/SwitchAndDeleteDialog.tsx

/**
 * Confirms deleting an unclaimed dependent's account. Since the dependent's own
 * on-chain trustee relationship can only be revoked by their own signer, this
 * switches the guardian into the dependent's session (they set the dependent's
 * password at creation, so EncryptionGate will unlock cleanly) and lands them
 * directly on the Delete Account confirmation, now running as the dependent.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { AccountSwitchService } from '../services/accountSwitchService';
import { DependentEntry } from './DependentsSettingsPage';

interface SwitchAndDeleteDialogProps {
  dependent: DependentEntry | null;
  onClose: () => void;
}

const SwitchAndDeleteDialog: React.FC<SwitchAndDeleteDialogProps> = ({ dependent, onClose }) => {
  const navigate = useNavigate();
  const [isSwitching, setIsSwitching] = useState(false);
  const name = dependent?.profile?.displayName ?? 'this account';

  const handleContinue = async () => {
    if (!dependent) return;
    setIsSwitching(true);
    try {
      await AccountSwitchService.switchToDependent(dependent.relationship.trustorId);
      navigate('/app/settings/account?action=delete-account');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to switch account.');
      setIsSwitching(false);
    }
  };

  return (
    <AlertDialog.Root open={!!dependent} onOpenChange={open => !open && !isSwitching && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 shadow-2xl z-[101] w-full max-w-md">
          <AlertDialog.Title className="text-lg font-bold mb-1 flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Delete Dependent Account
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-600 mb-4">
            {`${name} hasn't claimed their account and no handoff has been sent. To delete it, you'll be switched into their account — you'll be asked to enter the password you set for them — and taken directly to the delete account confirmation.`}
          </AlertDialog.Description>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
            <p className="text-xs text-red-800">
              You'll need to log back into your own account afterward.
            </p>
          </div>

          <div className="flex gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" className="flex-1" disabled={isSwitching}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              onClick={handleContinue}
              disabled={isSwitching}
              variant="destructive"
              className="flex-1"
            >
              {isSwitching ? (
                <span className="flex items-center gap-2 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Switching…
                </span>
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default SwitchAndDeleteDialog;
