// src/features/HealthRecordViewer/components/DisputesTable.tsx

import React, { useState } from 'react';
import { User, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, FileText } from 'lucide-react';
import { Dispute, DisputeSeverity, DisputeCulpability } from '../lib/types';
import { TableWrapper, StatusBadge, HashDisplay } from './SharedComponents';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import {
  DisputeSeverityOptions,
  getCulpabilityConfig,
  getSeverityConfig,
} from '@/features/Credibility/services/disputeService';

interface DisputesTableProps {
  disputes: Dispute[];
}

/**
 * Table displaying record disputes
 * Each row shows dispute details with expandable reaction stats
 */
export const DisputesTable: React.FC<DisputesTableProps> = ({ disputes }) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <TableWrapper>
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-8">
              {/* Expand */}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Record
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Disputed Hash
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Disputer
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Severity
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Culpability
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Reactions
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {disputes.map((dispute, idx) => {
            const rowKey = `${dispute.recordHash}-${dispute.disputerIdHash}-${idx}`;
            const isExpanded = expandedRows.has(rowKey);
            const severityInfo = getSeverityConfig(dispute.severity);
            const culpabilityInfo = getCulpabilityConfig(dispute.culpability);

            return (
              <React.Fragment key={rowKey}>
                {/* Main Row */}
                <tr
                  className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-orange-50' : ''}`}
                  onClick={() => toggleRow(rowKey)}
                >
                  {/* Expand Toggle */}
                  <td className="px-4 py-3">
                    <button className="p-1 hover:bg-gray-200 rounded">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </td>

                  {/* Record ID */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-gray-900">{dispute.recordId}</span>
                  </td>

                  {/* Record Hash */}
                  <td className="px-4 py-3">
                    <HashDisplay hash={dispute.recordHash} truncateStart={10} truncateEnd={6} />
                  </td>

                  {/* Disputer */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      {dispute.disputerProfile ? (
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {dispute.disputerProfile.displayName}
                          </p>
                          <p className="text-xs text-gray-500">{dispute.disputerProfile.email}</p>
                        </div>
                      ) : (
                        <HashDisplay
                          hash={dispute.disputerIdHash}
                          truncateStart={8}
                          truncateEnd={6}
                          className="text-gray-600"
                        />
                      )}
                    </div>
                  </td>

                  {/* Severity */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${severityInfo.color}`}
                      title={severityInfo.description}
                    >
                      {severityInfo.name}
                    </span>
                  </td>

                  {/* Culpability */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium`}
                      title={culpabilityInfo.description}
                    >
                      {culpabilityInfo.name}
                    </span>
                  </td>

                  {/* Reactions Summary */}
                  <td className="px-4 py-3 text-center">
                    {dispute.reactionStats ? (
                      <div className="flex items-center justify-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-green-600">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {dispute.reactionStats.supports}
                        </span>
                        <span className="flex items-center gap-1 text-red-600">
                          <ThumbsDown className="w-3.5 h-3.5" />
                          {dispute.reactionStats.opposes}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <StatusBadge isActive={dispute.isActive} inactiveLabel="Retracted" />
                  </td>
                </tr>

                {/* Expanded Details */}
                {isExpanded && (
                  <tr>
                    <td colSpan={8} className="px-4 py-4 bg-orange-50/50">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Dispute Details */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-gray-700">Dispute Details</h4>

                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-gray-500 uppercase mb-1">Filed On</p>
                              <p className="text-sm text-gray-900">
                                {formatTimestamp(dispute.createdAt)}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 uppercase mb-1">
                                Severity Description
                              </p>
                              <p className="text-sm text-gray-700">{severityInfo.description}</p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 uppercase mb-1">
                                Culpability Description
                              </p>
                              <p className="text-sm text-gray-700">{culpabilityInfo.description}</p>
                            </div>

                            {dispute.notes && (
                              <div>
                                <p className="text-xs text-gray-500 uppercase mb-1 flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  Notes Reference
                                </p>
                                <HashDisplay
                                  hash={dispute.notes}
                                  truncateStart={16}
                                  truncateEnd={8}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Full Hashes */}
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold text-gray-700">Identifiers</h4>

                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-gray-500 uppercase mb-1">Full Record ID</p>
                              <p className="font-mono text-xs text-gray-700 break-all bg-white p-2 rounded border">
                                {dispute.recordId}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 uppercase mb-1">
                                Full Record Hash
                              </p>
                              <p className="font-mono text-xs text-gray-700 break-all bg-white p-2 rounded border">
                                {dispute.recordHash}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 uppercase mb-1">
                                Disputer ID Hash
                              </p>
                              <p className="font-mono text-xs text-gray-700 break-all bg-white p-2 rounded border">
                                {dispute.disputerIdHash}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </TableWrapper>
  );
};

// ===============================================================
// SEVERITY BADGE (for use elsewhere)
// ===============================================================

interface SeverityBadgeProps {
  severity: DisputeSeverityOptions;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const info = getSeverityConfig(severity);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${info.color}`}
    >
      {info.name}
    </span>
  );
};

// ===============================================================
// CULPABILITY BADGE (for use elsewhere)
// ===============================================================

interface CulpabilityBadgeProps {
  culpability: DisputeCulpability;
}

export const CulpabilityBadge: React.FC<CulpabilityBadgeProps> = ({ culpability }) => {
  const info = getCulpabilityConfig(culpability);
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium`}>{info.name}</span>
  );
};
