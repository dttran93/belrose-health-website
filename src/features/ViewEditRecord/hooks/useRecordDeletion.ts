// src/features/ViewEditRecord/hooks/useRecordDeletion.ts

import { useEffect, useState } from 'react';
import RecordDeletionService, { DeletionCheckResult } from '../services/recordDeletionService';
import { FileObject } from '@/types/core';
import { useAuthContext } from '@/features/Auth/AuthContext';

export type RecordDeletionPhase =
  | 'idle'
  | 'checking' //Loading permissions check
  | 'options' // Show warnings + "Delete Record" vs "Remove Me" choice
  | 'confirming' // Final confirmation before deleting
  | 'deleting' // loading status for deleting
  | 'success'
  | 'error';

interface UseRecordDeletionResult {
  dialogProps: {
    // State
    isOpen: boolean;
    phase: RecordDeletionPhase;
    checkResult: DeletionCheckResult | null;
    error: string | null;
    isUserSubject: boolean;
    record: FileObject;
    startDeletion: () => void;
    confirmDeletion: () => Promise<void>;
    removeJustMe: () => Promise<void>;
    closeDialog: () => void;
  };

  // Actions
  initiateDeletion: () => void;

  // State
  isLoading: boolean;
  isOpen: boolean;
}

export const useRecordDeletion = (
  record: FileObject,
  onSuccess?: () => void
): UseRecordDeletionResult => {
  const { user } = useAuthContext();
  const [phase, setPhase] = useState<RecordDeletionPhase>('idle');
  const [checkResult, setCheckResult] = useState<DeletionCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isUserSubject = record.subjects?.includes(user?.uid || '') || false;

  useEffect(() => {
    console.log('📝 Record changed, resetting deletion state:', record.id);
    setPhase('idle');
    setCheckResult(null);
    setError(null);
  }, [record.id]);

  const initiateDeletion = async () => {
    if (!user?.uid) {
      setError('User not authenticated');
      setPhase('error');
      return;
    }

    try {
      setPhase('checking');
      const result = await RecordDeletionService.checkDeletionPermissions(record, user.uid);
      setCheckResult(result);
      setPhase('options');
    } catch (err: any) {
      setError(err.message || 'Failed to check deletion permissions');
      setPhase('error');
    }
  };

  const closeDialog = () => {
    setPhase('idle');
    setError(null);
  };

  const startDeletion = () => {
    setPhase('confirming');
  };

  const confirmDeletion = async () => {
    if (!user?.uid) {
      setError('User not authenticated');
      setPhase('error');
      return;
    }

    setPhase('deleting');

    try {
      await RecordDeletionService.deleteRecord(record, user.uid);

      setPhase('success');

      // Call onSuccess callback after a brief delay
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      console.error('❌ Deletion failed:', err);
      setError(err.message || 'Failed to delete record');
      setPhase('error');
    }
  };

  const removeJustMe = async () => {
    if (!user?.uid) {
      setError('User not authenticated');
      setPhase('error');
      return;
    }

    setPhase('deleting');

    try {
      const service = new RecordDeletionService();

      // If user is a subject and wants to remove subject status, they need to handle that separately
      // via SubjectActionDialog - this just removes permissions
      await service.removeUserFromRecord(record, user.uid);

      setPhase('success');

      // Call onSuccess callback after a brief delay
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      console.error('❌ Remove self failed:', err);
      setError(err.message || 'Failed to remove yourself from record');
      setPhase('error');
    }
  };

  return {
    dialogProps: {
      isOpen: phase !== 'idle',
      phase,
      checkResult,
      error,
      isUserSubject,
      record,
      startDeletion,
      confirmDeletion,
      removeJustMe,
      closeDialog,
    },

    initiateDeletion,
    isLoading: phase === 'checking' || phase === 'deleting',
    isOpen: phase !== 'idle',
  };
};
