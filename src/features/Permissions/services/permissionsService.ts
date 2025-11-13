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

    const recordDoc = await getDoc(recordRef);
    if (!recordDoc.exists()) throw new Error('Record not found');

    const recordData = recordDoc.data();
    const owners: string[] = recordData.owners || [];
    const admins: string[] = recordData.administrators || [];

    console.log('📝 Current ownership data', { owners, admins, currentUser: currentUser.uid });

    // Determine who can add owners
    const canAddOwner =
      owners.length > 0
        ? owners.includes(currentUser.uid) // Only owners if owners array not empty
        : admins.includes(currentUser.uid); // Admins if owners array is empty

    if (!canAddOwner) {
      throw new Error('You do not have permission to add owners');
    }

    if (owners.includes(userId)) {
      throw new Error('User is already an owner');
    }

    console.log('✅ Adding owner:', userId);

    await updateDoc(recordRef, {
      owners: arrayUnion(userId),
      administrators: arrayUnion(userId), // optional: only if you want them admin too
    });

    console.log('✅ Owner added successfully');
  }
  /**
   * Add an administrator to a record
   * @param recordId - The record ID
   * @param userId - The user ID to add as owner
   * @throws Error if operation fails or user doesn't have permission
   */
  static async addAdmin(recordId: string, userId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);

    // First, check if the current user is an admin
    const recordDoc = await getDoc(recordRef);
    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();
    if (!recordData.administrators.includes(currentUser.uid)) {
      throw new Error('Only administrators can add other administrators');
    }

    // Check if user is already an administrator
    if (recordData.administrators.includes(userId)) {
      throw new Error('User is already an administrator');
    }

    // Add the user to the owners array
    await updateDoc(recordRef, {
      administrators: arrayUnion(userId),
    });
  }

  /**
   * Remove an admin from a record
   * @param recordId - The record ID
   * @param userId - The user ID to remove as owner
   * @throws Error if operation fails or user doesn't have permission
   */
  static async removeAdmin(recordId: string, userId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);

    // Check if the current user is an admin
    const recordDoc = await getDoc(recordRef);
    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();
    if (!recordData.administrators?.includes(currentUser.uid)) {
      throw new Error('Only administrators can remove other administrators');
    }

    // Prevent removing the administrator if they're an owner
    if (recordData.owners && recordData.owners === userId) {
      throw new Error('Cannot remove the record owner as an administrator');
    }

    // Prevent removing yourself if you're the last administrator
    if (recordData.administrator?.length === 1 && recordData.administrator[0] === userId) {
      throw new Error('Cannot remove the last administrator from a record');
    }

    // Check if user is actually an administrator
    if (!recordData.administrators?.includes(userId)) {
      throw new Error('User is not an administrator of this record');
    }

    // Remove the user from the owners array
    await updateDoc(recordRef, {
      administrators: arrayRemove(userId),
    });
  }

  /**
   * Check if current user can manage administrators for a record
   * @param recordId - The record ID
   * @returns true if user is an admin, false otherwise
   */
  static async canManageAdmins(recordId: string): Promise<boolean> {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) return false;

      const db = getFirestore();
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) return false;

      const recordData = recordDoc.data();
      return recordData.administrators.includes(currentUser.uid) || false;
    } catch (err) {
      console.error('Error checking permissions:', err);
      return false;
    }
  }

  /**
   * Check if a specific user can be removed as an admin
   * @param recordId - The record ID
   * @param userId - The user ID to check
   * @returns true if user can be removed, false otherwise
   */
  static async canRemoveAdmins(recordId: string, userId: string): Promise<boolean> {
    try {
      const db = getFirestore();
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) return false;

      const recordData = recordDoc.data();

      // Cannot remove if they're the owner
      if (recordData.owners === userId) return false;

      // Cannot remove if they're the last administrator
      if (recordData.administrators.length === 1 && recordData.administrators[0] === userId)
        return false;

      return true;
    } catch (err) {
      console.error('Error checking if owner can be removed:', err);
      return false;
    }
  }

  /**
   * Get record ownership information
   * @param recordId - The record ID
   * @returns Object with owners, administrators, and permission info
   */
  static async getRecordOwnership(recordId: string): Promise<{
    owners: string[];
    administrators: string[];
    canManage: boolean;
  } | null> {
    try {
      const db = getFirestore();
      const recordRef = doc(db, 'records', recordId);
      const recordDoc = await getDoc(recordRef);

      if (!recordDoc.exists()) return null;

      const recordData = recordDoc.data();
      const canManage = await this.canManageAdmins(recordId);

      return {
        owners: recordData.owners || [],
        administrators: recordData.administrators || [],
        canManage,
      };
    } catch (err) {
      console.error('Error getting record ownership:', err);
      return null;
    }
  }
}
