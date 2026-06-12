// src/features/Dependents/components/RemoveDialog.tsx

/**
 * Dialog for confirming removal of a dependent account. If the account is unclaimed and no handoff has been initiated, this will delete the account. Otherwise, it just removes guardian access.
 */

import { useState } from 'react';
import { DependentEntry } from './DependentsSettingsPage';
import { DependentManagementService } from '../services/dependentManagementService';
import { toast } from 'sonner';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface RemoveDialogProps {
  dependent: DependentEntry | null;
  onClose: () => void;
  onRemoved: (uid: string) => void;
}

const RemoveDialog: React.FC<RemoveDialogProps> = ({ dependent, onClose, onRemoved }) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const isUnclaimed = dependent?.profile?.isDependent === true;
  const handoffInitiated = !!(dependent?.profile as any)?.handoffInitiatedAt;
  const willDelete = isUnclaimed && !handoffInitiated;
  const name = dependent?.profile?.displayName ?? 'this account';

  const handleRemove = async () => {
    if (!dependent) return;
    setIsRemoving(true);
    try {
      await DependentManagementService.removeDependent(dependent.relationship.trustorId);
      toast.success(
        willDelete ? `${name}'s account has been deleted.` : 'Guardian access removed.'
      );
      onRemoved(dependent.relationship.trustorId);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove dependent.');
      setIsRemoving(false);
    }
  };

  return (
    <AlertDialog.Root open={!!dependent} onOpenChange={open => !open && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 shadow-2xl z-[101] w-full max-w-md">
          <AlertDialog.Title className="text-lg font-bold mb-1 flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            {willDelete ? 'Delete Dependent Account' : 'Remove Guardian Access'}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-600 mb-4">
            {willDelete
              ? `${name} hasn't claimed their account and no handoff has been sent. This will permanently delete their account and all associated data.`
              : `This will remove your Controller access. ${name}'s account and records will be preserved.`}
          </AlertDialog.Description>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
            <p className="text-xs text-red-800">
              <strong>This cannot be undone.</strong>{' '}
              {willDelete
                ? 'The account, wallet, and any stored records will be permanently removed.'
                : 'You will lose Controller access to their health records.'}
            </p>
          </div>

          <div className="flex gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              onClick={handleRemove}
              disabled={isRemoving}
              variant="destructive"
              className="flex-1"
            >
              {isRemoving ? (
                <span className="flex items-center gap-2 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Removing…
                </span>
              ) : willDelete ? (
                'Delete Account'
              ) : (
                'Remove Access'
              )}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default RemoveDialog;
