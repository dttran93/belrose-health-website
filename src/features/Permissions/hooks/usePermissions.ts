//src/features/Permissions/hooks/usePermissions.ts
import { useState } from 'react';
import { PermissionsService } from '@/features/Permissions/services/permissionsService';
import { SharingService } from '@/features/Sharing/services/sharingService';
import { toast } from 'sonner';

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

      // Show toast with option to also revoke viewer access
      toast.info('Administrator Removed', {
        description: 'Do you also want to revoke their viewer access as well?',
        duration: 8000,
        action: {
          label: 'Yes, Revoke Access',
          onClick: async () => {
            const success = await revokeAccess(recordId, userId);
            if (success) {
              toast.success('All access revoked successfully');
            }
          },
        },
        cancel: {
          label: 'No, Keep Viewer Access',
          onClick: () => {
            toast.success('User can still view as a shared viewer');
          },
        },
      });

      options?.onSuccess?.('Admin status removed successfully');
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
   * Also removes them as an administrator if they are one
   */
  const revokeAccess = async (recordId: string, receiverId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // First, check if they're an admin and remove admin privileges
      // We'll do this silently - if they're not an admin, the removeAdmin will throw but we'll catch it
      try {
        await PermissionsService.removeAdmin(recordId, receiverId);
        console.log('✅ Admin privileges removed before revoking access');
      } catch (adminError) {
        // They're not an admin, that's fine - continue with revoking viewer access
        console.log('ℹ️  User is not an admin, proceeding to revoke viewer access');
      }

      // Revoke viewer access
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
