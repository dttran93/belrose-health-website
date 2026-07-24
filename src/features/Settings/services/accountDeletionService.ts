// src/features/Settings/services/accountDeletionService.ts
//
// Self-service account deletion. Always operates on the currently authenticated
// user (getAuth().currentUser) — there is no "delete someone else's account" path
// here. For dependents, the guardian switches into the dependent's session first
// (see AccountSwitchService) so this runs with the dependent's own live signer,
// which is what lets on-chain trustee revocation (onlyActiveMember) actually succeed.

import { getAuth, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, collection, doc, deleteDoc, getDocs, or, query, where } from 'firebase/firestore';
import { FileObject } from '@/types/core';
import mapFirestoreToFileObject from '@/features/ViewEditRecord/utils/firestoreMapping';
import { PermissionsService } from '@/features/Permissions/services/permissionsService';
import RecordDeletionService from '@/features/ViewEditRecord/services/recordDeletionService';
import { SubjectService } from '@/features/Subject/services/subjectService';
import { TrusteeRelationshipService } from '@/features/Trustee/services/trusteeRelationshipService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';

export type DeletionPhase = 'records' | 'trustees' | 'subject-requests' | 'profile' | 'account';

export interface RecordCleanupFailure {
  recordId: string;
  error: string;
}

export interface DeleteMyAccountResult {
  recordFailures: RecordCleanupFailure[];
}

async function getRecordsForUser(uid: string): Promise<FileObject[]> {
  const db = getFirestore();
  const q = query(
    collection(db, 'records'),
    or(
      where('uploadedBy', '==', uid),
      where('owners', 'array-contains', uid),
      where('administrators', 'array-contains', uid),
      where('sharers', 'array-contains', uid),
      where('viewers', 'array-contains', uid),
      where('subjects', 'array-contains', uid)
    )
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => mapFirestoreToFileObject(d.id, d.data()));
}

/**
 * Deletes solo-owned records outright, strips the user's role from shared ones.
 * Unanchors the user as subject first (SubjectService.rejectSubjectStatus) when
 * applicable — deleteRecord/checkDeletionPermissions both assume that's already
 * happened, since subjects can only ever unanchor themselves.
 */
async function cleanUpRecord(record: FileObject, uid: string): Promise<void> {
  if (record.subjects?.includes(uid)) {
    await SubjectService.rejectSubjectStatus(record.id, 'other');
  }

  const hasOtherRole =
    PermissionsService.getUserRole(
      {
        owners: record.owners ?? [],
        administrators: record.administrators ?? [],
        sharers: record.sharers ?? [],
        viewers: record.viewers ?? [],
      },
      uid
    ) !== null;

  if (!hasOtherRole) return;

  const check = await RecordDeletionService.checkDeletionPermissions(record, uid);
  if (check.canDelete) {
    await RecordDeletionService.deleteRecord(record, uid);
  } else {
    await RecordDeletionService.removeUserFromRecord(record, uid);
  }
}

/**
 * Cancels the user's own pending subject-consent/removal requests on records
 * they don't otherwise own (so getRecordsForUser never touched them). Requests
 * where the user is the *target* subject, not the requester, aren't covered here
 * — Firestore rules don't let a subject delete those directly; deleteOwnAccount
 * sweeps those server-side with the Admin SDK instead.
 */
async function cancelOwnPendingSubjectRequests(uid: string): Promise<void> {
  const db = getFirestore();

  for (const collectionName of ['subjectConsentRequests', 'subjectRemovalRequests'] as const) {
    const q = query(
      collection(db, collectionName),
      where('requestedBy', '==', uid),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
  }
}

export class AccountDeletionService {
  static async deleteMyAccount(
    onProgress?: (phase: DeletionPhase) => void
  ): Promise<DeleteMyAccountResult> {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    const recordFailures: RecordCleanupFailure[] = [];

    // Step 1: records — delete solo-owned, strip role from shared
    onProgress?.('records');
    const records = await getRecordsForUser(uid);
    for (const record of records) {
      try {
        await cleanUpRecord(record, uid);
      } catch (err: any) {
        console.error(`❌ Failed to clean up record ${record.id} during account deletion:`, err);
        recordFailures.push({ recordId: record.id, error: err?.message || 'Unknown error' });
      }
    }

    // Step 2: trustee relationships, both directions — real on-chain revoke/resign
    // since this runs with the current user's own live signer.
    onProgress?.('trustees');
    const [asTrustor, asTrustee] = await Promise.all([
      TrusteeRelationshipService.getTrusteesForTrustor(uid),
      TrusteeRelationshipService.getTrustorAccountsForTrustee(),
    ]);
    for (const rel of asTrustor) {
      await TrusteeRelationshipService.revokeTrustee(rel.trusteeId);
    }
    for (const rel of asTrustee) {
      await TrusteeRelationshipService.resignAsTrustee(rel.trustorId);
    }

    // Step 3: orphaned subject requests the user initiated on records they don't own
    onProgress?.('subject-requests');
    await cancelOwnPendingSubjectRequests(uid);

    // Step 4: Firestore user doc (self-delete already permitted by firestore.rules)
    onProgress?.('profile');
    await deleteDoc(doc(getFirestore(), 'users', uid));

    // Step 5: Firebase Auth user — server-side to avoid the client SDK's
    // "requires recent login" failure after this long an async sequence.
    onProgress?.('account');
    const deleteOwnAccount = httpsCallable(getFunctions(), 'deleteOwnAccount');
    await deleteOwnAccount({});

    // Step 6: client wrap-up
    EncryptionKeyManager.clearSession();
    await signOut(auth);

    return { recordFailures };
  }
}
