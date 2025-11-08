//src/features/Permissions/service/permissionsService.ts

import { getFirestore, doc, updateDoc, arrayRemove, arrayUnion, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

/**
 * Service for managing record permissions
 * Pure business logic - no React dependencies
 */
export class PermissionsService {
  /**
   * Add an owner to a record
   * @param recordId - The record ID
   * @param userId - The user ID to add as owner
   * @throws Error if operation fails or user doesn't have permission
   */
  static async addOwner(recordId: string, userId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);

    // First, check if the current user is an owner
    const recordDoc = await getDoc(recordRef);
    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();
    if (!recordData.owners?.includes(currentUser.uid)) {
      throw new Error('Only owners can add other owners');
    }

    // Check if user is already an owner
    if (recordData.owners?.includes(userId)) {
      throw new Error('User is already an owner');
    }

    // Add the user to the owners array
    await updateDoc(recordRef, {
      owners: arrayUnion(userId),
    });
  }

  /**
   * Remove an owner from a record
   * @param recordId - The record ID
   * @param userId - The user ID to remove as owner
   * @throws Error if operation fails or user doesn't have permission
   */
  static async removeOwner(recordId: string, userId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);

    // Check if the current user is an owner
    const recordDoc = await getDoc(recordRef);
    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();
    if (!recordData.owners?.includes(currentUser.uid)) {
      throw new Error('Only owners can remove other owners');
    }

    // Prevent removing the subject if they're an owner
    if (recordData.subjectId && recordData.subjectId === userId) {
      throw new Error('Cannot remove the record subject as an owner');
    }

    // Prevent removing yourself if you're the last owner
    if (recordData.owners?.length === 1 && recordData.owners[0] === userId) {
      throw new Error('Cannot remove the last owner from a record');
    }

    // Check if user is actually an owner
    if (!recordData.owners?.includes(userId)) {
      throw new Error('User is not an owner of this record');
    }

    // Remove the user from the owners array
    await updateDoc(recordRef, {
      owners: arrayRemove(userId),
    });
  }

  /**
   * Set the subject ID for a record (can only be done once)
   * The subject is automatically added as an owner
   * @param recordId - The record ID
   * @param subjectId - The user ID to set as subject
   * @throws Error if operation fails or subject is already set
   */
  static async setSubject(recordId: string, subjectId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);

    // Check if the current user is an owner
    const recordDoc = await getDoc(recordRef);
    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();
    if (!recordData.owners?.includes(currentUser.uid)) {
      throw new Error('Only owners can set the record subject');
    }

    // Check if subject is already set
    if (recordData.subjectId) {
      throw new Error('Record subject is already set and cannot be changed');
    }

    // Set the subject and ensure they're added to owners
    await updateDoc(recordRef, {
      subjectId: subjectId,
      owners: arrayUnion(subjectId), // Subject is automatically an owner
    });
  }

  /**
   * Check if current user can manage owners for a record
   * @param recordId - The record ID
   * @returns true if user is an owner, false otherwise
   */
  static async canManageOwners(recordId: string): Promise<boolean> {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) return false;

      const db = getFirestore();
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) return false;

      const recordData = recordDoc.data();
      return recordData.owners?.includes(currentUser.uid) || false;
    } catch (err) {
      console.error('Error checking permissions:', err);
      return false;
    }
  }

  /**
   * Check if a specific user can be removed as an owner
   * @param recordId - The record ID
   * @param userId - The user ID to check
   * @returns true if user can be removed, false otherwise
   */
  static async canRemoveOwner(recordId: string, userId: string): Promise<boolean> {
    try {
      const db = getFirestore();
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) return false;

      const recordData = recordDoc.data();

      // Cannot remove if they're the subject
      if (recordData.subjectId === userId) return false;

      // Cannot remove if they're the last owner
      if (recordData.owners?.length === 1 && recordData.owners[0] === userId) return false;

      return true;
    } catch (err) {
      console.error('Error checking if owner can be removed:', err);
      return false;
    }
  }

  /**
   * Get record ownership information
   * @param recordId - The record ID
   * @returns Object with owners, subject, and permission info
   */
  static async getRecordOwnership(recordId: string): Promise<{
    owners: string[];
    subjectId: string | null;
    canManage: boolean;
  } | null> {
    try {
      const db = getFirestore();
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) return null;

      const recordData = recordDoc.data();
      const canManage = await this.canManageOwners(recordId);

      return {
        owners: recordData.owners || [],
        subjectId: recordData.subjectId || null,
        canManage,
      };
    } catch (err) {
      console.error('Error getting record ownership:', err);
      return null;
    }
  }
}
