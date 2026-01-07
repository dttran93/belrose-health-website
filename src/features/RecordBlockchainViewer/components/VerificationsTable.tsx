// src/features/HealthRecordViewer/components/VerificationsTable.tsx

import React from 'react';
import { User } from 'lucide-react';
import { Verification, VerificationLevel } from '../lib/types';
import { TableWrapper, StatusBadge, HashDisplay } from './SharedComponents';
import { getVerificationConfig } from '@/features/Credibility/services/verificationService';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

interface VerificationsTableProps {
  verifications: Verification[];
}

/**
 * Table displaying record verifications
 * Shows who verified what, when, and at what level
 */
export const VerificationsTable: React.FC<VerificationsTableProps> = ({ verifications }) => {
  return (
    <TableWrapper>
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Record
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Hash Verified
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Verifier
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Level
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {verifications.map((verification, idx) => {
            const levelInfo = getVerificationConfig(verification.level);
            const ICON = levelInfo.icon;

            return (
              <tr
                key={`${verification.recordHash}-${verification.verifierIdHash}-${idx}`}
                className="hover:bg-gray-50"
              >
                {/* Record ID */}
                <td className="px-4 py-3">
                  <span className="font-mono text-sm text-gray-900">{verification.recordId}</span>
                </td>

                {/* Record Hash */}
                <td className="px-4 py-3">
                  <HashDisplay hash={verification.recordHash} truncateStart={10} truncateEnd={6} />
                </td>

                {/* Verifier */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    {verification.verifierProfile ? (
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {verification.verifierProfile.displayName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {verification.verifierProfile.email}
                        </p>
                      </div>
                    ) : (
                      <HashDisplay
                        hash={verification.verifierIdHash}
                        truncateStart={8}
                        truncateEnd={6}
                        className="text-gray-600"
                      />
                    )}
                  </div>
                </td>

                {/* Verification Level */}
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border`}
                    title={levelInfo.description}
                  >
                    <ICON />
                    {levelInfo.name}
                  </span>
                </td>

                {/* Date */}
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">
                    {formatTimestamp(verification.createdAt)}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3 text-center">
                  <StatusBadge isActive={verification.isActive} inactiveLabel="Retracted" />
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
// VERIFICATION LEVEL BADGE (for use elsewhere)
// ===============================================================

interface VerificationLevelBadgeProps {
  level: VerificationLevel;
  showDescription?: boolean;
}

export const VerificationLevelBadge: React.FC<VerificationLevelBadgeProps> = ({
  level,
  showDescription = false,
}) => {
  const info = getVerificationConfig(level);
  const ICON = info.icon;

  return (
    <div className="inline-flex flex-col">
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border`}
      >
        <ICON />
        {info.name}
      </span>
      {showDescription && <span className="text-xs text-gray-500 mt-1">{info.description}</span>}
    </div>
  );
};
