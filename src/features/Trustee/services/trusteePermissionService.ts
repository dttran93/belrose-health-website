// src/features/Trustee/services/trusteePermissionService.ts

/**
 * TrusteePermissionService
 *
 * Handles the fan-out of permissions when a trustee relationship is created or ended.
 * All privileged operations run on the TRUSTOR's client — they are always online
 * at invite time and have the session key needed for encryption fan-out.
 *
 * INVITE (called by trustor):
 *  - Queries all records where trustor is a subject
 *  - Resolves the correct role per record based on trust level
 *  - Grants blockchain role via grantRoleAsTrusteeBatch
 *  - Creates wrappedKeys for trustee (isActive: false) via SharingService
 *  - Updates Firestore role arrays + trustees[] on each record
 *  All access is pending until the trustee accepts.
 *
 * ACCEPT (called by trustee — minimal, just activates):
 *  - Flips all wrappedKeys for this trustor→trustee pair to isActive: true
 *  The trusteeRelationships doc itself is updated by TrusteeRelationshipService.
 *
 * DECLINE / REVOKE (rollback):
 *  - Removes trustee from role arrays + trustees[]
 *  - Deletes inactive wrappedKeys
 *  - Blockchain revocation handled upstream by TrusteeBlockchainService
 *
 * Trust level → role resolution (mirrors MemberRoleManager.sol):
 *  - Observer   → always viewer
 *  - Custodian  → mirrors trustor role, capped at administrator
 *  - Controller → mirrors trustor role exactly (including owner)
 */

import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  updateDoc,
  doc,
  getDoc,
  arrayRemove,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { TrusteeBlockchainService } from './trusteeBlockchainService';
import { TrustLevel } from './trusteeRelationshipService';
import { Role } from '@/features/Permissions/services/permissionsService';
import { SharingService } from '@/features/Sharing/services/sharingService';
import { getAuth } from 'firebase/auth';

interface TrusteeRecordAccess {
  recordId: string;
  role: Role;
  hadPriorAccess?: boolean; // true if trustee already had independent access before this relationship
}

export class TrusteePermissionService {
  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Query all records where the trustor is an active subject.
   * Runs on the trustor's client — they have read access to their own records.
   *
   * Optionally pass trusteeId to also return the trustee's current role on each record.
   * Used by grantPendingTrusteeAccess to skip/upgrade appropriately.
   */
  private static async getRecordsForTrustor(
    trustorId: string,
    trusteeId?: string
  ): Promise<{ recordId: string; trustorRole: Role | null; currentTrusteeRole?: Role | null }[]> {
    const db = getFirestore();
    const q = query(collection(db, 'records'), where('subjects', 'array-contains', trustorId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => {
      const data = d.data();

      let trustorRole: Role | null = null;
      if (data.owners?.includes(trustorId)) trustorRole = 'owner';
      else if (data.administrators?.includes(trustorId)) trustorRole = 'administrator';
      else if (data.viewers?.includes(trustorId)) trustorRole = 'viewer';

      if (!trusteeId) return { recordId: d.id, trustorRole };

      let currentTrusteeRole: Role | null = null;
      if (data.owners?.includes(trusteeId)) currentTrusteeRole = 'owner';
      else if (data.administrators?.includes(trusteeId)) currentTrusteeRole = 'administrator';
      else if (data.viewers?.includes(trusteeId)) currentTrusteeRole = 'viewer';

      return { recordId: d.id, trustorRole, currentTrusteeRole };
    });
  }

  /**
   * Resolve what role the trustee should get based on trust level + trustor's role.
   * Mirrors _resolveTrusteeRole in MemberRoleManager.sol.
   *
   * Optionally pass currentTrusteeRole to skip the grant if the trustee already has
   * an equal or higher role — prevents redundant grants and unintended downgrades
   * at invite time. Don't pass this for updateTrusteeAccess (downgrades are valid there).
   */
  private static resolveTrusteeRole(
    trustLevel: TrustLevel,
    trustorRole: Role | null,
    currentTrusteeRole?: Role | null
  ): Role | null {
    const resolved = (() => {
      if (trustLevel === 'observer') return 'viewer';
      if (!trustorRole) return null;
      if (trustLevel === 'custodian')
        return trustorRole === 'owner' ? 'administrator' : trustorRole;
      return trustorRole; // controller — full mirror
    })();

    // If trustee already has an equal or higher role, no change needed
    if (currentTrusteeRole !== undefined && resolved !== null && currentTrusteeRole !== null) {
      const rank: Record<Role, number> = { viewer: 1, administrator: 2, owner: 3 };
      if (rank[currentTrusteeRole] >= rank[resolved]) {
        console.log(`ℹ️ Trustee already has equal/higher role (${currentTrusteeRole}) — skipping`);
        return null;
      }
    }

    return resolved;
  }

  /**
   * Get the Firestore role array name for a given role.
   */
  private static roleToArray(role: Role): 'owners' | 'administrators' | 'viewers' {
    switch (role) {
      case 'owner':
        return 'owners';
      case 'administrator':
        return 'administrators';
      case 'viewer':
        return 'viewers';
    }
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Fan out access to all trustor records at INVITE time.
   * Called by TrusteeRelationshipService.inviteTrustee — runs on the TRUSTOR's client.
   *
   * Creates all permissions in a pending state:
   *  - Blockchain role granted
   *  - wrappedKeys created with isActive: false
   *  - Trustee added to role arrays + trustees[] on each record
   *
   * Everything is live in Firestore but the wrappedKey is inactive,
   * so the trustee can't decrypt anything until they accept.
   *
   * Flow:
   *  1. Query all records where trustor is a subject
   *  2. Resolve role per record
   *  3. Batch grant blockchain roles
   *  4. Create inactive wrappedKeys via SharingService
   *  5. Update Firestore role arrays + trustees[]
   */
  static async grantPendingTrusteeAccess(trusteeId: string, trustLevel: TrustLevel): Promise<void> {
    const auth = getAuth();
    const trustorId = auth.currentUser?.uid;
    if (!trustorId) throw new Error('User not authenticated');

    console.log('🔄 Fanning out pending trustee access...', { trustorId, trusteeId, trustLevel });

    // Pass trusteeId so we can check their current role on each record
    const records = await this.getRecordsForTrustor(trustorId, trusteeId);

    if (records.length === 0) {
      console.log('ℹ️ No records found for trustor — nothing to fan out');
      return;
    }

    const accessList: TrusteeRecordAccess[] = records
      .map(({ recordId, trustorRole, currentTrusteeRole }) => ({
        recordId,
        // Pass currentTrusteeRole — skips if trustee already has equal/higher role
        role: this.resolveTrusteeRole(trustLevel, trustorRole, currentTrusteeRole),
        hadPriorAccess: currentTrusteeRole !== null,
      }))
      .filter(
        (r): r is { recordId: string; role: Role; hadPriorAccess: boolean } => r.role !== null
      );

    if (accessList.length === 0) {
      console.log('ℹ️ Trustor has no roles on any records — nothing to grant');
      return;
    }

    const recordIds = accessList.map(r => r.recordId);

    // Step 1: Batch grant on blockchain
    console.log(`🔗 Batch granting blockchain roles across ${recordIds.length} records...`);
    const roles = accessList.map(r => r.role);
    const { success } = await TrusteeBlockchainService.grantRoleAsTrusteeBatch(
      trustorId,
      trusteeId,
      recordIds,
      roles
    );
    if (!success) throw new Error('Blockchain batch grant failed — see sync queue for details');
    console.log('✅ Blockchain batch grant complete');

    // Step 2: Create inactive wrappedKeys + update Firestore arrays per record
    // We do these together so the record stays consistent even if we crash partway through
    const db = getFirestore();

    for (const { recordId, role, hadPriorAccess } of accessList) {
      try {
        // Create wrappedKey in inactive state — trustee can't decrypt until they accept
        await SharingService.grantEncryptionAccess(recordId, trusteeId, trustorId, {
          isActive: false,
        });

        // Move trustee into the correct role array.
        // Only add to trustees[] if they didn't already have independent access —
        // trustees[] marks access as trustee-derived (cascades on trustor removal).
        await updateDoc(doc(db, 'records', recordId), {
          owners: arrayRemove(trusteeId),
          administrators: arrayRemove(trusteeId),
          viewers: arrayRemove(trusteeId),
          [this.roleToArray(role)]: arrayUnion(trusteeId),
          ...(!hadPriorAccess && { trustees: arrayUnion(trusteeId) }),
        });

        console.log(`✅ Pending access granted: ${trusteeId} as ${role} on record ${recordId}`);
      } catch (err) {
        // Log and continue — partial failures are recoverable
        console.error(`⚠️ Failed to grant pending access on record ${recordId}:`, err);
      }
    }

    console.log(`✅ Pending trustee access fan-out complete: ${accessList.length} records`);
  }

  /**
   * Activate all pending wrappedKeys when the trustee accepts the invite.
   * Called by TrusteeRelationshipService.acceptInvite — runs on the TRUSTEE's client.
   *
   * The trustee already has read access to records (they're in role arrays),
   * and they own their own wrappedKeys so they can update them.
   *
   * Note: TrusteeRelationshipService handles flipping the relationship doc to active.
   */
  static async activateTrusteeAccess(trustorId: string): Promise<void> {
    const auth = getAuth();
    const trusteeId = auth.currentUser?.uid;
    if (!trusteeId) throw new Error('User not authenticated');

    console.log('🔄 Activating trustee wrappedKeys...', { trustorId, trusteeId });

    const db = getFirestore();

    // Find all inactive wrappedKeys for this trustee that were granted by the trustor
    // wrappedKey format: `${recordId}_${trusteeId}`
    // We find them by querying for the trustee's keys where grantedBy === trustorId
    const q = query(
      collection(db, 'wrappedKeys'),
      where('userId', '==', trusteeId),
      where('grantedBy', '==', trustorId),
      where('isActive', '==', false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('ℹ️ No pending wrappedKeys found to activate');
      return;
    }

    // Batch activate all pending wrappedKeys
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => {
      batch.update(d.ref, { isActive: true, activatedAt: new Date() });
    });
    await batch.commit();

    console.log(`✅ Activated ${snapshot.size} wrappedKeys for trustee ${trusteeId}`);
  }

  /**
   * Rollback all pending access when the trustee DECLINES an invite.
   * Called by TrusteeRelationshipService.declineInvite — runs on the TRUSTEE's client.
   *
   * Removes trustee from role arrays + trustees[], deletes inactive wrappedKeys.
   * Blockchain revocation is handled upstream by TrusteeBlockchainService.
   */
  static async rollbackPendingTrusteeAccess(trustorId: string): Promise<void> {
    const auth = getAuth();
    const trusteeId = auth.currentUser?.uid;
    if (!trusteeId) throw new Error('User not authenticated');

    console.log('🔄 Rolling back pending trustee access...', { trustorId, trusteeId });

    const db = getFirestore();

    // Find all inactive wrappedKeys granted by the trustor to this trustee
    const q = query(
      collection(db, 'wrappedKeys'),
      where('userId', '==', trusteeId),
      where('grantedBy', '==', trustorId),
      where('isActive', '==', false)
    );

    const snapshot = await getDocs(q);

    for (const wrappedKeyDoc of snapshot.docs) {
      const { recordId } = wrappedKeyDoc.data();

      try {
        // Remove from role arrays + trustees[] — we check all three role arrays
        // since we don't know which role they were granted without re-querying
        await updateDoc(doc(db, 'records', recordId), {
          owners: arrayRemove(trusteeId),
          administrators: arrayRemove(trusteeId),
          viewers: arrayRemove(trusteeId),
          trustees: arrayRemove(trusteeId),
        });

        // Delete the inactive wrappedKey
        await deleteDoc(wrappedKeyDoc.ref);

        console.log(`✅ Rolled back pending access on record ${recordId}`);
      } catch (err) {
        console.error(`⚠️ Failed to rollback access on record ${recordId}:`, err);
      }
    }

    console.log('✅ Pending trustee access rollback complete');
  }

  /**
   * Revoke all active trustee access when the trustor REVOKES or trustee RESIGNS.
   * Called by TrusteeRelationshipService on revoke or resign.
   * Blockchain revocation is handled upstream — this handles Firestore + wrappedKeys only.
   */
  static async revokeTrusteeAccess(trustorId: string, trusteeId: string): Promise<void> {
    console.log('🔄 Revoking active trustee access...', { trustorId, trusteeId });

    const db = getFirestore();

    // Find all active wrappedKeys for this trustee granted by the trustor
    const q = query(
      collection(db, 'wrappedKeys'),
      where('userId', '==', trusteeId),
      where('grantedBy', '==', trustorId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    for (const wrappedKeyDoc of snapshot.docs) {
      const { recordId } = wrappedKeyDoc.data();

      try {
        // Remove from all role arrays + trustees[]
        await updateDoc(doc(db, 'records', recordId), {
          owners: arrayRemove(trusteeId),
          administrators: arrayRemove(trusteeId),
          viewers: arrayRemove(trusteeId),
          trustees: arrayRemove(trusteeId),
        });

        // Deactivate rather than delete — preserves audit trail
        await updateDoc(wrappedKeyDoc.ref, {
          isActive: false,
          revokedAt: new Date(),
          revokedBy: trustorId,
        });

        console.log(`✅ Revoked access on record ${recordId}`);
      } catch (err) {
        console.error(`⚠️ Failed to revoke access on record ${recordId}:`, err);
      }
    }

    console.log('✅ Trustee access revocation complete');
  }

  /**
   * Fan out access to all active trustees when the trustor is added to a NEW record.
   * Called by SubjectService after addSubject succeeds — runs on whoever added the subject
   * (which must be the trustor or an admin with session key access).
   *
   * Mirrors grantPendingTrusteeAccess but for a single record and activates immediately
   * since existing trustees have already accepted.
   */
  static async grantAccessForNewRecord(subjectId: string, recordId: string): Promise<void> {
    console.log('🔄 Granting trustee access for new record...', { subjectId, recordId });

    const db = getFirestore();

    // Get active trustees for this subject
    const q = query(
      collection(db, 'trusteeRelationships'),
      where('trustorId', '==', subjectId),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('ℹ️ No active trustees for subject — nothing to fan out');
      return;
    }

    const recordDoc = await getDoc(doc(db, 'records', recordId));
    if (!recordDoc.exists()) throw new Error('Record not found');

    const recordData = recordDoc.data();
    let subjectRole: Role | null = null;
    if (recordData.owners?.includes(subjectId)) subjectRole = 'owner';
    else if (recordData.administrators?.includes(subjectId)) subjectRole = 'administrator';
    else if (recordData.viewers?.includes(subjectId)) subjectRole = 'viewer';

    for (const relationshipDoc of snapshot.docs) {
      const { trusteeId, trustLevel } = relationshipDoc.data();

      // Check trustee's current role to avoid redundant grants / unintended downgrades
      let currentTrusteeRole: Role | null = null;
      if (recordData.owners?.includes(trusteeId)) currentTrusteeRole = 'owner';
      else if (recordData.administrators?.includes(trusteeId)) currentTrusteeRole = 'administrator';
      else if (recordData.viewers?.includes(trusteeId)) currentTrusteeRole = 'viewer';

      const role = this.resolveTrusteeRole(
        trustLevel as TrustLevel,
        subjectRole,
        currentTrusteeRole
      );

      if (!role) {
        console.log(`ℹ️ Skipping trustee ${trusteeId} on record ${recordId} — no role needed`);
        continue;
      }

      try {
        // Blockchain grant for this single record
        const { success } = await TrusteeBlockchainService.grantRoleAsTrusteeBatch(
          subjectId,
          trusteeId,
          [recordId],
          [role]
        );
        if (!success) {
          console.error(
            `⚠️ Blockchain grant failed for trustee ${trusteeId} on record ${recordId}`
          );
          continue;
        }

        // Active wrappedKey since trustee already accepted the relationship
        await SharingService.grantEncryptionAccess(recordId, trusteeId, subjectId);

        // Only tag as trustee-derived if they didn't already have independent access
        await updateDoc(doc(db, 'records', recordId), {
          owners: arrayRemove(trusteeId),
          administrators: arrayRemove(trusteeId),
          viewers: arrayRemove(trusteeId),
          [this.roleToArray(role)]: arrayUnion(trusteeId),
          ...(!currentTrusteeRole && { trustees: arrayUnion(trusteeId) }),
        });

        console.log(`✅ Trustee ${trusteeId} granted ${role} on new record ${recordId}`);
      } catch (err) {
        console.error(`⚠️ Failed to grant trustee ${trusteeId} access on record ${recordId}:`, err);
      }
    }

    console.log(`✅ Trustee fan-out complete for new record ${recordId}`);
  }

  /**
   * Update trustee's role across all trustor records when trust level changes.
   * Called by TrusteeRelationshipService.editTrusteeRelationship.
   */
  static async updateTrusteeAccess(
    trustorId: string,
    trusteeId: string,
    newTrustLevel: TrustLevel
  ): Promise<void> {
    console.log('🔄 Updating trustee access across records...', {
      trustorId,
      trusteeId,
      newTrustLevel,
    });

    const db = getFirestore();
    const records = await this.getRecordsForTrustor(trustorId);

    if (records.length === 0) {
      console.log('ℹ️ No records found for trustor — nothing to update');
      return;
    }

    const accessList: TrusteeRecordAccess[] = records
      .map(({ recordId, trustorRole }) => ({
        recordId,
        role: this.resolveTrusteeRole(newTrustLevel, trustorRole),
      }))
      .filter((r): r is TrusteeRecordAccess => r.role !== null);

    if (accessList.length === 0) {
      console.log('ℹ️ Trustor has no roles on any records — nothing to update');
      return;
    }

    for (const { recordId, role } of accessList) {
      try {
        // After (removes from all first, then adds to correct one)
        await updateDoc(doc(db, 'records', recordId), {
          owners: arrayRemove(trusteeId),
          administrators: arrayRemove(trusteeId),
          viewers: arrayRemove(trusteeId),
          [this.roleToArray(role)]: arrayUnion(trusteeId),
        });

        console.log(`✅ Updated ${trusteeId} to ${role} on record ${recordId}`);
      } catch (err) {
        console.error(`⚠️ Failed to update role on record ${recordId}:`, err);
      }
    }

    console.log(`✅ Trustee access update complete: ${accessList.length} records`);
  }
}
