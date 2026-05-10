// src/features/OnChainActivityTray/OnChainSubmittedModal.tsx

import React, { useEffect, useRef } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const AUTO_DISMISS_MS = 3000;

// ============================================================================
// INNER CONTENT — use this inside existing dialogs (e.g. SubjectActionDialog)
// No AlertDialog.Root/Portal — the parent dialog already provides that.
// onClose/label are just regular props, timer logic still lives here.
// ============================================================================

interface OnChainSubmittedContentProps {
  onClose: () => void;
  label?: string;
}

export const OnChainSubmittedContent: React.FC<OnChainSubmittedContentProps> = ({
  onClose,
  label,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss — runs on mount, cleans up on unmount
  // This works because the parent only renders this component when phase === 'submitted'
  // so mounting = open, unmounting = closed
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onClose();
    }, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // ← empty deps: only runs once on mount, that's all we need

  const handleGotIt = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onClose();
  };

  return (
    <div className="flex flex-col items-center text-center gap-4 py-4">
      {/* Icon */}
      <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-green-500" />
      </div>

      {/* Heading */}
      <div>
        <AlertDialog.Title className="text-base font-semibold text-gray-900">
          Transaction Submitted
        </AlertDialog.Title>
        <AlertDialog.Description className="text-sm text-gray-500 mt-1 leading-relaxed">
          {label ? (
            <>
              <span className="font-medium text-gray-700">{label}</span> is being processed on the
              distributed network.
            </>
          ) : (
            'Your transaction is being processed on-chain.'
          )}{' '}
          You can keep using the app while it confirms and track process below ↘
        </AlertDialog.Description>
      </div>

      <Button variant="outline" size="sm" onClick={handleGotIt} className="w-full">
        Got it
      </Button>
    </div>
  );
};

// ============================================================================
// STANDALONE MODAL — use this anywhere you need it outside an existing dialog
// (e.g. a future payments flow that doesn't have a parent AlertDialog)
// Wraps OnChainSubmittedContent with its own Root/Portal.
// ============================================================================

interface OnChainSubmittedModalProps {
  isOpen: boolean;
  onClose: () => void;
  label?: string;
}

export const OnChainSubmittedModal: React.FC<OnChainSubmittedModalProps> = ({
  isOpen,
  onClose,
  label,
}) => {
  if (!isOpen) return null;

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[150]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[151] w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <OnChainSubmittedContent onClose={onClose} label={label} />
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default OnChainSubmittedModal;
