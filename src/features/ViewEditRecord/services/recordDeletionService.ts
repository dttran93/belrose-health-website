// services/recordDeletionService.ts

/**
 * Service to delete records. Requires checking permissions, determining blockchain options
 * and clearing versionHistories and wrappedKeys
 */

import { PermissionsService } from '@/features/Permissions/services/permissionsService';
import SubjectQueryService from '@/features/Subject/services/subjectQueryService';
import SubjectRemovalService from '@/features/Subject/services/subjectRemovalService';
import { deleteFileComplete } from '@/firebase/uploadUtils';
import { FileObject } from '@/types/core';
import { getFirestore, doc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

export interface DeletionCheckResult {
  canDelete: boolean;
  reason?: string;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  hasSubjects: boolean;
  subjectCount?: number;
  affectsOtherUsers: boolean;
  otherUserCount?: number;
  otherOwners?: string[];
  otherAdmins?: string[];
  otherViewers?: string[];
  otherSubjects?: string[];
}

interface RecordDeletionEvent {
  recordId: string;
  recordTitle: string;
  deletedBy: string;
  deletedAt: Timestamp;
  affectedUsers: {
    owners: string[];
    administrators: string[];
    viewers: string[];
    subjects: string[];
  };
  deletionComplete: boolean;
}

class RecordDeletionService {
  /**
   * Step 1: Check if user can delete and what warnings to show
   */
  static async checkDeletionPermissions(
    record: FileObject,
    userId: string
  ): Promise<DeletionCheckResult> {
    // Get all role information from PermissionsService
    const roleInfo = await PermissionsService.getRecordRoles(record.id);

    if (!roleInfo) {
      return {
        canDelete: false,
        reason: 'Could not load record permissions',
        requiresConfirmation: false,
        hasSubjects: false,
        affectsOtherUsers: false,
      };
    }

    // Check if record has subjects (to see blockchain anchoring)
    const subjects = await SubjectQueryService.getRecordSubjects(record.id);
    const hasSubjects = subjects && subjects.length > 0;
    const subjectCount = subjects?.length || 0;

    const { owners, administrators, viewers } = roleInfo;

    // Check if there's an owner
    const userRole = PermissionsService.getUserRole({ owners, administrators, viewers }, userId);

    // Calculate other users (everyone except current user)
    const otherOwners = owners.filter(id => id !== userId);
    const otherAdmins = administrators.filter(id => id !== userId);
    const otherViewers = viewers.filter(id => id !== userId);
    const otherSubjects = subjects.filter(id => id !== userId);
    const totalOtherUsers = otherOwners.length + otherAdmins.length + otherViewers.length;

    // Permission logic:
    const hasOwners = owners.length > 0;
    const isUserOwner = owners.includes(userId);

    // Check 1: If there is an owner, user must be an owner to delete
    if (hasOwners && !isUserOwner) {
      return {
        canDelete: false,
        reason: 'Only owners can delete a record',
        requiresConfirmation: false,
        hasSubjects,
        subjectCount,
        affectsOtherUsers: totalOtherUsers > 0,
        otherUserCount: totalOtherUsers,
      };
    }

    // Check 2: If there isn't an owner, is the user an administrator?
    if (!hasOwners && userRole !== 'administrator') {
      return {
        canDelete: false,
        reason: 'You must be an administrator to delete this record',
        requiresConfirmation: false,
        hasSubjects,
        subjectCount,
        affectsOtherUsers: totalOtherUsers > 0,
        otherUserCount: totalOtherUsers,
      };
    }

    // Check 3: Cannot delete if there are other owners
    if (otherOwners.length > 0) {
      return {
        canDelete: false,
        reason:
          'There are other owners on this record. They must remove themselves before deletion',
        requiresConfirmation: false,
        hasSubjects,
        subjectCount,
        affectsOtherUsers: true,
        otherUserCount: totalOtherUsers,
        otherOwners,
      };
    }

    // At this point:
    // - User is the ONLY owner (if an owner exist) OR
    // - The user is an admin and no owners exist
    // Build confirmation message
    const warnings: string[] = [];

    // Warn about other admins/viewers being affected
    if (otherAdmins.length > 0 || otherViewers.length > 0 || otherSubjects.length > 0) {
      const userBreakdown: string[] = [];

      if (otherAdmins.length > 0) {
        userBreakdown.push(`${otherAdmins.length} admin${otherAdmins.length > 1 ? 's' : ''}`);
      }
      if (otherViewers.length > 0) {
        userBreakdown.push(`${otherViewers.length} viewer${otherViewers.length > 1 ? 's' : ''}`);
      }
      if (otherSubjects.length > 0) {
        userBreakdown.push(`${otherSubjects.length} subject${otherSubjects.length > 1 ? 's' : ''}`);
      }

      const totalAffected = otherAdmins.length + otherViewers.length;
      warnings.push(
        `This will delete the record for ${totalAffected} other user${
          totalAffected > 1 ? 's' : ''
        } (${userBreakdown.join(', ')}). The users will be notified that you deleted the record.`
      );
    }

    warnings.push('This action cannot be undone');

    return {
      canDelete: true,
      requiresConfirmation: true,
      confirmationMessage: warnings.join('. '),
      hasSubjects,
      subjectCount,
      affectsOtherUsers: otherAdmins.length > 0 || otherViewers.length > 0,
      otherUserCount: otherAdmins.length + otherViewers.length,
      otherOwners: [],
      otherAdmins,
      otherViewers,
      otherSubjects,
    };
  }

  /**
   * Step 2: Actually delete (called after user confirms)
   *
   * NOTE: If the deleting user is a subject, they should have already
   * unanchored themselves via SubjectActionDialog before calling this.
   */
  static async deleteRecord(record: FileObject, userId: string): Promise<void> {
    // Final permission check (in case state changed)
    const check = await this.checkDeletionPermissions(record, userId);
    if (!check.canDelete) {
      throw new Error(check.reason || 'Cannot delete this record');
    }

    try {
      console.log('🗑️ Starting complete record deletion for:', record.id);

      // Step 1: Create deletion event (triggers notifications via Cloud Function)
      await this.createDeletionEvent(record, userId, check);

      // Step 2: Handle OTHER subjects (not the deleting user - they already unanchored)
      if (check.hasSubjects && check.otherSubjects && check.otherSubjects.length > 0) {
        await this.handleOtherSubjectsCleanup(record, check);
      }

      // Step 3: Delete from Firebase (storage + Firestore + versions + wrapped keys)
      await deleteFileComplete(record.id);
      console.log('✅ Record deleted from Firebase');

      // Step 4: Mark deletion event as complete
      await this.markDeletionComplete(record.id);

      console.log('✅ Complete record deletion finished:', record.id);
    } catch (error) {
      console.error('❌ Record deletion failed:', error);
      throw error;
    }
  }

  /**
   * Create a deletion event that triggers notifications and serve as audit trail
   */
  private static async createDeletionEvent(
    record: FileObject,
    userId: string,
    checkResult: DeletionCheckResult
  ): Promise<void> {
    try {
      const db = getFirestore();

      const deletionEvent: RecordDeletionEvent = {
        recordId: record.id,
        recordTitle: record.belroseFields?.title || record.fileName,
        deletedBy: userId,
        deletedAt: Timestamp.now(),
        affectedUsers: {
          owners: checkResult.otherOwners || [],
          administrators: checkResult.otherAdmins || [],
          viewers: checkResult.otherViewers || [],
          subjects: checkResult.otherSubjects || [],
        },
        deletionComplete: false,
      };

      const eventRef = doc(db, 'recordDeletionEvents', record.id);
      await setDoc(eventRef, deletionEvent);

      console.log('✅ Deletion event created:', record.id);
    } catch (error) {
      console.error('❌ Failed to create deletion event:', error);
      console.warn('⚠️ Continuing with deletion despite event creation failure');
    }
  }

  /**
   * Mark deletion as complete
   */
  private static async markDeletionComplete(recordId: string): Promise<void> {
    try {
      const db = getFirestore();
      const eventRef = doc(db, 'recordDeletionEvents', recordId);

      await updateDoc(eventRef, {
        deletionComplete: true,
      });

      console.log('✅ Deletion marked complete:', recordId);
    } catch (error) {
      console.error('❌ Failed to mark deletion complete:', error);
      console.warn('⚠️ Deletion event not marked complete, but record was deleted');
    }
  }

  /**
   * Handle OTHER subjects cleanup (not the deleting user)
   *
   * Creates removal requests for all other subjects so they can unanchor themselves.
   */
  private static async handleOtherSubjectsCleanup(
    record: FileObject,
    checkResult: DeletionCheckResult
  ): Promise<void> {
    console.log('🔗 Creating removal requests for other subjects...');

    try {
      // Create removal requests for all other subjects (Unanchoring by the current user is covered by subject service in Record Deletion Dialog)
      const otherSubjects = checkResult.otherSubjects || [];

      if (otherSubjects.length === 0) {
        return;
      }

      console.log(`📨 Creating removal requests for ${otherSubjects.length} other subject(s)...`);

      const removalPromises = otherSubjects.map(async subjectId => {
        try {
          await SubjectRemovalService.requestRemoval(
            record.id,
            subjectId,
            `Record "${record.belroseFields?.title || record.fileName}" is being deleted by the owner/administrator. Please unanchor yourself from this record.`,
            record.belroseFields?.title || record.fileName
          );
          console.log(`✅ Removal request created for subject: ${subjectId}`);
          return { success: true, subjectId };
        } catch (error) {
          console.error(`❌ Failed to create removal request for ${subjectId}:`, error);
          return { success: false, subjectId, error };
        }
      });

      const results = await Promise.allSettled(removalPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`📊 Removal requests: ${successful} successful, ${failed} failed`);

      if (failed > 0) {
        console.warn(`⚠️ Failed to create ${failed} removal request(s), continuing...`);
      }
    } catch (error) {
      console.error('⚠️ Other subjects cleanup failed:', error);
      // Don't throw - let deletion continue
    }
  }

  /**
   * Remove self from record (don't delete for everyone)
   *
   * NOTE: If user is a subject, they should unanchor via SubjectActionDialog first.
   * This method only removes permissions.
   */
  async removeUserFromRecord(record: FileObject, userId: string): Promise<void> {
    console.log('👤 Removing user from record:', userId);

    try {
      const role = PermissionsService.getUserRole(record, userId);
      if (!role) {
        throw new Error('User does not have a role on this record');
      }

      await PermissionsService.removeRole(record.id, userId, role);
      console.log('✅ User removed from record successfully');
    } catch (error) {
      console.error('❌ Failed to remove user from record:', error);
      throw error;
    }
  }
}

export default RecordDeletionService;
