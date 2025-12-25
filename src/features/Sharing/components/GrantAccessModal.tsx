import React, { useState } from 'react';
import { X, Users, Shield, ShieldCheck, Crown, Loader2, Key } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileObject, BelroseUserProfile } from '@/types/core';
import UserSearch from '@/features/Users/components/UserSearch';
import UserCard from '@/features/Users/components/ui/UserCard';
import { usePermissions } from '@/features/Permissions/hooks/usePermissions';

type AccessRole = 'owner' | 'administrator' | 'viewer';

interface GrantAccessModalProps {
  record: FileObject;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Role configuration for display, matching the SetSubject style
const ROLE_CONFIG: Record<
  AccessRole,
  { label: string; description: string; icon: React.ElementType; color: string }
> = {
  viewer: {
    label: 'Viewer',
    description: 'Can decrypt and view the record.',
    icon: Shield,
    color: 'yellow',
  },
  administrator: {
    label: 'Administrator',
    description: 'Can view, edit, share, and manage the record',
    icon: ShieldCheck,
    color: 'blue',
  },
  owner: {
    label: 'Owner',
    description: 'Full control including deletion and adding other owners',
    icon: Crown,
    color: 'red',
  },
};

export const GrantAccessModal: React.FC<GrantAccessModalProps> = ({
  record,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedUser, setSelectedUser] = useState<BelroseUserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<AccessRole>('viewer');

  const { grantOwner, grantAdmin, grantViewer, isLoading } = usePermissions({
    onSuccess: () => {
      onSuccess?.();
      onClose();
      setSelectedUser(null);
    },
  });

  if (!isOpen) return null;

  const handleGrant = async () => {
    if (!selectedUser || !record.id) return;

    if (selectedRole === 'owner') {
      await grantOwner(record.id, selectedUser.uid);
    } else if (selectedRole === 'administrator') {
      await grantAdmin(record.id, selectedUser.uid);
    } else {
      await grantViewer(record.id, selectedUser.uid);
    }
  };

  const content = (
    <div className="bg-white p-4 space-y-6 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Grant Encrypted Access</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          Select a user to grant cryptographic access. This will create a{' '}
          <strong>wrapped key</strong> for them and assign the selected role.
        </div>

        {/* Step 1: User Search */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">1. Select User</p>
          <UserSearch
            onUserSelect={setSelectedUser}
            excludeUserIds={[
              ...(record.owners || []),
              ...(record.administrators || []),
              ...(record.viewers || []),
            ]}
            placeholder="Search by name, email, or ID..."
            autoFocus
          />
          {selectedUser && (
            <div className="mt-2">
              <UserCard
                user={selectedUser}
                variant="compact"
                color="primary"
                menuType="cancel"
                onCancel={() => setSelectedUser(null)}
                onView={() => {}}
              />
            </div>
          )}
        </div>

        {/* Step 2: Role Selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">2. Select Permission Level</p>
          <div className="space-y-2">
            {(Object.entries(ROLE_CONFIG) as [AccessRole, (typeof ROLE_CONFIG)['viewer']][]).map(
              ([role, config]) => {
                const Icon = config.icon;
                return (
                  <label
                    key={role}
                    className={`
                      flex items-center gap-3 p-3 border rounded-lg transition-colors cursor-pointer
                      ${
                        selectedRole === role
                          ? `border-${config.color}-200 bg-${config.color}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="accessRole"
                      value={role}
                      checked={selectedRole === role}
                      onChange={() => setSelectedRole(role)}
                      className="w-4 h-4 text-primary"
                    />
                    <Icon className={`w-5 h-5 text-${config.color}-600`} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{config.label}</p>
                      <p className="text-xs text-gray-500">{config.description}</p>
                    </div>
                  </label>
                );
              }
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 p-4 border-t mt-auto">
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleGrant}
          disabled={isLoading || !selectedUser}
          className="min-w-[140px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Granting...
            </>
          ) : (
            'Grant Access'
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      {content}
    </div>
  );
};

export default GrantAccessModal;
