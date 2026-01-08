//src/features/Permissions/service/permissionsService.ts
/**
 * Service for managing record permissions
 * Handles role assignment (Firestore array + blockchain)
 * Calls SharingService for encryption Access
 * Integrates with roleInitializationService for first-time blockchain permission setup
 */

import { getFirestore, doc, updateDoc, arrayRemove, arrayUnion, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { SharingService } from '@/features/Sharing/services/sharingService';
import { BlockchainRoleManagerService } from './blockchainRoleManagerService';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import { BlockchainSyncQueueService } from '@/features/BlockchainWallet/services/blockchainSyncQueueService';

export type Role = 'owner' | 'administrator' | 'viewer';

export class PermissionsService {
  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get a user's wallet address from Firestore
   */
  private static async getUserWalletAddress(userId: string): Promise<string> {
    const db = getFirestore();
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const walletAddress = userData.wallet?.address;

    if (!walletAddress) {
      throw new Error(
        'User has no wallet address. They must set up a wallet before managing permissions.'
      );
    }

    return walletAddress;
  }

  /**
   * Get current highest role for a user on a record
   */
  static getUserRole(
    recordData: { owners?: string[]; administrators?: string[]; viewers?: string[] },
    userId: string
  ): Role | null {
    if (recordData.owners?.includes(userId)) return 'owner';
    if (recordData.administrators?.includes(userId)) return 'administrator';
    if (recordData.viewers?.includes(userId)) return 'viewer';
    return null;
  }

  // ============================================================================
  // GRANT METHODS
  // ============================================================================

  /**
   * Add a viewer to a record
   * @param recordId - The record ID
   * @param targetUserId - The user ID to add as viewer
   * @throws Error if operation fails or user doesn't have permission
   * Mirrors to blockchain as well. Creates retry queue entry if blockchain mirroring fails
   */
  static async grantViewer(recordId: string, targetUserId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Check 1: Does record exist
    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);
    const recordDoc = await getDoc(recordRef);

    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();

    // Check 2: Permission check - only admins/owners can grant viewer
    const isCurrentUserAdmin = recordData.administrators?.includes(currentUser.uid);
    const isCurrentUserOwner = recordData.owners?.includes(currentUser.uid);

    if (!isCurrentUserAdmin && !isCurrentUserOwner) {
      throw new Error('You do not have permission to share this record');
    }

    // Check 3: Find and make sure targetUserId exists
    const targetProfile = await getUserProfile(targetUserId);

    if (!targetProfile) {
      throw new Error('Target user does not exist or has no profile');
    }

    // Check 4: Ensure the user and target have wallet addresses for the blockchain transaction
    const userWalletAddress = await this.getUserWalletAddress(currentUser.uid);
    const targetWalletAddress = targetProfile.wallet?.address;

    if (!userWalletAddress) {
      throw new Error('Target user does not have a linked blockchain wallet');
    }

    if (!targetWalletAddress) {
      throw new Error('Target user does not have a linked blockchain wallet');
    }

    // Check 5: Check existing role - don't demote owners/admins
    const existingRole = this.getUserRole(recordData, targetUserId);

    if (existingRole === 'owner') {
      throw new Error('User is already an owner (higher role than viewer)');
    }
    if (existingRole === 'administrator') {
      throw new Error('User is already an administrator (higher role than viewer)');
    }
    if (existingRole === 'viewer') {
      throw new Error('User is already a viewer');
    }

    // Note, preparation Service checks are covered in the initiation stage of the usePermissionFlow

    console.log('🔄 Granting viewer access:', targetUserId);

    // Step 1: Grant encryption access
    await SharingService.grantEncryptionAccess(recordId, targetUserId, currentUser.uid);

    // Step 2: Add to viewers array in Firebase
    await updateDoc(recordRef, {
      viewers: arrayUnion(targetUserId),
    });
    console.log('✅ Added to viewers array in Firebase');

    // Step 3: Grant viewer role on blockchain
    try {
      console.log('🔗 Granting viewer role on blockchain...');
      await BlockchainRoleManagerService.grantRole(recordId, targetWalletAddress, 'viewer');
      console.log('✅ Blockchain: Viewer role granted');
    } catch (blockchainError) {
      console.error('⚠️ Blockchain update failed:', blockchainError);
      await BlockchainSyncQueueService.logFailure({
        contract: 'MemberRoleManager',
        action: 'grantRole',
        userId: currentUser.uid,
        userWalletAddress: userWalletAddress,
        error: blockchainError as string,
        context: {
          type: 'permission',
          targetUserId: targetUserId,
          targetWalletAddress: targetWalletAddress,
          role: 'viewer',
          recordId: recordId,
        },
      });
    }

    console.log('✅ Viewer access granted successfully');
  }

  /**
   * Add an administrator to a record
   * @param recordId - The record ID
   * @param targetUserId - The user ID to add as administrator
   * @throws Error if operation fails or user doesn't have permission
   */
  static async grantAdmin(recordId: string, targetUserId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Check 1: does record exist
    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);
    const recordDoc = await getDoc(recordRef);

    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();

    // Check 2: Permission check - only admins/owners can grant admin
    const isCurrentUserAdmin = recordData.administrators?.includes(currentUser.uid);
    const isCurrentUserOwner = recordData.owners?.includes(currentUser.uid);

    if (!isCurrentUserAdmin && !isCurrentUserOwner) {
      throw new Error('Only administrators or owners can add other administrators');
    }

    // Check 3: Find and make sure targetUserId exists
    const targetProfile = await getUserProfile(targetUserId);

    if (!targetProfile) {
      throw new Error('Target user does not exist or has no profile');
    }

    // Check 4: Ensure the user and target have wallet addresses for the blockchain transaction
    const userWalletAddress = await this.getUserWalletAddress(currentUser.uid);
    const targetWalletAddress = targetProfile.wallet?.address;

    if (!userWalletAddress) {
      throw new Error('Current user does not have a linked blockchain wallet');
    }

    if (!targetWalletAddress) {
      throw new Error('Target user does not have a linked blockchain wallet');
    }

    // Check 5: Check existing roles - can't demote owners
    const existingRole = this.getUserRole(recordData, targetUserId);

    if (existingRole === 'owner') {
      throw new Error('User is already an owner (higher role than administrator)');
    }
    if (existingRole === 'administrator') {
      throw new Error('User is already an administrator');
    }

    console.log('🔄 Granting administrator role:', targetUserId);

    // Step 1: Grant encryption access
    await SharingService.grantEncryptionAccess(recordId, targetUserId, currentUser.uid);

    // Step 2: Update arrays - add to admins, remove from viewers (highest role only)
    await updateDoc(recordRef, {
      administrators: arrayUnion(targetUserId),
      viewers: arrayRemove(targetUserId),
    });
    console.log('✅ Added to administrators array');

    // Step 3: Blockchain - determine action based on existing role
    // changeRole is in case they're being upgraded from viewer to admin
    const hasExistingRole = existingRole !== null;

    try {
      console.log(
        `🔗 ${hasExistingRole ? 'Upgrading to' : 'Granting'} administrator role on blockchain...`
      );

      if (hasExistingRole) {
        await BlockchainRoleManagerService.changeRole(
          recordId,
          targetWalletAddress,
          'administrator'
        );
      } else {
        await BlockchainRoleManagerService.grantRole(
          recordId,
          targetWalletAddress,
          'administrator'
        );
      }

      console.log('✅ Blockchain: Administrator role set');
    } catch (blockchainError) {
      console.error('⚠️ Blockchain update failed:', blockchainError);
      await BlockchainSyncQueueService.logFailure({
        contract: 'MemberRoleManager',
        action: hasExistingRole ? 'changeRole' : 'grantRole',
        userId: currentUser.uid,
        userWalletAddress: userWalletAddress,
        error: blockchainError as string,
        context: {
          type: 'permission',
          targetUserId: targetUserId,
          targetWalletAddress: targetWalletAddress,
          role: 'administrator',
          recordId: recordId,
        },
      });
    }

    console.log('✅ Administrator access granted successfully');
  }

  /**
   * Add an owner to a record
   * @param recordId - The record ID
   * @param targetUserId - The user ID to add as owner
   * @throws Error if operation fails or user doesn't have permission
   * Mirrors to blockchain as well. Creates retry queue entry if blockchain mirroring fails
   */
  static async grantOwner(recordId: string, targetUserId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Check 1: Does record exist
    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);
    const recordDoc = await getDoc(recordRef);

    if (!recordDoc.exists()) throw new Error('Record not found');
    const recordData = recordDoc.data();

    // Check 2: Permission check - only owners can add owners (or admins if no owners exist)
    const owners = recordData.owners || [];
    const admins = recordData.administrators || [];

    const canGrantOwner =
      owners.length > 0 ? owners.includes(currentUser.uid) : admins.includes(currentUser.uid);

    if (!canGrantOwner) {
      throw new Error('You do not have permission to add owners');
    }

    // Check 3: Find and make sure targetUserId exists
    const targetProfile = await getUserProfile(targetUserId);

    if (!targetProfile) {
      throw new Error('Target user does not exist or has no profile');
    }

    // Check 4: Ensure the user has a wallet for the blockchain transaction
    const userWalletAddress = await this.getUserWalletAddress(currentUser.uid);
    const targetWalletAddress = targetProfile.wallet?.address;

    if (!userWalletAddress) {
      throw new Error('Current user does not have a linked blockchain wallet');
    }

    if (!targetWalletAddress) {
      throw new Error('Target user does not have a linked blockchain wallet');
    }

    // Check 5: Check if they're already an owner
    const existingRole = this.getUserRole(recordData, targetUserId);

    if (existingRole === 'owner') {
      throw new Error('User is already an owner');
    }

    console.log('🔄 Granting owner access:', targetUserId);

    // Step 2: Grant encryption access
    await SharingService.grantEncryptionAccess(recordId, targetUserId, currentUser.uid);

    // Step 3: Update arrays - add to owners, remove from lower roles (highest role only)
    await updateDoc(recordRef, {
      owners: arrayUnion(targetUserId),
      administrators: arrayRemove(targetUserId),
      viewers: arrayRemove(targetUserId),
    });
    console.log('✅ Added to owners array');

    // Step 4: Blockchain - determine action based on existing role
    const hasExistingRole = existingRole !== null;
    const blockchainAction: 'grantRole' | 'changeRole' = hasExistingRole
      ? 'changeRole'
      : 'grantRole';

    try {
      console.log(
        `🔗 ${hasExistingRole ? 'Upgrading to' : 'Granting'} owner role on blockchain...`
      );

      if (hasExistingRole) {
        await BlockchainRoleManagerService.changeRole(recordId, targetWalletAddress, 'owner');
      } else {
        await BlockchainRoleManagerService.grantRole(recordId, targetWalletAddress, 'owner');
      }

      console.log('✅ Blockchain: Owner role set');
    } catch (blockchainError) {
      console.error('⚠️ Blockchain update failed:', blockchainError);
      await BlockchainSyncQueueService.logFailure({
        contract: 'MemberRoleManager',
        action: hasExistingRole ? 'changeRole' : 'grantRole',
        userId: currentUser.uid,
        userWalletAddress: userWalletAddress,
        error: blockchainError as string,
        context: {
          type: 'permission',
          targetUserId: targetUserId,
          targetWalletAddress: targetWalletAddress,
          role: 'owner',
          recordId: recordId,
        },
      });
    }

    console.log('✅ Owner access granted successfully');
  }

  // ============================================================================
  // REMOVE METHODS
  // ============================================================================

  /**
   * Remove an viewer from a record
   * @param recordId - The record ID
   * @param targetUserId - The user ID to remove as viewer
   * @throws Error if operation fails or user doesn't have permission
   */
  static async removeViewer(recordId: string, targetUserId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const userWalletAddress = await this.getUserWalletAddress(currentUser.uid);
    const targetWalletAddress = await this.getUserWalletAddress(targetUserId);

    // Check 1: Check that record exist

    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);
    const recordDoc = await getDoc(recordRef);

    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();

    // Check 2: only admins/owners can remove viewers
    const isAdmin = recordData.administrators?.includes(currentUser.uid);
    const isOwner = recordData.owners?.includes(currentUser.uid);

    if (!isAdmin && !isOwner) {
      throw new Error('You do not have permission to remove viewers');
    }

    // Check 3: Verify user is actually a viewer
    if (!recordData.viewers?.includes(targetUserId)) {
      throw new Error('User is not a viewer of this record');
    }

    console.log('🔄 Removing viewer access:', targetUserId);

    // Step 1: Revoke encryption access
    await SharingService.revokeEncryptionAccess(recordId, targetUserId, currentUser.uid);

    // Step 2: Remove from viewers array
    await updateDoc(recordRef, {
      viewers: arrayRemove(targetUserId),
    });
    console.log('✅ Removed from viewers array');

    // Step 3: Revoke role on blockchain
    try {
      console.log('🔗 Revoking role on blockchain...');
      await BlockchainRoleManagerService.revokeRole(recordId, targetWalletAddress);
      console.log('✅ Blockchain: Role revoked');
    } catch (blockchainError) {
      console.error('⚠️ Blockchain update failed:', blockchainError);
      await BlockchainSyncQueueService.logFailure({
        contract: 'MemberRoleManager',
        action: 'revokeRole',
        userId: currentUser.uid,
        userWalletAddress: userWalletAddress,
        error: blockchainError as string,
        context: {
          type: 'permission',
          targetUserId: targetUserId,
          targetWalletAddress: targetWalletAddress,
          role: 'viewer',
          recordId: recordId,
        },
      });
    }

    console.log('✅ Viewer access removed successfully');
  }

  /**
   * Remove an admin from a record
   * @param recordId - The record ID
   * @param targetUserId - The user ID to remove as admin
   * @param options - Can set demote to viewer as true otherwise access fully revoked
   * @throws Error if operation fails or user doesn't have permission
   */
  static async removeAdmin(
    recordId: string,
    targetUserId: string,
    options?: { demoteToViewer?: boolean }
  ): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const userWalletAddress = await this.getUserWalletAddress(currentUser.uid);
    const targetWalletAddress = await this.getUserWalletAddress(targetUserId);

    // Check 1: Check record exists
    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);
    const recordDoc = await getDoc(recordRef);

    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();

    // Check 2: Permission checks
    const isCurrentUserOwner = recordData.owners?.includes(currentUser.uid);
    const isCurrentUserAdmin = recordData.administrators?.includes(currentUser.uid);
    const isSelfRemoval = targetUserId === currentUser.uid;
    const hasOwners = recordData.owners?.length > 0;
    const isLastAdmin = recordData.administrators?.length === 1;

    // Rule 1: Check if caller is an admin or Owner of this record
    if (!isCurrentUserOwner && !isCurrentUserAdmin) {
      throw new Error('You are not an owner or administrator of this record');
    }

    // Rule 2: If there are owners, only owners can remove other admins. Admins can only remove themselves
    if (hasOwners && !isSelfRemoval && !isCurrentUserOwner) {
      throw new Error('Only the record owner can remove other administrators');
    }

    // Rule 3: Can't remove owner via removeAdmin (although this should never come up... but just in case)
    if (recordData.owners?.includes(targetUserId)) {
      throw new Error('Cannot remove the record owner as administrator');
    }

    // Rule 4: Check if user in question is actually an administrator
    if (!recordData.administrators?.includes(targetUserId)) {
      throw new Error('User is not an administrator of this record');
    }

    // Rule 5: Prevent removing yourself if you're the last administrator or owner
    if (!hasOwners && isLastAdmin) {
      throw new Error('Cannot remove the last administrator from a record');
    }

    console.log('🔄 Removing administrator access:', targetUserId);

    const demoteToViewer = options?.demoteToViewer ?? false;

    // Step 1: Update Firestore arrays
    if (demoteToViewer) {
      await updateDoc(recordRef, {
        administrators: arrayRemove(targetUserId),
        viewers: arrayUnion(targetUserId),
      });
      console.log('✅ Demoted to viewer');
    } else {
      await updateDoc(recordRef, {
        administrators: arrayRemove(targetUserId),
      });
      console.log('✅ Removed from administrators array');

      // Revoke encryption access only if fully removing
      await SharingService.revokeEncryptionAccess(recordId, targetUserId, currentUser.uid);
    }

    // Step 2: Update blockchain
    try {
      if (demoteToViewer) {
        console.log('🔗 Demoting to viewer on blockchain...');
        await BlockchainRoleManagerService.changeRole(recordId, targetWalletAddress, 'viewer');
        console.log('✅ Blockchain: Demoted to viewer');
      } else {
        console.log('🔗 Revoking role on blockchain...');
        await BlockchainRoleManagerService.revokeRole(recordId, targetWalletAddress);
        console.log('✅ Blockchain: Role revoked');
      }
    } catch (blockchainError) {
      console.error('⚠️ Blockchain update failed:', blockchainError);
      await BlockchainSyncQueueService.logFailure({
        contract: 'MemberRoleManager',
        action: 'revokeRole',
        userId: currentUser.uid,
        userWalletAddress: userWalletAddress,
        error: blockchainError as string,
        context: {
          type: 'permission',
          targetUserId: targetUserId,
          targetWalletAddress: targetWalletAddress,
          role: 'administrator',
          recordId: recordId,
        },
      });
    }

    console.log('✅ Administrator access removed successfully');
  }

  /**
   * Remove owner access from a record. Owners can only remove themselves
   * Optionally demotes to admin or viewer instead of full revocation
   * @param recordId - The record ID
   * @param targetUserId - the user being removed as an owner
   * @param options - Can demote to 'administrator' or 'viewer' otherwise access fully revoked
   */
  static async removeOwner(
    recordId: string,
    targetUserId: string,
    options?: { demoteTo?: 'administrator' | 'viewer' }
  ): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    const userWalletAddress = await this.getUserWalletAddress(currentUser.uid);
    const targetWalletAddress = await this.getUserWalletAddress(targetUserId);

    const db = getFirestore();
    const recordRef = doc(db, 'records', recordId);
    const recordDoc = await getDoc(recordRef);

    if (!recordDoc.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordDoc.data();

    // Permission checks
    const isCurrentUserOwner = recordData.owners?.includes(currentUser.uid);
    const isSelfRemoval = targetUserId === currentUser.uid;

    // Rule 1: Only owners can remove themselves (no one can remove other owners)
    if (!isSelfRemoval) {
      throw new Error('Owners can only remove themselves. You cannot remove other owners.');
    }

    // Rule 2: Only owners can remove owners
    if (!isCurrentUserOwner) {
      throw new Error('You are not an owner of this record');
    }

    // Rule 3: Verify target is actually an owner
    if (!recordData.owners?.includes(targetUserId)) {
      throw new Error('User is not an owner of this record');
    }

    // Rule 4: Can't remove last owner unless there's at least one admin
    const isLastOwner = recordData.owners.length === 1;
    const hasAdmins = recordData.administrators && recordData.administrators.length > 0;

    if (isLastOwner && !hasAdmins) {
      throw new Error('Cannot remove the last owner when no administrators exist');
    }

    console.log('🔄 Removing owner access:', targetUserId);

    const demoteTo = options?.demoteTo;

    // Step 1: Update Firestore arrays
    if (demoteTo === 'administrator') {
      await updateDoc(recordRef, {
        owners: arrayRemove(targetUserId),
        administrators: arrayUnion(targetUserId),
      });
      console.log('✅ Demoted to administrator');
    } else if (demoteTo === 'viewer') {
      await updateDoc(recordRef, {
        owners: arrayRemove(targetUserId),
        viewers: arrayUnion(targetUserId),
      });
      console.log('✅ Demoted to viewer');
    } else {
      await updateDoc(recordRef, {
        owners: arrayRemove(targetUserId),
      });
      console.log('✅ Removed from owners array');

      // Revoke encryption access only if fully removing
      await SharingService.revokeEncryptionAccess(recordId, targetUserId, currentUser.uid);
    }

    // Step 2: Update blockchain - owners must use voluntarilyRemoveOwnOwnership
    try {
      console.log('🔗 Removing ownership on blockchain...');
      await BlockchainRoleManagerService.voluntarilyLeaveOwnership(recordId);
      console.log('✅ Blockchain: Ownership removed');
    } catch (blockchainError) {
      console.error('⚠️ Blockchain ownership removal failed:', blockchainError);
      await BlockchainSyncQueueService.logFailure({
        contract: 'MemberRoleManager',
        action: 'voluntarilyLeaveOwnership',
        userId: currentUser.uid,
        userWalletAddress: userWalletAddress,
        error: blockchainError as string,
        context: {
          type: 'permission',
          targetUserId: targetUserId,
          targetWalletAddress: targetWalletAddress,
          role: 'owner',
          recordId: recordId,
        },
      });
    }

    // Step 3: If demoting, need to grant the new role
    if (demoteTo) {
      try {
        console.log(`🔗 Demoting to ${demoteTo} on blockchain...`);
        await BlockchainRoleManagerService.grantRole(recordId, targetWalletAddress, demoteTo);
        console.log(`✅ Blockchain: Demoted to ${demoteTo}`);
      } catch (blockchainError) {
        console.error('⚠️ Blockchain update failed:', blockchainError);
        await BlockchainSyncQueueService.logFailure({
          contract: 'MemberRoleManager',
          action: 'grantRole',
          userId: currentUser.uid,
          userWalletAddress: userWalletAddress,
          error: blockchainError as string,
          context: {
            type: 'permission',
            targetUserId: targetUserId,
            targetWalletAddress: targetWalletAddress,
            role: demoteTo,
            recordId: recordId,
          },
        });
      }
    }

    console.log('✅ Owner access removed successfully');
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Check if current user can manage a specific role on a record
   */
  static async canManageRole(recordId: string, role: Role): Promise<boolean> {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) return false;

      const db = getFirestore();
      const recordDoc = await getDoc(doc(db, 'records', recordId));

      if (!recordDoc.exists()) return false;

      const recordData = recordDoc.data();
      const isOwner = recordData.owners?.includes(currentUser.uid);
      const isAdmin = recordData.administrators?.includes(currentUser.uid);

      switch (role) {
        case 'owner':
          // Only owners can manage owners (or admins if no owners exist)
          return recordData.owners?.length > 0 ? isOwner : isAdmin;
        case 'administrator':
          return isOwner || isAdmin;
        case 'viewer':
          return isOwner || isAdmin;
        default:
          return false;
      }
    } catch (err) {
      console.error('Error checking permissions:', err);
      return false;
    }
  }

  /**
   * Get record ownership information from firebase
   */
  static async getRecordRoles(recordId: string): Promise<{
    owners: string[];
    administrators: string[];
    viewers: string[];
    canManageOwners: boolean;
    canManageAdmins: boolean;
    canManageViewers: boolean;
  } | null> {
    try {
      const db = getFirestore();
      const recordDoc = await getDoc(doc(db, 'records', recordId));

      if (!recordDoc.exists()) return null;

      const recordData = recordDoc.data();

      const [canManageOwners, canManageAdmins, canManageViewers] = await Promise.all([
        this.canManageRole(recordId, 'owner'),
        this.canManageRole(recordId, 'administrator'),
        this.canManageRole(recordId, 'viewer'),
      ]);

      return {
        owners: recordData.owners || [],
        administrators: recordData.administrators || [],
        viewers: recordData.viewers || [],
        canManageOwners,
        canManageAdmins,
        canManageViewers,
      };
    } catch (err) {
      console.error('Error getting record roles:', err);
      return null;
    }
  }
}
