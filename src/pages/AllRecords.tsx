//src/pages/AllRecords.tsx

/**
 * AllRecords - Smart container for the health records list page.
 *
 * Owns: record fetching, filtering, search, subject profiles, deletion.
 *
 * Calls RecordDetail at /app/records/:recordId. Clicking a record (or any action
 * from the menu) navigates there with ?view= set appropriately.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { useRecordFileActions } from '@/features/ViewEditRecord/hooks/useRecordFileActions';
import { RecordsList } from '@/features/ViewEditRecord/components/RecordsList';
import { RecordFilterType, useUserRecords } from '@/features/ViewEditRecord/hooks/useUserRecords';
import useUserProfiles from '@/features/Users/hooks/useUserProfiles';
import { useRecordFilters } from '@/features/ViewEditRecord/hooks/useRecordFilters';
import { FileObject } from '@/types/core';
import { useRecordDeletion } from '@/features/ViewEditRecord/hooks/useRecordDeletion';
import { AlertCircle, Loader2, Upload } from 'lucide-react';
import RecordDeletionDialog from '@/features/ViewEditRecord/components/RecordDeletionDialog';
import FilterTabs from '@/features/ViewEditRecord/components/View/FilterTabs';

// ============================================================================
// TYPES
// ============================================================================

type RecordView =
  | 'record'
  | 'edit'
  | 'versions'
  | 'credibility'
  | 'permissions'
  | 'access'
  | 'subject';

// ============================================================================
// COMPONENT
// ============================================================================

export const AllRecords: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  // ================== RECORD FETCHING ==========================

  const [filterType, setFilterType] = useState<RecordFilterType>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>(undefined);

  // Second fetch (filterType: 'all') is only used to build the subject list
  // for the filter tabs — doesn't affect the main list.
  const { records: allRecordsForSubjects } = useUserRecords(user?.uid, { filterType: 'all' });

  const { records, loading, error, refetchRecords } = useUserRecords(user?.uid, {
    filterType,
    subjectId: selectedSubjectId,
  });

  // ================== SUBJECT PROFILES ==========================

  const uniqueSubjects = React.useMemo(() => {
    const subjectIds = new Set<string>();
    allRecordsForSubjects.forEach(record => {
      record.subjects?.forEach(subjectId => subjectIds.add(subjectId));
    });
    return Array.from(subjectIds);
  }, [allRecordsForSubjects]);

  const { loading: loadingProfiles, getDisplayName } = useUserProfiles(uniqueSubjects);

  // ================== SEARCH & FILTER ==========================

  const {
    searchTerm,
    setSearchTerm,
    sourceTypeFilter,
    setSourceTypeFilter,
    sortedRecords,
    sourceTypes,
  } = useRecordFilters(records);

  // ================== NAVIGATION ===============================

  // All record opens are now just navigations to RecordDetail.
  // ?view= maps 1:1 to the ViewMode in RecordFull.
  const openRecord = (record: FileObject, view: RecordView = 'record') => {
    navigate(`/app/records/${record.id}?view=${view}`);
  };

  // ================== DELETE HANDLER ===========================

  const [recordToDelete, setRecordToDelete] = useState<FileObject | null>(null);

  const deletion = useRecordDeletion(recordToDelete || ({} as FileObject), () => {
    setRecordToDelete(null);
    refetchRecords();
  });

  const handleDeleteRecord = (record: FileObject) => {
    console.log('🗑️ Initiating deletion for:', record.id);
    setRecordToDelete(record);
  };

  useEffect(() => {
    if (recordToDelete) {
      deletion.initiateDeletion();
    }
  }, [recordToDelete?.id]);

  const handleCloseDeleteDialog = () => {
    setRecordToDelete(null);
    deletion.dialogProps.closeDialog();
  };

  // ================== FILE ACTIONS =============================

  const { handleDownloadRecord, handleCopyRecord } = useRecordFileActions();

  // ================== FILTER TAB HANDLERS ======================

  const handleFilterChange = (newFilterType: RecordFilterType) => {
    setFilterType(newFilterType);
    if (newFilterType !== 'subject') setSelectedSubjectId(undefined);
  };

  const handleAddNewRecord = () => navigate('/app/add-record');

  // ================== LOADING / ERROR STATES ===================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading your health records...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Records</h3>
              <p className="text-red-600 text-sm mt-1">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================== EMPTY STATE ==============================

  if (records.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <FilterTabs
          filterType={filterType}
          onFilterChange={handleFilterChange}
          user={user}
          uniqueSubjects={uniqueSubjects}
          selectedSubjectId={selectedSubjectId}
          setSelectedSubjectId={setSelectedSubjectId}
          loadingProfiles={loadingProfiles}
          getDisplayName={getDisplayName}
        />
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="text-6xl mb-6">📄</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">No Health Records Found</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Start building your comprehensive health record by uploading your medical documents.
          </p>
          <button
            onClick={handleAddNewRecord}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <Upload className="w-5 h-5" />
            Add Your First Record
          </button>
        </div>
      </div>
    );
  }

  // ================== LIST VIEW ================================

  return (
    <div className="min-h-screen bg-gray-50">
      <FilterTabs
        filterType={filterType}
        onFilterChange={handleFilterChange}
        user={user}
        uniqueSubjects={uniqueSubjects}
        selectedSubjectId={selectedSubjectId}
        setSelectedSubjectId={setSelectedSubjectId}
        loadingProfiles={loadingProfiles}
        getDisplayName={getDisplayName}
      />

      {/* Search & Filter Bar */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search records..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-background w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            value={sourceTypeFilter}
            onChange={e => setSourceTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white"
          >
            <option value="">All Types</option>
            {sourceTypes.map(type => (
              <option key={type} value={type}>
                {type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          <p className="text-gray-600">
            Showing {sortedRecords.length} of {records.length} records
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>
      </div>

      {/* Records List */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <RecordsList
          records={sortedRecords}
          onView={record => openRecord(record, 'record')}
          onEdit={record => openRecord(record, 'edit')}
          onVersions={record => openRecord(record, 'versions')}
          onSubject={record => openRecord(record, 'subject')}
          onAccess={record => openRecord(record, 'access')}
          onCredibility={record => openRecord(record, 'credibility')}
          onPermissions={record => openRecord(record, 'permissions')}
          onDelete={handleDeleteRecord}
          onCopy={handleCopyRecord}
          onDownload={handleDownloadRecord}
        />
      </div>

      {/* Deletion Dialog */}
      {recordToDelete && (
        <RecordDeletionDialog {...deletion.dialogProps} closeDialog={handleCloseDeleteDialog} />
      )}
    </div>
  );
};

export default AllRecords;
