// src/features/Permissions/hooks/usePermissions.ts
import { useState } from 'react';
import { PermissionsService, Role } from '@/features/Permissions/services/permissionsService';

interface UsePermissionsOptions {
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
}

/**
 * React hook for managing record permissions
 * Wraps the PermissionsService with React state management
 */
export function usePermissions(hookOptions?: UsePermissionsOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // GRANT METHODS
  // ============================================================================

  /**
   * Grant viewer access to a record
   */
  const grantViewer = async (recordId: string, userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await PermissionsService.grantViewer(recordId, userId);
      hookOptions?.onSuccess?.('Viewer added successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add viewer';
      setError(errorMessage);
      hookOptions?.onError?.(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Grant admin access to a record
   */
  const grantAdmin = async (recordId: string, userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await PermissionsService.grantAdmin(recordId, userId);
      hookOptions?.onSuccess?.('Administrator added successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add administrator';
      setError(errorMessage);
      hookOptions?.onError?.(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Grant owner access to a record
   */
  const grantOwner = async (recordId: string, userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await PermissionsService.grantOwner(recordId, userId);
      hookOptions?.onSuccess?.('Owner added successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add owner';
      setError(errorMessage);
      hookOptions?.onError?.(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // REMOVE METHODS
  // ============================================================================

  /**
   * Remove viewer access from a record
   */
  const removeViewer = async (recordId: string, userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await PermissionsService.removeViewer(recordId, userId);
      hookOptions?.onSuccess?.('Viewer access revoked successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove viewer';
      setError(errorMessage);
      hookOptions?.onError?.(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove admin access from a record
   * Shows toast with option to demote to viewer or fully revoke
   */
  const removeAdmin = async (
    recordId: string,
    userId: string,
    options: { demoteToViewer: boolean }
  ) => {
    setIsLoading(true);
    try {
      await PermissionsService.removeAdmin(recordId, userId, options);
      hookOptions?.onSuccess?.(options.demoteToViewer ? 'Demoted to viewer' : 'Access revoked');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove admin';
      setError(msg);
      hookOptions?.onError?.(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove owner access from a record (self-removal only)
   * Now purely execution-focused.
   */
  const removeOwner = async (
    recordId: string,
    userId: string,
    // Accept the final decision directly from the UI component
    options?: { demoteTo?: 'administrator' | 'viewer' }
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      //1. call remove Owner
      await PermissionsService.removeOwner(recordId, userId, {
        demoteTo: options?.demoteTo,
      });

      // 2. Determine the success message based on what happened
      const message = options?.demoteTo
        ? `Successfully demoted to ${options.demoteTo}`
        : 'Owner access has been fully revoked';

      // 3. Trigger standard hook callbacks
      hookOptions?.onSuccess?.(message);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove owner';
      setError(errorMessage);
      hookOptions?.onError?.(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  /**
   * Fully revoke all access (removes from any role)
   * Convenience method that determines current role and removes appropriately
   */
  const revokeAllAccess = async (recordId: string, userId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const roles = await PermissionsService.getRecordRoles(recordId);

      if (!roles) {
        throw new Error('Could not fetch record roles');
      }

      // Determine user's current role and remove accordingly
      if (roles.owners.includes(userId)) {
        // Note: This will fail if caller isn't the user themselves
        await PermissionsService.removeOwner(recordId, userId, {});
      } else if (roles.administrators.includes(userId)) {
        await PermissionsService.removeAdmin(recordId, userId, { demoteToViewer: false });
      } else if (roles.viewers.includes(userId)) {
        await PermissionsService.removeViewer(recordId, userId);
      } else {
        throw new Error('User does not have any role on this record');
      }

      hookOptions?.onSuccess?.('Access revoked successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke access';
      setError(errorMessage);
      hookOptions?.onError?.(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // PERMISSION CHECK METHODS
  // ============================================================================

  /**
   * Check if current user can manage a specific role
   */
  const canManageRole = async (recordId: string, role: Role): Promise<boolean> => {
    return PermissionsService.canManageRole(recordId, role);
  };

  /**
   * Get all roles and management permissions for a record
   */
  const getRecordRoles = async (recordId: string) => {
    return PermissionsService.getRecordRoles(recordId);
  };

  return {
    // Grant actions
    grantViewer,
    grantAdmin,
    grantOwner,

    // Remove actions
    removeViewer,
    removeAdmin,
    removeOwner,
    revokeAllAccess,

    // Permission checks
    canManageRole,
    getRecordRoles,

    // State
    isLoading,
    error,
  };
}
