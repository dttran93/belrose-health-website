// functions/test/redeemGuestInvite.test.ts
//
// Functions layer — redeemGuestInvite: mints a fresh custom token for a guest clicking their
// invite link. No auth required (the invite code itself is the credential — this runs before
// the guest has ever signed in). Custom tokens expire in 1 hour, so this is called fresh on
// every click; the underlying guestInvites doc's own expiresAt is the real expiry gate.

import { beforeEach, describe, expect, it } from 'vitest';
import * as admin from 'firebase-admin';
import { buildRequest } from './helpers/callableRequest';
import { clearFirestore, deleteAllAuthUsers } from './helpers/testAdmin';

import { redeemGuestInvite } from '../src/handlers/redeemGuestInvite';

const GUEST_UID = 'guest-1';

async function seedGuestAuthUser() {
  await admin.auth().createUser({ uid: GUEST_UID, email: 'guest@example.com' });
}

async function seedInvite(overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .collection('guestInvites')
    .add({
      guestUserId: GUEST_UID,
      invitedBy: 'patient-1',
      guestEmail: 'guest@example.com',
      recordIds: ['rec-1'],
      status: 'pending',
      context: 'sharing',
      inviteCode: 'code-abc',
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 60_000)),
      isNewGuest: true,
      ...overrides,
    });
}

beforeEach(async () => {
  await clearFirestore();
  await deleteAllAuthUsers();
});

describe('redeemGuestInvite — guard clauses', () => {
  it('throws invalid-argument when inviteCode is missing', async () => {
    await expect(redeemGuestInvite.run(buildRequest({}))).rejects.toThrow('required');
  });

  it('throws not-found when no invite matches the code', async () => {
    await expect(
      redeemGuestInvite.run(buildRequest({ inviteCode: 'no-such-code' }))
    ).rejects.toThrow('not found');
  });

  it('throws not-found when the matching invite is already accepted (not pending)', async () => {
    await seedGuestAuthUser();
    await seedInvite({ status: 'accepted' });

    await expect(
      redeemGuestInvite.run(buildRequest({ inviteCode: 'code-abc' }))
    ).rejects.toThrow('not found');
  });

  it('throws failed-precondition when the invite has expired', async () => {
    await seedGuestAuthUser();
    await seedInvite({ expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 60_000)) });

    await expect(
      redeemGuestInvite.run(buildRequest({ inviteCode: 'code-abc' }))
    ).rejects.toThrow('expired');
  });
});

describe('redeemGuestInvite — happy path', () => {
  it('mints a custom token for the invite\'s guestUserId', async () => {
    await seedGuestAuthUser();
    await seedInvite();

    const result: any = await redeemGuestInvite.run(buildRequest({ inviteCode: 'code-abc' }));

    expect(result.guestUid).toBe(GUEST_UID);
    expect(typeof result.customToken).toBe('string');
    expect(result.customToken.length).toBeGreaterThan(0);
  });

  it('does not flip the invite status — redemption is repeatable until claimed', async () => {
    await seedGuestAuthUser();
    await seedInvite();

    await redeemGuestInvite.run(buildRequest({ inviteCode: 'code-abc' }));
    // Clicking the link again should still work — status is only flipped at claim time
    // (GuestClaimAccountModal Step 5), not at redemption.
    await expect(
      redeemGuestInvite.run(buildRequest({ inviteCode: 'code-abc' }))
    ).resolves.toMatchObject({ guestUid: GUEST_UID });
  });
});
