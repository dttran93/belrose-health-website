// src/features/HealthRecordViewer/components/RecordDashboard.tsx

import React from 'react';
import { FileText, CheckCircle, AlertTriangle, Flag } from 'lucide-react';
import { StatsCard } from '@/features/MemberBlockchainViewer/components/StatsCard';
import { useHealthRecordDashboard } from '../hooks/useRecordDashboard';
import { HealthRecordView } from '../lib/types';
import { AnchoredRecordsTable } from './AnchoredRecordsTable';
import { VerificationsTable } from './VerificationsTable';
import { DisputesTable } from './DisputesTable';
import { UnacceptedFlagsTable } from './UnacceptedFlagsTable';
import { SearchInput, LoadingState, EmptyState, ErrorAlert } from './SharedComponents';

/**
 * Health Record Dashboard Tab
 *
 * Displays data from the HealthRecordCore contract:
 * - Anchored records with subjects and version history
 * - Record verifications
 * - Record disputes
 * - Unaccepted update flags
 */
const RecordDashboard: React.FC = () => {
  const {
    // View state
    currentView,
    setCurrentView,
    // Data
    stats,
    isLoading,
    error,
    // Anchored records
    anchoredRecords,
    filteredRecords,
    // Verifications
    verifications,
    filteredVerifications,
    // Disputes
    disputes,
    filteredDisputes,
    // Flags
    unacceptedFlags,
    filteredFlags,
    // Filters
    searchQuery,
    setSearchQuery,
  } = useHealthRecordDashboard();

  const hasFilters = searchQuery !== '';

  return (
    <div>
      {/* Error State */}
      {error && (
        <ErrorAlert
          message={error}
          details="Make sure the HealthRecordCore contract address is correct and you're connected to the right network."
        />
      )}

      {/* Stats Cards - Clickable to switch views */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => setCurrentView('anchoring')}
          className="text-left transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-xl"
        >
          <StatsCard
            title="Anchored Records"
            value={stats.totalAnchoredRecords}
            icon={<FileText className="w-6 h-6 text-blue-600" />}
            color={`${currentView === 'anchoring' ? 'ring-2 ring-blue-500' : ''} bg-blue-50 border-blue-200 text-blue-900`}
          />
        </button>

        <button
          onClick={() => setCurrentView('verifications')}
          className="text-left transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-xl"
        >
          <StatsCard
            title="Total Verifications"
            value={stats.totalVerifications}
            icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
            color={`${currentView === 'verifications' ? 'ring-2 ring-emerald-500' : ''} bg-emerald-50 border-emerald-200 text-emerald-900`}
          />
        </button>

        <button
          onClick={() => setCurrentView('disputes')}
          className="text-left transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 rounded-xl"
        >
          <StatsCard
            title="Total Disputes"
            value={stats.totalDisputes}
            icon={<AlertTriangle className="w-6 h-6 text-orange-600" />}
            color={`${currentView === 'disputes' ? 'ring-2 ring-orange-500' : ''} bg-orange-50 border-orange-200 text-orange-900`}
          />
        </button>

        <button
          onClick={() => setCurrentView('flags')}
          className="text-left transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-xl"
        >
          <StatsCard
            title="Unaccepted Flags"
            value={stats.totalUnacceptedFlags}
            icon={<Flag className="w-6 h-6 text-red-600" />}
            color={`${currentView === 'flags' ? 'ring-2 ring-red-500' : ''} bg-red-50 border-red-200 text-red-900`}
          />
        </button>
      </div>

      {/* View Indicator */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">Viewing:</span>
        <span className="text-sm font-medium text-gray-900">
          {currentView === 'anchoring' && 'Anchored Records'}
          {currentView === 'verifications' && 'Verifications'}
          {currentView === 'disputes' && 'Disputes'}
          {currentView === 'flags' && 'Unaccepted Update Flags'}
        </span>
      </div>

      {/* Search Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={getSearchPlaceholder(currentView)}
        />
      </div>

      {/* Content based on current view */}
      {isLoading ? (
        <LoadingState message="Loading health record data from blockchain..." />
      ) : (
        <>
          {currentView === 'anchoring' &&
            (filteredRecords.length === 0 ? (
              <EmptyState hasFilters={hasFilters} entityName="anchored records" />
            ) : (
              <AnchoredRecordsTable records={filteredRecords} />
            ))}

          {currentView === 'verifications' &&
            (filteredVerifications.length === 0 ? (
              <EmptyState hasFilters={hasFilters} entityName="verifications" />
            ) : (
              <VerificationsTable verifications={filteredVerifications} />
            ))}

          {currentView === 'disputes' &&
            (filteredDisputes.length === 0 ? (
              <EmptyState hasFilters={hasFilters} entityName="disputes" />
            ) : (
              <DisputesTable disputes={filteredDisputes} />
            ))}

          {currentView === 'flags' &&
            (filteredFlags.length === 0 ? (
              <EmptyState hasFilters={hasFilters} entityName="unaccepted update flags" />
            ) : (
              <UnacceptedFlagsTable flags={filteredFlags} />
            ))}
        </>
      )}
    </div>
  );
};

/**
 * Get appropriate search placeholder based on current view
 */
function getSearchPlaceholder(view: HealthRecordView): string {
  switch (view) {
    case 'anchoring':
      return 'Search by record ID, subject hash, or record hash...';
    case 'verifications':
      return 'Search by record ID, hash, or verifier...';
    case 'disputes':
      return 'Search by record ID, hash, or disputer...';
    case 'flags':
      return 'Search by record ID or subject hash...';
    default:
      return 'Search...';
  }
}

export default RecordDashboard;
