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
   * Add an admin to a record
   */
  const addAdmin = async (recordId: string, userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await PermissionsService.addAdmin(recordId, userId);
      const successMessage = 'Admin added successfully';
      options?.onSuccess?.(successMessage);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add admin';
      setError(errorMessage);
      options?.onError?.(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove an admin from a record
   */
  const removeAdmin = async (recordId: string, userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await PermissionsService.removeAdmin(recordId, userId);
      const successMessage = 'Admin removed successfully';
      options?.onSuccess?.(successMessage);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove admin';
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
   * Check if current user can perform owner operations
   */
  const canManageAdmins = async (recordId: string): Promise<boolean> => {
    return PermissionsService.canManageAdmins(recordId);
  };

  /**
   * Check if a user can be removed as an owner
   */
  const canRemoveAdmins = async (recordId: string, userId: string): Promise<boolean> => {
    return PermissionsService.canRemoveAdmins(recordId, userId);
  };

  return {
    // Actions
    addOwner,
    revokeAccess,
    addAdmin,
    removeAdmin,

    // Permission checks
    canManageAdmins,
    canRemoveAdmins,

    // State
    isLoading,
    error,
  };
}
