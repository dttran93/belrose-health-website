// src/features/MemberManagement/components/RoleDetailsPanel.tsx

import React from 'react';
import { XCircle, Users, Loader2, User } from 'lucide-react';
import type { UserData, RoleAssignment } from '@/features/MemberManagement/lib/types';
import { truncateHash, getRoleInfo, capitalizeFirst } from '@/features/MemberManagement/lib/utils';

interface RoleDetailsPanelProps {
  user: UserData;
  roles: RoleAssignment[];
  isLoading: boolean;
  onClose: () => void;
}

/**
 * Modal panel showing all role assignments for a user
 */
export const RoleDetailsPanel: React.FC<RoleDetailsPanelProps> = ({
  user,
  roles,
  isLoading,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Role Assignments</h3>
              <UserSubheader user={user} />
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <XCircle className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <LoadingState />
          ) : roles.length === 0 ? (
            <EmptyState />
          ) : (
            <RoleList roles={roles} />
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Subheader showing user name/email or hash
 */
const UserSubheader: React.FC<{ user: UserData }> = ({ user }) => {
  if (user.profile) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <User className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-700">{user.profile.displayName}</span>
        <span className="text-gray-300">•</span>
        <span className="text-sm text-gray-500">{user.profile.email}</span>
      </div>
    );
  }

  return <p className="text-sm text-gray-500 font-mono">{truncateHash(user.userIdHash, 10, 6)}</p>;
};

/**
 * Loading spinner
 */
const LoadingState: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

/**
 * Empty state when no roles
 */
const EmptyState: React.FC = () => (
  <div className="text-center py-12 text-gray-500">
    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
    <p>No active roles found</p>
  </div>
);

/**
 * List of role assignments
 */
const RoleList: React.FC<{ roles: RoleAssignment[] }> = ({ roles }) => (
  <div className="space-y-3">
    {roles.map((role, index) => {
      const roleInfo = getRoleInfo(role.role);

      return (
        <div
          key={`${role.recordId}-${index}`}
          className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${roleInfo.color}`}
            >
              {roleInfo.icon}
              {capitalizeFirst(role.role)}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900">Record ID</p>
              <p className="font-mono text-sm text-gray-600">{role.recordId}</p>
            </div>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              role.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
            }`}
          >
            {role.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      );
    })}
  </div>
);
