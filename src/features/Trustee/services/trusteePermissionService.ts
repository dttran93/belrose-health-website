// src/features/Trustee/services/trusteePermissionService.ts

/**
 * TrusteePermissionService
 *
 * Handles the fan-out of permissions when a trustee relationship is accepted or revoked.
 * Called by TrusteeRelationshipService — does NOT manage the relationship itself.
 *
 * For each record where the trustor is a subject:
 *  - Grants/revokes the appropriate role on blockchain (via grantRoleAsTrusteeBatch)
 *  - Grants/revokes encryption access (via SharingService)
 *  - Updates Firestore arrays (viewers/administrators/owners)
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
} from 'firebase/firestore';
import { TrusteeBlockchainService } from './trusteeBlockchainService';
import { TrustLevel } from './trusteeRelationshipService';
import { PermissionsService, Role } from '@/features/Permissions/services/permissionsService';

interface TrusteeRecordAccess {
  recordId: string;
  role: Role;
}

export class TrusteePermissionService {
  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Query all records where the trustor is an active subject
   */
  private static async getRecordsForTrustor(
    trustorId: string
  ): Promise<{ recordId: string; trustorRole: Role | null }[]> {
    const db = getFirestore();
    const q = query(collection(db, 'records'), where('subjects', 'array-contains', trustorId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => {
      const data = d.data();
      let trustorRole: Role | null = null;
      if (data.owners?.includes(trustorId)) trustorRole = 'owner';
      else if (data.administrators?.includes(trustorId)) trustorRole = 'administrator';
      else if (data.viewers?.includes(trustorId)) trustorRole = 'viewer';

      return { recordId: d.id, trustorRole };
    });
  }

  /**
   * Resolve what role the trustee should get based on trust level and trustor's role
   * Mirrors _resolveTrusteeRole in MemberRoleManager.sol
   */
  private static resolveTrusteeRole(trustLevel: TrustLevel, trustorRole: Role | null): Role | null {
    if (trustLevel === 'observer') return 'viewer';
    if (!trustorRole) return null; // trustor has no role on this record — skip it

    if (trustLevel === 'custodian') {
      return trustorRole === 'owner' ? 'administrator' : trustorRole;
    }

    // controller — full mirror
    return trustorRole;
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Fan out access to all trustor records when a trustee accepts an invite.
   * Called by TrusteeRelationshipService.acceptInvite after blockchain acceptance.
   *
   * Flow:
   *  1. Query all records where trustor is a subject
   *  2. Resolve what role the trustee should get per record
   *  3. Batch grant roles on blockchain (one tx)
   *  4. Grant encryption access per record
   *  5. Update Firestore arrays per record
   */
  static async grantTrusteeAccess(
    trustorId: string,
    trusteeId: string,
    trustLevel: TrustLevel
  ): Promise<void> {
    console.log('🔄 Fanning out trustee access...', { trustorId, trusteeId, trustLevel });

    const records = await this.getRecordsForTrustor(trustorId);

    if (records.length === 0) {
      console.log('ℹ️ No records found for trustor — nothing to fan out');
      return;
    }

    // Resolve role per record, filter out records where trustor has no role
    const accessList: TrusteeRecordAccess[] = records
      .map(({ recordId, trustorRole }) => ({
        recordId,
        role: this.resolveTrusteeRole(trustLevel, trustorRole),
      }))
      .filter((r): r is TrusteeRecordAccess => r.role !== null);

    if (accessList.length === 0) {
      console.log('ℹ️ Trustor has no roles on any records — nothing to grant');
      return;
    }

    const recordIds = accessList.map(r => r.recordId);

    // Step 1: Batch grant on blockchain
    console.log(`🔗 Batch granting blockchain roles across ${recordIds.length} records...`);
    const { success } = await TrusteeBlockchainService.grantRoleAsTrusteeBatch(
      trustorId,
      trusteeId,
      recordIds
    );
    if (!success) throw new Error('Blockchain batch grant failed — see sync queue for details');
    console.log('✅ Blockchain batch grant complete');

    // Step 2: Grant Firestore + encryption via PermissionsService, get back which records got access through trustee
    const succeededIds = await PermissionsService.grantRoleBatch(
      recordIds,
      trusteeId,
      accessList.map(r => r.role)
    );

    // Step 3: Mark trustee-derived access only on records that got the grant above
    const db = getFirestore();
    for (const recordId of succeededIds) {
      await updateDoc(doc(db, 'records, recordId'), {
        trustees: arrayUnion(trusteeId),
      });
      console.log(`✅ Marked ${trusteeId} as trustee on record ${recordId}`);
    }

    console.log(`✅ Trustee access fan-out complete: ${recordIds.length} records updated`);
  }

  /**
   * Revoke access from all trustor records when a trustee relationship ends.
   * Called by TrusteeRelationshipService on revoke or resign.
   * Blockchain revocation is handled upstream — this handles Firestore + encryption only.
   *
   * Note: revokeRoleBatch is a general-purpose function so it lives in
   * BlockchainRoleManagerService, not TrusteeBlockchainService. The on-chain
   * revoke of the relationship itself (revokeTrustee) is called before this.
   */
  static async revokeTrusteeAccess(trustorId: string, trusteeId: string): Promise<void> {
    console.log('🔄 Revoking trustee access across records...', { trustorId, trusteeId });

    const records = await this.getRecordsForTrustor(trustorId);

    if (records.length === 0) {
      console.log('ℹ️ No records found for trustor — nothing to revoke');
      return;
    }

    const recordIds = records.map(r => r.recordId);

    // Revoke blockchain record role, encryption access + Firestore via PermissionService
    await PermissionsService.revokeRoleBatch(recordIds, trusteeId);

    console.log(`✅ Trustee access revocation complete: ${recordIds.length} records updated`);
  }

  /**
   * Update trustee's role across all trustor records when trust level changes.
   * Called by TrusteeRelationshipService.editTrusteeRelationship.
   * Uses changeRoleBatch on blockchain, then updates Firestore arrays.
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

    // Change blockchain record roles, encryption access + Firestore via PermissionsService
    await PermissionsService.changeRoleBatch(
      accessList.map(r => r.recordId),
      trusteeId,
      accessList.map(r => r.role)
    );

    console.log(`✅ Trustee access update complete: ${accessList.length} records updated`);
  }

  /**
   * Query all active trustee relationships for a given trustor (subject)
   */
  private static async getActiveTrusteesForSubject(
    subjectId: string
  ): Promise<{ trusteeId: string; trustLevel: TrustLevel }[]> {
    const db = getFirestore();
    const q = query(
      collection(db, 'trusteeRelationships'),
      where('trustorId', '==', subjectId),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      trusteeId: d.data().trusteeId,
      trustLevel: d.data().trustLevel as TrustLevel,
    }));
  }

  /**
   * Fan out access to all active trustees when a subject is added to a new record.
   * Called by SubjectService after addSubject succeeds.
   */
  static async grantAccessForNewRecord(subjectId: string, recordId: string): Promise<void> {
    console.log('🔄 Granting trustee access for new record...', { subjectId, recordId });

    const trustees = await this.getActiveTrusteesForSubject(subjectId);

    if (trustees.length === 0) {
      console.log('ℹ️ No active trustees for subject — nothing to fan out');
      return;
    }

    const db = getFirestore();
    const recordDoc = await getDoc(doc(db, 'records', recordId));
    if (!recordDoc.exists()) throw new Error('Record not found');

    const recordData = recordDoc.data();
    let subjectRole: Role | null = null;
    if (recordData.owners?.includes(subjectId)) subjectRole = 'owner';
    else if (recordData.administrators?.includes(subjectId)) subjectRole = 'administrator';
    else if (recordData.viewers?.includes(subjectId)) subjectRole = 'viewer';

    for (const { trusteeId, trustLevel } of trustees) {
      const role = this.resolveTrusteeRole(trustLevel, subjectRole);
      if (!role) {
        console.log(`ℹ️ Subject has no role on record ${recordId} — skipping trustee ${trusteeId}`);
        continue;
      }

      // Blockchain — trustee claims access for this single record
      const { success } = await TrusteeBlockchainService.grantRoleAsTrusteeBatch(
        subjectId,
        trusteeId,
        [recordId]
      );
      if (!success) {
        console.error(`⚠️ Blockchain grant failed for trustee ${trusteeId} on record ${recordId}`);
        continue;
      }

      // Firestore + encryption via PermissionsService
      const succeededIds = await PermissionsService.grantRoleBatch([recordId], trusteeId, [role]);

      // Mark as trustee-derived only if grant succeeded
      if (succeededIds.length > 0) {
        await updateDoc(doc(db, 'records', recordId), {
          trustees: arrayUnion(trusteeId),
        });
        console.log(`✅ Trustee ${trusteeId} granted ${role} on new record ${recordId}`);
      }
    }

    console.log(`✅ Trustee fan-out complete for new record ${recordId}`);
  }

  /**
   * Revoke trustee access on a record when the subject is removed.
   * Only revokes trustees who got access via the trustee relationship (in trustees array).
   * Trustees with independent access keep their role but are removed from trustees array.
   * Called by SubjectService after removeSubject succeeds.
   */
  static async revokeAccessOnSubjectRemoval(subjectId: string, recordId: string): Promise<void> {
    console.log('🔄 Revoking trustee access on subject removal...', { subjectId, recordId });

    const db = getFirestore();
    const recordDoc = await getDoc(doc(db, 'records', recordId));
    if (!recordDoc.exists()) throw new Error('Record not found');

    const recordData = recordDoc.data();
    const trusteesOnRecord: string[] = recordData.trustees ?? [];

    if (trusteesOnRecord.length === 0) {
      console.log('ℹ️ No trustees on this record — nothing to revoke');
      return;
    }

    // Get remaining subjects on the record AFTER this subject is removed
    const remainingSubjects: string[] = (recordData.subjects ?? []).filter(
      (id: string) => id !== subjectId
    );

    // Get active trustees of the subject being removed
    const removedSubjectTrustees = await this.getActiveTrusteesForSubject(subjectId);
    const removedSubjectTrusteeIds = new Set(removedSubjectTrustees.map(t => t.trusteeId));

    // For each remaining subject, get their active trustees
    // so we know who still has legitimate trustee access via another subject
    const retainedTrusteeIds = new Set<string>();
    for (const remainingSubjectId of remainingSubjects) {
      const trustees = await this.getActiveTrusteesForSubject(remainingSubjectId);
      for (const { trusteeId } of trustees) {
        retainedTrusteeIds.add(trusteeId);
      }
    }

    for (const trusteeId of trusteesOnRecord) {
      // Not a trustee of the removed subject — skip
      if (!removedSubjectTrusteeIds.has(trusteeId)) continue;

      // Still has access via another subject on this record — skip revocation
      // but we still need to leave them in trustees array since access remains valid
      if (retainedTrusteeIds.has(trusteeId)) {
        console.log(
          `ℹ️ Trustee ${trusteeId} still has access via another subject — keeping access`
        );
        continue;
      }

      // Safe to revoke — only had access through the removed subject
      await PermissionsService.revokeRoleBatch([recordId], trusteeId);
      await updateDoc(doc(db, 'records', recordId), {
        trustees: arrayRemove(trusteeId),
      });

      console.log(`✅ Trustee ${trusteeId} access revoked on record ${recordId}`);
    }

    console.log(`✅ Trustee access revocation complete for record ${recordId}`);
  }
}
