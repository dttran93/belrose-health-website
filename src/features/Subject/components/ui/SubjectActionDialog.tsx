// src/features/Subject/components/ui/SubjectActionDialog.tsx

/**
 * SubjectActionDialog
 *
 * Unified modal dialog for all subject operations:
 * - Adding subjects (self or others) with selection/search phases
 * - Accepting/rejecting subject requests
 * - Removing subject status
 *
 * Phases:
 * - selecting: Choose self vs other, role selection
 * - searching: User search for "other" flow
 * - preparing: Wallet setup with progress
 * - confirming: Final confirmation
 * - executing: Operation in progress
 * - success: Operation completed
 * - error: Operation failed
 */

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import {
  User,
  Users,
  UserCheck,
  UserMinus,
  UserX,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Link,
  Unlink,
  Shield,
  ShieldCheck,
  Crown,
  ArrowLeft,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import type {
  SubjectOperationType,
  SubjectPreparationProgress,
} from '../../services/subjectPreparationService';
import type { SubjectDialogPhase, SubjectRole, SubjectChoice } from '../../hooks/useSubjectFlow';
import { getUserRoleForRecord, getMinimumAllowedRole } from '../../hooks/useSubjectFlow';
import { FileObject, BelroseUserProfile } from '@/types/core';
import UserSearch from '@/features/Users/components/UserSearch';
import UserCard from '@/features/Users/components/ui/UserCard';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { REJECTION_REASON_OPTIONS, RejectionReasons } from '../../services/subjectRejectionService';

// ============================================================================
// TYPES
// ============================================================================

interface SubjectActionDialogProps {
  isOpen: boolean;
  phase: SubjectDialogPhase;
  operationType: SubjectOperationType;
  error?: string | null;
  preparationProgress?: SubjectPreparationProgress | null;
  // Selection state
  subjectChoice: SubjectChoice;
  setSubjectChoice: (choice: SubjectChoice) => void;
  selectedRole: SubjectRole;
  setSelectedRole: (role: SubjectRole) => void;
  selectedUser: BelroseUserProfile | null;
  setSelectedUser: (user: BelroseUserProfile | null) => void;
  revokeAccess: boolean;
  setRevokeAccess: (value: boolean) => void;
  // Record info
  record: FileObject;
  currentSubjects: string[];
  isSubject: boolean;
  // Callbacks
  onClose: () => void;
  onProceedFromSelection: () => void;
  onSelectUser: (user: BelroseUserProfile) => void;
  onGoBackToSelection: () => void;
  onGoBackToSearching: () => void;
  onConfirmSetSubjectAsSelf: () => void;
  onConfirmRequestConsent: () => void;
  onConfirmAcceptRequest: () => void;
  onConfirmRejectRequest: (reason: RejectionReasons) => void;
  onConfirmRemoveSubjectStatus: (reason: RejectionReasons) => void;
}

// Role configuration for display
const ROLE_CONFIG: Record<
  SubjectRole,
  {
    label: string;
    description: string;
    icon: React.ElementType;
    color: string;
    borderColor: string;
    bgColor: string;
  }
> = {
  viewer: {
    label: 'Viewer',
    description: 'Can view the record but cannot edit or manage it',
    icon: Shield,
    color: 'text-yellow-600',
    borderColor: 'border-yellow-200',
    bgColor: 'bg-yellow-50',
  },
  administrator: {
    label: 'Administrator',
    description: 'Can view, edit, share, and manage the record',
    icon: ShieldCheck,
    color: 'text-blue-600',
    borderColor: 'border-blue-200',
    bgColor: 'bg-blue-50',
  },
  owner: {
    label: 'Owner',
    description: 'Full control including deletion and adding other owners',
    icon: Crown,
    color: 'text-amber-600',
    borderColor: 'border-amber-200',
    bgColor: 'bg-amber-50',
  },
};

const ROLE_HIERARCHY: Record<SubjectRole, number> = {
  viewer: 1,
  administrator: 2,
  owner: 3,
};

// ============================================================================
// COMPONENT
// ============================================================================

export const SubjectActionDialog: React.FC<SubjectActionDialogProps> = ({
  isOpen,
  phase,
  operationType,
  error,
  preparationProgress,
  subjectChoice,
  setSubjectChoice,
  selectedRole,
  setSelectedRole,
  selectedUser,
  setSelectedUser,
  revokeAccess,
  setRevokeAccess,
  record,
  currentSubjects,
  isSubject,
  onClose,
  onProceedFromSelection,
  onSelectUser,
  onGoBackToSelection,
  onGoBackToSearching,
  onConfirmSetSubjectAsSelf,
  onConfirmRequestConsent,
  onConfirmAcceptRequest,
  onConfirmRejectRequest,
  onConfirmRemoveSubjectStatus,
}) => {
  const { user } = useAuthContext();

  if (!isOpen) return null;

  const canClose =
    phase === 'selecting' ||
    phase === 'searching' ||
    phase === 'confirming' ||
    phase === 'error' ||
    phase === 'success';

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={open => !open && canClose && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-[101] w-full max-w-md max-h-[90vh] overflow-y-auto">
          {/* Selecting Phase */}
          {phase === 'selecting' && (
            <SelectingContent
              record={record}
              currentSubjects={currentSubjects}
              isSubject={isSubject}
              subjectChoice={subjectChoice}
              setSubjectChoice={setSubjectChoice}
              selectedRole={selectedRole}
              setSelectedRole={setSelectedRole}
              onProceed={onProceedFromSelection}
              onClose={onClose}
            />
          )}

          {/* Searching Phase */}
          {phase === 'searching' && (
            <SearchingContent
              record={record}
              currentSubjects={currentSubjects}
              selectedRole={selectedRole}
              onSelectUser={onSelectUser}
              onGoBack={onGoBackToSelection}
              onClose={onClose}
            />
          )}

          {/* Preparing Phase */}
          {phase === 'preparing' && <PreparingContent progress={preparationProgress} />}

          {/* Executing Phase */}
          {phase === 'executing' && <ExecutingContent operationType={operationType} />}

          {/* Error Phase */}
          {phase === 'error' && <ErrorContent error={error} onClose={onClose} />}

          {/* Success Phase */}
          {phase === 'success' && (
            <SuccessContent operationType={operationType} onClose={onClose} />
          )}

          {/* Confirming Phase - Set Self as Subject */}
          {phase === 'confirming' && operationType === 'setSubjectAsSelf' && (
            <ConfirmSetSubjectAsSelfContent
              record={record}
              selectedRole={selectedRole}
              onConfirm={onConfirmSetSubjectAsSelf}
              onClose={onClose}
            />
          )}

          {/* Confirming Phase - Request Consent (other flow) */}
          {phase === 'confirming' && selectedUser && subjectChoice === 'other' && (
            <ConfirmRequestConsentContent
              record={record}
              selectedUser={selectedUser}
              selectedRole={selectedRole}
              onConfirm={onConfirmRequestConsent}
              onGoBack={onGoBackToSearching}
              onClose={onClose}
            />
          )}

          {/* Confirming Phase - Accept Subject Request */}
          {phase === 'confirming' && operationType === 'acceptSubjectRequest' && !selectedUser && (
            <ConfirmAcceptRequestContent
              record={record}
              onConfirm={onConfirmAcceptRequest}
              onClose={onClose}
            />
          )}

          {/* Confirming Phase - Reject Subject Request */}
          {phase === 'confirming' && operationType === 'rejectSubjectRequest' && (
            <ConfirmRejectRequestContent
              record={record}
              onConfirm={(reason: RejectionReasons) => onConfirmRejectRequest(reason)}
              onClose={onClose}
            />
          )}

          {/* Confirming Phase - Remove Subject Status */}
          {phase === 'confirming' && operationType === 'rejectSubjectStatus' && (
            <ConfirmRemoveSubjectStatusContent
              record={record}
              revokeAccess={revokeAccess}
              setRevokeAccess={setRevokeAccess}
              onConfirm={(reason: RejectionReasons) => onConfirmRemoveSubjectStatus(reason)}
              onClose={onClose}
            />
          )}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

// ============================================================================
// SELECTING PHASE CONTENT
// ============================================================================

const SelectingContent: React.FC<{
  record: FileObject;
  currentSubjects: string[];
  isSubject: boolean;
  subjectChoice: SubjectChoice;
  setSubjectChoice: (choice: SubjectChoice) => void;
  selectedRole: SubjectRole;
  setSelectedRole: (role: SubjectRole) => void;
  onProceed: () => void;
  onClose: () => void;
}> = ({
  record,
  currentSubjects,
  isSubject,
  subjectChoice,
  setSubjectChoice,
  selectedRole,
  setSelectedRole,
  onProceed,
  onClose,
}) => {
  const { user } = useAuthContext();
  const userCurrentRole = user?.uid ? getUserRoleForRecord(user.uid, record) : null;
  const minimumRole = user?.uid ? getMinimumAllowedRole(user.uid, record) : 'viewer';
  const minimumRoleLevel = ROLE_HIERARCHY[minimumRole];

  // Filter roles based on user's current role (for self)
  const allowedRoles = (Object.keys(ROLE_CONFIG) as SubjectRole[]).filter(role => {
    if (subjectChoice === 'self') {
      return ROLE_HIERARCHY[role] >= minimumRoleLevel;
    }
    return true;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
          <User className="w-5 h-5" />
          Set Record Subject
        </AlertDialog.Title>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <AlertDialog.Description className="text-sm text-gray-600 mb-4">
        Who is this record about?
      </AlertDialog.Description>

      {/* Subject Choice */}
      <div className="space-y-2 mb-4">
        {/* Self Option */}
        <label
          className={`
            flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors
            ${isSubject ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}
            ${subjectChoice === 'self' && !isSubject ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
          `}
        >
          <input
            type="radio"
            name="subjectChoice"
            value="self"
            checked={subjectChoice === 'self'}
            onChange={() => setSubjectChoice('self')}
            disabled={isSubject}
            className="w-4 h-4 text-blue-600"
          />
          <User className="w-5 h-5 text-gray-600" />
          <div className="flex-1">
            <p className="font-medium text-gray-900">This record is about me</p>
            <p className="text-xs text-gray-500">
              {isSubject
                ? 'You are already set as a subject'
                : 'You will be immediately added as the subject'}
            </p>
          </div>
        </label>

        {/* Other Person Option */}
        <label
          className={`
            flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors
            ${subjectChoice === 'other' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
          `}
        >
          <input
            type="radio"
            name="subjectChoice"
            value="other"
            checked={subjectChoice === 'other'}
            onChange={() => setSubjectChoice('other')}
            className="w-4 h-4 text-blue-600"
          />
          <Users className="w-5 h-5 text-gray-600" />
          <div className="flex-1">
            <p className="font-medium text-gray-900">This record is about someone else</p>
            <p className="text-xs text-gray-500">They will need to confirm before being added</p>
          </div>
        </label>
      </div>

      {/* Role Selection */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Select access level:</p>
        <div className="space-y-2">
          {allowedRoles.map(role => {
            const config = ROLE_CONFIG[role];
            const Icon = config.icon;
            const isSelected = selectedRole === role;

            return (
              <label
                key={role}
                className={`
                  flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                  ${isSelected ? `${config.borderColor} ${config.bgColor}` : 'border-gray-200 hover:border-gray-300'}
                `}
              >
                <input
                  type="radio"
                  name="roleChoice"
                  value={role}
                  checked={isSelected}
                  onChange={() => setSelectedRole(role)}
                  className="w-4 h-4 text-blue-600"
                />
                <Icon className={`w-5 h-5 ${config.color}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{config.label}</p>
                    {subjectChoice === 'self' && userCurrentRole === role && (
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

        {subjectChoice === 'self' && userCurrentRole && userCurrentRole !== 'viewer' && (
          <p className="text-xs text-gray-500 mt-2 italic">
            Lower permission levels are not shown to prevent downgrading.
          </p>
        )}
      </div>

      {/* Blockchain Info (for self) */}
      {subjectChoice === 'self' && !isSubject && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex gap-2">
          <Link className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Blockchain Anchoring</p>
            <p className="text-xs mt-1 text-blue-800">
              Your subject status will be recorded on the blockchain for verification.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
        <Button
          onClick={onProceed}
          disabled={subjectChoice === 'self' && isSubject}
          className="flex-1"
        >
          {subjectChoice === 'self' ? 'Continue' : 'Search Users'}
        </Button>
      </div>
    </div>
  );
};

// ============================================================================
// SEARCHING PHASE CONTENT
// ============================================================================

const SearchingContent: React.FC<{
  record: FileObject;
  currentSubjects: string[];
  selectedRole: SubjectRole;
  onSelectUser: (user: BelroseUserProfile) => void;
  onGoBack: () => void;
  onClose: () => void;
}> = ({ record, currentSubjects, selectedRole, onSelectUser, onGoBack, onClose }) => {
  const { user } = useAuthContext();

  const handleUserSelect = (user: BelroseUserProfile) => {
    onSelectUser(user);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={onGoBack} className="p-1 rounded hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <AlertDialog.Title className="text-lg font-bold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Search for Subject
          </AlertDialog.Title>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <AlertDialog.Description className="text-sm text-gray-600 mb-4">
        Search for the person this record is about. They will need to accept your request.
      </AlertDialog.Description>

      {/* User Search */}
      <div className="mb-4">
        <UserSearch
          onUserSelect={handleUserSelect}
          excludeUserIds={[...currentSubjects, user?.uid || '']}
          placeholder="Search by name, email, or user ID..."
          autoFocus
        />
      </div>

      {/* Role Badge */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500 mb-1">Access Level</p>
        <div className="flex items-center gap-2">
          {(() => {
            const config = ROLE_CONFIG[selectedRole];
            const Icon = config.icon;
            return (
              <>
                <Icon className={`w-4 h-4 ${config.color}`} />
                <span className="font-medium">{config.label}</span>
              </>
            );
          })()}
        </div>
      </div>

      {/* Consent Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900">Consent Required</p>
          <p className="text-xs mt-1 text-amber-800">
            The selected user will receive a notification and must accept before they are added.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onGoBack}>
          Back
        </Button>
        <Button disabled className="flex-1">
          Send Request
        </Button>
      </div>
    </div>
  );
};

// ============================================================================
// PHASE CONTENT COMPONENTS
// ============================================================================

const PreparingContent: React.FC<{ progress?: SubjectPreparationProgress | null }> = ({
  progress,
}) => (
  <div className="p-6 flex flex-col items-center gap-4 py-8">
    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
    <AlertDialog.Title className="text-lg font-bold text-center">
      Preparing Secure Connection
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      {progress?.message || 'Setting up your blockchain account...'}
    </AlertDialog.Description>

    {/* Progress Steps */}
    <div className="w-full mt-2 space-y-2">
      <ProgressStep
        label="Computing wallet address"
        status={
          progress?.step === 'computing'
            ? 'active'
            : progress?.step && ['saving', 'registering', 'complete'].includes(progress.step)
              ? 'complete'
              : 'pending'
        }
      />
      <ProgressStep
        label="Saving to profile"
        status={
          progress?.step === 'saving'
            ? 'active'
            : progress?.step && ['registering', 'complete'].includes(progress.step)
              ? 'complete'
              : 'pending'
        }
      />
      <ProgressStep
        label="Registering on blockchain"
        status={
          progress?.step === 'registering'
            ? 'active'
            : progress?.step === 'complete'
              ? 'complete'
              : 'pending'
        }
      />
    </div>
  </div>
);

const ProgressStep: React.FC<{
  label: string;
  status: 'pending' | 'active' | 'complete';
}> = ({ label, status }) => (
  <div className="flex items-center gap-2">
    {status === 'complete' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
    {status === 'active' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
    {status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}
    <span
      className={`text-sm ${
        status === 'complete'
          ? 'text-green-600'
          : status === 'active'
            ? 'text-blue-600 font-medium'
            : 'text-gray-400'
      }`}
    >
      {label}
    </span>
  </div>
);

const ExecutingContent: React.FC<{ operationType: SubjectOperationType }> = ({ operationType }) => {
  const messages: Record<SubjectOperationType, string> = {
    setSubjectAsSelf: 'Linking you to this record...',
    acceptSubjectRequest: 'Accepting subject request...',
    rejectSubjectRequest: 'Declining subject request...',
    rejectSubjectStatus: 'Removing your subject status...',
    removeSubjectByOwner: 'Removing subject from record...',
  };

  return (
    <div className="p-6 flex flex-col items-center gap-4 py-8">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      <AlertDialog.Title className="text-lg font-bold text-center">Processing</AlertDialog.Title>
      <AlertDialog.Description className="text-sm text-gray-600 text-center">
        {messages[operationType] || 'Processing your request...'}
      </AlertDialog.Description>
    </div>
  );
};

const ErrorContent: React.FC<{ error?: string | null; onClose: () => void }> = ({
  error,
  onClose,
}) => (
  <div className="p-6 flex flex-col items-center gap-4 py-8">
    <XCircle className="w-10 h-10 text-red-500" />
    <AlertDialog.Title className="text-lg font-bold text-center text-red-600">
      Something went wrong
    </AlertDialog.Title>
    <AlertDialog.Description className="text-sm text-gray-600 text-center">
      {error || 'An unexpected error occurred. Please try again.'}
    </AlertDialog.Description>
    <Button onClick={onClose} variant="outline" className="mt-2">
      Close
    </Button>
  </div>
);

const SuccessContent: React.FC<{
  operationType: SubjectOperationType;
  onClose: () => void;
}> = ({ operationType, onClose }) => {
  const messages: Record<SubjectOperationType, string> = {
    setSubjectAsSelf: 'You are now linked to this record as a subject.',
    acceptSubjectRequest: 'You have accepted the subject request.',
    rejectSubjectRequest: 'You have declined the subject request.',
    rejectSubjectStatus: 'You have been removed as a subject of this record.',
    removeSubjectByOwner: 'Subject has been removed from the record.',
  };

  return (
    <div className="p-6 flex flex-col items-center gap-4 py-8">
      <CheckCircle2 className="w-10 h-10 text-green-500" />
      <AlertDialog.Title className="text-lg font-bold text-center text-green-600">
        Success
      </AlertDialog.Title>
      <AlertDialog.Description className="text-sm text-gray-600 text-center">
        {messages[operationType] || 'Operation completed successfully!'}
      </AlertDialog.Description>
      <Button onClick={onClose} className="mt-2 bg-green-600 hover:bg-green-700">
        Done
      </Button>
    </div>
  );
};

// ============================================================================
// CONFIRM CONTENT COMPONENTS
// ============================================================================

const ConfirmSetSubjectAsSelfContent: React.FC<{
  record: FileObject;
  selectedRole: SubjectRole;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ record, selectedRole, onConfirm, onClose }) => {
  const roleConfig = ROLE_CONFIG[selectedRole];
  const RoleIcon = roleConfig.icon;

  return (
    <div className="p-6">
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2 mb-3">
        <UserCheck className="w-5 h-5 text-blue-500" />
        Confirm Subject Status
      </AlertDialog.Title>

      <AlertDialog.Description className="text-sm text-gray-600 mb-4">
        You are about to declare yourself as the subject of this record.
      </AlertDialog.Description>

      {/* Record Info */}
      <div className="p-3 border rounded-lg bg-gray-50 mb-4">
        <p className="text-xs text-gray-500 mb-1">Record</p>
        <p className="font-medium text-gray-900">
          {record.belroseFields?.title || record.fileName || 'Untitled Record'}
        </p>
      </div>

      {/* Role Info */}
      <div className={`p-3 border rounded-lg ${roleConfig.bgColor} ${roleConfig.borderColor} mb-4`}>
        <p className="text-xs text-gray-500 mb-1">Access Level</p>
        <div className="flex items-center gap-2">
          <RoleIcon className={`w-5 h-5 ${roleConfig.color}`} />
          <span className="font-medium">{roleConfig.label}</span>
        </div>
      </div>

      {/* Info Card */}
      <div className="p-4 border rounded-lg bg-blue-50 border-blue-200 mb-4">
        <div className="flex gap-3">
          <Link className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-900">What this means</p>
            <ul className="mt-2 text-sm text-blue-800 space-y-1">
              <li>• This record is about you or pertains to you</li>
              <li>• Your link will be recorded on the blockchain</li>
              <li>• You can remove this link at any time</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Note:</strong> By confirming, you are attesting that this record is about you.
        </p>
      </div>

      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
        <Button onClick={onConfirm} className="flex-1 bg-blue-600 hover:bg-blue-700">
          Confirm
        </Button>
      </div>
    </div>
  );
};

const ConfirmRequestConsentContent: React.FC<{
  record: FileObject;
  selectedUser: BelroseUserProfile;
  selectedRole: SubjectRole;
  onConfirm: () => void;
  onGoBack: () => void;
  onClose: () => void;
}> = ({ record, selectedUser, selectedRole, onConfirm, onGoBack, onClose }) => {
  const roleConfig = ROLE_CONFIG[selectedRole];
  const RoleIcon = roleConfig.icon;

  return (
    <div className="p-6">
      <AlertDialog.Title className="text-lg font-bold flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          Send Subject Request
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </AlertDialog.Title>

      <AlertDialog.Description className="text-sm text-gray-600 mb-4">
        You are about to request that this user confirm they are the subject of this record.
      </AlertDialog.Description>

      {/* User Info */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">Requesting</p>
        <UserCard user={selectedUser} variant="compact" color="primary" />
      </div>

      {/* Record Info */}
      <div className="p-3 border rounded-lg bg-gray-50 mb-4">
        <p className="text-xs text-gray-500 mb-1">Record</p>
        <p className="font-medium text-gray-900">
          {record.belroseFields?.title || record.fileName || 'Untitled Record'}
        </p>
      </div>

      {/* Role Info */}
      <div className={`p-3 border rounded-lg ${roleConfig.bgColor} ${roleConfig.borderColor} mb-4`}>
        <p className="text-xs text-gray-500 mb-1">Access Level (if accepted)</p>
        <div className="flex items-center gap-2">
          <RoleIcon className={`w-5 h-5 ${roleConfig.color}`} />
          <span className="font-medium">{roleConfig.label}</span>
        </div>
      </div>

      {/* Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-gray-600 leading-relaxed">
          The user will receive a notification and must accept before being added as a subject.
          Their acceptance will be recorded on the blockchain.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onGoBack}>
          Back
        </Button>
        <Button onClick={onConfirm} className="flex-1">
          Send Request
        </Button>
      </div>
    </div>
  );
};

const ConfirmAcceptRequestContent: React.FC<{
  record: FileObject;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ record, onConfirm, onClose }) => (
  <div className="p-6">
    <AlertDialog.Title className="text-lg font-bold flex items-center gap-2 mb-3">
      <UserCheck className="w-5 h-5 text-green-500" />
      Accept Subject Request
    </AlertDialog.Title>

    <AlertDialog.Description className="text-sm text-gray-600 mb-4">
      Someone has requested that you confirm you are the subject of this record.
    </AlertDialog.Description>

    {/* Record Info */}
    <div className="p-3 border rounded-lg bg-gray-50 mb-4">
      <p className="text-xs text-gray-500 mb-1">Record</p>
      <p className="font-medium text-gray-900">
        {record.belroseFields?.title || record.fileName || 'Untitled Record'}
      </p>
    </div>

    {/* Info Card */}
    <div className="p-4 border rounded-lg bg-green-50 border-green-200 mb-4">
      <div className="flex gap-3">
        <Link className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-green-900">By accepting, you confirm:</p>
          <ul className="mt-2 text-sm text-green-800 space-y-1">
            <li>• This record is about you</li>
            <li>• You consent to being linked to this record</li>
            <li>• Your link will be recorded on the blockchain</li>
          </ul>
        </div>
      </div>
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

const ConfirmRejectRequestContent: React.FC<{
  record: FileObject;
  onConfirm: (reason: RejectionReasons) => void;
  onClose: () => void;
}> = ({ record, onConfirm, onClose }) => {
  const [reason, setReason] = useState<RejectionReasons | ''>('');

  return (
    <div className="p-6">
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2 mb-3">
        <UserX className="w-5 h-5 text-red-500" />
        Decline Subject Request
      </AlertDialog.Title>

      <AlertDialog.Description className="text-sm text-gray-600 mb-4">
        You are declining a request to be marked as the subject of this record.
      </AlertDialog.Description>

      {/* Record Info */}
      <div className="p-3 border rounded-lg bg-gray-50 mb-4">
        <p className="text-xs text-gray-500 mb-1">Record</p>
        <p className="font-medium text-gray-900">
          {record.belroseFields?.title || record.fileName || 'Untitled Record'}
        </p>
      </div>

      {/* Reason Dropdown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reason for declining <span className="text-red-500">*</span>
        </label>
        <select
          value={reason}
          onChange={e => setReason(e.target.value as RejectionReasons | '')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
        >
          <option value="">Select a reason...</option>
          {REJECTION_REASON_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-gray-600 leading-relaxed">
          The person who sent this request will be notified that you declined. No blockchain
          transaction is required.
        </p>
      </div>

      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
        <Button
          onClick={() => reason && onConfirm(reason)}
          className="flex-1 bg-red-600 hover:bg-red-700"
        >
          Decline Request
        </Button>
      </div>
    </div>
  );
};

const ConfirmRemoveSubjectStatusContent: React.FC<{
  record: FileObject;
  revokeAccess: boolean;
  setRevokeAccess: (value: boolean) => void;
  onConfirm: (reason: RejectionReasons) => void;
  onClose: () => void;
}> = ({ record, revokeAccess, setRevokeAccess, onConfirm, onClose }) => {
  const [reason, setReason] = useState<RejectionReasons | ''>('');

  return (
    <div className="p-6">
      <AlertDialog.Title className="text-lg font-bold flex items-center gap-2 mb-3">
        <UserMinus className="w-5 h-5 text-orange-500" />
        Remove Subject Status
      </AlertDialog.Title>

      <AlertDialog.Description className="text-sm text-gray-600 mb-4">
        You are removing yourself as a subject of this record.
      </AlertDialog.Description>

      {/* Record Info */}
      <div className="p-3 border rounded-lg bg-gray-50 mb-4">
        <p className="text-xs text-gray-500 mb-1">Record</p>
        <p className="font-medium text-gray-900">
          {record.belroseFields?.title || record.fileName || 'Untitled Record'}
        </p>
      </div>

      {/* Warning Card */}
      <div className="p-4 border rounded-lg bg-orange-50 border-orange-200 mb-4">
        <div className="flex gap-3">
          <Unlink className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-orange-900">What happens next</p>
            <ul className="mt-2 text-sm text-orange-800 space-y-1">
              <li>• Your link to this record will be removed</li>
              <li>• This will be recorded on the blockchain</li>
              <li>• The record creator will be notified</li>
              {revokeAccess && <li>• Your access to this record will be revoked</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Reason Dropdown */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reason for removing <span className="text-red-500">*</span>
        </label>
        <select
          value={reason}
          onChange={e => setReason(e.target.value as RejectionReasons | '')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
        >
          <option value="">Select a reason...</option>
          {REJECTION_REASON_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Revoke Access Checkbox */}
      <div className="mb-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={revokeAccess}
            onChange={e => setRevokeAccess(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">
              Also revoke my access to this record
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Uncheck this if you still need access to this record after removing your subject
              status (unusual).
            </p>
          </div>
        </label>
      </div>

      {/* Additional Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Note:</strong> If you previously accepted a consent request, the record creator
          may choose to publicly note that you withdrew your consent.
        </p>
      </div>

      <div className="flex gap-3">
        <AlertDialog.Cancel asChild>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </AlertDialog.Cancel>
        <Button
          onClick={() => reason && onConfirm(reason)}
          className="flex-1 bg-orange-600 hover:bg-orange-700"
        >
          Remove Status
        </Button>
      </div>
    </div>
  );
};

export default SubjectActionDialog;
