// functions/test/guestPasswordUpdate.test.ts
//
// Functions layer — guestPasswordUpdate: sets a guest's Auth password via the Admin SDK,
// bypassing Firebase's 5-minute recent-login requirement (guests routinely exceed it, since
// they land on the claim flow well after their custom-token sign-in). Gated on the caller
// actually having a pending guestInvites doc, so a stranger can't password-reset an arbitrary
// account just by knowing its uid.

import { beforeEach, describe, expect, it } from 'vitest';
import * as admin from 'firebase-admin';
import { buildRequest } from './helpers/callableRequest';
import { clearFirestore, deleteAllAuthUsers } from './helpers/testAdmin';

import { guestPasswordUpdate } from '../src/handlers/guestPasswordUpdate';

const GUEST_UID = 'guest-1';

async function seedGuestAuthUser() {
  await admin.auth().createUser({ uid: GUEST_UID, email: 'guest@example.com', password: 'old-password' });
}

async function seedPendingInvite(overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .collection('guestInvites')
    .add({ guestUserId: GUEST_UID, status: 'pending', ...overrides });
}

beforeEach(async () => {
  await clearFirestore();
  await deleteAllAuthUsers();
});

describe('guestPasswordUpdate — guard clauses', () => {
  it('throws unauthenticated when there is no caller', async () => {
    await expect(
      guestPasswordUpdate.run(buildRequest({ newPassword: 'newpassword123' }))
    ).rejects.toThrow('Not signed in');
  });

  it('throws invalid-argument when newPassword is missing', async () => {
    await expect(guestPasswordUpdate.run(buildRequest({}, GUEST_UID))).rejects.toThrow(
      'at least 8 characters'
    );
  });

  it('throws invalid-argument when newPassword is under 8 characters', async () => {
    await expect(
      guestPasswordUpdate.run(buildRequest({ newPassword: 'short' }, GUEST_UID))
    ).rejects.toThrow('at least 8 characters');
  });

  it('throws permission-denied when the caller has no pending guestInvites doc', async () => {
    await seedGuestAuthUser();
    // No invite seeded at all — not a guest account by this handler's definition.

    await expect(
      guestPasswordUpdate.run(buildRequest({ newPassword: 'newpassword123' }, GUEST_UID))
    ).rejects.toThrow('Not an active guest account');
  });

  it('throws permission-denied when the caller\'s only invite is already accepted', async () => {
    await seedGuestAuthUser();
    await seedPendingInvite({ status: 'accepted' });

    await expect(
      guestPasswordUpdate.run(buildRequest({ newPassword: 'newpassword123' }, GUEST_UID))
    ).rejects.toThrow('Not an active guest account');
  });
});

describe('guestPasswordUpdate — happy path', () => {
  it('updates the Auth password and returns a fresh custom token', async () => {
    await seedGuestAuthUser();
    await seedPendingInvite();

    const result: any = await guestPasswordUpdate.run(
      buildRequest({ newPassword: 'newpassword123' }, GUEST_UID)
    );

    expect(result.success).toBe(true);
    expect(typeof result.customToken).toBe('string');
    expect(result.customToken.length).toBeGreaterThan(0);
  });

  it('does not touch the guestInvites doc itself — that is Step 5, a separate client write', async () => {
    await seedGuestAuthUser();
    await seedPendingInvite();

    await guestPasswordUpdate.run(buildRequest({ newPassword: 'newpassword123' }, GUEST_UID));

    const inviteSnap = await admin
      .firestore()
      .collection('guestInvites')
      .where('guestUserId', '==', GUEST_UID)
      .get();
    expect(inviteSnap.docs[0]!.data().status).toBe('pending');
  });
});
