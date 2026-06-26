// src/features/BackendChainParity/components/VerificationsTable.tsx

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { NETWORK } from '@belrose/shared';
import { IntegrityStatusBadge } from './IntegrityStatusBadge';
import { CopyableHash } from './ui/CopyableHash';
import type { VerificationIntegrityItem } from '../services/credibilityIntegrityService';

const BASESCAN_TX_URL = `${NETWORK.explorerUrl}/tx/`;

const VERIFICATION_LEVEL: Record<number, string> = {
  1: 'Provenance',
  2: 'Content',
  3: 'Full',
};

interface VerificationsTableProps {
  items: VerificationIntegrityItem[];
  searchQuery: string;
  onClearSearch: () => void;
}

function ChainStateCell({ item }: { item: VerificationIntegrityItem }) {
  if (item.integrityStatus === 'pending' || item.integrityStatus === 'failed') {
    return <span className="text-gray-400">—</span>;
  }
  if (!item.existsOnChain || item.integrityStatus === 'missing') {
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
  return <span className="font-medium text-emerald-600">Active</span>;
}

export const VerificationsTable: React.FC<VerificationsTableProps> = ({
  items,
  searchQuery,
  onClearSearch,
}) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No verifications match the current filter.</p>
        {searchQuery && (
          <button
            onClick={onClearSearch}
            className="mt-2 text-sm text-blue-500 hover:text-blue-700"
          >
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
            <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Record ID</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Verifier</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Record Hash</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Level</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Chain State</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-left">
          {items.map(item => (
            <tr key={`${item.recordHash}_${item.verifierIdHash}`} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <IntegrityStatusBadge status={item.integrityStatus} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">
                <CopyableHash value={item.recordId} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <div className="font-mono text-xs text-gray-600">
                    ID: <CopyableHash value={item.verifierId} chars={10} />
                  </div>
                  <div className="font-mono text-xs text-gray-400">
                    #: <CopyableHash value={item.verifierIdHash} chars={10} />
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">
                <CopyableHash value={item.recordHash} />
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {item.level ? (VERIFICATION_LEVEL[item.level] ?? item.level) : '—'}
              </td>
              <td className="px-4 py-3 text-xs">
                <ChainStateCell item={item} />
              </td>
              <td className="px-4 py-3">
                {item.blockchainRef?.txHash && (
                  <a
                    href={`${BASESCAN_TX_URL}${item.blockchainRef.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
