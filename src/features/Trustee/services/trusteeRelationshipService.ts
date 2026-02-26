// src/features/Trustee/services/trusteeRelationshipService.ts

/**
 * TrusteeRelationshipService
 *
 * Manages the lifecycle of trustee relationships between users.
 * A trustee is a user who has been granted account-level trust by another user (the trustor).
 *
 * Trust Levels:
 *  - observer:   Read-only access to all records where trustor is a subject <-- gets added as viewer for every record
 *  - custodian:  Same record-level permissions as the trustor on all their records <-- just gets added with the same permission at every
 *  - guardian:   Full account-level access, including accepting records, requires blockchain transaction.
 *
 * Key design decisions:
 *  - Document ID: `${trustorId}_${trusteeId}` — mirrors wrappedKeys pattern, ensures
 *    uniqueness per pair and enables cheap direct lookups without querying
 *  - Soft delete only: relationships are never deleted, only status/isActive updated
 *    (same pattern as wrappedKeys: revokedAt + revokedBy instead of deleteDoc)
 *  - Re-invitation reactivates the existing document rather than creating a new one
 *  - Guardian appointments require a blockchain transaction and store the tx hash
 *
 * Relationship to other services:
 *  - Does NOT touch record-level permissions directly (that stays in PermissionsService)
 *  - Permission resolution ("what can this trustee do on record X?") is handled
 *    by a separate TrusteePermissionService (to be built)
 *  - Notifications are fired via Cloud Function triggers on status changes,
 *    not called directly here (same pattern as subjectConsentRequest triggers)
 */

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  collection,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getUserProfile } from '@/features/Users/services/userProfileService';

// ============================================================================
// TYPES
// ============================================================================

export type TrustLevel = 'observer' | 'custodian' | 'guardian';
export type TrusteeStatus = 'pending' | 'active' | 'revoked' | 'declined';
export type RevocationReason = 'trustor_revoked' | 'trustee_resigned';

export interface TrusteeRelationship {
  // Core identifiers
  trustorId: string;
  trusteeId: string;
  trustLevel: TrustLevel;

  // Status — never deleted, mirrors wrappedKeys isActive pattern
  isActive: boolean;
  status: TrusteeStatus;

  // Lifecycle timestamps
  createdAt: Timestamp;
  respondedAt: Timestamp | null;
  revokedAt: Timestamp | null;
  revokedBy: string | null; // uid — could be either party
  revocationReason: RevocationReason | null;

  // Denormalized display names for easy rendering (same pattern as notifications)
  trustorDisplayName: string;
  trusteeDisplayName: string;

  // Guardian only — blockchain tx hash from the guardian appointment
  blockchainTxHash: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate the document ID for a trustee relationship.
 * Format: `${trustorId}_${trusteeId}`
 * Mirrors the wrappedKeys pattern: `${recordId}_${userId}`
 */
export const getTrusteeRelationshipId = (trustorId: string, trusteeId: string): string => {
  return `${trustorId}_${trusteeId}`;
};

// ============================================================================
// SERVICE
// ============================================================================

export class TrusteeRelationshipService {
  // ============================================================================
  // INVITE METHODS (Called by trustor)
  // ============================================================================

  /**
   * Invite a user to become a trustee.
   *
   * If a relationship document already exists (previous revocation or decline),
   * reactivates it as a new pending invite rather than creating a duplicate.
   * This mirrors how sharingService handles wrappedKey reactivation.
   *
   * @param trusteeId - The userId of the person being invited
   * @param trustLevel - The level of trust being granted
   */
  static async inviteTrustee(trusteeId: string, trustLevel: TrustLevel): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) throw new Error('User not authenticated');

    const trustorId = currentUser.uid;

    if (trustorId === trusteeId) {
      throw new Error('You cannot appoint yourself as a trustee');
    }

    // Check 1: Verify target user exists
    const targetProfile = await getUserProfile(trusteeId);
    if (!targetProfile) throw new Error('Target user does not exist or has no profile');

    // Check 2: Guardian requires a blockchain wallet for both parties
    // TODO: When implementing guardian blockchain tx, add wallet checks here
    // (mirrors the wallet checks in permissionsService.grantOwner)

    const db = getFirestore();
    const relationshipId = getTrusteeRelationshipId(trustorId, trusteeId);
    const relationshipRef = doc(db, 'trusteeRelationships', relationshipId);
    const existing = await getDoc(relationshipRef);

    // Get display names for denormalization
    const trustorProfile = await getUserProfile(trustorId);
    const trustorDisplayName = trustorProfile?.displayName || 'Unknown';
    const trusteeDisplayName = targetProfile.displayName || 'Unknown';

    const now = Timestamp.now();

    if (existing.exists()) {
      const existingData = existing.data() as TrusteeRelationship;

      // Block re-invite if relationship is already active or pending
      if (existingData.status === 'active') {
        throw new Error('This user is already an active trustee');
      }
      if (existingData.status === 'pending') {
        throw new Error('An invite is already pending for this user');
      }

      // Reactivate as new pending invite (mirrors wrappedKey reactivation)
      console.log('🔄 Reactivating existing trustee relationship as new invite');
      await updateDoc(relationshipRef, {
        trustLevel,
        status: 'pending',
        isActive: false, // stays false until trustee accepts
        createdAt: now,
        respondedAt: null,
        revokedAt: null,
        revokedBy: null,
        revocationReason: null,
        blockchainTxHash: null,
        trustorDisplayName,
        trusteeDisplayName,
      });
    } else {
      // First time — create new document
      console.log('🔄 Creating new trustee relationship invite');
      await setDoc(relationshipRef, {
        trustorId,
        trusteeId,
        trustLevel,
        isActive: false,
        status: 'pending',
        createdAt: now,
        respondedAt: null,
        revokedAt: null,
        revokedBy: null,
        revocationReason: null,
        trustorDisplayName,
        trusteeDisplayName,
        blockchainTxHash: null,
      } satisfies TrusteeRelationship);
    }

    // NOTE: Notification to trustee is fired by a Cloud Function trigger
    // on the trusteeRelationships collection (status: pending created/updated)
    // — same pattern as subjectConsentRequest notifications

    console.log(`✅ Trustee invite sent: ${trustorId} → ${trusteeId} (${trustLevel})`);
  }

  /**
   * Revoke an active or pending trustee relationship.
   * Only the trustor can call this.
   *
   * @param trusteeId - The userId of the trustee to revoke
   */
  static async revokeTrustee(trusteeId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) throw new Error('User not authenticated');

    const trustorId = currentUser.uid;
    const db = getFirestore();
    const relationshipId = getTrusteeRelationshipId(trustorId, trusteeId);
    const relationshipRef = doc(db, 'trusteeRelationships', relationshipId);
    const existing = await getDoc(relationshipRef);

    if (!existing.exists()) throw new Error('Trustee relationship not found');

    const data = existing.data() as TrusteeRelationship;

    if (data.status === 'revoked') throw new Error('Relationship is already revoked');
    if (data.status === 'declined') throw new Error('Cannot revoke a declined relationship');

    // TODO: Guardian revocation will also need a blockchain tx here
    // to remove the guardian's wallet-level permissions

    await updateDoc(relationshipRef, {
      isActive: false,
      status: 'revoked',
      revokedAt: Timestamp.now(),
      revokedBy: trustorId,
      revocationReason: 'trustor_revoked',
    });

    // NOTE: Notification to trustee fired by Cloud Function trigger
    console.log(`✅ Trustee revoked: ${trustorId} revoked ${trusteeId}`);
  }

  // ============================================================================
  // RESPONSE METHODS (Called by trustee)
  // ============================================================================

  /**
   * Accept a pending trustee invite.
   * Only the trustee (the invited user) can call this.
   *
   * @param trustorId - The userId of the trustor who sent the invite
   */
  static async acceptInvite(trustorId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) throw new Error('User not authenticated');

    const trusteeId = currentUser.uid;
    const db = getFirestore();
    const relationshipId = getTrusteeRelationshipId(trustorId, trusteeId);
    const relationshipRef = doc(db, 'trusteeRelationships', relationshipId);
    const existing = await getDoc(relationshipRef);

    if (!existing.exists()) throw new Error('Trustee invite not found');

    const data = existing.data() as TrusteeRelationship;

    if (data.status !== 'pending') {
      throw new Error(`Cannot accept an invite with status: ${data.status}`);
    }

    // Verify this user is actually the trustee on the document
    // (Firestore rules enforce this too, but good to check in service)
    if (data.trusteeId !== trusteeId) {
      throw new Error('You are not the intended recipient of this invite');
    }

    // TODO: Guardian acceptance may require a blockchain tx here
    // to register the guardian's wallet with the trustor's identity

    await updateDoc(relationshipRef, {
      isActive: true,
      status: 'active',
      respondedAt: Timestamp.now(),
    });

    // NOTE: Notification to trustor fired by Cloud Function trigger
    console.log(`✅ Trustee invite accepted: ${trusteeId} accepted invite from ${trustorId}`);
  }

  /**
   * Decline a pending trustee invite.
   * Only the trustee (the invited user) can call this.
   *
   * @param trustorId - The userId of the trustor who sent the invite
   */
  static async declineInvite(trustorId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) throw new Error('User not authenticated');

    const trusteeId = currentUser.uid;
    const db = getFirestore();
    const relationshipId = getTrusteeRelationshipId(trustorId, trusteeId);
    const relationshipRef = doc(db, 'trusteeRelationships', relationshipId);
    const existing = await getDoc(relationshipRef);

    if (!existing.exists()) throw new Error('Trustee invite not found');

    const data = existing.data() as TrusteeRelationship;

    if (data.status !== 'pending') {
      throw new Error(`Cannot decline an invite with status: ${data.status}`);
    }

    await updateDoc(relationshipRef, {
      isActive: false,
      status: 'declined',
      respondedAt: Timestamp.now(),
      revokedBy: trusteeId,
      revocationReason: null, // declined is its own status, not a revocation
    });

    console.log(`✅ Trustee invite declined: ${trusteeId} declined invite from ${trustorId}`);
  }

  /**
   * Resign from an active trustee relationship.
   * Only the trustee can call this. This is the "trustee ends the relationship" path.
   *
   * @param trustorId - The userId of the trustor
   */
  static async resignAsTrustee(trustorId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) throw new Error('User not authenticated');

    const trusteeId = currentUser.uid;
    const db = getFirestore();
    const relationshipId = getTrusteeRelationshipId(trustorId, trusteeId);
    const relationshipRef = doc(db, 'trusteeRelationships', relationshipId);
    const existing = await getDoc(relationshipRef);

    if (!existing.exists()) throw new Error('Trustee relationship not found');

    const data = existing.data() as TrusteeRelationship;

    if (data.status !== 'active') {
      throw new Error('Can only resign from an active trustee relationship');
    }

    // TODO: Guardian resignation will also need a blockchain tx here

    await updateDoc(relationshipRef, {
      isActive: false,
      status: 'revoked',
      revokedAt: Timestamp.now(),
      revokedBy: trusteeId,
      revocationReason: 'trustee_resigned',
    });

    // NOTE: Notification to trustor fired by Cloud Function trigger
    console.log(`✅ Trustee resigned: ${trusteeId} resigned from ${trustorId}'s account`);
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Get all active trustees for a given trustor.
   * Used to render the "My Trustees" list on the trustor's settings/profile page.
   *
   * @param trustorId - Defaults to current user if not provided
   */
  static async getTrusteesForTrustor(trustorId?: string): Promise<TrusteeRelationship[]> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const db = getFirestore();
    const targetId = trustorId || currentUser.uid;

    const q = query(
      collection(db, 'trusteeRelationships'),
      where('trustorId', '==', targetId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as TrusteeRelationship);
  }

  /**
   * Get all accounts the current user is an active trustee for.
   * Used to render "Accounts I Manage" on the trustee's dashboard.
   */
  static async getTrustorAccountsForTrustee(): Promise<TrusteeRelationship[]> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const db = getFirestore();

    const q = query(
      collection(db, 'trusteeRelationships'),
      where('trusteeId', '==', currentUser.uid),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as TrusteeRelationship);
  }

  /**
   * Get all pending invites for the current user (invites they need to respond to).
   * Used to show the "Pending Trustee Invites" notification/inbox item.
   */
  static async getPendingInvitesForTrustee(): Promise<TrusteeRelationship[]> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');

    const db = getFirestore();

    const q = query(
      collection(db, 'trusteeRelationships'),
      where('trusteeId', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as TrusteeRelationship);
  }

  /**
   * Get a single relationship by trustor + trustee pair.
   * Useful for checking if a relationship exists before showing invite UI.
   */
  static async getRelationship(
    trustorId: string,
    trusteeId: string
  ): Promise<TrusteeRelationship | null> {
    const db = getFirestore();
    const relationshipId = getTrusteeRelationshipId(trustorId, trusteeId);
    const snap = await getDoc(doc(db, 'trusteeRelationships', relationshipId));

    if (!snap.exists()) return null;
    return snap.data() as TrusteeRelationship;
  }
}
