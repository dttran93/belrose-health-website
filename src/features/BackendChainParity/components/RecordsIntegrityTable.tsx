// src/features/BackendChainParity/components/RecordsIntegrityTable.tsx

import React, { useState } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { IntegrityStatusBadge } from './IntegrityStatusBadge';
import { CopyableHash } from './ui/CopyableHash';
import { VersionReviewBadge } from '@/features/ViewEditRecord/components/Edit/VersionReviewBadge';
import { useSubjectConsentRefs } from '../hooks/useSubjectConsentRefs';
import type {
  RecordIntegrityItem,
  IntegrityStatus,
  VerificationIntegrityItem,
  DisputeIntegrityItem,
} from '../lib/types';
import { NETWORK } from '@belrose/shared';

const BASESCAN_TX_URL = `${NETWORK.explorerUrl}/tx/`;

interface RecordsIntegrityTableProps {
  items: RecordIntegrityItem[];
  searchQuery: string;
  statusFilter: IntegrityStatus | 'all';
  verificationsMap: Record<string, VerificationIntegrityItem[] | undefined>;
  disputesMap: Record<string, DisputeIntegrityItem[] | undefined>;
  onViewVerifications: (recordHash?: string) => void;
  onViewMember: (uid: string) => void;
}

export const RecordsIntegrityTable: React.FC<RecordsIntegrityTableProps> = ({
  items,
  searchQuery,
  statusFilter,
  verificationsMap,
  disputesMap,
  onViewVerifications,
  onViewMember,
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
            <th className="px-4 py-3 text-center font-medium text-gray-600">Credibility</th>
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
                  <td className="px-4 py-3 text-center">
                    {(() => {
                      const vCount = verificationsMap[item.firestoreId]?.length ?? 0;
                      const dCount = disputesMap[item.firestoreId]?.length ?? 0;
                      if (vCount === 0 && dCount === 0) return <span className="text-gray-300 text-xs">—</span>;
                      return (
                        <div className="flex items-center justify-center gap-2 text-xs">
                          {vCount > 0 && (
                            <span className="flex items-center gap-0.5 text-emerald-600">
                              <CheckCircle className="w-3 h-3" />{vCount}
                            </span>
                          )}
                          {dCount > 0 && (
                            <span className="flex items-center gap-0.5 text-amber-500">
                              <AlertTriangle className="w-3 h-3" />{dCount}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.blockchainRef?.txHash && (
                      <a
                        href={`${BASESCAN_TX_URL}${item.blockchainRef.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </td>
                </tr>

                {isExpanded && (
                  <tr className="bg-gray-50">
                    <td colSpan={8} className="px-6 py-5">
                      <ExpandedRow
                        item={item}
                        verifications={verificationsMap[item.firestoreId] ?? []}
                        disputes={disputesMap[item.firestoreId] ?? []}
                        onViewVerifications={onViewVerifications}
                        onViewMember={onViewMember}
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
  onViewVerifications: (recordHash?: string) => void;
  onViewMember: (uid: string) => void;
}

const ExpandedRow: React.FC<ExpandedRowProps> = ({
  item,
  verifications,
  disputes,
  onViewVerifications,
  onViewMember,
}) => {
  const activeVerifications = verifications.filter(v => v.isActiveOnChain !== false);
  const activeDisputes = disputes.filter(d => d.isActiveOnChain !== false);
  const { data: consentRefsMap = {} } = useSubjectConsentRefs(item.firestoreId);

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
              {item.subjectStatuses.map(s => {
                const anchorTxHash = consentRefsMap[s.uid]?.txHash;
                return (
                  <div key={s.uid} className="flex items-center gap-2 text-xs">
                    <IntegrityStatusBadge
                      status={s.isActiveOnChain ? 'synced' : 'missing'}
                      showLabel={false}
                    />
                    <div className="font-mono min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500 truncate min-w-0">{s.uid}</span>
                        <button
                          onClick={e => { e.stopPropagation(); onViewMember(s.uid); }}
                          title="View in Members tab"
                          className="flex-shrink-0 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-gray-400 text-left">
                        <CopyableHash value={s.userIdHash} className="text-gray-400" />
                      </div>
                    </div>
                    <span
                      className={`whitespace-nowrap ${s.isActiveOnChain ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      {s.isActiveOnChain ? 'active on-chain' : 'not active'}
                    </span>
                    {anchorTxHash ? (
                      <a
                        href={`${BASESCAN_TX_URL}${anchorTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View anchor transaction"
                        className="flex-shrink-0 text-blue-500 hover:text-blue-700"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="w-3 h-3 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
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
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Record Hash & Credibility
            </div>
            <div className="flex items-center justify-between gap-2 text-xs font-mono text-gray-600">
              <CopyableHash value={item.recordHash} />
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
              <VersionReviewBadge
                stats={{
                  verifications: {
                    total: verifications.length,
                    active: activeVerifications.length,
                  },
                  disputes: { total: disputes.length, active: activeDisputes.length },
                }}
                onClick={() => onViewVerifications(item.recordHash)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
