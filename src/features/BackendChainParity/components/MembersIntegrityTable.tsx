// src/features/BackendChainParity/components/MembersIntegrityTable.tsx

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { IntegrityStatusBadge } from './IntegrityStatusBadge';
import { CopyableHash } from './ui/CopyableHash';
import type { MemberIntegrityItem, IntegrityStatus } from '../lib/types';

const BASESCAN_ADDR_URL = 'https://sepolia.basescan.org/address/';

const MEMBER_STATUS_LABEL: Record<number, string> = {
  0: 'NotRegistered',
  1: 'Inactive',
  2: 'Active',
  3: 'Verified',
  4: 'VerifiedProvider',
  5: 'Guest',
};

interface MembersIntegrityTableProps {
  items: MemberIntegrityItem[];
  searchQuery: string;
  statusFilter: IntegrityStatus | 'all';
}

export const MembersIntegrityTable: React.FC<MembersIntegrityTableProps> = ({
  items,
  searchQuery,
  statusFilter,
}) => {
  const filtered = items.filter(item => {
    if (statusFilter !== 'all' && item.integrityStatus !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.uid.toLowerCase().includes(q) ||
      item.displayName.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      (item.userIdHash?.toLowerCase().includes(q) ?? false) ||
      (item.firestoreWalletAddress?.toLowerCase().includes(q) ?? false)
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">No members match the current filter.</div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">User ID Hash</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Firestore Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">On-Chain Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Wallet</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filtered.map(item => (
            <tr key={item.uid} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <IntegrityStatusBadge status={item.integrityStatus} />
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900 text-sm">{item.displayName}</div>
                <div className="text-xs text-gray-400">{item.email}</div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">
                <CopyableHash value={item.userIdHash} />
              </td>
              <td className="px-4 py-3 text-xs">
                {item.firestoreStatus ? (
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                    {item.firestoreStatus}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs">
                {item.onChainStatus !== undefined ? (
                  <span
                    className={`px-2 py-0.5 rounded ${
                      item.statusMismatch
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {MEMBER_STATUS_LABEL[item.onChainStatus] ?? item.onChainStatus}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs">
                {item.firestoreWalletAddress ? (
                  <div className="flex items-center gap-1">
                    <CopyableHash
                      value={item.firestoreWalletAddress}
                      chars={8}
                      className={`font-mono ${item.walletMismatch ? 'text-amber-600' : 'text-gray-500'}`}
                    />
                    <a
                      href={`${BASESCAN_ADDR_URL}${item.firestoreWalletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-gray-400">
                {item.walletMismatch && (
                  <span className="text-amber-600 block">Wallet not on-chain</span>
                )}
                {item.statusMismatch && (
                  <span className="text-amber-600 block">Status mismatch</span>
                )}
                {item.error && <span className="text-red-600 block">{item.error}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
