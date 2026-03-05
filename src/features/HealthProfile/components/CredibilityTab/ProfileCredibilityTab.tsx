// src/features/HealthProfile/components/ProfileBlockchainTab.tsx

/**
 * ProfileBlockchainTab
 *
 * Read-only view of a subject's blockchain completeness — visible to any
 * viewer who has been granted access to the profile.
 *
 * Three layers of information per record:
 *   1. Hash history  — which on-chain hashes exist and which matches the current/previous Firestore hash
 *   2. Verifications — third-party attestations (read-only, no add/retract actions)
 *   3. Disputes      — flagged inaccuracies with severity, culpability, and reactions
 *
 * Data sources:
 *   - Chain data (anchored IDs + version history): useBlockchainCompleteness
 *   - Verifications per record: getVerificationsByRecordId (called lazily on expand)
 *   - Disputes per record:      getDisputesByRecordId (called lazily on expand)
 *   - User profiles for avatars: getUserProfiles
 */

import React, { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { FileObject } from '@/types/core';
import { useBlockchainCompleteness } from '../../hooks/useBlockchainCompleteness';
import RecordRow from './ui/RecordRow';
import CompletenessBanner from './ui/CompletenessBanner';

// ============================================================================
// TYPES
// ============================================================================

interface ProfileCredibilityTabProps {
  subjectFirebaseUid: string;
  records: FileObject[];
  subjectName: string;
}

// ============================================================================
// HELPERS
// ============================================================================

export const ProfileCredibilityTab: React.FC<ProfileCredibilityTabProps> = ({
  subjectFirebaseUid,
  records,
  subjectName,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { results, summary, anchoredRecordIds, privateRecordsSummary, isLoading, error } =
    useBlockchainCompleteness(subjectFirebaseUid, records);

  const circ = 2 * Math.PI * 28;

  const handleToggle = useCallback(
    (id: string) => setExpandedId(prev => (prev === id ? null : id)),
    []
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Fetching blockchain data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-2">
        <AlertTriangle className="w-6 h-6 text-red-500 mx-auto" />
        <p className="text-sm font-medium text-red-700">Failed to load blockchain data</p>
        <p className="text-xs text-red-500">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl">
      {/* ── Completeness banner ── */}
      <CompletenessBanner
        summary={summary}
        privateRecordsSummary={privateRecordsSummary}
        totalAccessibleRecords={records.length}
        subjectName={subjectName}
        anchoredCount={anchoredRecordIds.size} // already available from the hook
        visibleCount={
          results.filter(r => r.status !== 'not_anchored' && r.status !== 'no_hash').length
        }
      />

      {/* ── Note on separation of hash matching vs credibility ── */}
      <p className="text-xs text-muted-foreground px-1 border-l-2 border-border pl-3">
        Hash matching confirms the record's data integrity on-chain. Verifications and disputes are
        independent third-party assessments of a specific hash version's clinical accuracy.
      </p>

      {/* ── Record list ── */}
      <div className="space-y-2">
        {results.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No records to display.
          </div>
        )}
        {results.map(result => {
          const id = result.record.id || result.record.firestoreId || '';
          return (
            <RecordRow
              key={id}
              result={result}
              expanded={expandedId === id}
              onToggle={() => handleToggle(id)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ProfileCredibilityTab;
