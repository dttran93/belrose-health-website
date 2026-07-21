// functions/test/checkEmailRegistrationStatus.test.ts
//
// Spike test for the new Cloud Functions test layer (see root test plan): proves the
// `.run()` calling convention works end-to-end against the real Auth + Firestore
// emulators before the rest of the Auth/Dependents/GuestAccess Functions suites are
// built on top of it. checkEmailRegistrationStatus is a v1-style onCall handler
// (Runnable.run(data, context)) and has no blockchain/email dependencies to mock,
// making it the cheapest possible smoke test for the whole layer.

import { beforeEach, describe, expect, it } from 'vitest';
import * as admin from 'firebase-admin';
import { checkEmailRegistrationStatus } from '../src/handlers/checkEmailRegistrationStatus';
import { clearFirestore, deleteAllAuthUsers } from './helpers/testAdmin';
import { buildRequest } from './helpers/callableRequest';

describe('checkEmailRegistrationStatus', () => {
  beforeEach(async () => {
    await clearFirestore();
    await deleteAllAuthUsers();
  });

  it('throws invalid-argument when email is missing', async () => {
    await expect(checkEmailRegistrationStatus.run(buildRequest({}))).rejects.toThrow(
      'valid email string'
    );
  });

  it('returns isRegistered:false when no Auth account exists for the email', async () => {
    const result = await checkEmailRegistrationStatus.run(
      buildRequest({ email: 'nobody@example.com' })
    );
    expect(result).toEqual({ isRegistered: false });
  });

  it('returns isRegistered:false when the Auth account has no Firestore user doc', async () => {
    await admin.auth().createUser({ email: 'noprofile@example.com' });

    const result = await checkEmailRegistrationStatus.run(
      buildRequest({ email: 'noprofile@example.com' })
    );
    expect(result).toEqual({ isRegistered: false });
  });

  it('returns isRegistered:false for a guest-only account', async () => {
    const userRecord = await admin.auth().createUser({ email: 'guest@example.com' });
    await admin.firestore().collection('users').doc(userRecord.uid).set({ isGuest: true });

    const result = await checkEmailRegistrationStatus.run(
      buildRequest({ email: 'guest@example.com' })
    );
    expect(result).toEqual({ isRegistered: false });
  });

  it('returns isRegistered:true for a full registered account', async () => {
    const userRecord = await admin.auth().createUser({ email: 'real@example.com' });
    await admin.firestore().collection('users').doc(userRecord.uid).set({ isGuest: false });

    const result = await checkEmailRegistrationStatus.run(
      buildRequest({ email: 'real@example.com' })
    );
    expect(result).toEqual({ isRegistered: true });
  });
});
