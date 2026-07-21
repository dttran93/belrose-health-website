// test/rules/guestInvites.test.ts
//
// firestore.rules — guestInvites/{inviteId} — see firestore.rules "GUEST INVITES" section.
// Docs are created server-side only (writeGuestInviteDoc, Admin SDK) — clients can only read
// their own invite (as guest or inviter) and flip status to 'accepted' when claiming
// (GuestClaimAccountModal Step 5). No create/delete rule exists client-side; permanent audit
// trail.

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const GUEST = 'guest-uid';
const INVITER = 'inviter-uid';
const STRANGER = 'stranger-uid';
const INVITE_ID = 'invite-1';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'belrose-rules-test-guest-invites',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(() => testEnv.cleanup());
beforeEach(() => testEnv.clearFirestore());

function invitePath(id: string = INVITE_ID) {
  return `guestInvites/${id}`;
}

async function seedInvite(overrides: Record<string, unknown> = {}) {
  const data = {
    guestUserId: GUEST,
    invitedBy: INVITER,
    guestEmail: 'guest@example.com',
    recordIds: ['rec-1'],
    status: 'pending',
    context: 'sharing',
    isNewGuest: true,
    inviteCode: 'code-abc',
    ...overrides,
  };
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc(invitePath()).set(data);
  });
  return data;
}

describe('firestore.rules — guestInvites — read', () => {
  it('allows the guest (guestUserId match) to read their own invite', async () => {
    await seedInvite();
    await assertSucceeds(testEnv.authenticatedContext(GUEST).firestore().doc(invitePath()).get());
  });

  it('allows the inviter (invitedBy match) to read the invite', async () => {
    await seedInvite();
    await assertSucceeds(testEnv.authenticatedContext(INVITER).firestore().doc(invitePath()).get());
  });

  it('denies a stranger from reading the invite', async () => {
    await seedInvite();
    await assertFails(testEnv.authenticatedContext(STRANGER).firestore().doc(invitePath()).get());
  });

  it('denies unauthenticated read', async () => {
    await seedInvite();
    await assertFails(testEnv.unauthenticatedContext().firestore().doc(invitePath()).get());
  });
});

describe('firestore.rules — guestInvites — create', () => {
  it('denies client create — no create rule exists, guestInvites are admin-SDK-only', async () => {
    await assertFails(
      testEnv
        .authenticatedContext(INVITER)
        .firestore()
        .doc(invitePath())
        .set({ guestUserId: GUEST, invitedBy: INVITER, status: 'pending' })
    );
  });
});

describe('firestore.rules — guestInvites — update', () => {
  it('lets the guest mark their own invite accepted with a claimedAt stamp', async () => {
    await seedInvite();
    await assertSucceeds(
      testEnv
        .authenticatedContext(GUEST)
        .firestore()
        .doc(invitePath())
        .update({ status: 'accepted', claimedAt: new Date().toISOString() })
    );
  });

  it('lets the guest mark accepted with just status alone (claimedAt is optional in the allowlist)', async () => {
    await seedInvite();
    await assertSucceeds(
      testEnv.authenticatedContext(GUEST).firestore().doc(invitePath()).update({ status: 'accepted' })
    );
  });

  it('denies setting status to anything other than accepted', async () => {
    await seedInvite();
    await assertFails(
      testEnv.authenticatedContext(GUEST).firestore().doc(invitePath()).update({ status: 'pending' })
    );
  });

  it('denies the invitedBy inviter from marking the invite accepted — only the guest can', async () => {
    await seedInvite();
    await assertFails(
      testEnv.authenticatedContext(INVITER).firestore().doc(invitePath()).update({ status: 'accepted' })
    );
  });

  it('denies a stranger from marking the invite accepted', async () => {
    await seedInvite();
    await assertFails(
      testEnv.authenticatedContext(STRANGER).firestore().doc(invitePath()).update({ status: 'accepted' })
    );
  });

  it('denies unauthenticated update', async () => {
    await seedInvite();
    await assertFails(
      testEnv.unauthenticatedContext().firestore().doc(invitePath()).update({ status: 'accepted' })
    );
  });

  it('denies a write that touches a field outside the allowlist alongside the allowed ones', async () => {
    await seedInvite();
    await assertFails(
      testEnv
        .authenticatedContext(GUEST)
        .firestore()
        .doc(invitePath())
        .update({ status: 'accepted', recordIds: ['rec-1', 'rec-2'] })
    );
  });
});

describe('firestore.rules — guestInvites — delete', () => {
  it('denies delete — permanent audit trail', async () => {
    await seedInvite();
    await assertFails(testEnv.authenticatedContext(GUEST).firestore().doc(invitePath()).delete());
  });

  it('denies delete even for the inviter', async () => {
    await seedInvite();
    await assertFails(testEnv.authenticatedContext(INVITER).firestore().doc(invitePath()).delete());
  });
});
