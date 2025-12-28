// src/features/Permissions/components/PermissionActionDialog.tsx

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Shield, UserPlus, Loader2, XCircle, ShieldCheck, Crown, Key } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BelroseUserProfile } from '@/types/core';
import { Role } from '@/features/Permissions/services/permissionsService';
import UserCard from '@/features/Users/components/ui/UserCard';
import { useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type DialogPhase = 'idle' | 'preparing' | 'confirming' | 'executing' | 'error';
export type OperationType = 'grant' | 'revoke';
export type RevokeAction = 'full-revoke' | 'demote-admin' | 'demote-viewer';
export type GrantVariant = 'confirm' | 'select-role';

interface PermissionActionDialogProps {
  isOpen: boolean;
  phase: DialogPhase;
  operationType: OperationType;
  role: Role;
  user: BelroseUserProfile | null;
  error?: string | null;
  grantVariant?: GrantVariant;
  onClose: () => void;
  onConfirmGrant: (role?: Role) => void;
  onConfirmRevoke: (action: RevokeAction) => void;
}

// ============================================================================
// ROLE CONFIG
// ============================================================================

// Role configuration for display, matching the SetSubject style
const ROLE_CONFIG: Record<
  Role,
  {
    label: string;
    description: string;
    icon: React.ElementType;
    textColor: string;
    bgColor: string;
    borderColor: string;
    selectedBg: string;
  }
> = {
  viewer: {
    label: 'Viewer',
    description: 'Can decrypt and view the record.',
    icon: Shield,
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    selectedBg: 'bg-yellow-100',
  },
  administrator: {
    label: 'Administrator',
    description: 'Can view, edit, share, and manage the record.',
    icon: ShieldCheck,
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    selectedBg: 'bg-blue-100',
  },
  owner: {
    label: 'Owner',
    description: 'Full control including deletion and adding other owners.',
    icon: Crown,
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    selectedBg: 'bg-amber-100',
  },
};

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
  grantVariant = 'confirm',
  onClose,
  onConfirmGrant,
  onConfirmRevoke,
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
          {phase === 'preparing' && <PreparingContent />}
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
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

// ============================================================================
// PHASE CONTENT COMPONENTS
// ============================================================================

const PreparingContent: React.FC = () => (
  <div className="flex flex-col items-center gap-4 py-4">
    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
    <AlertDialog.Title className="text-lg font-bold text-center">
      Preparing Blockchain
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      Verifying accounts and checking record status on-chain.
      <br />
      This may take a moment...
    </AlertDialog.Description>
  </div>
);

const ExecutingContent: React.FC<{ operationType: OperationType }> = ({ operationType }) => (
  <div className="flex flex-col items-center gap-4 py-4">
    <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
    <AlertDialog.Title className="text-lg font-bold text-center">
      {operationType === 'grant' ? 'Granting Access' : 'Updating Access'}
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      Writing to blockchain and updating encryption keys...
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
// SELECT ROLE GRANT (user picks the role - from GrantAccessModal)
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

      {/* Role Selection */}
      <div className="space-y-2 mb-4">
        {(Object.entries(ROLE_CONFIG) as [Role, (typeof ROLE_CONFIG)['viewer']][]).map(
          ([role, config]) => {
            const Icon = config.icon;
            const isSelected = selectedRole === role;

            return (
              <label
                key={role}
                className={`
                  flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer
                  ${isSelected ? `${config.borderColor} ${config.bgColor}/20` : 'border-gray-200 hover:border-gray-300'}
                `}
              >
                <input
                  type="radio"
                  name="accessRole"
                  value={role}
                  checked={isSelected}
                  onChange={() => setSelectedRole(role)}
                  className="w-4 h-4 text-primary"
                />
                <Icon className={`w-5 h-5 ${config.bgColor}`} />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{config.label}</p>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>
              </label>
            );
          }
        )}
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

export default PermissionActionDialog;
