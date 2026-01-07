// src/features/HealthRecordViewer/components/AnchoredRecordsTable.tsx

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Users, Hash, Eye } from 'lucide-react';
import { AnchoredRecord } from '../lib/types';
import { TableWrapper, StatusBadge, HashDisplay } from './SharedComponents';

interface AnchoredRecordsTableProps {
  records: AnchoredRecord[];
}

/**
 * Table displaying anchored health records
 * Each row is expandable to show subjects and version history
 */
export const AnchoredRecordsTable: React.FC<AnchoredRecordsTableProps> = ({ records }) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (recordId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
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
              {/* Expand toggle */}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Record ID
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Subjects
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Versions
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Latest Hash
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {records.map(record => {
            const isExpanded = expandedRows.has(record.recordId);
            const latestActiveHash = record.versionHistory.find(v => v.isActive)?.hash;

            return (
              <React.Fragment key={record.recordId}>
                {/* Main Row */}
                <tr
                  className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                  onClick={() => toggleRow(record.recordId)}
                >
                  <td className="px-4 py-3">
                    <button className="p-1 hover:bg-gray-200 rounded">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium text-gray-900">
                      {record.recordId}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {record.activeSubjectCount}
                        <span className="text-gray-400">/{record.totalSubjectCount}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Hash className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">
                        {record.activeVersionCount}
                        <span className="text-gray-400">/{record.versionHistory.length}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {latestActiveHash ? (
                      <HashDisplay hash={latestActiveHash} truncateStart={10} truncateEnd={6} />
                    ) : (
                      <span className="text-gray-400 text-sm">No active hash</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge isActive={record.activeSubjectCount > 0} />
                  </td>
                </tr>

                {/* Expanded Details */}
                {isExpanded && (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 bg-gray-50">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Subjects Panel */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Subjects ({record.subjects.length})
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {record.subjects.length === 0 ? (
                              <p className="text-sm text-gray-500">No subjects linked</p>
                            ) : (
                              record.subjects.map((subject, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
                                >
                                  <div>
                                    {subject.profile ? (
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">
                                          {subject.profile.displayName}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {subject.profile.email}
                                        </p>
                                      </div>
                                    ) : (
                                      <HashDisplay
                                        hash={subject.subjectIdHash}
                                        truncateStart={8}
                                        truncateEnd={6}
                                        className="text-gray-600"
                                      />
                                    )}
                                  </div>
                                  <StatusBadge isActive={subject.isActive} />
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Version History Panel */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Hash className="w-4 h-4" />
                            Version History ({record.versionHistory.length})
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {record.versionHistory.length === 0 ? (
                              <p className="text-sm text-gray-500">No versions</p>
                            ) : (
                              record.versionHistory.map((version, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 bg-white rounded border border-gray-200"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400 w-6">
                                      v{record.versionHistory.length - idx}
                                    </span>
                                    <HashDisplay
                                      hash={version.hash}
                                      truncateStart={12}
                                      truncateEnd={8}
                                    />
                                  </div>
                                  <StatusBadge
                                    isActive={version.isActive}
                                    inactiveLabel="Retracted"
                                  />
                                </div>
                              ))
                            )}
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
