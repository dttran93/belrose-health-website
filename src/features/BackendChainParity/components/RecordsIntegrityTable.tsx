// src/features/BackendChainParity/components/RecordsIntegrityTable.tsx

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { IntegrityStatusBadge } from './IntegrityStatusBadge';
import { CopyableHash } from './ui/CopyableHash';
import type { RecordIntegrityItem, IntegrityStatus, VerificationIntegrityItem, DisputeIntegrityItem } from '../lib/types';

const BASESCAN_TX_URL = 'https://sepolia.basescan.org/tx/';

interface RecordsIntegrityTableProps {
  items: RecordIntegrityItem[];
  searchQuery: string;
  statusFilter: IntegrityStatus | 'all';
  verificationsMap: Record<string, VerificationIntegrityItem[] | undefined>;
  disputesMap: Record<string, DisputeIntegrityItem[] | undefined>;
  onViewVerifications: () => void;
}

export const RecordsIntegrityTable: React.FC<RecordsIntegrityTableProps> = ({
  items,
  searchQuery,
  statusFilter,
  verificationsMap,
  disputesMap,
  onViewVerifications,
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
            <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Firestore ID</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Record ID Hash</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Record Hash</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Subjects</th>
            <th className="px-4 py-3 text-center font-medium text-gray-600">Init Tx</th>
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
                    <CopyableHash value={item.firestoreId} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    <CopyableHash value={item.recordIdHash} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    <CopyableHash value={item.recordHash} />
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
                    <td colSpan={7} className="px-6 py-5">
                      <ExpandedRow
                        item={item}
                        verifications={verificationsMap[item.firestoreId] ?? []}
                        disputes={disputesMap[item.firestoreId] ?? []}
                        onViewVerifications={onViewVerifications}
                      />
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

// ─── Expanded panel ────────────────────────────────────────────────────────────

interface ExpandedRowProps {
  item: RecordIntegrityItem;
  verifications: VerificationIntegrityItem[];
  disputes: DisputeIntegrityItem[];
  onViewVerifications: () => void;
}

const ExpandedRow: React.FC<ExpandedRowProps> = ({ item, verifications, disputes, onViewVerifications }) => {
  const activeVerifications = verifications.filter(v => v.isActiveOnChain !== false);
  const activeDisputes = disputes.filter(d => d.isActiveOnChain !== false);
  const hasActivity = verifications.length > 0 || disputes.length > 0;

  // Credibility badge color logic mirroring VersionReviewBadge
  const hasVerifications = activeVerifications.length > 0;
  const hasDisputes = activeDisputes.length > 0;
  let shieldColor = 'text-gray-400';
  if (hasVerifications && !hasDisputes) shieldColor = 'text-green-600';
  else if (hasDisputes && !hasVerifications) shieldColor = 'text-amber-600';
  else if (hasVerifications && hasDisputes) {
    shieldColor = activeDisputes.length > activeVerifications.length ? 'text-red-500' : 'text-green-600';
  }

  return (
    <div className="space-y-4">
      {/* ── Identifiers ── */}
      <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs font-mono text-gray-500">
        <span>
          <span className="text-gray-400 mr-2">Firestore ID</span>
          <CopyableHash value={item.firestoreId} full />
        </span>
        <span>
          <span className="text-gray-400 mr-2">Record ID Hash</span>
          <CopyableHash value={item.recordIdHash} full />
        </span>
      </div>

      {/* ── Two-column: subjects left, hash + credibility right ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Subjects */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Subjects ({item.subjects.length})
          </div>
          {item.subjectStatuses && item.subjectStatuses.length > 0 ? (
            <div className="space-y-2">
              {item.subjectStatuses.map(s => (
                <div key={s.uid} className="flex items-start gap-2 text-xs">
                  <IntegrityStatusBadge
                    status={s.isActiveOnChain ? 'synced' : 'missing'}
                    showLabel={false}
                  />
                  <div className="font-mono min-w-0">
                    <div className="text-gray-500 truncate">{s.uid}</div>
                    <div className="text-gray-400">
                      <CopyableHash value={s.userIdHash} className="text-gray-400" />
                    </div>
                  </div>
                  <span className={`ml-auto whitespace-nowrap ${s.isActiveOnChain ? 'text-emerald-600' : 'text-red-500'}`}>
                    {s.isActiveOnChain ? 'active on-chain' : 'not active'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400">
              {item.integrityStatus === 'not_applicable'
                ? 'Not yet anchored to blockchain.'
                : item.subjects.length === 0
                  ? 'No subjects on this record.'
                  : 'Subject chain data unavailable.'}
            </div>
          )}
          {item.error && (
            <div className="mt-3 text-xs text-red-600 bg-red-50 rounded p-2">{item.error}</div>
          )}
        </div>

        {/* Record Hash + Credibility */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-4">
          {/* Hash */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Record Hash & Credibility
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-gray-600">
              <CopyableHash value={item.recordHash} full className="break-all" />
              {item.blockchainRef?.txHash && (
                <a
                  href={`${BASESCAN_TX_URL}${item.blockchainRef.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1 text-blue-600 hover:text-blue-800 font-sans"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Init Tx</span>
                </a>
              )}
            </div>
          </div>

          {/* Credibility badge — styled after VersionReviewBadge */}
          <button
            onClick={e => { e.stopPropagation(); onViewVerifications(); }}
            className="inline-flex items-center gap-2.5 px-3 py-2 border rounded-lg transition-all self-start hover:shadow-sm"
            style={{ background: 'transparent' }}
          >
            <Shield className={`w-4 h-4 ${shieldColor}`} />
            <div className="flex items-center gap-3 text-xs">
              {!hasActivity ? (
                <span className="text-gray-500">No reviews yet</span>
              ) : (
                <>
                  {verifications.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                      <span className="font-semibold text-green-700">{verifications.length}</span>
                      <span className="text-gray-600">
                        {verifications.length === 1 ? 'verification' : 'verifications'}
                      </span>
                    </span>
                  )}
                  {verifications.length > 0 && disputes.length > 0 && (
                    <span className="text-gray-300">|</span>
                  )}
                  {disputes.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className={`w-3.5 h-3.5 ${activeDisputes.length > activeVerifications.length ? 'text-red-500' : 'text-amber-500'}`} />
                      <span className={`font-semibold ${activeDisputes.length > activeVerifications.length ? 'text-red-600' : 'text-amber-600'}`}>
                        {disputes.length}
                      </span>
                      <span className="text-gray-600">
                        {disputes.length === 1 ? 'dispute' : 'disputes'}
                      </span>
                    </span>
                  )}
                </>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
