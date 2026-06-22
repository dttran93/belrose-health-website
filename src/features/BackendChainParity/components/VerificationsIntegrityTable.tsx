// src/features/BackendChainParity/components/VerificationsIntegrityTable.tsx

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { IntegrityStatusBadge } from './IntegrityStatusBadge';
import { CopyableHash } from './ui/CopyableHash';
import type {
  VerificationIntegrityItem,
  DisputeIntegrityItem,
  IntegrityStatus,
} from '../lib/types';

const BASESCAN_TX_URL = 'https://sepolia.basescan.org/tx/';

const VERIFICATION_LEVEL: Record<number, string> = {
  1: 'Provenance',
  2: 'Content',
  3: 'Full',
};

const DISPUTE_SEVERITY: Record<number, string> = {
  1: 'Negligible',
  2: 'Moderate',
  3: 'Major',
};

type SubTab = 'verifications' | 'disputes';

interface VerificationsIntegrityTableProps {
  verifications: VerificationIntegrityItem[];
  disputes: DisputeIntegrityItem[];
  searchQuery: string;
  statusFilter: IntegrityStatus | 'all';
}

export const VerificationsIntegrityTable: React.FC<VerificationsIntegrityTableProps> = ({
  verifications,
  disputes,
  searchQuery,
  statusFilter,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('verifications');

  const filteredVerifications = verifications.filter(item => {
    if (statusFilter !== 'all' && item.integrityStatus !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.firestoreId.toLowerCase().includes(q) ||
      (item.verifierIdHash?.toLowerCase().includes(q) ?? false) ||
      (item.recordId?.toLowerCase().includes(q) ?? false) ||
      (item.recordHash?.toLowerCase().includes(q) ?? false)
    );
  });

  const filteredDisputes = disputes.filter(item => {
    if (statusFilter !== 'all' && item.integrityStatus !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.firestoreId.toLowerCase().includes(q) ||
      (item.disputerIdHash?.toLowerCase().includes(q) ?? false) ||
      (item.recordId?.toLowerCase().includes(q) ?? false) ||
      (item.recordHash?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-4">
        {(['verifications', 'disputes'] as SubTab[]).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`pb-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              subTab === t
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t} ({t === 'verifications' ? filteredVerifications.length : filteredDisputes.length})
          </button>
        ))}
      </div>

      {subTab === 'verifications' && <VerificationsTable items={filteredVerifications} />}
      {subTab === 'disputes' && <DisputesTable items={filteredDisputes} />}
    </div>
  );
};

const VerificationsTable: React.FC<{ items: VerificationIntegrityItem[] }> = ({ items }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No verifications match the current filter.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Firestore ID</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Verifier Hash</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Record Hash</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Level</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Chain Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">On-Chain</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(item => (
            <tr key={item.firestoreId} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <IntegrityStatusBadge status={item.integrityStatus} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">
                <CopyableHash value={item.firestoreId} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">
                <CopyableHash value={item.verifierIdHash} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">
                <CopyableHash value={item.recordHash} />
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {item.level ? (VERIFICATION_LEVEL[item.level] ?? item.level) : '—'}
              </td>
              <td className="px-4 py-3 text-xs">
                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  {item.chainStatus ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-xs">
                {item.existsOnChain !== undefined ? (
                  <span
                    className={
                      item.existsOnChain && item.isActiveOnChain
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }
                  >
                    {item.existsOnChain
                      ? item.isActiveOnChain
                        ? 'Active'
                        : 'Inactive'
                      : 'Not found'}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
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

const DisputesTable: React.FC<{ items: DisputeIntegrityItem[] }> = ({ items }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">No disputes match the current filter.</div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Firestore ID</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Disputer Hash</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Record Hash</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Severity</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Chain Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">On-Chain</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(item => (
            <tr key={item.firestoreId} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <IntegrityStatusBadge status={item.integrityStatus} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">
                <CopyableHash value={item.firestoreId} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">
                <CopyableHash value={item.disputerIdHash} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">
                <CopyableHash value={item.recordHash} />
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {item.severity ? (DISPUTE_SEVERITY[item.severity] ?? item.severity) : '—'}
              </td>
              <td className="px-4 py-3 text-xs">
                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  {item.chainStatus ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-xs">
                {item.existsOnChain !== undefined ? (
                  <span
                    className={
                      item.existsOnChain && item.isActiveOnChain
                        ? 'text-emerald-600'
                        : 'text-red-600'
                    }
                  >
                    {item.existsOnChain
                      ? item.isActiveOnChain
                        ? 'Active'
                        : 'Inactive'
                      : 'Not found'}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
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
