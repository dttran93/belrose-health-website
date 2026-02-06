// services/recordDeletionService.ts

/**
 * Service to delete records. Requires checking permissions, determining blockchain options
 * and clearing verisonHistories and wrappedKeys
 */

import { PermissionsService } from '@/features/Permissions/services/permissionsService';
import SubjectQueryService from '@/features/Subject/services/subjectQueryService';
import { RejectionReasons } from '@/features/Subject/services/subjectRejectionService';
import SubjectRemovalService from '@/features/Subject/services/subjectRemovalService';
import SubjectService from '@/features/Subject/services/subjectService';
import { deleteFileComplete } from '@/firebase/uploadUtils';
import { FileObject } from '@/types/core';

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
    if (otherAdmins.length > 0 || otherViewers.length > 0) {
      const userBreakdown: string[] = [];

      if (otherAdmins.length > 0) {
        userBreakdown.push(`${otherAdmins.length} admin${otherAdmins.length > 1 ? 's' : ''}`);
      }
      if (otherViewers.length > 0) {
        userBreakdown.push(`${otherViewers.length} viewer${otherViewers.length > 1 ? 's' : ''}`);
      }
      if (otherSubjects.length > 0) {
        userBreakdown.push(`${otherSubjects.length} viewer${otherSubjects.length > 1 ? 's' : ''}`);
      }

      warnings.push(
        `This will delete the record for ${otherAdmins.length + otherViewers.length} other user${
          otherAdmins.length + otherViewers.length > 1 ? 's' : ''
        } (${userBreakdown.join(', ')}). The users will be notified that you deleted the record.`
      );
    }

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
   */
  static async deleteRecord(
    record: FileObject,
    userId: string,
    reason?: RejectionReasons
  ): Promise<void> {
    // Final permission check (in case state changed)
    const check = await this.checkDeletionPermissions(record, userId);
    if (!check.canDelete) {
      throw new Error(check.reason || 'Cannot delete this record');
    }

    try {
      console.log('🗑️ Starting complete record deletion for:', record.id);

      // Step 1: Notify Affected Users
      if (check.affectsOtherUsers && check.otherUserCount! > 0) {
      }

      // Step 2: Handle subject removal and blockchain unanchoring
      if (check.hasSubjects) {
        await this.handleSubjectCleanup(record, userId, reason, check);
      }

      // 1. Delete from Firebase
      await deleteFileComplete(record.id);
      console.log('Record deleted successfully');

      // 2. Subject removal and unanchoring from blockchain
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle subject cleanup and blockchain unanchoring
   */
  private static async handleSubjectCleanup(
    record: FileObject,
    userId: string,
    reason: RejectionReasons | undefined,
    checkResult: DeletionCheckResult
  ): Promise<void> {
    console.log('🔗 Handling subject cleanup and blockchain unanchoring...');

    try {
      // Step 1: If the deleting user is a subject, remove them immediately
      if (reason && record.subjects?.includes(userId)) {
        await SubjectService.rejectSubjectStatus(record.id, reason);
        console.log('✅ User subject status rejected and unanchored');
      }

      // Step 2: Create removal request sfor all other subjects
      const otherSubjects = checkResult.otherSubjects || [];

      if (otherSubjects.length > 0) {
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

        if (successful > 0) {
          console.log(`✅ Created ${successful} subject removal request(s)`);
        }

        if (failed > 0) {
          console.warn(`⚠️ Failed to create ${failed} removal request(s), continuing...`);
        }
      }
    } catch (error) {
      console.error('⚠️ Subject cleanup failed:', error);
      // Don't throw - let deletion continue
    }
  }

  /**
   * Alternative: Remove self from record (don't delete)
   * Remove subject status and permissions
   */
  async removeUserFromRecord(
    record: FileObject,
    userId: string,
    reason?: RejectionReasons
  ): Promise<void> {
    console.log('👤 Removing user from record:', userId);

    try {
      if (reason && record.subjects?.includes(userId)) {
        await SubjectService.rejectSubjectStatus(record.id, reason);
      }

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
