// src/features/ViewEditRecord/components/CredibilityBadge.tsx

import React from 'react';
import { Shield, CheckCircle, AlertTriangle, ChevronRight } from 'lucide-react';

export interface CredibilityStats {
  verifications: { total: number; active: number };
  disputes: { total: number; active: number };
}

export interface VersionReviewProps {
  stats: CredibilityStats | null | undefined;
  isLoading?: boolean;
  onClick?: (recordHash: string) => void;
}

export const VersionReviewBadge: React.FC<VersionReviewProps> = ({ stats, isLoading, onClick }) => {
  // Loading state
  if (isLoading) {
    return (
      <button
        className="inline-flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg cursor-default"
        disabled
      >
        <Shield className="w-4 h-4 text-gray-300" />
        <div className="flex items-center gap-2">
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
          <span className="text-gray-300">|</span>
          <div className="h-3 w-14 bg-gray-200 rounded animate-pulse" />
        </div>
      </button>
    );
  }

  // No stats available
  if (!stats) {
    return null;
  }

  const { verifications, disputes } = stats;
  const hasVerifications = verifications.active > 0;
  const hasDisputes = disputes.active > 0;
  const noActivity = !hasVerifications && !hasDisputes;

  // Determine badge styling based on state
  let badgeClasses =
    'inline-flex items-center gap-2.5 px-3 py-2 border rounded-lg transition-all group ';
  let shieldColor = 'text-blue-600';

  if (noActivity) {
    badgeClasses += 'bg-gray-50 border-gray-200 hover:bg-gray-100';
    shieldColor = 'text-gray-400';
  } else if (hasDisputes && disputes.active > verifications.active) {
    // More disputes than verifications - danger state
    badgeClasses +=
      'bg-gradient-to-r from-green-50 to-red-50 border-red-200 hover:shadow-sm hover:border-red-300';
    shieldColor = 'text-red-500';
  } else if (!hasVerifications && hasDisputes) {
    // Only disputes - warning state
    badgeClasses += 'bg-amber-50 border-amber-200 hover:shadow-sm hover:border-amber-300';
    shieldColor = 'text-amber-600';
  } else if (hasVerifications && !hasDisputes) {
    // Only verifications - ideal state
    badgeClasses += 'bg-green-50 border-green-200 hover:shadow-sm hover:border-green-300';
    shieldColor = 'text-green-600';
  } else {
    // Both verifications and disputes - default state
    badgeClasses +=
      'bg-gradient-to-r from-green-50 to-amber-50 border-gray-200 hover:shadow-sm hover:border-gray-300';
  }

  return (
    <button className={badgeClasses} onClick={() => onClick}>
      <Shield className={`w-4 h-4 ${shieldColor}`} />

      <div className="flex items-center gap-3 text-xs">
        {noActivity ? (
          <span className="text-gray-500">No verifications or disputes</span>
        ) : (
          <>
            {/* Verifications */}
            {hasVerifications && (
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                <span className="font-semibold text-green-700">{verifications.active}</span>
                <span className="text-gray-600">verifications</span>
              </span>
            )}

            {/* Separator - only show if both exist */}
            {hasVerifications && hasDisputes && <span className="text-gray-300">|</span>}

            {/* Disputes */}
            {hasDisputes && (
              <span className="flex items-center gap-1.5">
                <AlertTriangle
                  className={`w-3.5 h-3.5 ${
                    disputes.active > verifications.active ? 'text-red-500' : 'text-amber-500'
                  }`}
                />
                <span
                  className={`font-semibold ${
                    disputes.active > verifications.active ? 'text-red-600' : 'text-amber-600'
                  }`}
                >
                  {disputes.active}
                </span>
                <span className="text-gray-600">disputes</span>
              </span>
            )}
          </>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
    </button>
  );
};

export default VersionReviewBadge;
