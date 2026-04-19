// src/features/RequestRecord/components/ui/LinkModalShells.tsx

/**
 * Shared phase components used by both LinkRecordModal and LinkRequestModal.
 *
 * Exports:
 *   LinkModalOverlay  — Dialog.Root + portal wrapper
 *   ExecutingPhase    — spinner
 *   ErrorPhase        — error + retry/cancel
 *   PickRolePhase     — role selector (identical in both flows)
 */

import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, Loader2, XCircle } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/Button';
import RoleSelector from '@/features/Permissions/component/ui/RoleSelector';
import { Role } from '@/features/Permissions/services/permissionsService';

// ── Overlay wrapper ───────────────────────────────────────────────────────────

interface LinkModalOverlayProps {
  isOpen: boolean;
  canDismiss: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const LinkModalOverlay: React.FC<LinkModalOverlayProps> = ({
  isOpen,
  canDismiss,
  onClose,
  children,
}) => (
  <Dialog.Root open={isOpen} onOpenChange={open => !open && canDismiss && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
      <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[101] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden focus:outline-none">
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

// ── Executing ─────────────────────────────────────────────────────────────────

interface ExecutingPhaseProps {
  message?: string;
}

export const ExecutingPhase: React.FC<ExecutingPhaseProps> = ({
  message = 'Writing to the network and updating encryption keys.',
}) => (
  <div className="flex flex-col items-center gap-4 py-16 px-6">
    <Loader2 className="w-10 h-10 text-slate-400 animate-spin" />
    <p className="text-base font-semibold text-slate-800">Working…</p>
    <p className="text-sm text-slate-500 text-center">{message}</p>
  </div>
);

// ── Error ─────────────────────────────────────────────────────────────────────

interface ErrorPhaseProps {
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}

export const ErrorPhase: React.FC<ErrorPhaseProps> = ({ error, onRetry, onClose }) => (
  <div className="flex flex-col items-center gap-4 py-12 px-6">
    <XCircle className="w-10 h-10 text-red-500" />
    <p className="text-base font-semibold text-slate-800">Something went wrong</p>
    <p className="text-sm text-slate-500 text-center">{error || 'An unexpected error occurred.'}</p>
    <div className="flex gap-3 w-full mt-2">
      <Button variant="outline" className="flex-1" onClick={onClose}>
        Cancel
      </Button>
      <Button className="flex-1" onClick={onRetry}>
        Go back
      </Button>
    </div>
  </div>
);

// ── Pick role ─────────────────────────────────────────────────────────────────

interface PickRolePhaseProps {
  // Summary line — e.g. "3 records" or "2 requests"
  itemLabel: string;
  // Who they're being shared with — e.g. requester name or record title
  recipientLabel: string;
  selectedRole: Role;
  onRoleChange: (r: Role) => void;
  onBack: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

export const PickRolePhase: React.FC<PickRolePhaseProps> = ({
  itemLabel,
  recipientLabel,
  selectedRole,
  onRoleChange,
  onBack,
  onConfirm,
  confirmLabel = 'Grant access',
}) => (
  <>
    <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0">
      <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
        <ArrowLeft className="w-4 h-4 text-slate-500" />
      </button>
      <Dialog.Title className="text-base font-semibold text-slate-900">
        Choose access level
      </Dialog.Title>
    </div>

    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs text-slate-500">
          Sharing <span className="font-medium text-slate-700">{itemLabel}</span> with{' '}
          <span className="font-medium text-slate-700">{recipientLabel}</span>
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          The access level you choose applies to all selected items.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          Access level
        </p>
        <RoleSelector value={selectedRole} onChange={onRoleChange} />
      </div>
    </div>

    <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0 flex gap-3">
      <Button variant="outline" className="flex-1" onClick={onBack}>
        Back
      </Button>
      <Button className="flex-1" onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  </>
);
