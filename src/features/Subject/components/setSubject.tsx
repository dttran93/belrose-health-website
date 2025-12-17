// features/Subject/components/SetSubject.tsx

import React, { useState, useEffect } from 'react';
import { X, User, Users, AlertTriangle, Loader2, Shield, ShieldCheck, Crown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileObject, BelroseUserProfile } from '@/types/core';
import UserSearch from '@/features/Users/components/UserSearch';
import UserCard from '@/features/Users/components/ui/UserCard';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { useAuthContext } from '@/features/Auth/AuthContext';
import {
  useSetSubject,
  SubjectRole,
  getUserRoleForRecord,
  isRoleDowngrade,
  getMinimumAllowedRole,
} from '../hooks/useSetSubject';

interface SetSubjectProps {
  record: FileObject;
  onSuccess?: () => void;

  // Modal-specific props (optional)
  asModal?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

type SubjectChoice = 'self' | 'other';

// Role hierarchy for filtering allowed roles
const ROLE_HIERARCHY: Record<SubjectRole, number> = {
  viewer: 1,
  administrator: 2,
  owner: 3,
};

// Role configuration for display
const ROLE_CONFIG: Record<
  SubjectRole,
  { label: string; description: string; icon: React.ElementType; color: string }
> = {
  viewer: {
    label: 'Viewer',
    description: 'Can view the record but cannot edit or manage it',
    icon: Shield,
    color: 'blue',
  },
  administrator: {
    label: 'Administrator',
    description: 'Can view, edit, share, and manage the record',
    icon: ShieldCheck,
    color: 'yellow',
  },
  owner: {
    label: 'Owner',
    description: 'Full control including deletion and adding other owners',
    icon: Crown,
    color: 'red',
  },
};

export const SetSubject: React.FC<SetSubjectProps> = ({
  record,
  onSuccess,
  asModal = false,
  isOpen = true,
  onClose,
}) => {
  const { user } = useAuthContext();

  // UI State
  const [subjectChoice, setSubjectChoice] = useState<SubjectChoice>('self');
  const [selectedRole, setSelectedRole] = useState<SubjectRole>('viewer');
  const [selectedUser, setSelectedUser] = useState<BelroseUserProfile | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  // Current subjects state
  const [currentSubjects, setCurrentSubjects] = useState<string[]>([]);
  const [subjectProfiles, setSubjectProfiles] = useState<Map<string, BelroseUserProfile>>(
    new Map()
  );

  // Hook for subject operations
  const { setSubjectAsSelf, requestSubjectConsent, isLoading } = useSetSubject({
    onSuccess: () => {
      onSuccess?.();
      if (asModal) onClose?.();
    },
  });

  // Determine current user's role and if they're already a subject
  const userCurrentRole = user?.uid ? getUserRoleForRecord(user.uid, record) : null;
  const userIsSubject = user?.uid ? currentSubjects.includes(user.uid) : false;
  const wouldDowngrade = user?.uid ? isRoleDowngrade(userCurrentRole, selectedRole) : false;

  // Load current subjects on mount
  useEffect(() => {
    const loadCurrentSubjects = async () => {
      if (!record.id) return;

      setLoadingSubjects(true);
      try {
        const subjects = record.subjects || [];
        setCurrentSubjects(subjects);

        if (subjects.length > 0) {
          const profiles = await getUserProfiles(subjects);
          setSubjectProfiles(profiles);
        }
      } catch (error) {
        console.error('Error loading subjects:', error);
      } finally {
        setLoadingSubjects(false);
      }
    };

    if (asModal ? isOpen : true) {
      loadCurrentSubjects();
    }
  }, [isOpen, record.id, record.subjects, asModal]);

  // Reset state when modal closes
  useEffect(() => {
    if (asModal && !isOpen) {
      setSubjectChoice('self');
      setSelectedRole('viewer');
      setSelectedUser(null);
    }
  }, [isOpen, asModal]);

  // Auto-set minimum role to prevent downgrade
  useEffect(() => {
    if (subjectChoice === 'self' && userCurrentRole && wouldDowngrade) {
      setSelectedRole(userCurrentRole);
    }
  }, [subjectChoice, userCurrentRole, wouldDowngrade]);

  // Handle user selection from search
  const handleUserSelect = (selectedUserProfile: BelroseUserProfile) => {
    setSelectedUser(selectedUserProfile);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (subjectChoice === 'self') {
      await setSubjectAsSelf(record, selectedRole);
    } else if (selectedUser) {
      await requestSubjectConsent(record, selectedUser.uid, selectedRole);
    }
  };

  // For modal mode, don't render if not open
  if (asModal && !isOpen) return null;

  // Role selection component
  const RoleSelector = ({ disabled = false }: { disabled?: boolean }) => {
    const minimumRole = user?.uid ? getMinimumAllowedRole(user.uid, record) : 'viewer';
    const minimumRoleLevel = ROLE_HIERARCHY[minimumRole];

    // Filter roles to only show allowed ones (current level or higher)
    const allowedRoles = (
      Object.entries(ROLE_CONFIG) as [SubjectRole, (typeof ROLE_CONFIG)[SubjectRole]][]
    ).filter(([role]) => {
      // For "self", only show roles >= current role
      if (subjectChoice === 'self') {
        return ROLE_HIERARCHY[role] >= minimumRoleLevel;
      }
      // For "other", show all roles
      return true;
    });

    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Select access level:</p>
        <div className="space-y-2">
          {allowedRoles.map(([role, config]) => {
            const Icon = config.icon;

            return (
              <label
                key={role}
                className={`
                  flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer
                  ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}
                  ${
                    selectedRole === role && !disabled
                      ? `border-${config.color}-200 bg-${config.color}-50`
                      : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <input
                  type="radio"
                  name="roleChoice"
                  value={role}
                  checked={selectedRole === role}
                  onChange={() => setSelectedRole(role)}
                  disabled={disabled}
                  className="w-4 h-4 text-primary"
                />
                <Icon className={`w-5 h-5 text-${config.color}-600`} />
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

        {/* Note about downgrading */}
        {subjectChoice === 'self' && userCurrentRole && userCurrentRole !== 'viewer' && (
          <p className="text-xs text-gray-500 mt-2 italic">
            Lower permission levels are not shown. To downgrade permissions, visit the{' '}
            <span className="font-medium text-primary">Permissions</span> screen.
          </p>
        )}
      </div>
    );
  };

  // The actual content (shared between both modes)
  const content = (
    <div
      className={
        asModal
          ? 'bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-3'
          : 'bg-white rounded-xl border'
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Set Record Subject</h2>
        </div>
        {asModal && onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Explanation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            The <strong>subject</strong> is the person this health record is about. Setting a
            subject grants them access to view or manage the record based on the role you select.
          </p>
        </div>

        {/* Current Subjects (if any) */}
        {loadingSubjects ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading current subjects...</span>
          </div>
        ) : currentSubjects.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Current Subject(s):</p>
            <div className="space-y-2">
              {currentSubjects.map(subjectId => {
                const profile = subjectProfiles.get(subjectId);
                return (
                  <UserCard
                    key={subjectId}
                    user={profile}
                    userId={subjectId}
                    variant="compact"
                    color="green"
                    onView={() => {}}
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Subject Choice */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Who is this record about?</p>

          {/* Self Option */}
          <label
            className={`
              flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors
              ${
                subjectChoice === 'self'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }
              ${userIsSubject ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input
              type="radio"
              name="subjectChoice"
              value="self"
              checked={subjectChoice === 'self'}
              onChange={() => setSubjectChoice('self')}
              disabled={userIsSubject}
              className="w-4 h-4 text-primary"
            />
            <User className="w-5 h-5 text-gray-600" />
            <div className="flex-1">
              <p className="font-medium text-gray-900">This record is about me</p>
              <p className="text-xs text-gray-500">
                {userIsSubject
                  ? 'You are already set as a subject'
                  : 'You will be immediately added as the subject'}
              </p>
            </div>
          </label>

          {/* Other Person Option */}
          <label
            className={`
              flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors
              ${
                subjectChoice === 'other'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <input
              type="radio"
              name="subjectChoice"
              value="other"
              checked={subjectChoice === 'other'}
              onChange={() => setSubjectChoice('other')}
              className="w-4 h-4 text-primary"
            />
            <Users className="w-5 h-5 text-gray-600" />
            <div className="flex-1">
              <p className="font-medium text-gray-900">This record is about someone else</p>
              <p className="text-xs text-gray-500">They will need to confirm before being added</p>
            </div>
          </label>
        </div>

        {/* Role Selection - Always shown after subject choice */}
        <RoleSelector disabled={isLoading} />

        {/* User Search (shown when "other" is selected) */}
        {subjectChoice === 'other' && (
          <div className="space-y-4 pt-2">
            <UserSearch
              onUserSelect={handleUserSelect}
              excludeUserIds={[...currentSubjects, user?.uid || '']}
              placeholder="Search by name, email, or user ID..."
              autoFocus={asModal}
            />

            {/* Selected User Preview */}
            {selectedUser && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Selected User:</p>
                <UserCard
                  user={selectedUser}
                  variant="default"
                  color="amber"
                  menuType="cancel"
                  onView={() => {}}
                  onCancel={() => setSelectedUser(null)}
                />
              </div>
            )}

            {/* Consent Warning */}
            <div className="bg-chart-4/20 border border-chart-4 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="w-5 h-5 text-chart-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Consent Required</p>
                <p className="text-xs mt-1">
                  The selected user will receive a notification and must accept before they are
                  added as the subject with <strong>{selectedRole}</strong> access. They may also
                  need to provide a cryptographic signature for blockchain verification.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 p-4 border-t">
        {asModal && onClose && (
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={
            isLoading ||
            (subjectChoice === 'self' && userIsSubject) ||
            (subjectChoice === 'other' && !selectedUser)
          }
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {subjectChoice === 'self' ? 'Setting...' : 'Sending Request...'}
            </>
          ) : subjectChoice === 'self' ? (
            `Set as Subject (${ROLE_CONFIG[selectedRole].label})`
          ) : (
            `Send Consent Request (${ROLE_CONFIG[selectedRole].label})`
          )}
        </Button>
      </div>
    </div>
  );

  // Wrap in modal overlay if needed
  if (asModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        {content}
      </div>
    );
  }

  return content;
};

export default SetSubject;
