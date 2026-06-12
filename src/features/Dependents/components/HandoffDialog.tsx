// src/features/Dependents/components/HandoffDialog.tsx

/**
 * Dialog for initiating handoff process for dependent accounts.
 * Basically just sends them an email and prompts the guardian to give the password/recovery phrase to the dependent
 */

import { useEffect, useState } from 'react';
import { DependentManagementService } from '../services/dependentManagementService';
import { toast } from 'sonner';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Loader2, SendHorizontal } from 'lucide-react';
import { DependentEntry } from './DependentsSettingsPage';
import { InputField } from '@/components/ui/InputField';
import { Button } from '@/components/ui/Button';

interface HandoffDialogProps {
  dependent: DependentEntry | null;
  onClose: () => void;
}

const HandoffDialog: React.FC<HandoffDialogProps> = ({ dependent, onClose }) => {
  const [contactEmail, setContactEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const isPlaceholder = dependent?.profile?.email?.endsWith('@placeholder.belrose.health') ?? true;
  const prefillEmail = isPlaceholder ? '' : (dependent?.profile?.email ?? '');

  useEffect(() => {
    setContactEmail(prefillEmail);
  }, [prefillEmail]);

  const handleSend = async () => {
    if (!dependent || !contactEmail.trim()) return;
    setIsSending(true);
    try {
      await DependentManagementService.initiateHandoff(
        dependent.relationship.trustorId,
        contactEmail.trim()
      );
      toast.success('Handoff email sent.');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send handoff email.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AlertDialog.Root open={!!dependent} onOpenChange={open => !open && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 shadow-2xl z-[101] w-full max-w-md">
          <AlertDialog.Title className="text-lg font-bold mb-1 flex items-center gap-2">
            <SendHorizontal className="w-5 h-5 text-primary" />
            Initiate Account Handoff
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-gray-600 mb-4">
            Send {dependent?.profile?.displayName ?? 'the dependent'} an email letting them know
            their account is ready to claim. They'll use their 24-word recovery phrase to set their
            own password.
          </AlertDialog.Description>

          <div className="mb-4">
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Send to email address
            </label>
            <InputField
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="their@email.com"
              className="px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400 mt-2">
              The email will include their Belrose login email and instructions to use the recovery
              phrase you saved when creating the account.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
            <p className="text-xs text-amber-800">
              <strong>Reminder:</strong> You must securely shared the 24-word recovery phrase
              separately (in person or via a secure messaging app). The recovery phrase is NOT in
              the email because Belrose has no access to it.
            </p>
          </div>

          <div className="flex gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              onClick={handleSend}
              disabled={isSending || !contactEmail.trim()}
              className="flex-1"
            >
              {isSending ? (
                <span className="flex items-center gap-2 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </span>
              ) : (
                'Send Handoff Email'
              )}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default HandoffDialog;
