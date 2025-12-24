// src/features/Sharing/components/RevokeAccessDialog.tsx

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AccessEntry } from '@/features/Sharing/components/EncryptionAccessView';

interface RevokeAccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (action: 'full-revoke' | 'demote-admin' | 'demote-viewer') => void;
  entry: AccessEntry | null;
  loading?: boolean;
}

const RevokeAccessDialog = ({
  isOpen,
  onClose,
  onConfirm,
  entry,
  loading,
}: RevokeAccessDialogProps) => {
  if (!entry) return null;

  const isOwner = entry.role === 'owner';
  const isAdmin = entry.role === 'administrator';

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 shadow-2xl z-[101] w-full max-w-md">
          <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-600" />
            Revoke Access?
          </AlertDialog.Title>

          <AlertDialog.Description className="mt-3 text-sm text-gray-600">
            Choose how to handle access for{' '}
            <strong>{entry.profile?.displayName || entry.userId}</strong>.
            {isOwner && (
              <p className="mt-2 text-xs text-amber-600 font-medium">
                Note: Owners can only be removed by themselves.
              </p>
            )}
          </AlertDialog.Description>

          <div className="mt-6 flex flex-col gap-3">
            {/* 1. Full Revocation */}
            <button
              disabled={loading}
              onClick={() => onConfirm('full-revoke')}
              className="w-full text-left p-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <div className="font-semibold text-red-700 text-sm">Full Revocation</div>
              <div className="text-xs text-red-600/80">Remove all keys and permissions.</div>
            </button>

            {/* 2. Demote to Admin (Owner only) */}
            {isOwner && (
              <button
                disabled={loading}
                onClick={() => onConfirm('demote-admin')}
                className="w-full text-left p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <div className="font-semibold text-gray-900 text-sm">Demote to Administrator</div>
                <div className="text-xs text-gray-500">
                  Remove ownership but keep full record management.
                </div>
              </button>
            )}

            {/* 3. Demote to Viewer (Owner or Admin) */}
            {(isOwner || isAdmin) && (
              <button
                disabled={loading}
                onClick={() => onConfirm('demote-viewer')}
                className="w-full text-left p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <div className="font-semibold text-gray-900 text-sm">Demote to Viewer</div>
                <div className="text-xs text-gray-500">Keep read-only access only.</div>
              </button>
            )}

            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={loading} className="mt-2">
                Cancel
              </Button>
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default RevokeAccessDialog;
