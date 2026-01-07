// src/features/HealthRecordViewer/components/UnacceptedFlagsTable.tsx

import React from 'react';
import { Flag, Clock, CheckCircle } from 'lucide-react';
import { UnacceptedUpdateFlag, ResolutionType } from '../lib/types';
import { TableWrapper, StatusBadge, HashDisplay } from './SharedComponents';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

interface UnacceptedFlagsTableProps {
  flags: UnacceptedUpdateFlag[];
}

// =====================================================================================
// RESOLUTION TYPE HELPERS --> here until we finish building out the resolution process
// =====================================================================================

interface ResolutionTypeInfo {
  label: string;
  description: string;
  color: string;
}

export function getResolutionTypeInfo(resolution: ResolutionType): ResolutionTypeInfo {
  switch (resolution) {
    case ResolutionType.PatientAccepted:
      return {
        label: 'Patient Accepted',
        description: 'Patient eventually accepted the update',
        color: 'bg-green-100 text-green-700',
      };
    case ResolutionType.DoctorWithdrew:
      return {
        label: 'Doctor Withdrew',
        description: 'Doctor withdrew the proposed update',
        color: 'bg-blue-100 text-blue-700',
      };
    case ResolutionType.Arbitrated:
      return {
        label: 'Arbitrated',
        description: 'Belrose made a decision',
        color: 'bg-purple-100 text-purple-700',
      };
    case ResolutionType.Expired:
      return {
        label: 'Expired',
        description: 'No resolution after time limit',
        color: 'bg-gray-100 text-gray-600',
      };
    default:
      return {
        label: 'Unresolved',
        description: 'Pending resolution',
        color: 'bg-yellow-100 text-yellow-700',
      };
  }
}

/**
 * Table displaying unaccepted update flags
 * These are admin-created flags for proposed updates that patients haven't accepted
 */
export const UnacceptedFlagsTable: React.FC<UnacceptedFlagsTableProps> = ({ flags }) => {
  return (
    <TableWrapper>
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Subject
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Record ID
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Note Hash
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Created
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Resolution
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Resolved At
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {flags.map((flag, idx) => {
            const resolutionInfo = getResolutionTypeInfo(flag.resolution);

            return (
              <tr key={`${flag.subjectIdHash}-${flag.flagIndex}`} className="hover:bg-gray-50">
                {/* Flag Index */}
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-500">#{flag.flagIndex}</span>
                </td>

                {/* Subject */}
                <td className="px-4 py-3">
                  <HashDisplay
                    hash={flag.subjectIdHash}
                    truncateStart={8}
                    truncateEnd={6}
                    className="text-gray-700"
                  />
                </td>

                {/* Record ID */}
                <td className="px-4 py-3">
                  {flag.recordId ? (
                    <span className="font-mono text-sm text-gray-900">{flag.recordId}</span>
                  ) : (
                    <span className="text-gray-400 text-sm italic">No record linked</span>
                  )}
                </td>

                {/* Note Hash */}
                <td className="px-4 py-3">
                  <HashDisplay hash={flag.noteHash} truncateStart={12} truncateEnd={6} />
                </td>

                {/* Created */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    {formatTimestamp(flag.createdAt)}
                  </div>
                </td>

                {/* Resolution */}
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${resolutionInfo.color}`}
                    title={resolutionInfo.description}
                  >
                    {resolutionInfo.label}
                  </span>
                </td>

                {/* Resolved At */}
                <td className="px-4 py-3">
                  {flag.resolvedAt ? (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      {formatTimestamp(flag.resolvedAt)}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">—</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3 text-center">
                  <StatusBadge
                    isActive={flag.isActive}
                    activeLabel="Pending"
                    inactiveLabel="Resolved"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrapper>
  );
};

// ===============================================================
// FLAG SUMMARY CARD (for dashboard overview)
// ===============================================================

interface FlagSummaryProps {
  totalFlags: number;
  activeFlags: number;
  resolutionBreakdown?: {
    patientAccepted: number;
    doctorWithdrew: number;
    arbitrated: number;
    expired: number;
  };
}

export const FlagSummary: React.FC<FlagSummaryProps> = ({
  totalFlags,
  activeFlags,
  resolutionBreakdown,
}) => {
  const resolvedFlags = totalFlags - activeFlags;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Flag className="w-5 h-5 text-red-500" />
        <h3 className="font-semibold text-gray-900">Unaccepted Update Flags</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <p className="text-2xl font-bold text-yellow-700">{activeFlags}</p>
          <p className="text-xs text-yellow-600">Pending</p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-700">{resolvedFlags}</p>
          <p className="text-xs text-green-600">Resolved</p>
        </div>
      </div>

      {resolutionBreakdown && resolvedFlags > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase">Resolution Breakdown</p>
          <div className="space-y-1">
            {resolutionBreakdown.patientAccepted > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Patient Accepted</span>
                <span className="font-medium">{resolutionBreakdown.patientAccepted}</span>
              </div>
            )}
            {resolutionBreakdown.doctorWithdrew > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Doctor Withdrew</span>
                <span className="font-medium">{resolutionBreakdown.doctorWithdrew}</span>
              </div>
            )}
            {resolutionBreakdown.arbitrated > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Arbitrated</span>
                <span className="font-medium">{resolutionBreakdown.arbitrated}</span>
              </div>
            )}
            {resolutionBreakdown.expired > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Expired</span>
                <span className="font-medium">{resolutionBreakdown.expired}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
