//src/features/Permissions/service/permissionsService.ts

import { getFirestore, doc, updateDoc, arrayRemove, arrayUnion, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { SharingService } from '@/features/Sharing/services/sharingService';

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
   * Also adds owner as administrator if they aren't one already
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

    // Step 1: Check if they're not an admin and if they aren't add them (owners must be admins as well)
    if (!admins.includes(userId)) {
      console.log('📝 User is not yet an admin, adding admin privileges...');
      await this.addAdmin(recordId, userId);
      console.log('✅ User added as administrator with encryption access');
    } else {
      console.log('ℹ️  User is already an administrator, skipping admin addition');
    }

    //Step 2: Add them to the owners array
    await updateDoc(recordRef, {
      owners: arrayUnion(userId),
    });

    console.log('✅ Owner added successfully with full access');
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

    const recordDoc = await getDoc(recordRef);
    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();

    //Rule 1: Check if user is an admin. (Owners are automatically admins, so owners covered too)
    if (!recordData.administrators.includes(currentUser.uid)) {
      throw new Error('Only administrators can add other administrators');
    }

    //Rule 2: Can't add as an admin, someone who's already an admin
    if (recordData.administrators.includes(userId)) {
      throw new Error('User is already an administrator');
    }

    // Get the new admin's user data (need their email for sharing)
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    if (!userData.email) {
      throw new Error('User does not have an email address');
    }

    console.log('🔄 Granting encryption access to new admin...');

    // Step 1: Share the record with them (creates wrapped key for encryption access)
    // This validates they have encryption keys, verified email, etc.
    // If they already have viewer access, shareRecord will throw an error,
    try {
      await SharingService.shareRecord({
        recordId: recordId,
        receiverEmail: userData.email,
      });
      console.log('✅ Admin granted encryption access via wrapped key');
    } catch (shareError) {
      const errorMsg = shareError instanceof Error ? shareError.message : '';

      // If they already have access as a viewer, that's fine - they'll keep that key
      if (errorMsg.includes('This user already has')) {
        console.log('ℹ️  User already has viewer access, will keep existing wrapped key');
      } else {
        // Some other error - re-throw it
        throw shareError;
      }
    }

    // Step 2: Add  new admin to the administrators array after verifying they can decrypt the record
    await updateDoc(recordRef, {
      administrators: arrayUnion(userId),
    });

    console.log('✅ Administrator added successfully with full access');
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
    const isOwner = recordData.owners?.includes(currentUser.uid);
    const isAdmin = recordData.administrators?.includes(currentUser.uid);

    // Rule 1: Only owners can remove Other admins
    if (userId !== currentUser.uid && !isOwner) {
      throw new Error('Only the record owner can remove other administrators');
    }

    // Rule 2: Check if you are an admin of this record
    if (userId === currentUser.uid && !isAdmin) {
      throw new Error('You are not an administrator of this record');
    }

    // Rule 3: Can't remove owner as admin. (Owner should always be admin)
    if (recordData.owners?.includes(userId)) {
      throw new Error('Cannot remove the record owner as administrator');
    }

    // Rule 4: Prevent removing yourself if you're the last administrator
    if (recordData.administrator?.length === 1) {
      throw new Error('Cannot remove the last administrator from a record');
    }

    // Check if user in question is actually an administrator
    if (!recordData.administrators?.includes(userId)) {
      throw new Error('User is not an administrator of this record');
    }

    console.log('🔄 Removing administrator:', userId);

    // Remove the user from the owners array
    await updateDoc(recordRef, {
      administrators: arrayRemove(userId),
    });

    console.log('✅ User admin priviledges removed successfully', userId);
    console.log(
      'ℹ️ Note: This user may still have viewer access. Remove that separately if desired.'
    );
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
