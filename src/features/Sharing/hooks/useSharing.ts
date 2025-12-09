// src/features/Sharing/hooks/useSharing.ts

import { useState } from 'react';
import {
  SharingService,
  ShareRecordRequest,
  AccessPermissionData,
} from '../services/sharingService';
import { toast } from 'sonner';

export const useSharing = () => {
  const [isSharing, setIsSharing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const shareRecord = async (request: ShareRecordRequest) => {
    setIsSharing(true);
    try {
      console.log('🔄 useSharing: Starting share request:', request);
      await SharingService.shareRecord(request);
      console.log('✅ useSharing: Share completed successfully');
      toast.success('Record shared successfully!');
    } catch (error) {
      console.error('❌ useSharing: Share failed:', error);

      // Log the full error object for debugging
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }

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
      console.log('🔄 useSharing: Starting revoke request:', { recordId, providerId });
      await SharingService.revokeAccess(recordId, providerId);
      console.log('✅ useSharing: Revoke completed successfully');
      toast.success('Access revoked successfully!');
    } catch (error) {
      console.error('❌ useSharing: Revoke failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to revoke access';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsRevoking(false);
    }
  };

  const getSharedRecords = async (): Promise<AccessPermissionData[]> => {
    setIsLoading(true);
    try {
      console.log('🔄 useSharing: Fetching shared records');
      const records = await SharingService.getSharedRecords();
      console.log('✅ useSharing: Fetched shared records:', records.length);
      return records;
    } catch (error) {
      console.error('❌ useSharing: Failed to fetch shared records:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch shared records';
      toast.error(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const getRecordsSharedWithMe = async (): Promise<AccessPermissionData[]> => {
    setIsLoading(true);
    try {
      console.log('🔄 useSharing: Fetching records shared with me');
      const records = await SharingService.getRecordsSharedWithMe();
      console.log('✅ useSharing: Fetched records shared with me:', records.length);
      return records;
    } catch (error) {
      console.error('❌ useSharing: Failed to fetch records shared with me:', error);
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
