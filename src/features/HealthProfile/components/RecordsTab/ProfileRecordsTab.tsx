// src/features/HealthProfile/components/tabs/ProfileRecordsTab.tsx

/**
 * ProfileRecordsTab
 *
 * The "Records" tab on the HealthProfile page. Shows all records the current
 * user has access to for this subject, with search + source type filtering.
 *
 * Key design decisions vs AllRecords:
 * - No re-fetch: records flow in from useHealthProfile (already loaded)
 * - No destructive actions: delete/edit/permissions are hidden — this is a
 *   read-only view of another person's (or your own) profile context
 * - "View" navigates to AllRecords with the record pre-opened, rather than
 *   rendering RecordFull inline, so the user gets the full action surface
 *   if they need it
 * - Download and copy are kept — non-destructive and genuinely useful
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { FileObject } from '@/types/core';
import { RecordsList } from '@/features/ViewEditRecord/components/RecordsList';
import { useRecordFilters } from '@/features/ViewEditRecord/hooks/useRecordFilters';
import { useRecordFileActions } from '@/features/ViewEditRecord/hooks/useRecordFileActions';

// ============================================================================
// TYPES
// ============================================================================

interface ProfileRecordsTabProps {
  records: FileObject[];
  isLoading: boolean;
}

// ============================================================================
// NO-OP HANDLER
// ============================================================================

/**
 * Used for actions that are intentionally disabled in the profile context.
 * Passing a no-op prevents TypeScript errors from RecordsList's required props
 * while making it clear at the call site which actions are suppressed.
 */
const noop = (_record: FileObject) => {};

// ============================================================================
// COMPONENT
// ============================================================================

export const ProfileRecordsTab: React.FC<ProfileRecordsTabProps> = ({ records, isLoading }) => {
  const navigate = useNavigate();
  const { handleDownloadRecord, handleCopyRecord } = useRecordFileActions();

  const {
    searchTerm,
    setSearchTerm,
    sourceTypeFilter,
    setSourceTypeFilter,
    sortedRecords,
    sourceTypes,
  } = useRecordFilters(records);

  /**
   * Navigate to the standalone RecordDetail page.
   */
  const handleView = (record: FileObject) => {
    navigate(`/app/records/${record.id}`);
  };

  // ============================================================
  // LOADING SKELETON
  // ============================================================

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-border h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  // ============================================================
  // EMPTY STATE
  // ============================================================

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">No accessible records for this profile.</p>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-4">
      {/* Search + source type filter bar */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-border p-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={sourceTypeFilter}
          onChange={e => setSourceTypeFilter(e.target.value)}
          className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Types</option>
          {sourceTypes.map(type => (
            <option key={type} value={type}>
              {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground px-1">
        Showing {sortedRecords.length} of {records.length} records
        {searchTerm && ` matching "${searchTerm}"`}
      </p>

      {/* Records list — destructive/owner-only actions suppressed via noop */}
      <RecordsList
        records={sortedRecords}
        onView={handleView}
        onEdit={noop}
        onVersions={noop}
        onSubject={noop}
        onAccess={noop}
        onCredibility={noop}
        onPermissions={noop}
        onDelete={noop}
        onCopy={handleCopyRecord}
        onDownload={handleDownloadRecord}
      />
    </div>
  );
};

export default ProfileRecordsTab;
