// src/features/Trustee/services/trusteeRelationshipService.ts

/**
 * TrusteeRelationshipService
 *
 * Manages the lifecycle of trustee relationships between users.
 * A trustee is a user who has been granted account-level trust by another user (the trustor).
 *
 * Trust Levels:
 *  - observer:   Read-only access to all records where trustor is a subject <-- gets added as viewer for every record
 *  - custodian:  Same record-level permissions as the trustor on all their records <-- gets added with the same permission level
 *  - controller:   Full account-level access, including accepting records, requires blockchain transaction.
 *
 * Key design decisions:
 *  - Document ID: `${trustorId}_${trusteeId}` — mirrors wrappedKeys pattern, ensures
 *    uniqueness per pair and enables cheap direct lookups without querying
 *  - Soft delete only: relationships are never deleted, only status/isActive updated
 *    (same pattern as wrappedKeys: revokedAt + revokedBy instead of deleteDoc)
 *  - Re-invitation reactivates the existing document rather than creating a new one
 *  - Controller appointments require a blockchain transaction to add the trustee's smart wallet/EOA wallet to the trustor's ID and store the tx hash
 *
 * Relationship to other services:
 *  - Does NOT touch record-level permissions directly (that stays in PermissionsService)
 *  - Permission resolution ("what can this trustee do on record X?") is handled
 *    by a separate TrusteePermissionService
 *  - Notifications are fired via Cloud Function triggers on status changes,
 *    not called directly here (same pattern as subjectConsentRequest triggers)
 *
 * Permission fan-out lifecycle:
 *  - inviteTrustee      → TrusteePermissionService.grantPendingTrusteeAccess
 *                         (trustor is online; creates inactive wrappedKeys + role arrays)
 *  - acceptInvite       → TrusteePermissionService.activateTrusteeAccess
 *                         (flips wrappedKeys to isActive: true)
 *  - declineInvite      → TrusteePermissionService.rollbackPendingTrusteeAccess
 *                         (removes from role arrays, deletes inactive wrappedKeys)
 *  - revokeTrustee      → TrusteePermissionService.revokeTrusteeAccess
 *  - resignAsTrustee    → TrusteePermissionService.revokeTrusteeAccess
 */

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  query,
  collection,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import { TrusteeBlockchainService } from './trusteeBlockchainService';
import { TrusteePermissionService } from './trusteePermissionService';
import { BlockchainRef } from '@belrose/shared';

// ============================================================================
// TYPES
// ============================================================================

export type TrustLevel = 'observer' | 'custodian' | 'controller';
export type TrusteeStatus = 'pending' | 'active' | 'revoked' | 'declined';
export type StatusUpdate =
  | 'trustor_revoked'
  | 'trustee_resigned'
  | 'trust_level_upgrade'
  | 'trust_level_downgrade';

export type OnChainTrusteeAction = 'propose' | 'accept' | 'revoke' | 'decline' | 'level-update';

export interface OnChainTrusteeEvent {
  action: OnChainTrusteeAction;
  trustLevel?: TrustLevel; // present on 'propose' and 'level-update'
  blockchainRef: BlockchainRef;
  recordedAt: Timestamp;
}

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
  statusUpdateReason: StatusUpdate | null;

  // Append-only audit log of every blockchain operation on this relationship.
  // Each write appends a new entry; history is never overwritten.
  onChainEvents: OnChainTrusteeEvent[];

  // Set to true for auto-created relationships on dependent accounts
  isDependentRelationship?: boolean;
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

const trustLevelMap = { observer: 0, custodian: 1, controller: 2 } as const;

// ============================================================================
// SERVICE
// ============================================================================

export class TrusteeRelationshipService {
  // ============================================================================
  // INVITE METHODS (Called by trustor)
  // ============================================================================

  /**
   * Invite a user to become a trustee. Only called by the trustor.
   *
   * If a relationship document already exists (previous revocation or decline),
   * reactivates it as a new pending invite rather than creating a duplicate.
   *
   * Permission fan-out happens at invite time (not accept time) because the
   * trustor is guaranteed online and has the session key needed for encryption.
   * wrappedKeys are created with isActive: false — trustee can't decrypt until
   * they accept. If the permission fan-out fails, the relationship doc is rolled
   * back so the invite isn't left in a broken state.
   *
   * @param trusteeId - The userId of the person being invited
   * @param trustLevel - The level of trust being granted
   */
  static async inviteTrustee(trusteeId: string, trustLevel: TrustLevel): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) throw new Error('User not authenticated');

    const trustorId = currentUser.uid;
    const currentUserProfile = await getUserProfile(trustorId);

    if (trustorId === trusteeId) {
      throw new Error('You cannot appoint yourself as a trustee');
    }

    // Check 1: Verify target user exists
    const targetProfile = await getUserProfile(trusteeId);
    if (!targetProfile) throw new Error('Target user does not exist or has no profile');

    // Check 2: Requires a blockchain wallet for both parties
    if (!currentUserProfile?.onChainIdentity?.linkedWallets.some(w => w.isWalletActive)) {
      throw new Error('Trustor does not have an existing blockchain account');
    }
    if (!targetProfile?.onChainIdentity?.linkedWallets.some(w => w.isWalletActive)) {
      throw new Error('Trustee does not have an existing blockchain account');
    }

    const db = getFirestore();
    const relationshipId = getTrusteeRelationshipId(trustorId, trusteeId);
    const relationshipRef = doc(db, 'trusteeRelationships', relationshipId);
    const existing = await getDoc(relationshipRef);
    const now = Timestamp.now();

    // Check existing doc FIRST before touching blockchain
    if (existing.exists()) {
      const existingData = existing.data() as TrusteeRelationship;
      if (existingData.status === 'active') {
        throw new Error('This user is already an active trustee');
      }
      if (existingData.status === 'pending') {
        throw new Error('An invite is already pending for this user');
      }
    }

    // Step 1: Fetch records so roles can be granted atomically with the proposal
    const trustorRecords = await TrusteePermissionService.getRecordsForTrustor(
      trustorId,
      trusteeId
    );
    const recordIds = trustorRecords.map(r => r.recordId);

    // Step 2: Blockchain proposal — grants record roles in the same tx
    console.log('🔗 Proposing trustee on blockchain...');
    const { success, blockchainRef: inviteBlockchainRef } =
      await TrusteeBlockchainService.proposeTrustee(
        trustorId,
        trusteeId,
        trustLevelMap[trustLevel],
        recordIds
      );
    if (!success) throw new Error('Blockchain proposal failed — see sync queue for details');
    console.log('✅ Blockchain: Trustee proposed');

    // Step 3: Fan out pending permissions (wrappedKeys + Firestore arrays)
    // Blockchain roles already granted above; trustor is online so session key is available
    await TrusteePermissionService.grantPendingTrusteeAccess(
      trusteeId,
      trustLevel,
      inviteBlockchainRef!
    );
    console.log('✅ Pending permissions granted');

    const proposeEvent: OnChainTrusteeEvent = {
      action: 'propose',
      trustLevel,
      blockchainRef: inviteBlockchainRef!,
      recordedAt: now,
    };

    // Step 2: Write relationship doc
    if (existing.exists()) {
      console.log('🔄 Reactivating existing trustee relationship as new invite');
      await updateDoc(relationshipRef, {
        trustLevel,
        status: 'pending',
        isActive: false,
        createdAt: now,
        respondedAt: null,
        revokedAt: null,
        revokedBy: null,
        statusUpdateReason: null,
        onChainEvents: arrayUnion(proposeEvent),
      });
    } else {
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
        statusUpdateReason: null,
        onChainEvents: [proposeEvent],
      } satisfies TrusteeRelationship);
    }

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

    // Step 1: Revoke on blockchain
    console.log('🔗 Revoking trustee on blockchain...');
    const { success, blockchainRef: revocationBlockchainRef } =
      await TrusteeBlockchainService.revokeTrustee(trustorId, trusteeId, trustorId);
    if (!success) throw new Error('Blockchain revocation failed — see sync queue for details');
    console.log('✅ Blockchain: Trustee revoked');

    // Step 2: Revoke record permissions
    // For active relationships: deactivates wrappedKeys + removes from role arrays
    // For pending relationships: deletes inactive wrappedKeys + removes from role arrays
    if (data.status === 'active') {
      await TrusteePermissionService.revokeTrusteeAccess(
        trustorId,
        trusteeId,
        revocationBlockchainRef
      );
    } else if (data.status === 'pending') {
      await TrusteePermissionService.rollbackPendingTrusteeAccess(
        trustorId,
        trusteeId,
        revocationBlockchainRef
      );
    }

    // Step 3: Update Firestore relationship doc. A null blockchainRef means the relationship
    // was already revoked on-chain from an earlier attempt (see
    // TrusteeBlockchainService.revokeTrustee) — nothing new to add to the audit log, but the
    // Firestore state still needs to catch up to match.
    await updateDoc(relationshipRef, {
      isActive: false,
      status: 'revoked',
      revokedAt: Timestamp.now(),
      revokedBy: trustorId,
      statusUpdateReason: 'trustor_revoked',
      ...(revocationBlockchainRef && {
        onChainEvents: arrayUnion({
          action: 'revoke',
          blockchainRef: revocationBlockchainRef,
          recordedAt: Timestamp.now(),
        } satisfies OnChainTrusteeEvent),
      }),
    });

    console.log(`✅ Trustee revoked: ${trustorId} revoked ${trusteeId}`);
  }

  /**
   * Edit the trust level of an active trustee relationship.
   * Only the trustor can call this.
   *
   * @param trusteeId - The userId of the trustee
   * @param newTrustLevel - The new trust level to set
   */
  static async editTrusteeRelationship(
    trusteeId: string,
    newTrustLevel: TrustLevel
  ): Promise<void> {
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

    if (data.status !== 'active') {
      throw new Error('Can only edit an active trustee relationship');
    }

    if (data.trustLevel === newTrustLevel) {
      throw new Error('Trustee already has this trust level');
    }

    const isUpgrade =
      (data.trustLevel === 'observer' && newTrustLevel !== 'observer') ||
      (data.trustLevel === 'custodian' && newTrustLevel === 'controller');

    // Step 1: Update trust level on blockchain
    console.log('🔗 Updating trust level on blockchain...');
    const { success, blockchainRef: editBlockchainRef } =
      await TrusteeBlockchainService.updateTrusteeLevel(
        trustorId,
        trusteeId,
        trustLevelMap[newTrustLevel]
      );
    if (!success) throw new Error('Blockchain update failed — see sync queue for details');
    console.log('✅ Blockchain: Trust level updated');

    // Step 2: Update record permissions to reflect new trust level.
    // Fan-out errors are non-fatal — the blockchain trust-level write at step 1 has
    // already committed, so the relationship doc must stay in sync regardless.
    try {
      await TrusteePermissionService.updateTrusteeAccess(
        trustorId,
        trusteeId,
        newTrustLevel,
        editBlockchainRef!
      );
    } catch (err) {
      console.error('⚠️ Permission fan-out failed during trust level edit (non-fatal):', err);
    }

    // Step 3: Update Firestore
    await updateDoc(relationshipRef, {
      trustLevel: newTrustLevel,
      statusUpdateReason: isUpgrade ? 'trust_level_upgrade' : 'trust_level_downgrade',
      onChainEvents: arrayUnion({
        action: 'level-update',
        trustLevel: newTrustLevel,
        blockchainRef: editBlockchainRef!,
        recordedAt: Timestamp.now(),
      } satisfies OnChainTrusteeEvent),
    });

    console.log(`✅ Trust level updated: ${trustorId} → ${trusteeId} (${newTrustLevel})`);
  }

  /**
   * Trustee self-downgrades their own trust level.
   * Only the trustee can call this, and only to a strictly lower level.
   * Upgrades require trustor approval via editTrusteeRelationship.
   *
   * @param trustorId - The userId of the trustor
   * @param newTrustLevel - The new (lower) trust level
   */
  static async stepDownTrusteeLevel(trustorId: string, newTrustLevel: TrustLevel): Promise<void> {
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

    if (data.status !== 'active') throw new Error('Can only step down from an active relationship');

    const LEVEL_ORDER: TrustLevel[] = ['observer', 'custodian', 'controller'];
    if (LEVEL_ORDER.indexOf(newTrustLevel) >= LEVEL_ORDER.indexOf(data.trustLevel)) {
      throw new Error('Can only step down to a lower trust level');
    }

    // Step 1: Update on blockchain — trustee signs, trustorIdHash passed as arg
    console.log('🔗 Downgrading trust level on blockchain...');
    const { success, blockchainRef: editBlockchainRef } =
      await TrusteeBlockchainService.downgradeTrusteeLevel(
        trustorId,
        trusteeId,
        trustLevelMap[newTrustLevel]
      );
    if (!success) throw new Error('Blockchain update failed — see sync queue for details');
    console.log('✅ Blockchain: Trust level downgraded');

    // Step 2: Update record permissions to reflect new (lower) trust level.
    // Fan-out errors are non-fatal — the blockchain is already updated, so the
    // relationship doc must be kept in sync regardless of partial permission failures.
    try {
      await TrusteePermissionService.updateTrusteeAccess(
        trustorId,
        trusteeId,
        newTrustLevel,
        editBlockchainRef!
      );
    } catch (err) {
      console.error('⚠️ Permission fan-out failed during step-down (non-fatal):', err);
    }

    // Step 3: Update Firestore
    await updateDoc(relationshipRef, {
      trustLevel: newTrustLevel,
      statusUpdateReason: 'trust_level_downgrade',
      onChainEvents: arrayUnion({
        action: 'level-update',
        trustLevel: newTrustLevel,
        blockchainRef: editBlockchainRef!,
        recordedAt: Timestamp.now(),
      } satisfies OnChainTrusteeEvent),
    });

    console.log(
      `✅ Trust level stepped down: ${trusteeId} → ${newTrustLevel} (trustor: ${trustorId})`
    );
  }

  // ============================================================================
  // RESPONSE METHODS (Called by trustee)
  // ============================================================================

  /**
   * Accept a pending trustee invite.
   * Only the trustee (the invited user) can call this.
   *
   * Activates all wrappedKeys that were created at invite time (isActive: false → true).
   * The trustee already has role array access — this just unlocks decryption.
   *
   * @param trustorId - The userId of the trustor who sent the invite
   */
  static async acceptInvite(trustorId: string): Promise<void> {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) throw new Error('User not authenticated');

    const trusteeId = currentUser.uid;
    const currentUserProfile = await getUserProfile(trusteeId);
    const db = getFirestore();
    const relationshipId = getTrusteeRelationshipId(trustorId, trusteeId);
    const relationshipRef = doc(db, 'trusteeRelationships', relationshipId);
    const existing = await getDoc(relationshipRef);

    if (!existing.exists()) throw new Error('Trustee invite not found');

    const data = existing.data() as TrusteeRelationship;

    if (data.status !== 'pending') {
      throw new Error(`Cannot accept an invite with status: ${data.status}`);
    }

    if (data.trusteeId !== trusteeId) {
      throw new Error('You are not the intended recipient of this invite');
    }

    const activeWallets =
      currentUserProfile?.onChainIdentity?.linkedWallets
        ?.filter(w => w.isWalletActive)
        .map(w => w.address) ?? [];

    if (activeWallets.length === 0) {
      throw new Error('You need an active blockchain wallet to accept a trustee invite');
    }

    // Step 1: Accept on blockchain
    console.log('🔗 Accepting trustee on blockchain...');
    const { success, blockchainRef: acceptBlockchainRef } =
      await TrusteeBlockchainService.acceptTrustee(trustorId, trusteeId);
    if (!success) throw new Error('Blockchain acceptance failed — see sync queue for details');
    console.log('✅ Blockchain: Trustee accepted');

    // Step 2: Activate all wrappedKeys created at invite time
    // This is the only thing the trustee needs to do — role arrays were already
    // updated by the trustor at invite time
    await TrusteePermissionService.activateTrusteeAccess(trustorId);

    // Step 3: Flip relationship to active. A null acceptBlockchainRef means this was already
    // active on-chain from an earlier attempt (see TrusteeBlockchainService.acceptTrustee) —
    // nothing new to add to the audit log, but Firestore still needs to catch up to match.
    await updateDoc(relationshipRef, {
      isActive: true,
      status: 'active',
      respondedAt: Timestamp.now(),
      ...(acceptBlockchainRef && {
        onChainEvents: arrayUnion({
          action: 'accept',
          blockchainRef: acceptBlockchainRef,
          recordedAt: Timestamp.now(),
        } satisfies OnChainTrusteeEvent),
      }),
    });

    console.log(`✅ Trustee invite accepted: ${trusteeId} accepted invite from ${trustorId}`);
  }

  /**
   * Decline a pending trustee invite.
   * Only the trustee (the invited user) can call this.
   *
   * Rolls back all permissions granted at invite time:
   * removes from role arrays and deletes inactive wrappedKeys.
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

    // Step 1: Blockchain decline — revokes roles granted at proposal time
    console.log('🔗 Declining trustee proposal on blockchain...');
    const { success, blockchainRef: declineBlockchainRef } =
      await TrusteeBlockchainService.declineTrustee(trustorId, trusteeId);
    if (!success) throw new Error('Blockchain decline failed — see sync queue for details');
    console.log('✅ Blockchain: Trustee proposal declined');

    // Step 2: Roll back all pending permissions granted at invite time
    await TrusteePermissionService.rollbackPendingTrusteeAccess(
      trustorId,
      trusteeId,
      declineBlockchainRef!
    );

    // Step 3: Update relationship doc
    await updateDoc(relationshipRef, {
      isActive: false,
      status: 'declined',
      respondedAt: Timestamp.now(),
      revokedBy: trusteeId,
      onChainEvents: arrayUnion({
        action: 'decline',
        blockchainRef: declineBlockchainRef!,
        recordedAt: Timestamp.now(),
      } satisfies OnChainTrusteeEvent),
    });

    console.log(`✅ Trustee invite declined: ${trusteeId} declined invite from ${trustorId}`);
  }

  /**
   * Resign from an active trustee relationship.
   * Only the trustee can call this.
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

    // Step 1: Revoke on blockchain
    console.log('🔗 Resigning as trustee on blockchain...');
    const { success, blockchainRef: revocationBlockchainRef } =
      await TrusteeBlockchainService.revokeTrustee(trustorId, trusteeId, trusteeId);
    if (!success) throw new Error('Blockchain revocation failed — see sync queue for details');
    console.log('✅ Blockchain: Trustee resigned');

    // Step 2: Revoke record permissions
    await TrusteePermissionService.revokeTrusteeAccess(
      trustorId,
      trusteeId,
      revocationBlockchainRef
    );

    // Step 3: Update Firestore. A null blockchainRef means the relationship was already revoked
    // on-chain from an earlier attempt (see TrusteeBlockchainService.revokeTrustee) — nothing
    // new to add to the audit log, but the Firestore state still needs to catch up to match.
    await updateDoc(relationshipRef, {
      status: 'declined',
      isActive: false,
      revokedAt: Timestamp.now(),
      revokedBy: trusteeId,
      statusUpdateReason: 'trustee_resigned',
      ...(revocationBlockchainRef && {
        onChainEvents: arrayUnion({
          action: 'revoke',
          blockchainRef: revocationBlockchainRef,
          recordedAt: Timestamp.now(),
        } satisfies OnChainTrusteeEvent),
      }),
    });

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
   * Get all pending invites for the current user.
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

  /**
   * Check whether the current user is an active controller trustee of the given trustorId.
   * Uses a direct document lookup (no composite index needed).
   */
  static async getControllerRelationshipWith(
    trustorId: string
  ): Promise<TrusteeRelationship | null> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return null;

    const rel = await TrusteeRelationshipService.getRelationship(trustorId, currentUser.uid);
    if (rel && rel.isActive && rel.trustLevel === 'controller') return rel;
    return null;
  }

  /**
   * Returns all active relationships where the current user is a controller trustee.
   * Filters client-side after the trusteeId + isActive index query to avoid a new composite index.
   */
  static async getActiveControllerTrustors(): Promise<TrusteeRelationship[]> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return [];

    const db = getFirestore();
    const q = query(
      collection(db, 'trusteeRelationships'),
      where('trusteeId', '==', currentUser.uid),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => d.data() as TrusteeRelationship)
      .filter(r => r.trustLevel === 'controller');
  }
}
