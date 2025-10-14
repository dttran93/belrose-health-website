// src/features/Sharing/hooks/useSharing.ts

import { useState } from 'react';
import { SharingService, ShareRecordRequest, SharedRecord } from '../services/sharingService';
import { toast } from 'sonner';

export const useSharing = () => {
  const [isSharing, setIsSharing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const shareRecord = async (request: ShareRecordRequest) => {
    setIsSharing(true);
    try {
      await SharingService.shareRecord(request);
      toast.success('Record shared successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to share record';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsSharing(false);
    }
  };

  const revokeAccess = async (recordId: string, providerId: string) => {
    setIsRevoking(true);
    try {
      await SharingService.revokeAccess(recordId, providerId);
      toast.success('Access revoked successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to revoke access';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsRevoking(false);
    }
  };

  const getSharedRecords = async (): Promise<SharedRecord[]> => {
    setIsLoading(true);
    try {
      return await SharingService.getSharedRecords();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch shared records';
      toast.error(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const getRecordsSharedWithMe = async (): Promise<SharedRecord[]> => {
    setIsLoading(true);
    try {
      return await SharingService.getRecordsSharedWithMe();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch shared records';
      toast.error(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    shareRecord,
    revokeAccess,
    getSharedRecords,
    getRecordsSharedWithMe,
    isSharing,
    isRevoking,
    isLoading,
  };
};
