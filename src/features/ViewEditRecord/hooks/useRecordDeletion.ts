// src/features/ViewEditRecord/hooks/useRecordDeletion.ts

import { useState } from 'react';
import RecordDeletionService, { DeletionCheckResult } from '../services/recordDeletionService';
import { FileObject } from '@/types/core';
import { toast } from 'sonner';

interface UseRecordDeletionReturn {
  isDeleting: boolean;
  deleteRecord: (record: FileObject, userId: string) => Promise<void>;
  checkCanDelete: (record: FileObject, userId: string) => Promise<DeletionCheckResult>;
}

export function useRecordDeletion(): UseRecordDeletionReturn {
  const [isDeleting, setIsDeleting] = useState(false);

  const checkCanDelete = async (record: FileObject, userId: string) => {
    return await RecordDeletionService.checkDeletionPermissions(record, userId);
  };

  const deleteRecord = async (record: FileObject, userId: string) => {
    setIsDeleting(true);

    try {
      await RecordDeletionService.deleteRecord(record, userId);
      toast.success(`Deleted "${record.belroseFields?.title}"`, {
        description: 'Record has been permanently deleted',
        duration: 4000,
      });
    } catch (error) {
      console.error('Failed to delete record:', error);
      toast.error('Failed to delete record', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000,
      });
      throw error;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isDeleting,
    deleteRecord,
    checkCanDelete,
  };
}
