// src/features/Settings/components/DeleteAccountDialog.tsx

import { useState } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import {
  AccountDeletionService,
  DeletionPhase,
} from '@/features/Settings/services/accountDeletionService';

const PHASE_LABELS: Record<DeletionPhase, string> = {
  records: 'Cleaning up your health records…',
  trustees: 'Revoking trustee relationships…',
  'subject-requests': 'Cancelling pending requests…',
  profile: 'Deleting your profile…',
  account: 'Deleting your account…',
};

const CONFIRM_PHRASE = 'DELETE';

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({ isOpen, onClose }) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phase, setPhase] = useState<DeletionPhase | null>(null);

  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmText('');
    setPhase(null);
    onClose();
  };

  const handleDelete = async () => {
    if (!canConfirm) return;
    setIsDeleting(true);
    try {
      const { recordFailures } = await AccountDeletionService.deleteMyAccount(setPhase);
      if (recordFailures.length > 0) {
        toast.warning(
          `Account deleted, but ${recordFailures.length} record(s) couldn't be fully cleaned up ` +
            'because other subjects still need to unanchor themselves.'
        );
      } else {
        toast.success('Account deleted.');
      }
      // AccountDeletionService signs the user out — route guards handle the redirect.
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete account.');
      setIsDeleting(false);
      setPhase(null);
    }
  };

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && handleClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 shadow-2xl z-[101] w-full max-w-md">
          {isDeleting ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
              <AlertDialog.Title className="text-lg font-bold text-center">
                Deleting Account
              </AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-gray-600 text-center">
                {phase ? PHASE_LABELS[phase] : 'Starting…'}
              </AlertDialog.Description>
            </div>
          ) : (
            <>
              <AlertDialog.Title className="text-lg font-bold mb-1 flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                Delete Account
              </AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-gray-600 mb-4">
                This permanently deletes your account. Records you solely own will be deleted;
                records shared with others will just have your access removed. Trustee
                relationships you're part of will be revoked.
              </AlertDialog.Description>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-800">
                  <strong>This cannot be undone.</strong> Type <strong>{CONFIRM_PHRASE}</strong>{' '}
                  below to confirm.
                </p>
              </div>

              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-red-400"
                autoFocus
              />

              <div className="flex gap-3">
                <AlertDialog.Cancel asChild>
                  <Button variant="outline" className="flex-1">
                    Cancel
                  </Button>
                </AlertDialog.Cancel>
                <Button
                  onClick={handleDelete}
                  disabled={!canConfirm}
                  variant="destructive"
                  className="flex-1"
                >
                  Delete Account
                </Button>
              </div>
            </>
          )}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default DeleteAccountDialog;
