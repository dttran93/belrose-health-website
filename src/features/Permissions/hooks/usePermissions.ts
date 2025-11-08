//src/features/Permissions/hooks/usePermissions.ts
import { useState } from 'react';
import { PermissionsService } from '@/features/Permissions/services/permissionsService';
import { SharingService } from '@/features/Sharing/services/sharingService';

interface UsePermissionsOptions {
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
}

/**
 * React hook for managing record permissions
 * Wraps the PermissionsService with React state management
 */
export function usePermissions(options?: UsePermissionsOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Add an owner to a record
   */
  const addOwner = async (recordId: string, userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await PermissionsService.addOwner(recordId, userId);
      const successMessage = 'Owner added successfully';
      options?.onSuccess?.(successMessage);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add owner';
      setError(errorMessage);
      options?.onError?.(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove an owner from a record
   */
  const removeOwner = async (recordId: string, userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await PermissionsService.removeOwner(recordId, userId);
      const successMessage = 'Owner removed successfully';
      options?.onSuccess?.(successMessage);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove owner';
      setError(errorMessage);
      options?.onError?.(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Revoke shared access (remove a viewer)
   */
  const revokeAccess = async (recordId: string, receiverId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await SharingService.revokeAccess(recordId, receiverId);
      const successMessage = 'Access revoked successfully';
      options?.onSuccess?.(successMessage);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke access';
      setError(errorMessage);
      options?.onError?.(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Set the subject ID for a record
   */
  const setSubject = async (recordId: string, subjectId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await PermissionsService.setSubject(recordId, subjectId);
      const successMessage = 'Record subject set successfully';
      options?.onSuccess?.(successMessage);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set subject';
      setError(errorMessage);
      options?.onError?.(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check if current user can perform owner operations
   */
  const canManageOwners = async (recordId: string): Promise<boolean> => {
    return PermissionsService.canManageOwners(recordId);
  };

  /**
   * Check if a user can be removed as an owner
   */
  const canRemoveOwner = async (recordId: string, userId: string): Promise<boolean> => {
    return PermissionsService.canRemoveOwner(recordId, userId);
  };

  return {
    // Actions
    addOwner,
    removeOwner,
    revokeAccess,
    setSubject,

    // Permission checks
    canManageOwners,
    canRemoveOwner,

    // State
    isLoading,
    error,
  };
}
