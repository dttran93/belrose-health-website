// src/features/HealthRecordViewer/components/UnacceptedFlagsTable.tsx

import React from 'react';
import { Flag, Clock } from 'lucide-react';
import { UnacceptedUpdateFlag } from '../lib/types';
import { TableWrapper, StatusBadge, HashDisplay } from './SharedComponents';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

interface UnacceptedFlagsTableProps {
  flags: UnacceptedUpdateFlag[];
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
              Subject
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Record ID Hash
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Reporter
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Record Hash
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Created
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {flags.map((flag) => (
            <tr
              key={`${flag.subjectIdHash}-${flag.recordIdHash}`}
              className="hover:bg-gray-50"
            >
              <td className="px-4 py-3">
                <HashDisplay
                  hash={flag.subjectIdHash}
                  truncateStart={8}
                  truncateEnd={6}
                  className="text-gray-700"
                />
              </td>

              <td className="px-4 py-3">
                <HashDisplay hash={flag.recordIdHash} truncateStart={8} truncateEnd={6} />
              </td>

              <td className="px-4 py-3">
                <HashDisplay hash={flag.reporterIdHash} truncateStart={8} truncateEnd={6} />
              </td>

              <td className="px-4 py-3">
                <HashDisplay hash={flag.recordHash} truncateStart={12} truncateEnd={6} />
              </td>

              <td className="px-4 py-3">
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  {formatTimestamp(flag.createdAt)}
                </div>
              </td>

              <td className="px-4 py-3 text-center">
                <StatusBadge
                  isActive={flag.isActive}
                  activeLabel="Pending"
                  inactiveLabel="Resolved"
                />
              </td>
            </tr>
          ))}
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
}

export const FlagSummary: React.FC<FlagSummaryProps> = ({ totalFlags, activeFlags }) => {
  const resolvedFlags = totalFlags - activeFlags;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Flag className="w-5 h-5 text-red-500" />
        <h3 className="font-semibold text-gray-900">Unaccepted Update Flags</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <p className="text-2xl font-bold text-yellow-700">{activeFlags}</p>
          <p className="text-xs text-yellow-600">Pending</p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-700">{resolvedFlags}</p>
          <p className="text-xs text-green-600">Resolved</p>
        </div>
      </div>
    </div>
  );
};
