//src/pages/AllRecords.tsx

/**
 * AllRecords Component - Smart container for the health records page.
 *
 * Owns all state: which record is selected, view navigation, filtering,
 * search, deletion and save logic. Renders RecordsList/RecordFull conditionally.
 *
 * useUserProfile/useRecordFilters and other hooks are called for functions logic
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { useRecordFileActions } from '@/features/ViewEditRecord/hooks/useRecordFileActions';
import { RecordsList } from '@/features/ViewEditRecord/components/RecordsList';
import { RecordFilterType, useUserRecords } from '@/features/ViewEditRecord/hooks/useUserRecords';
import useUserProfiles from '@/features/Users/hooks/useUserProfiles';
import useFileManager from '@/features/AddRecord/hooks/useFileManager';
import { useRecordFilters } from '@/features/ViewEditRecord/hooks/useRecordFilters';
import { FileObject } from '@/types/core';
import { toast } from 'sonner';
import { useRecordDeletion } from '@/features/ViewEditRecord/hooks/useRecordDeletion';
import { AlertCircle, Loader2, Search, Upload } from 'lucide-react';
import RecordFull from '@/features/ViewEditRecord/components/RecordFull';
import RecordDeletionDialog from '@/features/ViewEditRecord/components/RecordDeletionDialog';
import FilterTabs from '@/features/ViewEditRecord/components/View/FilterTabs';

type InitialRecordView =
  | 'record'
  | 'edit'
  | 'versions'
  | 'credibility'
  | 'permissions'
  | 'access'
  | 'subject';

export const AllRecords: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const { updateFirestoreRecord } = useFileManager();

  // ================== RECORD FETCHING ==========================

  const [filterType, setFilterType] = useState<RecordFilterType>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>(undefined);

  const { records: allRecordsForSubjects } = useUserRecords(user?.uid, { filterType: 'all' });

  const { records, loading, error, refetchRecords } = useUserRecords(user?.uid, {
    filterType,
    subjectId: selectedSubjectId,
  });

  // ================== SUBJECT PROFILES ==========================

  // Extract unique subjects from records
  const uniqueSubjects = React.useMemo(() => {
    const subjectIds = new Set<string>();
    allRecordsForSubjects.forEach(record => {
      record.subjects?.forEach(subjectId => subjectIds.add(subjectId));
    });
    return Array.from(subjectIds);
  }, [allRecordsForSubjects]);

  // Load user profiles for all unique subjects
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

  // ================== RECORD SELECTION (view/RecordFull) =======

  const [selectedRecord, setSelectedRecord] = useState<FileObject | null>(null);
  const [initialRecordView, setInitialRecordView] = useState<InitialRecordView>('record');
  const [comingFromAddRecord, setComingFromAddRecord] = useState(false);

  // Keep selectedRecord in sync when Firestore pushes record updates
  useEffect(() => {
    if (selectedRecord && records.length > 0) {
      const updated = records.find(r => r.id === selectedRecord.id);
      if (updated && updated !== selectedRecord) {
        console.log('🔄 Syncing selected record with fresh data.');
        setSelectedRecord(updated);
      }
    }
  }, [records]);

  const openRecord = (record: FileObject, view: InitialRecordView = 'record') => {
    setSelectedRecord(record);
    setInitialRecordView(view);
    setComingFromAddRecord(false);
  };

  const closeRecord = () => {
    setSelectedRecord(null);
    setInitialRecordView('record');
    setComingFromAddRecord(false);
  };

  // ================== AUTO-OPEN (from AddRecord navigation) =====

  const [autoOpenRecordId, setAutoOpenRecordId] = useState<string | null>(null);
  const [autoOpenInEditMode, setAutoOpenInEditMode] = useState(false);

  // Check for navigation state on mount and when records load
  useEffect(() => {
    const state = location.state as { openRecordId?: string; openInEditMode?: boolean };

    if (state?.openRecordId) {
      console.log('🎯 Received navigation state:', state);
      setAutoOpenRecordId(state.openRecordId);
      setAutoOpenInEditMode(state.openInEditMode || false);

      // Clear the state so it doesn't re-trigger
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (autoOpenRecordId && records.length > 0) {
      const record = records.find(r => r.id === autoOpenRecordId);
      if (record) {
        console.log('🎯 Auto-opening record:', record.id, 'Edit mode:', autoOpenInEditMode);
        setSelectedRecord(record);
        setInitialRecordView(autoOpenInEditMode ? 'edit' : 'record');
        setComingFromAddRecord(true);
        setAutoOpenRecordId(null); // clear so it doesn't re-trigger
      }
    }
  }, [autoOpenRecordId, records]);

  // ================== SAVE HANDLER =============================

  const handleSaveRecord = async (updatedRecord: FileObject) => {
    try {
      if (!updatedRecord.id) throw new Error('Cannot save record - no document ID found');

      await updateFirestoreRecord(updatedRecord.id, {
        fhirData: updatedRecord.fhirData,
        belroseFields: updatedRecord.belroseFields,
        lastModified: new Date().toISOString(),
      });

      setSelectedRecord(updatedRecord);
      toast.success(`💾 Record saved for ${updatedRecord.belroseFields?.title}`, {
        description: 'Record updates saved to cloud storage',
        duration: 4000,
      });
    } catch (err) {
      console.error('Failed to save record:', err);
      toast.error(`Failed to save ${updatedRecord.belroseFields?.title}`, {
        description: err instanceof Error ? err.message : 'Unknown error occurred',
        duration: 4000,
      });
    }
  };

  // ================== DELETE HANDLER ===========================

  const [recordToDelete, setRecordToDelete] = useState<FileObject | null>(null);

  const deletion = useRecordDeletion(recordToDelete || ({} as FileObject), () => {
    const deletedId = recordToDelete?.id;
    setRecordToDelete(null);
    refetchRecords();
    if (selectedRecord?.id === deletedId) closeRecord();
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

  const handleAddNewRecord = () => navigate('/app/addrecord');

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

  // ================== RECORD FULL VIEW =========================

  if (selectedRecord) {
    return (
      <div className="p-4">
        <RecordFull
          record={selectedRecord}
          onDownload={handleDownloadRecord}
          onCopy={handleCopyRecord}
          onDelete={handleDeleteRecord}
          onBack={closeRecord}
          onSave={handleSaveRecord}
          initialViewMode={initialRecordView}
          comingFromAddRecord={comingFromAddRecord}
          onRefreshRecord={refetchRecords}
        />
        {recordToDelete && (
          <RecordDeletionDialog {...deletion.dialogProps} closeDialog={handleCloseDeleteDialog} />
        )}
      </div>
    );
  }
  // ================== LIST VIEW ================================

  // Empty state (no records at all, before search filtering)
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
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-5 h-5 mr-2" />
            Upload Your First Record
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your Health Records</h1>
          </div>
          <button
            onClick={handleAddNewRecord}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            Add Record
          </button>
        </div>
      </div>
      {/* Filter Tabs + Subject Selector */}
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

      {/* Search and Source Type Filter */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-background border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={sourceTypeFilter}
            onChange={e => setSourceTypeFilter(e.target.value)}
            className="px-3 py-2 bg-background border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            {sourceTypes.map(type => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
