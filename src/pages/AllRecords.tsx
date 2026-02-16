//src/pages/AllRecords.tsx

/**
 * AllRecords Component - Main container for viewing and managing health records
 * Uses useUserRecords to fetch records based on selected filters
 * Uses useUserProfiles to fetch profiles for all unique subjects in the records
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { useRecordFileActions } from '@/features/ViewEditRecord/hooks/useRecordFileActions';
import { RecordsList } from '@/features/ViewEditRecord/components/RecordsList';
import { RecordFilterType, useUserRecords } from '@/features/ViewEditRecord/hooks/useUserRecords';
import useUserProfiles from '@/features/Users/hooks/useUserProfiles';

export const AllRecords: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();

  const [filterType, setFilterType] = useState<RecordFilterType>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>(undefined);

  const { records, loading, error, refetchRecords } = useUserRecords(user?.uid, {
    filterType,
    subjectId: selectedSubjectId,
  });

  const [autoOpenRecordId, setAutoOpenRecordId] = useState<string | null>(null);
  const [autoOpenInEditMode, setAutoOpenInEditMode] = useState(false);

  // Get all record actions from the centralized hook
  const recordActions = useRecordFileActions();

  // Extract unique subjects from records
  const uniqueSubjects = React.useMemo(() => {
    const subjectIds = new Set<string>();
    records.forEach(record => {
      record.subjects?.forEach(subjectId => subjectIds.add(subjectId));
    });
    return Array.from(subjectIds);
  }, [records]);

  // Load user profiles for all unique subjects
  const { loading: loadingProfiles, getDisplayName } = useUserProfiles(uniqueSubjects);

  const handleFilterChange = (newFilterType: RecordFilterType) => {
    setFilterType(newFilterType);
    // Reset subject selection when changing filter types
    if (newFilterType !== 'subject') {
      setSelectedSubjectId(undefined);
    }
  };

  const handleAddNewRecord = () => {
    navigate('/app/addrecord');
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Filter Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex space-x-8">
              {[
                { value: 'all', label: 'All Records' },
                { value: 'subject', label: 'Filter by Patient' },
                { value: 'uploaded', label: 'Uploaded by Me' },
                { value: 'owner', label: 'I Own' },
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => handleFilterChange(tab.value as RecordFilterType)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    filterType === tab.value
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Subject Selector - only show when "Filter by Patient" is active */}
            {filterType === 'subject' && (
              <div className="py-2">
                <select
                  value={selectedSubjectId || ''}
                  onChange={e => setSelectedSubjectId(e.target.value || undefined)}
                  disabled={loadingProfiles}
                  className="block w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:opacity-50"
                >
                  <option value="">
                    {user?.uid && uniqueSubjects.includes(user.uid)
                      ? 'My Health Records'
                      : 'Select a patient...'}
                  </option>

                  {/* Current user first (if they're a subject) */}
                  {user?.uid && uniqueSubjects.includes(user.uid) && (
                    <option value={user.uid}>{getDisplayName(user.uid)} (Me)</option>
                  )}

                  {/* Other subjects */}
                  {uniqueSubjects
                    .filter(id => id !== user?.uid)
                    .sort((a, b) => {
                      const nameA = getDisplayName(a);
                      const nameB = getDisplayName(b);
                      return nameA.localeCompare(nameB);
                    })
                    .map(subjectId => (
                      <option key={subjectId} value={subjectId}>
                        {getDisplayName(subjectId)}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <RecordsList
        {...recordActions}
        onAddNewRecord={handleAddNewRecord}
        records={records}
        loading={loading}
        error={error}
        autoOpenRecordId={autoOpenRecordId}
        autoOpenInEditMode={autoOpenInEditMode}
        onRefreshRecords={refetchRecords}
      />
    </div>
  );
};

export default AllRecords;
