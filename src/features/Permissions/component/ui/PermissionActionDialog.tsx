// src/features/Permissions/components/PermissionActionDialog.tsx

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import {
  Shield,
  UserPlus,
  Loader2,
  XCircle,
  ShieldCheck,
  Crown,
  Key,
  Stethoscope,
  FileText,
  Plus,
  X as XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BelroseUserProfile, FileObject } from '@/types/core';
import { Role } from '@/features/Permissions/services/permissionsService';
import UserCard from '@/features/Users/components/ui/UserCard';
import { useState } from 'react';
import NetworkPreparingContent from '@/features/BlockchainWallet/components/NetworkPreparingContent';
import RoleSelector, { ROLE_CONFIG } from './RoleSelector';

// ============================================================================
// TYPES
// ============================================================================

export type DialogPhase = 'idle' | 'preparing' | 'confirming' | 'executing' | 'error';
export type OperationType = 'grant' | 'revoke' | 'guest-invite';
export type RevokeAction = 'full-revoke' | 'demote-admin' | 'demote-viewer';
export type GrantVariant = 'confirm' | 'select-role';

interface PermissionActionDialogProps {
  isOpen: boolean;
  phase: DialogPhase;
  operationType: OperationType;
  role: Role;
  user: BelroseUserProfile | null;
  error?: string | null;
  preparationProgress?: { step: string; message: string } | null;
  grantVariant?: GrantVariant;
  onClose: () => void;
  onConfirmGrant: (role?: Role) => void;
  onConfirmRevoke: (action: RevokeAction) => void;
  onConfirmGuestInvite?: () => void;
  guestInviteProps?: {
    email: string;
    setEmail: (email: string) => void;
    duration: DurationOption;
    setDuration: (duration: DurationOption) => void;
    durationOptions: readonly DurationOption[];
    selectedRecords: FileObject[];
    loadingRecords: boolean;
    onOpenRecordPicker: () => void;
    onRemoveRecord: (id: string) => void;
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export const PermissionActionDialog: React.FC<PermissionActionDialogProps> = ({
  isOpen,
  phase,
  operationType,
  role,
  user,
  error,
  preparationProgress,
  grantVariant = 'confirm',
  onClose,
  onConfirmGrant,
  onConfirmRevoke,
  onConfirmGuestInvite,
  guestInviteProps,
}) => {
  // Don't render if closed or no user
  if (!isOpen) return null;

  const canClose = phase === 'confirming' || phase === 'error';

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && canClose && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 shadow-2xl z-[101] w-full max-w-md">
          {/* Render different content based on phase */}
          {phase === 'preparing' && (
            <NetworkPreparingContent
              progress={preparationProgress}
              steps={['computing', 'saving', 'registering', 'initializing_record']}
            />
          )}
          {phase === 'executing' && <ExecutingContent operationType={operationType} />}
          {phase === 'error' && <ErrorContent error={error} onClose={onClose} />}
          {phase === 'confirming' && operationType === 'grant' && grantVariant === 'confirm' && (
            <ConfirmGrantContent
              user={user}
              role={role}
              onConfirm={onConfirmGrant}
              onClose={onClose}
            />
          )}
          {phase === 'confirming' &&
            operationType === 'grant' &&
            grantVariant === 'select-role' && (
              <SelectRoleGrantContent
                user={user}
                defaultRole={role}
                onConfirm={onConfirmGrant}
                onClose={onClose}
              />
            )}
          {phase === 'confirming' && operationType === 'revoke' && (
            <ConfirmRevokeContent
              user={user}
              role={role}
              onConfirm={onConfirmRevoke}
              onClose={onClose}
            />
          )}
          {phase === 'confirming' && operationType === 'guest-invite' && guestInviteProps && (
            <GuestInviteContent
              {...guestInviteProps}
              onConfirm={onConfirmGuestInvite}
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

const ExecutingContent: React.FC<{ operationType: OperationType }> = ({ operationType }) => (
  <div className="flex flex-col items-center gap-4 py-4">
    <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
    <AlertDialog.Title className="text-lg font-bold text-center">
      {operationType === 'guest-invite'
        ? 'Sending Invite'
        : operationType === 'grant'
          ? 'Granting Access'
          : 'Updating Access'}
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      {operationType === 'guest-invite'
        ? 'Setting up guest access and sending email...'
        : 'Writing to network and updating encryption keys...'}
    </AlertDialog.Description>
  </div>
);

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

// ============================================================================
// CONFIRM GRANT CONTENT
// ============================================================================

interface ConfirmGrantContentProps {
  user: BelroseUserProfile | null;
  role: Role;
  onConfirm: (role: Role) => void;
  onClose: () => void;
}

const ConfirmGrantContent: React.FC<ConfirmGrantContentProps> = ({
  user,
  role,
  onConfirm,
  onClose,
}) => {
  const config = ROLE_CONFIG[role];
  const Icon = config.icon;

  return (
    <>
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-green-600" />
        Confirm Access Grant
      </AlertDialog.Title>

      <AlertDialog.Description className="mt-3 text-sm text-gray-600">
        You are about to grant <strong className={config.textColor}>{config.label}</strong> access
        to:
      </AlertDialog.Description>

      {user && (
        <div className="my-4">
          <UserCard user={user} variant="default" color="green" />
        </div>
      )}

      <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-3 mb-4`}>
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-4 h-4 ${config.textColor}`} />
          <span className="font-medium text-sm">{config.label}</span>
        </div>
        <p className="text-xs text-gray-600">{config.description}</p>
      </div>

      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
        <Button
          onClick={() => {
            onConfirm(role);
          }}
          className="flex-1"
        >
          Confirm
        </Button>
      </div>
    </>
  );
};

// ============================================================================
// SELECT ROLE GRANT
// ============================================================================

interface SelectRoleGrantContentProps {
  user: BelroseUserProfile | null;
  defaultRole: Role;
  onConfirm: (role: Role) => void;
  onClose: () => void;
}

const SelectRoleGrantContent: React.FC<SelectRoleGrantContentProps> = ({
  user,
  defaultRole,
  onConfirm,
  onClose,
}) => {
  const [selectedRole, setSelectedRole] = useState<Role>(defaultRole);

  return (
    <>
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
        <Key className="w-5 h-5 text-primary" />
        Grant Encrypted Access
      </AlertDialog.Title>
      <AlertDialog.Description className="mt-3 text-sm text-gray-600">
        Select a permission level for{' '}
        <strong>{user?.displayName || user?.email || 'this user'}</strong>.
      </AlertDialog.Description>
      {user && (
        <div className="my-4">
          <UserCard user={user} variant="compact" color="primary" />
        </div>
      )}

      {/* ↓ Replaced inline radio markup with the shared RoleSelector */}
      <div className="mb-4">
        <RoleSelector value={selectedRole} onChange={setSelectedRole} />
      </div>

      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
        <Button onClick={() => onConfirm(selectedRole)} className="flex-1">
          Grant Access
        </Button>
      </div>
    </>
  );
};

// ============================================================================
// CONFIRM REVOKE CONTENT
// ============================================================================

interface ConfirmRevokeContentProps {
  user: BelroseUserProfile | null;
  role: Role;
  onConfirm: (action: RevokeAction) => void;
  onClose: () => void;
}

const ConfirmRevokeContent: React.FC<ConfirmRevokeContentProps> = ({
  user,
  role,
  onConfirm,
  onClose,
}) => {
  const isOwner = role === 'owner';
  const isAdmin = role === 'administrator';

  return (
    <>
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
        <Shield className="w-5 h-5 text-red-600" />
        Revoke Access?
      </AlertDialog.Title>

      <AlertDialog.Description className="mt-3 text-sm text-gray-600">
        Choose how to handle access for{' '}
        <strong>{user?.displayName || user?.uid || 'this user'}</strong>.
        {isOwner && (
          <p className="mt-2 text-xs text-amber-600 font-medium">
            Note: Owners can only remove themselves.
          </p>
        )}
      </AlertDialog.Description>

      {user && (
        <div className="my-4">
          <UserCard user={user} variant="default" color="red" />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {/* Full Revocation */}
        <button
          onClick={() => onConfirm('full-revoke')}
          className="w-full text-left p-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
        >
          <div className="font-semibold text-red-700 text-sm">Full Revocation</div>
          <div className="text-xs text-red-600/80">Remove all keys and permissions.</div>
        </button>

        {/* Demote to Admin (Owner only) */}
        {isOwner && (
          <button
            onClick={() => onConfirm('demote-admin')}
            className="w-full text-left p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="font-semibold text-gray-900 text-sm">Demote to Administrator</div>
            <div className="text-xs text-gray-500">
              Remove ownership but keep full record management.
            </div>
          </button>
        )}

        {/* Demote to Viewer (Owner or Admin) */}
        {(isOwner || isAdmin) && (
          <button
            onClick={() => onConfirm('demote-viewer')}
            className="w-full text-left p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="font-semibold text-gray-900 text-sm">Demote to Viewer</div>
            <div className="text-xs text-gray-500">Keep read-only access only.</div>
          </button>
        )}

        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="mt-2" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
      </div>
    </>
  );
};

// ============================================================================
// GUEST INVITE CONTENT
// ============================================================================

type DurationOption = { label: string; seconds: number };

interface GuestInviteContentProps {
  email: string;
  setEmail: (email: string) => void;
  duration: DurationOption;
  setDuration: (duration: DurationOption) => void;
  durationOptions: readonly DurationOption[];
  selectedRecords: FileObject[];
  loadingRecords: boolean;
  onOpenRecordPicker: () => void;
  onRemoveRecord: (id: string) => void;
  onConfirm: (() => void) | undefined;
  onClose: () => void;
}

const GuestInviteContent: React.FC<GuestInviteContentProps> = ({
  email,
  setEmail,
  duration,
  setDuration,
  durationOptions,
  selectedRecords,
  loadingRecords,
  onOpenRecordPicker,
  onRemoveRecord,
  onConfirm,
  onClose,
}) => (
  <>
    <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
      <Stethoscope className="w-5 h-5 text-complement-4" />
      Share via Email
    </AlertDialog.Title>

    <AlertDialog.Description className="mt-3 text-sm text-gray-600">
      Share your Belrose records with guests. We'll email them a secure link.
    </AlertDialog.Description>

    <div className="my-4 space-y-3">
      {/* Email input */}
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="doctor@clinic.com"
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                   bg-white focus:outline-none focus:ring-2 focus:ring-complement-4"
        onKeyDown={e => e.key === 'Enter' && email && onConfirm?.()}
      />

      {/* Selected records */}
      <div>
        <p className="text-xs text-gray-500 mb-1.5">Sharing records:</p>
        {loadingRecords ? (
          <p className="text-xs text-gray-400">Loading your records...</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedRecords.map(r => (
              <div
                key={r.id}
                className="flex items-center gap-1 bg-slate-100 border border-slate-200 
                   rounded-md px-2 py-1 text-xs text-slate-700"
              >
                <FileText className="w-3 h-3 shrink-0" />
                <span className="max-w-[140px] truncate">
                  {r.belroseFields?.title || r.fileName || r.id}
                </span>
                {selectedRecords.length > 1 && (
                  <button
                    onClick={() => onRemoveRecord(r.id)}
                    className="ml-0.5 text-slate-400 hover:text-slate-600"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={onOpenRecordPicker}
              className="flex items-center gap-1 border border-dashed border-slate-300 
                         rounded-md px-2 py-1 text-xs text-slate-500
                         hover:border-slate-400 hover:text-slate-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add record
            </button>
          </div>
        )}
      </div>

      {/* Duration selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Link expires in:</span>
        <div className="flex gap-1">
          {durationOptions.map(option => (
            <button
              key={option.seconds}
              onClick={() => setDuration(option)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                duration.seconds === option.seconds
                  ? 'bg-complement-4 border-complement-4 text-white font-medium'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>

    <div className="flex gap-3">
      <AlertDialog.Cancel asChild>
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </AlertDialog.Cancel>
      <Button
        onClick={() => onConfirm?.()}
        disabled={!email || selectedRecords.length === 0}
        className="flex-1"
      >
        Send Invite
      </Button>
    </div>
  </>
);

export default PermissionActionDialog;
