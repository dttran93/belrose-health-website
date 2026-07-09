// test/rules/permissionHistory.test.ts
//
// firestore.rules — records/{recordId}/permissionHistory/{eventId} — the audit-trail
// subcollection PermissionsService.writePermissionChangeEvent writes to.

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { OWNER, SHARER, baseRecord } from './fixtures/recordPermissionMatrix';

const STRANGER = 'stranger-uid';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'belrose-rules-test-permission-history',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(() => testEnv.cleanup());
beforeEach(() => testEnv.clearFirestore());

async function seedRecord(recordId: string) {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc(`records/${recordId}`).set(baseRecord({ owners: [OWNER], sharers: [SHARER] }));
  });
}

describe('firestore.rules — permissionHistory subcollection', () => {
  it('lets a role holder create an event where changedBy matches themselves', async () => {
    const recordId = 'history-create-allowed';
    await seedRecord(recordId);

    await assertSucceeds(
      testEnv
        .authenticatedContext(SHARER)
        .firestore()
        .doc(`records/${recordId}/permissionHistory/event-1`)
        .set({ changedBy: SHARER, changes: [] })
    );
  });

  it('denies create from a user with no role on the parent record', async () => {
    const recordId = 'history-create-no-role-denied';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(STRANGER)
        .firestore()
        .doc(`records/${recordId}/permissionHistory/event-1`)
        .set({ changedBy: STRANGER, changes: [] })
    );
  });

  it('denies create when changedBy does not match the caller', async () => {
    const recordId = 'history-create-changedby-mismatch-denied';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(SHARER)
        .firestore()
        .doc(`records/${recordId}/permissionHistory/event-1`)
        .set({ changedBy: OWNER, changes: [] })
    );
  });

  it('lets a role holder read events, but denies a stranger', async () => {
    const recordId = 'history-read';
    await seedRecord(recordId);
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx
        .firestore()
        .doc(`records/${recordId}/permissionHistory/event-1`)
        .set({ changedBy: SHARER, changes: [] });
    });

    await assertSucceeds(
      testEnv.authenticatedContext(OWNER).firestore().doc(`records/${recordId}/permissionHistory/event-1`).get()
    );
    await assertFails(
      testEnv.authenticatedContext(STRANGER).firestore().doc(`records/${recordId}/permissionHistory/event-1`).get()
    );
  });

  it('never allows update or delete — immutable audit log', async () => {
    const recordId = 'history-immutable';
    await seedRecord(recordId);
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx
        .firestore()
        .doc(`records/${recordId}/permissionHistory/event-1`)
        .set({ changedBy: SHARER, changes: [] });
    });

    await assertFails(
      testEnv
        .authenticatedContext(SHARER)
        .firestore()
        .doc(`records/${recordId}/permissionHistory/event-1`)
        .update({ changes: [1] })
    );
    await assertFails(
      testEnv.authenticatedContext(OWNER).firestore().doc(`records/${recordId}/permissionHistory/event-1`).delete()
    );
  });
});
