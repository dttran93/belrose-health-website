// src/features/MemberManagement/components/WalletsPanel.tsx

import React from 'react';
import { XCircle, Wallet, User } from 'lucide-react';
import type { UserData } from '@/features/MemberManagement/lib/types';
import { truncateHash, copyToClipboard } from '@/features/MemberManagement/lib/utils';

interface WalletsPanelProps {
  user: UserData;
  onClose: () => void;
}

/**
 * Modal panel showing all wallets linked to a user identity
 */
export const WalletsPanel: React.FC<WalletsPanelProps> = ({ user, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Linked Wallets</h3>
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
          {user.wallets.length === 0 ? <EmptyState /> : <WalletList wallets={user.wallets} />}
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
 * Empty state when no wallets
 */
const EmptyState: React.FC = () => (
  <div className="text-center py-12 text-gray-500">
    <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
    <p>No wallets linked</p>
  </div>
);

/**
 * List of wallet addresses
 */
const WalletList: React.FC<{ wallets: UserData['wallets'] }> = ({ wallets }) => (
  <div className="space-y-3">
    {wallets.map((wallet, index) => (
      <div
        key={wallet.address}
        className={`flex items-center justify-between p-3 rounded-lg border ${
          wallet.isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">#{index + 1}</span>
          <button
            onClick={() => copyToClipboard(wallet.address)}
            className="font-mono text-sm text-gray-700 hover:text-blue-600"
            title="Click to copy"
          >
            {wallet.address}
          </button>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            wallet.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
          }`}
        >
          {wallet.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    ))}
  </div>
);
