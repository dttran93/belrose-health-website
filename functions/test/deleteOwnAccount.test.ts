// functions/test/deleteOwnAccount.test.ts
//
// Functions layer — deleteOwnAccount is the final step of self-service account deletion
// (AccountDeletionService.deleteMyAccount). By the time it's called, the client has already
// cleaned up records/trustee relationships/its own requestedBy subject requests and deleted the
// users/{uid} doc — this handler only does what the Admin SDK is needed for: sweeping pending
// subjectConsentRequests/subjectRemovalRequests where the caller is the target subjectId (not the
// requester — Firestore rules don't let a subject delete those directly), and deleting the
// Firebase Auth user.

import { beforeEach, describe, expect, it } from 'vitest';
import * as admin from 'firebase-admin';
import { buildRequest } from './helpers/callableRequest';
import { clearFirestore, deleteAllAuthUsers } from './helpers/testAdmin';

import { deleteOwnAccount } from '../src/handlers/deleteOwnAccount';

const UID = 'delete-own-account-uid';

beforeEach(async () => {
  await clearFirestore();
  await deleteAllAuthUsers();
  await admin.auth().createUser({ uid: UID, email: `${UID}@example.com` });
});

describe('deleteOwnAccount — guard clauses', () => {
  it('throws unauthenticated when there is no caller', async () => {
    await expect(deleteOwnAccount.run(buildRequest({}))).rejects.toThrow('authenticated');
  });
});

describe('deleteOwnAccount — subject request sweep', () => {
  it("deletes the caller's own pending subjectConsentRequests where they're the target subject", async () => {
    await admin.firestore().collection('subjectConsentRequests').doc('rec1_' + UID).set({
      recordId: 'rec1',
      subjectId: UID,
      requestedBy: 'someone-else',
      status: 'pending',
    });

    await deleteOwnAccount.run(buildRequest({}, UID));

    const snap = await admin
      .firestore()
      .collection('subjectConsentRequests')
      .doc('rec1_' + UID)
      .get();
    expect(snap.exists).toBe(false);
  });

  it("deletes the caller's own pending subjectRemovalRequests where they're the target subject", async () => {
    await admin.firestore().collection('subjectRemovalRequests').doc('rec2_' + UID).set({
      recordId: 'rec2',
      subjectId: UID,
      requestedBy: 'someone-else',
      status: 'pending',
    });

    await deleteOwnAccount.run(buildRequest({}, UID));

    const snap = await admin
      .firestore()
      .collection('subjectRemovalRequests')
      .doc('rec2_' + UID)
      .get();
    expect(snap.exists).toBe(false);
  });

  it('leaves another user\'s pending subject requests untouched', async () => {
    await admin.firestore().collection('subjectConsentRequests').doc('rec3_other-user').set({
      recordId: 'rec3',
      subjectId: 'other-user',
      requestedBy: 'someone-else',
      status: 'pending',
    });

    await deleteOwnAccount.run(buildRequest({}, UID));

    const snap = await admin
      .firestore()
      .collection('subjectConsentRequests')
      .doc('rec3_other-user')
      .get();
    expect(snap.exists).toBe(true);
  });

  it('leaves a non-pending subject request where the caller is the target subject untouched', async () => {
    await admin.firestore().collection('subjectConsentRequests').doc('rec4_' + UID).set({
      recordId: 'rec4',
      subjectId: UID,
      requestedBy: 'someone-else',
      status: 'accepted',
    });

    await deleteOwnAccount.run(buildRequest({}, UID));

    const snap = await admin
      .firestore()
      .collection('subjectConsentRequests')
      .doc('rec4_' + UID)
      .get();
    expect(snap.exists).toBe(true);
  });
});

describe('deleteOwnAccount — Auth user deletion', () => {
  it('deletes the calling user\'s own Firebase Auth account', async () => {
    const result = await deleteOwnAccount.run(buildRequest({}, UID));
    expect(result).toEqual({ success: true });

    await expect(admin.auth().getUser(UID)).rejects.toThrow();
  });
});
