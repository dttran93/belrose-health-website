// src/features/BackendChainParity/components/RecordsIntegrityTable.tsx

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { IntegrityStatusBadge } from './IntegrityStatusBadge';
import type { RecordIntegrityItem, IntegrityStatus } from '../lib/types';

const BASESCAN_TX_URL = 'https://sepolia.basescan.org/tx/';

function truncate(s: string | undefined, chars = 12): string {
  if (!s) return '—';
  return `${s.slice(0, chars)}…${s.slice(-4)}`;
}

interface RecordsIntegrityTableProps {
  items: RecordIntegrityItem[];
  searchQuery: string;
  statusFilter: IntegrityStatus | 'all';
}

export const RecordsIntegrityTable: React.FC<RecordsIntegrityTableProps> = ({
  items,
  searchQuery,
  statusFilter,
}) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filtered = items.filter(item => {
    if (statusFilter !== 'all' && item.integrityStatus !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.firestoreId.toLowerCase().includes(q) ||
      (item.recordIdHash?.toLowerCase().includes(q) ?? false) ||
      (item.recordHash?.toLowerCase().includes(q) ?? false) ||
      item.subjects.some(uid => uid.toLowerCase().includes(q))
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">No records match the current filter.</div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="w-6 px-3 py-3" />
            <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Firestore ID</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Record ID Hash</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Record Hash</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Subjects</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filtered.map(item => {
            const isExpanded = expandedRow === item.firestoreId;
            return (
              <React.Fragment key={item.firestoreId}>
                <tr
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedRow(isExpanded ? null : item.firestoreId)}
                >
                  <td className="px-3 py-3 text-gray-400">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <IntegrityStatusBadge status={item.integrityStatus} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {truncate(item.firestoreId, 10)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {truncate(item.recordIdHash)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {truncate(item.recordHash)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{item.subjects.length}</td>
                  <td className="px-4 py-3">
                    {item.blockchainRef?.txHash && (
                      <a
                        href={`${BASESCAN_TX_URL}${item.blockchainRef.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50">
                    <td colSpan={7} className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="font-medium text-gray-700 text-xs uppercase tracking-wide mb-3">
                          Subject Details
                        </div>
                        {item.subjectStatuses && item.subjectStatuses.length > 0 ? (
                          <div className="space-y-1">
                            {item.subjectStatuses.map(s => (
                              <div
                                key={s.uid}
                                className="flex items-center gap-3 text-xs font-mono"
                              >
                                <IntegrityStatusBadge
                                  status={s.isActiveOnChain ? 'synced' : 'missing'}
                                  showLabel={false}
                                />
                                <span className="text-gray-500">{s.uid}</span>
                                <span className="text-gray-400">→ {truncate(s.userIdHash)}</span>
                                <span className={s.isActiveOnChain ? 'text-emerald-600' : 'text-red-600'}>
                                  {s.isActiveOnChain ? 'active on-chain' : 'not active on-chain'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">
                            {item.integrityStatus === 'not_applicable'
                              ? 'Not yet anchored to blockchain.'
                              : 'No subject data available.'}
                          </div>
                        )}
                        {item.error && (
                          <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                            {item.error}
                          </div>
                        )}
                        {item.recordIdHash && (
                          <div className="mt-3 text-xs text-gray-400 space-y-0.5">
                            <div>Record ID Hash: <span className="font-mono">{item.recordIdHash}</span></div>
                            <div>Record Hash: <span className="font-mono">{item.recordHash}</span></div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
