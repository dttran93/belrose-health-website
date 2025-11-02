import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { user } = useAuthContext();
  const { records, loading, error } = useAllUserRecords(user?.uid);

  // Get all record actions from the centralized hook
  const recordActions = useRecordFileActions();

  const handleAddNewRecord = () => {
    navigate('/dashboard/addrecord');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <RecordsList
        {...recordActions}
        onAddNewRecord={handleAddNewRecord}
        records={records}
        loading={loading}
        error={error}
      />
    </div>
  );
};

export default AllRecords;
