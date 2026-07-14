// src/features/Trustee/components/TrusteeActionDialog.tsx
//
// Unified dialog for all trustee operations.
// Phase-based rendering — hook (useTrusteeFlow) drives state.
//
// Operations:
//   invite    — trustor invites a user (preparing → confirming → submitted)
//   accept    — trustee accepts invite (preparing → confirming → submitted)
//   decline   — trustee declines invite (confirming → executing, no blockchain)
//   revoke    — trustor revokes a trustee (preparing → confirming → submitted)
//   editLevel — trustor changes trust level (preparing → confirming → submitted)
//   resign    — trustee resigns (preparing → confirming → submitted)

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import {
  Loader2,
  XCircle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  UserPlus,
  UserMinus,
  LogOut,
  Pencil,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BelroseUserProfile } from '@/types/core';
import UserCard from '@/features/Users/components/ui/UserCard';
import { TrusteeDialogPhase, TrusteeOperationType } from '../../hooks/useTrusteeFlow';
import { TrustLevel } from '../../services/trusteeRelationshipService';
import { OnChainSubmittedContent } from '@/features/OnChainActivityTray/components/OnChainSubmittedModal';
import { TrustLevelBadge } from './TrusteeLevelBadge';

// ============================================================================
// TYPES
// ============================================================================

interface TrusteeActionDialogProps {
  isOpen: boolean;
  phase: TrusteeDialogPhase;
  operationType: TrusteeOperationType;
  error?: string | null;
  targetUser: BelroseUserProfile | null;
  trustLevel?: TrustLevel; // current level (for revoke/resign/accept/editLevel)
  selectedTrustLevel: TrustLevel; // bound to hook state (for invite/editLevel)
  setSelectedTrustLevel: (level: TrustLevel) => void;
  onClose: () => void;
  onConfirmInvite: () => void;
  onConfirmAccept: () => void;
  onConfirmDecline: () => void;
  onConfirmRevoke: () => void;
  onConfirmEditLevel: () => void;
  onConfirmResign: () => void;
  onConfirmStepDown: () => void;
  submittedLabel: string;
}

// ============================================================================
// TRUST LEVEL CONFIG
// ============================================================================

const TRUST_LEVEL_CONFIG: Record<
  TrustLevel,
  {
    label: string;
    description: string;
    icon: React.ElementType;
    textColor: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  observer: {
    label: 'Observer',
    description: 'Can view all records you are a subject of.',
    icon: Eye,
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  custodian: {
    label: 'Custodian',
    description: 'Can manage your records up to your own role level.',
    icon: ShieldCheck,
    textColor: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  controller: {
    label: 'Controller',
    description: 'Full access to your records, including ownership actions.',
    icon: ShieldAlert,
    textColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
};

const TRUST_LEVELS: TrustLevel[] = ['observer', 'custodian', 'controller'];

// ============================================================================
// SHARED PHASE CONTENT
// ============================================================================

const PreparingContent: React.FC = () => (
  <div className="flex flex-col items-center gap-4 py-8">
    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
    <AlertDialog.Title className="text-lg font-bold text-center">
      Preparing Distributed Network
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      Verifying distributed network accounts...
      <br />
      This may take a moment.
    </AlertDialog.Description>
  </div>
);

const ExecutingContent: React.FC<{ operationType: TrusteeOperationType }> = ({ operationType }) => {
  const messages: Record<string, string> = {
    decline: 'Declining invite...',
  };

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
      <AlertDialog.Title className="text-lg font-bold text-center">Processing</AlertDialog.Title>
      <AlertDialog.Description className="text-sm text-gray-600 text-center">
        {messages[operationType]}
      </AlertDialog.Description>
    </div>
  );
};

const ErrorContent: React.FC<{ error?: string | null; onClose: () => void }> = ({
  error,
  onClose,
}) => (
  <div className="flex flex-col items-center gap-4 py-8">
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
// TRUST LEVEL SELECTOR (shared by invite + editLevel)
// ============================================================================

const TrustLevelSelector: React.FC<{
  selected: TrustLevel;
  onChange: (level: TrustLevel) => void;
  disabledLevel?: TrustLevel;
  levels?: TrustLevel[]; // defaults to all three; pass subset to restrict choices
}> = ({ selected, onChange, disabledLevel, levels = TRUST_LEVELS }) => (
  <div className="space-y-2">
    {levels.map(level => {
      const config = TRUST_LEVEL_CONFIG[level];
      const Icon = config.icon;
      const isSelected = selected === level;
      const isDisabled = level === disabledLevel;

      return (
        <label
          key={level}
          className={`
            flex items-center gap-3 p-3 border rounded-lg transition-colors
            ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
            ${isSelected && !isDisabled ? `${config.borderColor} ${config.bgColor}` : 'border-gray-200 hover:border-gray-300'}
          `}
        >
          <input
            type="radio"
            name="trustLevel"
            value={level}
            checked={isSelected}
            onChange={() => onChange(level)}
            disabled={isDisabled}
            className="w-4 h-4"
          />
          <Icon className={`w-5 h-5 ${config.textColor}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 text-sm">{config.label}</p>
              {isDisabled && (
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                  Current
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{config.description}</p>
          </div>
        </label>
      );
    })}
  </div>
);

// ============================================================================
// CONFIRMING CONTENT VARIANTS
// ============================================================================

// ── Invite ────────────────────────────────────────────────────────────────────

const ConfirmInviteContent: React.FC<{
  targetUser: BelroseUserProfile | null;
  selectedTrustLevel: TrustLevel;
  setSelectedTrustLevel: (level: TrustLevel) => void;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ targetUser, selectedTrustLevel, setSelectedTrustLevel, onConfirm, onClose }) => (
  <div>
    <AlertDialog.Title className="text-lg font-bold flex items-center gap-2 mb-3">
      <UserPlus className="w-5 h-5 text-primary" />
      Invite Trustee
    </AlertDialog.Title>

    <AlertDialog.Description className="text-sm text-gray-600 mb-4">
      Select a trust level for{' '}
      <strong>{targetUser?.displayName || targetUser?.email || 'this user'}</strong>.
    </AlertDialog.Description>

    {targetUser && (
      <div className="mb-4">
        <UserCard user={targetUser} variant="default" color="primary" menuType="none" />
      </div>
    )}

    <p className="text-sm font-medium text-gray-700 mb-2">Trust Level</p>
    <TrustLevelSelector selected={selectedTrustLevel} onChange={setSelectedTrustLevel} />

    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
      <p className="text-xs text-blue-800 leading-relaxed">
        <strong>Note:</strong> The invite will be recorded on the distributed network. The user must
        accept before gaining access.
      </p>
    </div>

    <div className="flex gap-3">
      <AlertDialog.Cancel asChild>
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </AlertDialog.Cancel>
      <Button onClick={onConfirm} className="flex-1">
        Send Invite
      </Button>
    </div>
  </div>
);

// ── Accept ────────────────────────────────────────────────────────────────────

const ConfirmAcceptContent: React.FC<{
  targetUser: BelroseUserProfile | null;
  trustLevel?: TrustLevel;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ targetUser, trustLevel, onConfirm, onClose }) => {
  const config = trustLevel ? TRUST_LEVEL_CONFIG[trustLevel] : null;
  const Icon = config?.icon ?? Shield;

  return (
    <div>
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2 mb-3">
        <Check className="w-5 h-5 text-green-600" />
        Accept Trustee Invite
      </AlertDialog.Title>

      <AlertDialog.Description className="text-sm text-gray-600 mb-4">
        <strong>{targetUser?.displayName || 'This user'}</strong> has invited you to be their
        trustee.
      </AlertDialog.Description>

      {targetUser && (
        <div className="mb-4">
          <UserCard user={targetUser} variant="default" color="green" menuType="none" />
        </div>
      )}

      {trustLevel && config && (
        <div className={`p-3 border rounded-lg ${config.bgColor} ${config.borderColor} mb-4`}>
          <p className="text-xs text-gray-500 mb-1">Your trust level</p>
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${config.textColor}`} />
            <span className="font-medium text-sm">{config.label}</span>
            <span className="text-xs text-gray-500">— {config.description}</span>
          </div>
        </div>
      )}

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
        <p className="text-xs text-blue-800 leading-relaxed">
          Accepting will be recorded on the distributed network. You can resign at any time.
        </p>
      </div>

      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
        <Button onClick={onConfirm} className="flex-1 bg-green-600 hover:bg-green-700">
          Accept
        </Button>
      </div>
    </div>
  );
};

// ── Decline ───────────────────────────────────────────────────────────────────

const ConfirmDeclineContent: React.FC<{
  targetUser: BelroseUserProfile | null;
  trustLevel?: TrustLevel;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ targetUser, trustLevel, onConfirm, onClose }) => (
  <div>
    <AlertDialog.Title className="text-lg font-bold flex items-center gap-2 mb-3">
      <XCircle className="w-5 h-5 text-red-500" />
      Decline Trustee Invite
    </AlertDialog.Title>

    <AlertDialog.Description className="text-sm text-gray-600 mb-4">
      You are declining a trustee invite from{' '}
      <strong>{targetUser?.displayName || 'this user'}</strong>.
    </AlertDialog.Description>

    {targetUser && (
      <div className="mb-4">
        <UserCard user={targetUser} variant="default" color="red" menuType="none" />
      </div>
    )}

    {trustLevel && (
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
        <span>Offered level:</span>
        <TrustLevelBadge level={trustLevel} />
      </div>
    )}

    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg mb-4">
      <p className="text-xs text-gray-600">
        No distributed network transaction required. The user will be notified.
      </p>
    </div>

    <div className="flex gap-3">
      <AlertDialog.Cancel asChild>
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </AlertDialog.Cancel>
      <Button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700">
        Decline Invite
      </Button>
    </div>
  </div>
);

// ── Revoke ────────────────────────────────────────────────────────────────────

const ConfirmRevokeContent: React.FC<{
  targetUser: BelroseUserProfile | null;
  trustLevel?: TrustLevel;
  selectedTrustLevel: TrustLevel;
  setSelectedTrustLevel: (level: TrustLevel) => void;
  onConfirmEditLevel: () => void;
  onConfirmRevoke: () => void;
  onClose: () => void;
}> = ({
  targetUser,
  trustLevel,
  selectedTrustLevel,
  setSelectedTrustLevel,
  onConfirmEditLevel,
  onConfirmRevoke,
  onClose,
}) => (
  <div>
    <AlertDialog.Title className="text-lg font-bold flex items-center gap-2 mb-3">
      <Pencil className="w-5 h-5 text-primary" />
      Update or Revoke Trustee
    </AlertDialog.Title>

    <AlertDialog.Description className="text-sm text-gray-600 mb-4">
      Adjust <strong>{targetUser?.displayName || 'this user'}</strong>'s trust level, or remove
      their access entirely.
    </AlertDialog.Description>

    {targetUser && (
      <div className="mb-4">
        <UserCard user={targetUser} variant="default" color="primary" menuType="none" />
      </div>
    )}

    <p className="text-sm font-medium text-gray-700 mb-2">Select new trust level</p>
    <TrustLevelSelector
      selected={selectedTrustLevel}
      onChange={setSelectedTrustLevel}
      disabledLevel={trustLevel}
    />

    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
      <p className="text-xs text-blue-800">
        The change will be recorded on the distributed network and their record access will be
        updated.
      </p>
    </div>

    <div className="flex gap-3 mb-4">
      <AlertDialog.Cancel asChild>
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </AlertDialog.Cancel>
      <Button
        onClick={onConfirmEditLevel}
        className="flex-1"
        disabled={selectedTrustLevel === trustLevel}
      >
        Change Level
      </Button>
    </div>

    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 border-t border-gray-200" />
      <span className="text-xs text-gray-400">or</span>
      <div className="flex-1 border-t border-gray-200" />
    </div>

    <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
      <p className="text-xs text-red-800 leading-relaxed">
        <strong>Fully revoking will:</strong> remove their trustee role, revoke access to records
        you added them to, and delete their encryption keys.
      </p>
    </div>

    <Button
      onClick={onConfirmRevoke}
      variant="outline"
      className="w-full border-red-300 text-red-600 hover:bg-red-50"
    >
      <UserMinus className="w-4 h-4 mr-2" />
      Fully Revoke Access
    </Button>
  </div>
);

// ── Edit Level ────────────────────────────────────────────────────────────────

const ConfirmEditLevelContent: React.FC<{
  targetUser: BelroseUserProfile | null;
  trustLevel?: TrustLevel; // current level
  selectedTrustLevel: TrustLevel; // new level
  setSelectedTrustLevel: (level: TrustLevel) => void;
  onConfirm: () => void;
  onClose: () => void;
}> = ({
  targetUser,
  trustLevel,
  selectedTrustLevel,
  setSelectedTrustLevel,
  onConfirm,
  onClose,
}) => (
  <div>
    <AlertDialog.Title className="text-lg font-bold flex items-center gap-2 mb-3">
      <Pencil className="w-5 h-5 text-primary" />
      Edit Trust Level
    </AlertDialog.Title>

    <AlertDialog.Description className="text-sm text-gray-600 mb-4">
      Change the trust level for <strong>{targetUser?.displayName || 'this user'}</strong>.
    </AlertDialog.Description>

    {targetUser && (
      <div className="mb-4">
        <UserCard user={targetUser} variant="default" color="primary" menuType="none" />
      </div>
    )}

    <p className="text-sm font-medium text-gray-700 mb-2">Select new trust level</p>
    <TrustLevelSelector
      selected={selectedTrustLevel}
      onChange={setSelectedTrustLevel}
      disabledLevel={trustLevel}
    />

    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
      <p className="text-xs text-blue-800">
        The change will be recorded on the distributed network and their record access will be
        updated.
      </p>
    </div>

    <div className="flex gap-3">
      <AlertDialog.Cancel asChild>
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </AlertDialog.Cancel>
      <Button onClick={onConfirm} className="flex-1" disabled={selectedTrustLevel === trustLevel}>
        Update Level
      </Button>
    </div>
  </div>
);

// ── Resign ────────────────────────────────────────────────────────────────────

const LEVEL_ORDER: TrustLevel[] = ['observer', 'custodian', 'controller'];

const ConfirmResignContent: React.FC<{
  targetUser: BelroseUserProfile | null;
  trustLevel?: TrustLevel;
  selectedTrustLevel: TrustLevel;
  setSelectedTrustLevel: (level: TrustLevel) => void;
  onConfirmStepDown: () => void;
  onConfirmResign: () => void;
  onClose: () => void;
}> = ({
  targetUser,
  trustLevel,
  selectedTrustLevel,
  setSelectedTrustLevel,
  onConfirmStepDown,
  onConfirmResign,
  onClose,
}) => {
  const canStepDown = trustLevel !== undefined && trustLevel !== 'observer';
  const levelsBelow = trustLevel
    ? LEVEL_ORDER.filter(l => LEVEL_ORDER.indexOf(l) < LEVEL_ORDER.indexOf(trustLevel))
    : [];

  return (
    <div>
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2 mb-3">
        <LogOut className="w-5 h-5 text-orange-500" />
        Step Down or Resign as Trustee
      </AlertDialog.Title>

      <AlertDialog.Description className="text-sm text-gray-600 mb-4">
        Reduce your responsibilities for{' '}
        <strong>{targetUser?.displayName || 'this user'}</strong>, or resign entirely.
      </AlertDialog.Description>

      {targetUser && (
        <div className="mb-4">
          <UserCard user={targetUser} variant="default" color="yellow" menuType="none" />
        </div>
      )}

      {canStepDown && (
        <>
          <p className="text-sm font-medium text-gray-700 mb-2">Step down to a lower level</p>
          <TrustLevelSelector
            selected={selectedTrustLevel}
            onChange={setSelectedTrustLevel}
            levels={levelsBelow}
          />

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            <p className="text-xs text-blue-800">
              The change will be recorded on the distributed network. Your access will be updated to
              match the new level.
            </p>
          </div>

          <div className="flex gap-3 mb-4">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button onClick={onConfirmStepDown} className="flex-1">
              Step Down
            </Button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>
        </>
      )}

      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg mb-3">
        <p className="text-xs text-orange-800 leading-relaxed">
          <strong>Fully resigning will:</strong> remove your trustee role entirely and revoke all
          access to their records.
        </p>
      </div>

      {canStepDown ? (
        <Button
          onClick={onConfirmResign}
          variant="outline"
          className="w-full border-orange-300 text-orange-600 hover:bg-orange-50"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Fully Resign
        </Button>
      ) : (
        <div className="flex gap-3">
          <AlertDialog.Cancel asChild>
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
          </AlertDialog.Cancel>
          <Button onClick={onConfirmResign} className="flex-1 bg-orange-600 hover:bg-orange-700">
            Resign
          </Button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN DIALOG
// ============================================================================

export const TrusteeActionDialog: React.FC<TrusteeActionDialogProps> = ({
  isOpen,
  phase,
  operationType,
  error,
  targetUser,
  trustLevel,
  selectedTrustLevel,
  setSelectedTrustLevel,
  onClose,
  onConfirmInvite,
  onConfirmAccept,
  onConfirmDecline,
  onConfirmRevoke,
  onConfirmEditLevel,
  onConfirmResign,
  onConfirmStepDown,
  submittedLabel,
}) => {
  if (!isOpen) return null;

  const canClose = phase === 'confirming' || phase === 'error' || phase === 'submitted';

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && canClose && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-xl shadow-2xl z-[101] w-full max-w-md max-h-[90vh] overflow-y-auto">
          {phase === 'preparing' && <PreparingContent />}
          {phase === 'executing' && <ExecutingContent operationType={operationType} />}
          {phase === 'error' && <ErrorContent error={error} onClose={onClose} />}

          {phase === 'confirming' && operationType === 'invite' && (
            <ConfirmInviteContent
              targetUser={targetUser}
              selectedTrustLevel={selectedTrustLevel}
              setSelectedTrustLevel={setSelectedTrustLevel}
              onConfirm={onConfirmInvite}
              onClose={onClose}
            />
          )}
          {phase === 'confirming' && operationType === 'accept' && (
            <ConfirmAcceptContent
              targetUser={targetUser}
              trustLevel={trustLevel}
              onConfirm={onConfirmAccept}
              onClose={onClose}
            />
          )}
          {phase === 'confirming' && operationType === 'decline' && (
            <ConfirmDeclineContent
              targetUser={targetUser}
              trustLevel={trustLevel}
              onConfirm={onConfirmDecline}
              onClose={onClose}
            />
          )}
          {phase === 'confirming' && operationType === 'revoke' && (
            <ConfirmRevokeContent
              targetUser={targetUser}
              trustLevel={trustLevel}
              selectedTrustLevel={selectedTrustLevel}
              setSelectedTrustLevel={setSelectedTrustLevel}
              onConfirmEditLevel={onConfirmEditLevel}
              onConfirmRevoke={onConfirmRevoke}
              onClose={onClose}
            />
          )}
          {phase === 'confirming' && operationType === 'editLevel' && (
            <ConfirmEditLevelContent
              targetUser={targetUser}
              trustLevel={trustLevel}
              selectedTrustLevel={selectedTrustLevel}
              setSelectedTrustLevel={setSelectedTrustLevel}
              onConfirm={onConfirmEditLevel}
              onClose={onClose}
            />
          )}
          {phase === 'confirming' && operationType === 'resign' && (
            <ConfirmResignContent
              targetUser={targetUser}
              trustLevel={trustLevel}
              selectedTrustLevel={selectedTrustLevel}
              setSelectedTrustLevel={setSelectedTrustLevel}
              onConfirmStepDown={onConfirmStepDown}
              onConfirmResign={onConfirmResign}
              onClose={onClose}
            />
          )}
          {phase === 'submitted' && (
            <OnChainSubmittedContent onClose={onClose} label={submittedLabel} />
          )}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default TrusteeActionDialog;
