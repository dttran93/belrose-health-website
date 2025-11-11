import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/components/auth/AuthContext';
import { useRecordFileActions } from '@/features/ViewEditRecord/hooks/useRecordFileActions';
import { RecordsList } from '@/features/ViewEditRecord/components/RecordsList';
import { useAllUserRecords } from '@/features/ViewEditRecord/hooks/useAllUserRecords';

/**
 * AllRecords Component - Main container for viewing and managing health records
 *
 * This component uses the useRecordFileActions and useCompleteRecords hook to centralize File Actions (copy/download)
 * and passes them down to RecordsList
 */
export const AllRecords: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const { records, loading, error, refetchRecords } = useAllUserRecords(user?.uid);

  const [autoOpenRecordId, setAutoOpenRecordId] = useState<string | null>(null);
  const [autoOpenInEditMode, setAutoOpenInEditMode] = useState(false);

  // Get all record actions from the centralized hook
  const recordActions = useRecordFileActions();

  const handleAddNewRecord = () => {
    navigate('/dashboard/addrecord');
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
      <RecordsList
        {...recordActions}
        onAddNewRecord={handleAddNewRecord}
        records={records}
        loading={loading}
        error={error}
        autoOpenRecordId={autoOpenRecordId}
        autoOpenInEditMode={autoOpenInEditMode}
      />
    </div>
  );
};

export default AllRecords;
