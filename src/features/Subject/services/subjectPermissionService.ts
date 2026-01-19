//src/features/Subject/services/subjectPermissionService.ts

/*
 * This service manages checking permissions for subject service
 * - Can this user make a subject consent request (owner/admin/uploader)
 * - Can this user remove a subject (owner only, if no owner then admin)
 */

import { FileObject } from '@/types/core';

export class SubjectPermissionService {
  /**
   * General check: Can this user manage the record (upload/edit/request subjects)?
   */
  static canManageRecord(record: FileObject, userId: string): boolean {
    const isUploader = record.uploadedBy === userId;
    const isOwner = record.owners?.includes(userId);
    const isAdmin = record.administrators?.includes(userId);

    return isUploader || isOwner || isAdmin;
  }

  /**
   * Logic for cancelling a pending request
   */
  static canCancelRequest(record: FileObject, userId: string): boolean {
    // Current rule: same as manage, but kept separate for future restrictions
    return this.canManageRecord(record, userId);
  }

  /**
   * Specific check: Can this user remove a subject?
   * Logic: Only owners can remove subjects, unless no owners exist,
   * in which case administrators can.
   */
  static canRemoveSubject(record: FileObject, userId: string): boolean {
    const isOwner = record.owners?.includes(userId);
    const isAdmin = record.administrators?.includes(userId);
    const hasOwners = record.owners && record.owners.length > 0;

    return isOwner || (isAdmin && !hasOwners);
  }
}

export default SubjectPermissionService;
