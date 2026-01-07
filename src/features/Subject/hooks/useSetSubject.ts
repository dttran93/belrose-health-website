// features/Subject/hooks/useSetSubject.ts

import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { FileObject } from '@/types/core';
import { PermissionsService } from '@/features/Permissions/services/permissionsService';
import { SubjectService } from '../services/subjectService';

export type SubjectRole = 'viewer' | 'administrator' | 'owner';

interface UseSetSubjectOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseSetSubjectReturn {
  setSubjectAsSelf: (record: FileObject, role: SubjectRole) => Promise<void>;
  requestSubjectConsent: (
    record: FileObject,
    subjectId: string,
    role: SubjectRole
  ) => Promise<void>;
  removeSubjectAsSelf: (record: FileObject, reason?: string) => Promise<void>;
  removeSubjectAsOwner: (record: FileObject, subjectId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// Role hierarchy for comparison
const ROLE_HIERARCHY: Record<SubjectRole | 'none', number> = {
  none: 0,
  viewer: 1,
  administrator: 2,
  owner: 3,
};

/**
 * Get the user's current highest role for a record
 */
export const getUserRoleForRecord = (userId: string, record: FileObject): SubjectRole | null => {
  if (record.owners?.includes(userId)) return 'owner';
  if (record.administrators?.includes(userId)) return 'administrator';
  // Check if user has viewer access (shared with them)
  // This would need to check the sharedWith array or similar
  // For now, we'll check if they're the uploader
  if (record.uploadedBy === userId) return 'administrator';
  return null;
};

/**
 * Check if selecting a role would be a downgrade
 */
export const isRoleDowngrade = (
  currentRole: SubjectRole | null,
  selectedRole: SubjectRole
): boolean => {
  const currentLevel = ROLE_HIERARCHY[currentRole || 'none'];
  const selectedLevel = ROLE_HIERARCHY[selectedRole];
  return selectedLevel < currentLevel;
};

/**
 * Get the minimum allowed role for a user (their current role or viewer if none)
 */
export const getMinimumAllowedRole = (userId: string, record: FileObject): SubjectRole => {
  const currentRole = getUserRoleForRecord(userId, record);
  return currentRole || 'viewer';
};

/**
 * Hook for setting record subjects with integrated permission management
 *
 * This hook provides a UI-friendly interface for subject management,
 * handling loading states, error messages, and toast notifications.
 * All Firestore operations are delegated to SubjectService.
 * Permission operations use PermissionsService directly (no dialog confirmation needed).
 */
export const useSetSubject = (options: UseSetSubjectOptions = {}): UseSetSubjectReturn => {
  const { onSuccess, onError } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = getAuth();

  /**
   * Grant a role to a user for a record using PermissionsService
   */
  const grantRole = async (recordId: string, userId: string, role: SubjectRole): Promise<void> => {
    switch (role) {
      case 'owner':
        await PermissionsService.grantOwner(recordId, userId);
        break;
      case 'administrator':
        await PermissionsService.grantAdmin(recordId, userId);
        break;
      case 'viewer':
        await PermissionsService.grantViewer(recordId, userId);
        break;
    }
  };

  /**
   * Set the current user as subject of the record
   */
  const setSubjectAsSelf = async (record: FileObject, role: SubjectRole): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    if (!record.id) {
      throw new Error('Record ID is missing');
    }

    // Check for downgrade
    const currentRole = getUserRoleForRecord(currentUser.uid, record);
    if (isRoleDowngrade(currentRole, role)) {
      throw new Error(
        `Cannot downgrade your permissions from ${currentRole} to ${role}. ` +
          `Please select ${currentRole} or higher.`
      );
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Add user as subject via SubjectService
      console.log('📝 Adding self as subject...');
      await SubjectService.setSubjectAsSelf(record.id);

      // Step 2: Grant role (if upgrading or same level)
      // Only grant if the role is higher than current
      if (!currentRole || ROLE_HIERARCHY[role] > ROLE_HIERARCHY[currentRole]) {
        console.log(`🔐 Granting ${role} role...`);
        await grantRole(record.id, currentUser.uid, role);
      } else {
        console.log(`ℹ️ User already has ${currentRole} role, skipping role grant`);
      }

      // Step 3: Blockchain verification (future)
      // TODO: await BlockchainService.recordSubjectAttestation(record.id, currentUser.uid);
      console.log('⛓️ Blockchain attestation (TODO)');

      console.log('✅ Successfully set self as subject');
      toast.success('You have been set as the subject of this record');
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set subject';
      console.error('❌ Failed to set subject:', err);
      setError(errorMessage);
      toast.error(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Request consent from another user to be set as subject
   * This creates a pending request that the target user must accept
   */
  const requestSubjectConsent = async (
    record: FileObject,
    subjectId: string,
    role: SubjectRole
  ): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    if (!record.id) {
      throw new Error('Record ID is missing');
    }

    // Verify current user has permission to set subjects
    const currentRole = getUserRoleForRecord(currentUser.uid, record);
    if (!currentRole || ROLE_HIERARCHY[currentRole] < ROLE_HIERARCHY['administrator']) {
      throw new Error('You do not have permission to set subjects for this record');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Create consent request via SubjectService
      console.log('📨 Creating subject consent request...');
      await SubjectService.requestSubjectConsent(record.id, subjectId, {
        role,
        recordTitle: record.belroseFields?.title || record.fileName,
      });

      // Note: Notification is created automatically via Cloud Function (onDocumentCreated trigger)

      // Step 2: Blockchain verification will happen when consent is accepted
      // TODO: Blockchain attestation will be recorded in acceptSubjectRequest flow
      console.log('⛓️ Blockchain attestation will occur upon consent acceptance');

      console.log('✅ Consent request sent successfully');
      toast.success('Consent request sent. The user will be notified.');
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send consent request';
      console.error('❌ Failed to request consent:', err);
      setError(errorMessage);
      toast.error(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove yourself as a subject from a record
   * This triggers the rejection flow where the creator must decide
   * whether to publicly list the rejection
   */
  const removeSubjectAsSelf = async (record: FileObject, reason?: string): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    if (!record.id) {
      throw new Error('Record ID is missing');
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🚫 Removing self as subject...');
      await SubjectService.rejectSubjectStatus(record.id, { reason });

      // TODO: Blockchain attestation for subject removal
      // await BlockchainService.recordSubjectRemoval(record.id, currentUser.uid);
      console.log('⛓️ Blockchain removal attestation (TODO)');

      console.log('✅ Successfully removed self as subject');
      toast.success('You have been removed as the subject of this record');
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove subject status';
      console.error('❌ Failed to remove subject status:', err);
      setError(errorMessage);
      toast.error(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove another user as a subject (owner/admin action)
   * This is an administrative action and does not trigger the rejection flow
   */
  const removeSubjectAsOwner = async (record: FileObject, subjectId: string): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    if (!record.id) {
      throw new Error('Record ID is missing');
    }

    // If removing yourself, use the self-removal flow
    if (subjectId === currentUser.uid) {
      return removeSubjectAsSelf(record);
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🗑️ Removing subject as owner/admin...');
      await SubjectService.removeSubjectByOwner(record.id, subjectId);

      // TODO: Blockchain attestation for administrative subject removal
      // await BlockchainService.recordAdminSubjectRemoval(record.id, subjectId, currentUser.uid);
      console.log('⛓️ Blockchain admin removal attestation (TODO)');

      console.log('✅ Successfully removed subject');
      toast.success('Subject has been removed from this record');
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove subject';
      console.error('❌ Failed to remove subject:', err);
      setError(errorMessage);
      toast.error(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    setSubjectAsSelf,
    requestSubjectConsent,
    removeSubjectAsSelf,
    removeSubjectAsOwner,
    isLoading,
    error,
  };
};

export default useSetSubject;
