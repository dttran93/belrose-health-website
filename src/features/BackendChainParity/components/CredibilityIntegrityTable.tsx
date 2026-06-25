// src/features/BackendChainParity/components/CredibilityIntegrityTable.tsx

import React, { useState } from 'react';
import { VerificationsTable } from './VerificationsTable';
import { DisputesTable } from './DisputesTable';
import type {
  VerificationIntegrityItem,
  DisputeIntegrityItem,
  IntegrityStatus,
} from '../lib/types';

type SubTab = 'verifications' | 'disputes';

interface CredibilityIntegrityTableProps {
  verifications: VerificationIntegrityItem[];
  disputes: DisputeIntegrityItem[];
  searchQuery: string;
  statusFilter: IntegrityStatus | 'all';
  onClearSearch: () => void;
}

export const CredibilityIntegrityTable: React.FC<CredibilityIntegrityTableProps> = ({
  verifications,
  disputes,
  searchQuery,
  statusFilter,
  onClearSearch,
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

      {subTab === 'verifications' && (
        <VerificationsTable
          items={filteredVerifications}
          searchQuery={searchQuery}
          onClearSearch={onClearSearch}
        />
      )}
      {subTab === 'disputes' && (
        <DisputesTable
          items={filteredDisputes}
          searchQuery={searchQuery}
          onClearSearch={onClearSearch}
        />
      )}
    </div>
  );
};
