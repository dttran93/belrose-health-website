// src/features/MemberManagement/components/UsersTable.tsx

import React from 'react';
import { Eye, Wallet, User, Mail, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { UserData } from '@/features/MemberManagement/lib/types';
import {
  truncateHash,
  copyToClipboard,
  getStatusInfo,
} from '@/features/MemberManagement/lib/utils';
import { EtherscanLink } from './EtherscanLink';

interface UsersTableProps {
  users: UserData[];
  onViewRoles: (user: UserData) => void;
  onViewWallets: (user: UserData) => void;
}

/**
 * Table displaying all users with their profile info, status, and actions
 */
export const UsersTable: React.FC<UsersTableProps> = ({ users, onViewRoles, onViewWallets }) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Verification
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Wallets
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Records
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Registration Tx
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map(user => (
              <UserRow
                key={user.userIdHash}
                user={user}
                onViewRoles={onViewRoles}
                onViewWallets={onViewWallets}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * Single row in the users table
 */
interface UserRowProps {
  user: UserData;
  onViewRoles: (user: UserData) => void;
  onViewWallets: (user: UserData) => void;
}

const UserRow: React.FC<UserRowProps> = ({ user, onViewRoles, onViewWallets }) => {
  const statusInfo = getStatusInfo(user.status);
  const activeWallets = user.wallets.filter(w => w.isActive).length;
  const hasProfile = !!user.profile;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* User Info */}
      <td className="px-4 py-3">
        {hasProfile ? (
          <UserWithProfile user={user} />
        ) : (
          <UserWithoutProfile userIdHash={user.userIdHash} />
        )}
      </td>

      {/* On-Chain Status */}
      <td className="py-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}
        >
          {statusInfo.icon}
          {statusInfo.label}
        </span>
      </td>

      {/* Verification Status */}
      <td className="px-4 py-3 text-left">
        {hasProfile ? (
          <VerificationStatus profile={user.profile!} />
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>

      {/* Wallets Count */}
      <td className="px-4 py-3">
        <button
          onClick={() => onViewWallets(user)}
          className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1"
        >
          <Wallet className="w-4 h-4" />
          {activeWallets}/{user.wallets.length}
          <span className="text-xs text-gray-400">active</span>
        </button>
      </td>

      {/* Records Count */}
      <td className="px-4 py-3 text-sm text-gray-600">{user.records.length}</td>

      {/* Registration Tx */}
      <td className="px-4 py-3 text-left">
        <EtherscanLink txHash={user.registrationTxHash} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-left">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewRoles(user)}
          className="text-xs"
          disabled={user.records.length === 0}
        >
          <Eye className="w-3 h-3 mr-1" />
          View Roles
        </Button>
      </td>
    </tr>
  );
};

/**
 * User cell when Firebase profile exists
 */
const UserWithProfile: React.FC<{ user: UserData }> = ({ user }) => (
  <div className="flex flex-col">
    <div className="flex items-center gap-2">
      <User className="w-4 h-4 text-gray-400" />
      <span className="font-medium text-gray-900">{user.profile!.displayName}</span>
    </div>
    <div className="flex items-center gap-2 mt-1">
      <Mail className="w-3 h-3 text-gray-400" />
      <span className="text-sm text-gray-500">{user.profile!.email}</span>
      {user.profile!.emailVerified && (
        <span title="Email verified" className="flex items-center">
          <CheckCircle className="w-3 h-3 text-green-500" />
        </span>
      )}
    </div>
    <button
      onClick={() => copyToClipboard(user.userIdHash)}
      className="font-mono text-xs text-gray-400 hover:text-blue-600 mt-1 text-left"
      title="Click to copy full hash"
    >
      {truncateHash(user.userIdHash, 8, 4)}
    </button>
  </div>
);

/**
 * User cell when no Firebase profile exists
 */
const UserWithoutProfile: React.FC<{ userIdHash: string }> = ({ userIdHash }) => (
  <div className="flex flex-col">
    <span className="text-sm text-gray-500 text-left italic">No profile linked</span>
    <button
      onClick={() => copyToClipboard(userIdHash)}
      className="font-mono text-sm text-gray-700 hover:text-blue-600 text-left"
      title="Click to copy full hash"
    >
      {truncateHash(userIdHash, 10, 6)}
    </button>
  </div>
);

/**
 * Verification status indicators
 */
const VerificationStatus: React.FC<{ profile: NonNullable<UserData['profile']> }> = ({
  profile,
}) => (
  <div className="flex flex-col gap-1">
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        profile.identityVerified ? 'text-green-600' : 'text-gray-400'
      }`}
    >
      {profile.identityVerified ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      Identity
    </span>
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        profile.emailVerified ? 'text-green-600' : 'text-gray-400'
      }`}
    >
      {profile.emailVerified ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      Email
    </span>
  </div>
);
