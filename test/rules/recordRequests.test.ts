// test/rules/recordRequests.test.ts
//
// firestore.rules — recordRequests/{requestId} — see firestore.rules "RECORD REQUESTS" section.
// This collection backs the guest "request records from a patient" flow and has the most
// heterogeneous `allow update` block in the whole ruleset: 7 independent paths (A-G), each with
// its own actor, status precondition, and field allowlist, rather than one shared shape — so
// unlike records/{recordId} (see recordUpdateHarness.ts + recordPermissionMatrix.ts), a
// fixture-matrix isn't a good fit here; each path gets its own describe block instead.
//
// Path A is notable: it has NO auth check at all (unauthenticated read-receipt stamping, so a
// provider's read-tracking pixel/link doesn't require them to be signed in).

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, getDocs, query, where } from 'firebase/firestore';

const REQUESTER = 'requester-uid';
const TARGET = 'target-uid';
const GUEST_PROVIDER = 'guest-provider-uid';
const STRANGER = 'stranger-uid';
const TARGET_EMAIL = 'target@example.com';
const REQUEST_ID = 'request-1';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'belrose-rules-test-record-requests',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(() => testEnv.cleanup());
beforeEach(() => testEnv.clearFirestore());

function requestPath(id: string = REQUEST_ID) {
  return `recordRequests/${id}`;
}

async function seedRequest(overrides: Record<string, unknown> = {}) {
  const data = {
    requesterId: REQUESTER,
    targetUserId: TARGET,
    targetEmail: TARGET_EMAIL,
    providerGuestUid: GUEST_PROVIDER,
    status: 'pending',
    fulfilledRecordIds: [] as string[],
    ...overrides,
  };
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc(requestPath()).set(data);
  });
  return data;
}

describe('firestore.rules — recordRequests — create', () => {
  it('allows the requester to create their own pending request', async () => {
    await assertSucceeds(
      testEnv
        .authenticatedContext(REQUESTER)
        .firestore()
        .doc(requestPath())
        .set({ requesterId: REQUESTER, targetEmail: TARGET_EMAIL, status: 'pending' })
    );
  });

  it('denies creating on behalf of someone else', async () => {
    await assertFails(
      testEnv
        .authenticatedContext(STRANGER)
        .firestore()
        .doc(requestPath())
        .set({ requesterId: REQUESTER, targetEmail: TARGET_EMAIL, status: 'pending' })
    );
  });

  it('denies creating with a non-pending status', async () => {
    await assertFails(
      testEnv
        .authenticatedContext(REQUESTER)
        .firestore()
        .doc(requestPath())
        .set({ requesterId: REQUESTER, targetEmail: TARGET_EMAIL, status: 'fulfilled' })
    );
  });

  it('denies unauthenticated create', async () => {
    await assertFails(
      testEnv
        .unauthenticatedContext()
        .firestore()
        .doc(requestPath())
        .set({ requesterId: REQUESTER, targetEmail: TARGET_EMAIL, status: 'pending' })
    );
  });
});

describe('firestore.rules — recordRequests — read (get)', () => {
  it('allows anyone (even unauthenticated) to get a single doc — needed for inviteCode lookup', async () => {
    await seedRequest();
    await assertSucceeds(testEnv.unauthenticatedContext().firestore().doc(requestPath()).get());
  });
});

describe('firestore.rules — recordRequests — read (list)', () => {
  // Firestore's list-rule validation only binds the fields present in the query's equality
  // filters — a rule branch that references a field NOT in the filter can't be proven true or
  // false and errors out. That's exactly why useInboundRequests.ts (the real caller) issues two
  // separate single-field queries (targetUserId, targetEmail) instead of one combined query —
  // each test below mirrors that by filtering on the one field its scenario's OR-branch needs.
  function listBy(
    field: string,
    value: string,
    ctx:
      | ReturnType<typeof testEnv.authenticatedContext>
      | ReturnType<typeof testEnv.unauthenticatedContext>
  ) {
    return getDocs(query(collection(ctx.firestore(), 'recordRequests'), where(field, '==', value)));
  }

  it('allows the requester to list their own requests (filtered by requesterId)', async () => {
    await seedRequest();
    await assertSucceeds(listBy('requesterId', REQUESTER, testEnv.authenticatedContext(REQUESTER)));
  });

  it('allows the target user (by uid) to list (filtered by targetUserId)', async () => {
    await seedRequest();
    await assertSucceeds(listBy('targetUserId', TARGET, testEnv.authenticatedContext(TARGET)));
  });

  it('allows a caller whose token email matches targetEmail to list (filtered by targetEmail)', async () => {
    await seedRequest();
    await assertSucceeds(
      listBy(
        'targetEmail',
        TARGET_EMAIL,
        testEnv.authenticatedContext(STRANGER, { email: TARGET_EMAIL })
      )
    );
  });

  it('allows the guest provider to list (filtered by providerGuestUid)', async () => {
    await seedRequest();
    await assertSucceeds(
      listBy('providerGuestUid', GUEST_PROVIDER, testEnv.authenticatedContext(GUEST_PROVIDER))
    );
  });

  it('denies an unrelated stranger from listing by targetUserId when it is not their own uid', async () => {
    await seedRequest();
    await assertFails(listBy('targetUserId', TARGET, testEnv.authenticatedContext(STRANGER)));
  });

  it('denies unauthenticated list', async () => {
    await seedRequest();
    await assertFails(listBy('requesterId', REQUESTER, testEnv.unauthenticatedContext()));
  });
});

describe('firestore.rules — recordRequests — update Path A (unauthenticated read receipt)', () => {
  it('allows an unauthenticated caller to stamp readAt/viewCount on a pending request', async () => {
    await seedRequest();
    await assertSucceeds(
      testEnv
        .unauthenticatedContext()
        .firestore()
        .doc(requestPath())
        .update({ readAt: new Date().toISOString(), viewCount: 1 })
    );
  });

  it('denies the read-receipt stamp once the request is no longer pending', async () => {
    await seedRequest({ status: 'fulfilled' });
    await assertFails(
      testEnv
        .unauthenticatedContext()
        .firestore()
        .doc(requestPath())
        .update({ readAt: new Date().toISOString(), viewCount: 1 })
    );
  });

  it('denies sneaking an out-of-allowlist field into the read-receipt write', async () => {
    await seedRequest();
    await assertFails(
      testEnv
        .unauthenticatedContext()
        .firestore()
        .doc(requestPath())
        .update({ readAt: new Date().toISOString(), viewCount: 1, status: 'denied' })
    );
  });
});

describe('firestore.rules — recordRequests — update Path B (provider adds records)', () => {
  it('allows the target (by uid) to add fulfilledRecordIds while staying pending', async () => {
    await seedRequest();
    await assertSucceeds(
      testEnv
        .authenticatedContext(TARGET)
        .firestore()
        .doc(requestPath())
        .update({ status: 'pending', fulfilledRecordIds: ['rec-1'] })
    );
  });

  it('allows the target (by token email) to add records and mark fulfilled in one write', async () => {
    await seedRequest();
    await assertSucceeds(
      testEnv
        .authenticatedContext(STRANGER, { email: TARGET_EMAIL })
        .firestore()
        .doc(requestPath())
        .update({
          status: 'fulfilled',
          fulfilledRecordIds: ['rec-1'],
          fulfilledAt: new Date().toISOString(),
        })
    );
  });

  it('denies adding an empty fulfilledRecordIds array', async () => {
    // Seeded with a non-empty starting array so the update below is a genuine diff — writing
    // back the same [] value as the seed default produces an empty diff, which vacuously
    // satisfies every path's hasOnly() allowlist and defeats the point of this test.
    await seedRequest({ fulfilledRecordIds: ['old-rec'] });
    await assertFails(
      testEnv
        .authenticatedContext(TARGET)
        .firestore()
        .doc(requestPath())
        .update({ status: 'pending', fulfilledRecordIds: [] })
    );
  });

  it('denies a caller who is neither the target uid nor the target email', async () => {
    await seedRequest();
    await assertFails(
      testEnv
        .authenticatedContext(STRANGER)
        .firestore()
        .doc(requestPath())
        .update({ status: 'pending', fulfilledRecordIds: ['rec-1'] })
    );
  });
});

describe('firestore.rules — recordRequests — update Path C (requester cancels)', () => {
  it('allows the requester to cancel a pending request', async () => {
    await seedRequest();
    await assertSucceeds(
      testEnv
        .authenticatedContext(REQUESTER)
        .firestore()
        .doc(requestPath())
        .update({ status: 'cancelled', cancelledAt: new Date().toISOString() })
    );
  });

  it('denies a non-requester from cancelling', async () => {
    await seedRequest();
    await assertFails(
      testEnv
        .authenticatedContext(TARGET)
        .firestore()
        .doc(requestPath())
        .update({ status: 'cancelled', cancelledAt: new Date().toISOString() })
    );
  });

  it('denies cancelling a request that is no longer pending', async () => {
    await seedRequest({ status: 'fulfilled' });
    await assertFails(
      testEnv
        .authenticatedContext(REQUESTER)
        .firestore()
        .doc(requestPath())
        .update({ status: 'cancelled', cancelledAt: new Date().toISOString() })
    );
  });
});

describe('firestore.rules — recordRequests — update Path D (note key rewrap)', () => {
  it('allows the target uid to rewrap the note key on any status', async () => {
    await seedRequest({ status: 'fulfilled' });
    await assertSucceeds(
      testEnv
        .authenticatedContext(TARGET)
        .firestore()
        .doc(requestPath())
        .update({ encryptedNoteKeyForProvider: 'rewrapped' })
    );
  });

  it('allows the guest provider (providerGuestUid) to rewrap the note key', async () => {
    await seedRequest();
    await assertSucceeds(
      testEnv
        .authenticatedContext(GUEST_PROVIDER)
        .firestore()
        .doc(requestPath())
        .update({ encryptedNoteKeyForProvider: 'rewrapped' })
    );
  });

  it('denies a stranger from rewrapping the note key', async () => {
    await seedRequest();
    await assertFails(
      testEnv
        .authenticatedContext(STRANGER)
        .firestore()
        .doc(requestPath())
        .update({ encryptedNoteKeyForProvider: 'rewrapped' })
    );
  });
});

describe('firestore.rules — recordRequests — update Path E (provider marks fulfilled)', () => {
  it('allows the target to mark a pending request fulfilled', async () => {
    await seedRequest();
    await assertSucceeds(
      testEnv
        .authenticatedContext(TARGET)
        .firestore()
        .doc(requestPath())
        .update({ status: 'fulfilled', fulfilledAt: new Date().toISOString() })
    );
  });

  it('denies marking fulfilled a request that is not pending', async () => {
    await seedRequest({ status: 'denied' });
    await assertFails(
      testEnv
        .authenticatedContext(TARGET)
        .firestore()
        .doc(requestPath())
        .update({ status: 'fulfilled', fulfilledAt: new Date().toISOString() })
    );
  });
});

describe('firestore.rules — recordRequests — update Path F (provider denies)', () => {
  it('allows the target to deny a pending request', async () => {
    await seedRequest();
    await assertSucceeds(
      testEnv
        .authenticatedContext(TARGET)
        .firestore()
        .doc(requestPath())
        .update({
          status: 'denied',
          deniedAt: new Date().toISOString(),
          deniedReason: 'not applicable',
        })
    );
  });

  it('denies a non-target from denying the request', async () => {
    await seedRequest();
    await assertFails(
      testEnv
        .authenticatedContext(STRANGER)
        .firestore()
        .doc(requestPath())
        .update({ status: 'denied', deniedAt: new Date().toISOString() })
    );
  });
});

describe('firestore.rules — recordRequests — update Path G (guest claim backfill)', () => {
  it('allows a caller whose token email matches targetEmail to backfill their own uid', async () => {
    await seedRequest();
    await assertSucceeds(
      testEnv
        .authenticatedContext(TARGET, { email: TARGET_EMAIL })
        .firestore()
        .doc(requestPath())
        .update({ targetUserId: TARGET })
    );
  });

  it("denies backfilling someone else's uid", async () => {
    await seedRequest();
    await assertFails(
      testEnv
        .authenticatedContext(TARGET, { email: TARGET_EMAIL })
        .firestore()
        .doc(requestPath())
        .update({ targetUserId: STRANGER })
    );
  });

  it('denies a caller whose token email does not match targetEmail', async () => {
    await seedRequest();
    await assertFails(
      testEnv
        .authenticatedContext(STRANGER, { email: 'wrong@example.com' })
        .firestore()
        .doc(requestPath())
        .update({ targetUserId: STRANGER })
    );
  });
});

describe('firestore.rules — recordRequests — delete', () => {
  it('denies delete — no delete rule exists', async () => {
    await seedRequest();
    await assertFails(
      testEnv.authenticatedContext(REQUESTER).firestore().doc(requestPath()).delete()
    );
  });
});
