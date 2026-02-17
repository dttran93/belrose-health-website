// services/recordDeletionService.ts

/**
 * Service to handle the two-step process of deleting a record or removing a user from one.
 *
 * DELETION PERMISSION RULES:
 * - If the record has owners, only an owner can delete it
 * - If there are multiple owners, all other owners must remove themselves first
 * - If there are no owners, any administrator may delete the record
 * - If there are other subjects (besides the deleting user), they must all unanchor
 *   themselves from the blockchain before deletion is permitted
 *
 * SUBJECT SOVEREIGNTY:
 * Subjects are blockchain-anchored to a record and can only unanchor themselves —
 * no one can force-remove them. This means:
 * - If the deleting user is a subject, they must unanchor via SubjectActionDialog
 *   BEFORE calling deleteRecord(). The RecordDeletionDialog handles this automatically.
 * - If there are other subjects on the record, deletion is blocked entirely until
 *   they have all unanchored themselves. This protects subjects from having a record
 *   deleted out from under them without their participation.
 *
 * DELETION FLOW:
 * 1. checkDeletionPermissions() — Verify user can delete and collect warnings
 * 2. [If user is a subject] SubjectActionDialog unanchors them from the blockchain
 * 3. deleteRecord() — called only after the user confirms and is no longer a subject
 *    a. Creates a recordDeletionEvent → triggers Cloud Function notifications to affected users
 *    b. Deletes file from storage, Firestore record, version history, and wrapped encryption keys
 *    c. Marks deletion event complete
 */

import { PermissionsService } from '@/features/Permissions/services/permissionsService';
import SubjectQueryService from '@/features/Subject/services/subjectQueryService';
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
   * Step 1: Check if user can delete and what warnings to show.
   *
   * Returns a DeletionCheckResult indicating whether deletion is permitted,
   * and if so, what confirmation warnings to display. Checks in order:
   * 1. User must be an owner (if owners exist) or an administrator (if no owners)
   * 2. No other owners may exist — they must remove themselves first
   * 3. No other subjects may exist — they must unanchor themselves first
   *
   * If the calling user is the only remaining subject, canDelete will be true
   * and the dialog will prompt them to unanchor before proceeding.
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

    // Check 1: If there are owners, user must be one of them
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

    // Check 2: If there are no owners, user must be an administrator
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

    // Check 3: Cannot delete if there are other owners — they must remove themselves first
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

    // Check 4: Cannot delete if there are other subjects — they must unanchor themselves first.
    // If the calling user is the only subject, this check passes and the dialog will
    // prompt them to unanchor before proceeding to deletion.
    if (otherSubjects.length > 0) {
      return {
        canDelete: false,
        reason:
          otherSubjects.length === 1
            ? 'This record has a subject who must unanchor themselves before it can be deleted'
            : `This record has ${otherSubjects.length} subjects who must all unanchor themselves before it can be deleted`,
        requiresConfirmation: false,
        hasSubjects: true,
        subjectCount,
        affectsOtherUsers: totalOtherUsers > 0,
        otherUserCount: totalOtherUsers,
        otherSubjects,
      };
    }

    // At this point the user is permitted to delete:
    // - They are the sole/only owner, OR
    // - They are an administrator and no owners exist
    // - No other subjects remain on the record
    // Build confirmation warnings for affected users.
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

      const totalAffected = otherAdmins.length + otherViewers.length;
      warnings.push(
        `This will delete the record for ${totalAffected} other user${
          totalAffected > 1 ? 's' : ''
        } (${userBreakdown.join(', ')}). They will be notified that you deleted the record.`
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
      otherSubjects: [],
    };
  }

  /**
   * Step 2: Execute deletion (call only after checkDeletionPermissions() returns
   * canDelete: true and the user has confirmed via the dialog).
   *
   * IMPORTANT: If the deleting user is a subject, they must have already unanchored
   * themselves via SubjectActionDialog before this is called. The RecordDeletionDialog
   * handles this automatically when isUserSubject is true.
   *
   * By the time this is called, no subjects remain on the record — the permission
   * check blocks deletion if any other subjects exist, and the dialog ensures the
   * calling user has unanchored if they were a subject.
   */
  static async deleteRecord(record: FileObject, userId: string): Promise<void> {
    // Final permission check in case state changed between dialog open and confirm
    const check = await this.checkDeletionPermissions(record, userId);
    if (!check.canDelete) {
      throw new Error(check.reason || 'Cannot delete this record');
    }

    try {
      console.log('🗑️ Starting complete record deletion for:', record.id);

      // Step 1: Create deletion event (triggers notifications via Cloud Function)
      await this.createDeletionEvent(record, userId, check);

      // Step 2: Delete from Firebase (storage + Firestore + versions + wrapped keys)
      await deleteFileComplete(record.id);
      console.log('✅ Record deleted from Firebase');

      // Step 3: Mark deletion event as complete
      await this.markDeletionComplete(record.id);

      console.log('✅ Complete record deletion finished:', record.id);
    } catch (error) {
      console.error('❌ Record deletion failed:', error);
      throw error;
    }
  }

  /**
   * Create a deletion event document that triggers Cloud Function notifications
   * to all affected users and serves as an audit trail.
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
          subjects: [],
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
   * Mark the deletion event as complete after Firebase deletion succeeds.
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
   * Remove the calling user from a record without deleting it for everyone.
   *
   * NOTE: If user is a subject, they must unanchor via SubjectActionDialog first.
   * This method only removes their permissions role.
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
