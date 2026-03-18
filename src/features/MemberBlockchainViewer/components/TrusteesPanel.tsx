// src/features/MemberBlockchainViewer/components/TrusteesPanel.tsx

import React from 'react';
import { X, Loader2, Users } from 'lucide-react';
import type { UserData, TrusteeRelationshipOnChain } from '../lib/types';
import { TrusteeStatus, TrusteeLevel } from '../lib/types';

interface TrusteesPanelProps {
  user: UserData;
  trustees: TrusteeRelationshipOnChain[];
  isLoading: boolean;
  onClose: () => void;
}

const LEVEL_LABELS: Record<TrusteeLevel, { label: string; color: string }> = {
  [TrusteeLevel.Observer]: { label: 'Observer', color: 'bg-blue-100 text-blue-700' },
  [TrusteeLevel.Custodian]: { label: 'Custodian', color: 'bg-amber-100 text-amber-700' },
  [TrusteeLevel.Controller]: { label: 'Controller', color: 'bg-purple-100 text-purple-700' },
};

const STATUS_LABELS: Record<TrusteeStatus, { label: string; color: string }> = {
  [TrusteeStatus.None]: { label: 'None', color: 'text-gray-400' },
  [TrusteeStatus.Pending]: { label: 'Pending', color: 'text-yellow-600' },
  [TrusteeStatus.Active]: { label: 'Active', color: 'text-emerald-600' },
  [TrusteeStatus.Revoked]: { label: 'Revoked', color: 'text-red-500' },
};

export const TrusteesPanel: React.FC<TrusteesPanelProps> = ({
  user,
  trustees,
  isLoading,
  onClose,
}) => {
  const displayName = user.profile?.displayName ?? 'Unknown User';

  return (
    // Backdrop
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Trustee Relationships</h2>
            <p className="text-sm text-gray-500 mt-0.5">{displayName} (as trustor)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : trustees.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No trustee relationships found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trustees.map(t => {
                const levelInfo = LEVEL_LABELS[t.level];
                const statusInfo = STATUS_LABELS[t.status];
                const trusteeName = t.profile?.displayName ?? t.trusteeIdHash.slice(0, 10) + '...';

                return (
                  <div
                    key={t.trusteeIdHash}
                    className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{trusteeName}</p>
                      {t.profile?.email && (
                        <p className="text-xs text-gray-500 truncate">{t.profile.email}</p>
                      )}
                      <p className="text-xs text-gray-400 font-mono mt-1">
                        {t.trusteeIdHash.slice(0, 18)}...
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 ml-4 flex-shrink-0">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${levelInfo.color}`}
                      >
                        {levelInfo.label}
                      </span>
                      <span className={`text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
