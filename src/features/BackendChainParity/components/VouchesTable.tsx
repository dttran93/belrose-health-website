// src/features/BackendChainParity/components/VouchesTable.tsx

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { NETWORK } from '@belrose/shared';
import type { VouchOnChainEvent } from '@belrose/shared';
import { IntegrityStatusBadge } from './IntegrityStatusBadge';
import { CopyableHash } from './ui/CopyableHash';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import type { VouchIntegrityItem } from '../services/credibilityIntegrityService';

const BASESCAN_TX_URL = `${NETWORK.explorerUrl}/tx/`;

interface VouchesTableProps {
  items: VouchIntegrityItem[];
  searchQuery: string;
  onClearSearch: () => void;
}

function ChainStateCell({ item }: { item: VouchIntegrityItem }) {
  if (item.integrityStatus === 'pending' || item.integrityStatus === 'failed') {
    return <span className="text-gray-400">—</span>;
  }
  if (item.integrityStatus === 'missing') {
    return <span className="font-medium text-red-600">Not Found</span>;
  }
  if (item.mismatchReasons && item.mismatchReasons.length > 0) {
    return (
      <ul className="space-y-0.5">
        {item.mismatchReasons.map((reason, i) => (
          <li key={i} className="text-amber-700">
            {reason}
          </li>
        ))}
      </ul>
    );
  }
  const label = item.chainStatus === 'Active' ? 'Active' : item.chainStatus ?? '—';
  const color = item.chainStatus === 'Active' ? 'text-emerald-600' : 'text-gray-500';
  return <span className={`font-medium ${color}`}>{label}</span>;
}

function OnChainHistoryPanel({ history }: { history?: VouchOnChainEvent[] }) {
  if (!history || history.length === 0) {
    return <p className="text-xs text-gray-400 italic">No on-chain history recorded</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {[...history].reverse().map((entry, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700 capitalize">
            {entry.action}
          </span>
          {entry.at && <span className="text-gray-400">{formatTimestamp(entry.at)}</span>}
          {entry.blockchainRef?.txHash && (
            <div className="flex items-center gap-1 text-gray-400">
              <span>Tx:</span>
              <CopyableHash value={entry.blockchainRef.txHash} chars={8} className="font-mono" />
              <a
                href={`${BASESCAN_TX_URL}${entry.blockchainRef.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const TOTAL_COLS = 7;

export const VouchesTable: React.FC<VouchesTableProps> = ({ items, searchQuery, onClearSearch }) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No vouches match the current filter.</p>
        {searchQuery && (
          <button onClick={onClearSearch} className="mt-2 text-sm text-blue-500 hover:text-blue-700">
            Clear search
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-xl border border-gray-200 max-h-[80vh]">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
          <tr>
            <th className="px-2 py-3 w-6" />
            <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Voucher</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Vouchee</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Firestore Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Chain State</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-left">
          {items.map(item => {
            const isExpanded = expandedRows.has(item.vouchId);

            return (
              <React.Fragment key={item.vouchId}>
                <tr className="hover:bg-gray-50">
                  <td className="px-2 py-3">
                    <button
                      onClick={() => toggleRow(item.vouchId)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={isExpanded ? 'Collapse history' : 'Expand history'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <IntegrityStatusBadge status={item.integrityStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <div className="font-mono text-xs text-gray-600">
                        ID: <CopyableHash value={item.voucherId} chars={10} />
                      </div>
                      <div className="font-mono text-xs text-gray-400">
                        #: <CopyableHash value={item.voucherIdHash} chars={10} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <div className="font-mono text-xs text-gray-600">
                        ID: <CopyableHash value={item.voucheeId} chars={10} />
                      </div>
                      <div className="font-mono text-xs text-gray-400">
                        #: <CopyableHash value={item.voucheeIdHash} chars={10} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded font-medium ${
                        item.chainStatus === 'Active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : item.chainStatus === 'Retracted'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {item.chainStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <ChainStateCell item={item} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {item.createdAt ? formatTimestamp(item.createdAt) : '—'}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50 border-t border-gray-100">
                    <td />
                    <td colSpan={TOTAL_COLS - 1} className="px-6 py-4">
                      <p className="text-xs font-medium text-gray-500 mb-2">On-Chain History</p>
                      <OnChainHistoryPanel history={item.onChainHistory} />
                      {item.error && (
                        <p className="mt-2 text-xs text-red-500 font-mono">{item.error}</p>
                      )}
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
