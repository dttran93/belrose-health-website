// test/rules/trusteeRelationships.dependentSemantics.test.ts
//
// firestore.rules — trusteeRelationships/{relationshipId} — sibling to trusteeRelationships.test.ts
// (same split-by-concern convention used for records.adminOwner.test.ts /
// records.readDelete.test.ts / records.sharerViewerSelfService.test.ts), scoped specifically to
// the isDependentRelationship field's semantics.
//
// CONFIRMED, DOCUMENTED-AS-POLICY (not a Dependents-specific regression): the create rule
// (BRANCH-agnostic — it's the collection's single create rule) does not restrict or require
// anything about isDependentRelationship at all, and update BRANCH 1 (trustor-managing) only
// pins trustorId/trusteeId immutable — nothing else is restricted, including this field. So a
// plain user can self-create (or later self-flip) a relationship flagged as a dependent
// relationship. The real authorization boundary for an ACTUAL dependent relationship lives in
// createDependentAccount.ts's Admin-SDK write (clients can never reach it — it writes
// status:'active'/isActive:true directly, bypassing this collection's client create rule
// entirely). This file documents the existing wide-trustor-grant policy already established by
// trusteeRelationships.test.ts for this collection generally — it is not a new hole introduced
// by the Dependents feature.

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const TRUSTOR = 'trustor-uid';
const TRUSTEE = 'trustee-uid';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'belrose-rules-test-trustee-relationships-dependent-semantics',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(() => testEnv.cleanup());
beforeEach(() => testEnv.clearFirestore());

const relPath = (trustorId: string, trusteeId: string) =>
  `trusteeRelationships/${trustorId}_${trusteeId}`;

function invitePayload(overrides: Record<string, unknown> = {}) {
  return {
    trustorId: TRUSTOR,
    trusteeId: TRUSTEE,
    trustLevel: 'observer',
    isActive: false,
    status: 'pending',
    createdAt: new Date(),
    respondedAt: null,
    revokedAt: null,
    revokedBy: null,
    statusUpdateReason: null,
    onChainEvents: [],
    ...overrides,
  };
}

async function seedRelationship(overrides: Record<string, unknown> = {}) {
  const data = invitePayload(overrides);
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx
      .firestore()
      .doc(relPath(data.trustorId as string, data.trusteeId as string))
      .set(data);
  });
  return data;
}

describe('firestore.rules — trusteeRelationships — isDependentRelationship on create', () => {
  it('DOCUMENTED POLICY: a plain user can self-create a pending relationship flagged isDependentRelationship:true', async () => {
    await assertSucceeds(
      testEnv
        .authenticatedContext(TRUSTOR)
        .firestore()
        .doc(relPath(TRUSTOR, TRUSTEE))
        .set(invitePayload({ isDependentRelationship: true }))
    );
  });

  it('the flag survives the normal trustee-accept path (BRANCH 2 does not restrict it)', async () => {
    await seedRelationship({ isDependentRelationship: true, status: 'pending', isActive: false });

    await assertSucceeds(
      testEnv
        .authenticatedContext(TRUSTEE)
        .firestore()
        .doc(relPath(TRUSTOR, TRUSTEE))
        .update({ status: 'active', isActive: true, respondedAt: new Date() })
    );

    // withSecurityRulesDisabled discards its callback's return value (types as Promise<void>),
    // so the fetched snapshot must be captured via an outer-scoped variable instead.
    let snap: any;
    await testEnv.withSecurityRulesDisabled(async ctx => {
      snap = await ctx.firestore().doc(relPath(TRUSTOR, TRUSTEE)).get();
    });
    expect(snap?.data()?.isDependentRelationship).toBe(true);
  });
});

describe('firestore.rules — trusteeRelationships — isDependentRelationship on update (BRANCH 1)', () => {
  it('DOCUMENTED POLICY: the trustor can flip isDependentRelationship on an existing relationship — BRANCH 1 only pins trustorId/trusteeId', async () => {
    await seedRelationship({ isDependentRelationship: false, status: 'active', isActive: true });

    await assertSucceeds(
      testEnv
        .authenticatedContext(TRUSTOR)
        .firestore()
        .doc(relPath(TRUSTOR, TRUSTEE))
        .update({ isDependentRelationship: true })
    );
  });

  it('DOCUMENTED POLICY: the trustor can just as easily flip it back off', async () => {
    await seedRelationship({ isDependentRelationship: true, status: 'active', isActive: true });

    await assertSucceeds(
      testEnv
        .authenticatedContext(TRUSTOR)
        .firestore()
        .doc(relPath(TRUSTOR, TRUSTEE))
        .update({ isDependentRelationship: false })
    );
  });
});
