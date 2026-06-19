// src/features/BackendChainParity/components/SyncFailuresTable.tsx

import React from 'react';
import type { FirestoreSyncQueueItem } from '../lib/types';
import type { Timestamp } from 'firebase/firestore';

function formatTimestamp(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleString();
}

interface SyncFailuresTableProps {
  items: FirestoreSyncQueueItem[];
  searchQuery: string;
}

export const SyncFailuresTable: React.FC<SyncFailuresTableProps> = ({ items, searchQuery }) => {
  const filtered = items.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.contract?.toLowerCase().includes(q) ?? false) ||
      (item.action?.toLowerCase().includes(q) ?? false) ||
      (item.error?.toLowerCase().includes(q) ?? false) ||
      (item.userId?.toLowerCase().includes(q) ?? false)
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        {items.length === 0
          ? 'No sync failures found. All blockchain writes appear successful.'
          : 'No failures match the current search.'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Contract</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">User ID</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Error</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Retries</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Last Attempt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filtered.map(item => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                  {item.contract ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-xs font-mono text-gray-600">{item.action ?? '—'}</td>
              <td className="px-4 py-3 text-xs font-mono text-gray-400">
                {item.userId ? `${item.userId.slice(0, 10)}…` : '—'}
              </td>
              <td className="px-4 py-3 text-xs text-red-600 max-w-xs">
                <span className="line-clamp-2" title={item.error}>
                  {item.error ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-600 text-center">
                {item.retryCount ?? 0}
              </td>
              <td className="px-4 py-3 text-xs text-gray-400">
                {formatTimestamp(item.createdAt)}
              </td>
              <td className="px-4 py-3 text-xs text-gray-400">
                {formatTimestamp(item.lastAttemptAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
