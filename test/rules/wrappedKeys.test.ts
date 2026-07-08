// test/rules/wrappedKeys.test.ts
//
// firestore.rules — wrappedKeys/{wrappedKeyId} — the encryption-access collection
// SharingService.grantEncryptionAccess/revokeEncryptionAccess reads and writes.

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { OWNER, ADMIN, SHARER, VIEWER, baseRecord } from './fixtures/recordPermissionMatrix';

const OTHER_SHARER = 'other-sharer-uid';
const RECEIVER = 'receiver-uid';
const STRANGER = 'stranger-uid';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'belrose-rules-test-wrapped-keys',
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
    await ctx
      .firestore()
      .doc(`records/${recordId}`)
      .set(
        baseRecord({
          owners: [OWNER],
          administrators: [ADMIN],
          sharers: [SHARER, OTHER_SHARER],
          viewers: [VIEWER],
        })
      );
  });
}

async function seedWrappedKey(recordId: string, wrappedKeyId: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc(`wrappedKeys/${wrappedKeyId}`).set({ recordId, ...data });
  });
}

describe('firestore.rules — wrappedKeys — create', () => {
  it('lets a sharer-or-above create a wrapped key for a record they can share', async () => {
    const recordId = 'wk-create-allowed';
    await seedRecord(recordId);

    await assertSucceeds(
      testEnv
        .authenticatedContext(SHARER)
        .firestore()
        .doc(`wrappedKeys/${recordId}_${RECEIVER}`)
        .set({ recordId, userId: RECEIVER, grantedBy: SHARER, isActive: true })
    );
  });

  it('denies a viewer (below sharer) from creating a wrapped key', async () => {
    const recordId = 'wk-create-denied-viewer';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(VIEWER)
        .firestore()
        .doc(`wrappedKeys/${recordId}_${RECEIVER}`)
        .set({ recordId, userId: RECEIVER, grantedBy: VIEWER, isActive: true })
    );
  });
});

describe('firestore.rules — wrappedKeys — update', () => {
  it('lets an admin/owner of the record update any wrapped key', async () => {
    const recordId = 'wk-update-admin-owner';
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: RECEIVER, grantedBy: SHARER, isActive: true });

    await assertSucceeds(
      testEnv.authenticatedContext(OWNER).firestore().doc('wrappedKeys/key-1').update({ isActive: false })
    );
  });

  it("lets the key's own receiver update it", async () => {
    const recordId = 'wk-update-receiver-self';
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: RECEIVER, grantedBy: SHARER, isActive: true });

    await assertSucceeds(
      testEnv.authenticatedContext(RECEIVER).firestore().doc('wrappedKeys/key-1').update({ isActive: false })
    );
  });

  it('lets the sharer who personally granted it update their own grant', async () => {
    const recordId = 'wk-update-granter-self';
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: RECEIVER, grantedBy: SHARER, isActive: true });

    await assertSucceeds(
      testEnv.authenticatedContext(SHARER).firestore().doc('wrappedKeys/key-1').update({ isActive: false })
    );
  });

  it('denies a different sharer who did not personally grant it', async () => {
    const recordId = 'wk-update-different-sharer-denied';
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: RECEIVER, grantedBy: SHARER, isActive: true });

    await assertFails(
      testEnv.authenticatedContext(OTHER_SHARER).firestore().doc('wrappedKeys/key-1').update({ isActive: false })
    );
  });
});

describe('firestore.rules — wrappedKeys — delete', () => {
  it('denies a stranger with no relationship to the record or key', async () => {
    const recordId = 'wk-delete-stranger-denied';
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: RECEIVER, grantedBy: SHARER, isActive: true });

    await assertFails(testEnv.authenticatedContext(STRANGER).firestore().doc('wrappedKeys/key-1').delete());
  });

  it('lets an admin/owner delete', async () => {
    const recordId = 'wk-delete-admin-owner';
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: RECEIVER, grantedBy: SHARER, isActive: true });

    await assertSucceeds(testEnv.authenticatedContext(ADMIN).firestore().doc('wrappedKeys/key-1').delete());
  });
});

describe('firestore.rules — wrappedKeys — read', () => {
  it('is readable by any authenticated user', async () => {
    const recordId = 'wk-read';
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: RECEIVER, grantedBy: SHARER, isActive: true });

    await assertSucceeds(testEnv.authenticatedContext(STRANGER).firestore().doc('wrappedKeys/key-1').get());
  });
});
