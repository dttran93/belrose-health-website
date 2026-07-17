// test/rules/invites.test.ts
//
// firestore.rules — invites/{email} and waitlist/{email} — the alpha-gate collections
// AlphaGateScreen/WaitlistForm read/write before a user has an account (so `read`/`create`
// on these collections are intentionally public in places — see rule comments).
//
// invites/{email}'s `update` rule used to only check the write was limited to
// ['registeredUserId', 'registeredAt'] — it never checked the caller against the document at
// all, so any authenticated user (not just the actual invitee) could stamp those fields on
// someone else's invite doc. Fixed to require request.auth.token.email (lowered) match the
// invite's email AND request.resource.data.registeredUserId equal the caller's own uid.
// The email comparison is lowered because RegistrationForm/BelroseAccountForm don't lowercase
// the email before Firebase Auth signup, while this doc's id is always lowercased — see the
// case-insensitivity test below, which pins that specifically.

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const INVITEE_EMAIL = 'invitee@example.com';
const REGISTERING_UID = 'registering-uid';
const STRANGER = 'stranger-uid';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'belrose-rules-test-invites',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(() => testEnv.cleanup());
beforeEach(() => testEnv.clearFirestore());

function invitePath(email: string) {
  return `invites/${email}`;
}

async function seedInvite(overrides: Record<string, unknown> = {}) {
  const data = { approved: true, code: 'AAAABBBBCCCCDDDD', ...overrides };
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc(invitePath(INVITEE_EMAIL)).set(data);
  });
  return data;
}

/** The registering user's own context — token email matches the invite (this is the fix). */
function registeringUserContext() {
  return testEnv.authenticatedContext(REGISTERING_UID, { email: INVITEE_EMAIL });
}

describe('firestore.rules — invites — read', () => {
  it('allows unauthenticated read (needed for pre-signup invite lookup)', async () => {
    await seedInvite();
    await assertSucceeds(
      testEnv.unauthenticatedContext().firestore().doc(invitePath(INVITEE_EMAIL)).get()
    );
  });
});

describe('firestore.rules — invites — create', () => {
  it('denies client create — no create rule exists, invites are admin-SDK-only', async () => {
    await assertFails(
      testEnv
        .authenticatedContext(REGISTERING_UID)
        .firestore()
        .doc(invitePath(INVITEE_EMAIL))
        .set({ approved: true, code: 'AAAABBBBCCCCDDDD' })
    );
  });

  it('denies unauthenticated create', async () => {
    await assertFails(
      testEnv
        .unauthenticatedContext()
        .firestore()
        .doc(invitePath(INVITEE_EMAIL))
        .set({ approved: true, code: 'AAAABBBBCCCCDDDD' })
    );
  });
});

describe('firestore.rules — invites — update', () => {
  it('lets the registering user (matching token email + own uid) stamp registeredUserId/registeredAt', async () => {
    await seedInvite();
    await assertSucceeds(
      registeringUserContext()
        .firestore()
        .doc(invitePath(INVITEE_EMAIL))
        .update({ registeredUserId: REGISTERING_UID, registeredAt: new Date().toISOString() })
    );
  });

  it('matches case-insensitively — a mixed-case Auth token email still matches the lowercased doc id', async () => {
    await seedInvite();
    await assertSucceeds(
      testEnv
        .authenticatedContext(REGISTERING_UID, { email: 'Invitee@Example.com' })
        .firestore()
        .doc(invitePath(INVITEE_EMAIL))
        .update({ registeredUserId: REGISTERING_UID, registeredAt: new Date().toISOString() })
    );
  });

  it('FIXED: denies an unrelated authenticated stranger whose token email does not match', async () => {
    await seedInvite();
    await assertFails(
      testEnv
        .authenticatedContext(STRANGER, { email: 'stranger@example.com' })
        .firestore()
        .doc(invitePath(INVITEE_EMAIL))
        .update({ registeredUserId: STRANGER, registeredAt: new Date().toISOString() })
    );
  });

  it('denies a matching-email caller trying to stamp someone else\'s uid into registeredUserId', async () => {
    await seedInvite();
    await assertFails(
      testEnv
        .authenticatedContext(REGISTERING_UID, { email: INVITEE_EMAIL })
        .firestore()
        .doc(invitePath(INVITEE_EMAIL))
        .update({ registeredUserId: STRANGER, registeredAt: new Date().toISOString() })
    );
  });

  it('allows updating just registeredAt alone once registeredUserId already matches the caller', async () => {
    await seedInvite({ registeredUserId: REGISTERING_UID });
    await assertSucceeds(
      registeringUserContext()
        .firestore()
        .doc(invitePath(INVITEE_EMAIL))
        .update({ registeredAt: new Date().toISOString() })
    );
  });

  it('denies unauthenticated update', async () => {
    await seedInvite();
    await assertFails(
      testEnv
        .unauthenticatedContext()
        .firestore()
        .doc(invitePath(INVITEE_EMAIL))
        .update({ registeredUserId: REGISTERING_UID, registeredAt: new Date().toISOString() })
    );
  });

  it('denies a write that touches a field outside the allowlist alongside the allowed ones', async () => {
    await seedInvite({ approved: true });
    await assertFails(
      registeringUserContext()
        .firestore()
        .doc(invitePath(INVITEE_EMAIL))
        .update({
          registeredUserId: REGISTERING_UID,
          registeredAt: new Date().toISOString(),
          approved: false, // sneaking in a change to a field outside hasOnly(['registeredUserId','registeredAt'])
        })
    );
  });
});

describe('firestore.rules — invites — delete', () => {
  it('denies delete — no delete rule exists', async () => {
    await seedInvite();
    await assertFails(
      testEnv.authenticatedContext(REGISTERING_UID).firestore().doc(invitePath(INVITEE_EMAIL)).delete()
    );
  });
});

describe('firestore.rules — waitlist', () => {
  const waitlistPath = (email: string) => `waitlist/${email}`;
  const WAITLIST_EMAIL = 'waitlisted@example.com';

  it('allows unauthenticated create (waitlist signup)', async () => {
    await assertSucceeds(
      testEnv
        .unauthenticatedContext()
        .firestore()
        .doc(waitlistPath(WAITLIST_EMAIL))
        .set({ email: WAITLIST_EMAIL, region: 'US' })
    );
  });

  it('denies read even for an authenticated user — admin only', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().doc(waitlistPath(WAITLIST_EMAIL)).set({ email: WAITLIST_EMAIL });
    });
    await assertFails(
      testEnv.authenticatedContext(STRANGER).firestore().doc(waitlistPath(WAITLIST_EMAIL)).get()
    );
  });

  it('denies update even for an authenticated user — admin only', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().doc(waitlistPath(WAITLIST_EMAIL)).set({ email: WAITLIST_EMAIL });
    });
    await assertFails(
      testEnv
        .authenticatedContext(STRANGER)
        .firestore()
        .doc(waitlistPath(WAITLIST_EMAIL))
        .update({ region: 'UK' })
    );
  });

  it('denies delete even for an authenticated user — admin only', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().doc(waitlistPath(WAITLIST_EMAIL)).set({ email: WAITLIST_EMAIL });
    });
    await assertFails(
      testEnv.authenticatedContext(STRANGER).firestore().doc(waitlistPath(WAITLIST_EMAIL)).delete()
    );
  });
});
