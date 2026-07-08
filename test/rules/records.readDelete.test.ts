// test/rules/records.readDelete.test.ts
//
// firestore.rules — records/{recordId} — the `read` rule (any role holder can read;
// a stranger cannot) and the `delete` rule (owners only, or admins when no owners exist).

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { OWNER, ADMIN, SHARER, VIEWER, baseRecord } from './fixtures/recordPermissionMatrix';

const STRANGER = 'stranger-uid';
const UPLOADER = 'uploader-uid';
const SUBJECT = 'subject-uid';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'belrose-rules-test-read-delete',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(() => testEnv.cleanup());
beforeEach(() => testEnv.clearFirestore());

async function seed(recordId: string, data: object) {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc(`records/${recordId}`).set(data);
  });
}

describe('firestore.rules — records/{recordId} — read', () => {
  it('lets the owner, admin, sharer, viewer, subject, and original uploader all read', async () => {
    const recordId = 'read-role-holders';
    await seed(recordId, {
      ...baseRecord({ owners: [OWNER], administrators: [ADMIN], sharers: [SHARER], viewers: [VIEWER], subjects: [SUBJECT] }),
      uploadedBy: UPLOADER,
    });

    for (const uid of [OWNER, ADMIN, SHARER, VIEWER, SUBJECT, UPLOADER]) {
      await assertSucceeds(testEnv.authenticatedContext(uid).firestore().doc(`records/${recordId}`).get());
    }
  });

  it('denies a stranger with no role on the record', async () => {
    const recordId = 'read-stranger-denied';
    await seed(recordId, { ...baseRecord({ owners: [OWNER] }), uploadedBy: UPLOADER });

    await assertFails(testEnv.authenticatedContext(STRANGER).firestore().doc(`records/${recordId}`).get());
  });
});

describe('firestore.rules — records/{recordId} — delete', () => {
  it('lets an owner delete', async () => {
    const recordId = 'delete-owner-allowed';
    await seed(recordId, baseRecord({ owners: [OWNER] }));

    await assertSucceeds(testEnv.authenticatedContext(OWNER).firestore().doc(`records/${recordId}`).delete());
  });

  it('blocks an admin from deleting while an owner exists', async () => {
    const recordId = 'delete-admin-blocked-with-owner';
    await seed(recordId, baseRecord({ owners: [OWNER], administrators: [ADMIN] }));

    await assertFails(testEnv.authenticatedContext(ADMIN).firestore().doc(`records/${recordId}`).delete());
  });

  it('lets an admin delete when no owner exists', async () => {
    const recordId = 'delete-admin-allowed-no-owner';
    await seed(recordId, baseRecord({ owners: [], administrators: [ADMIN] }));

    await assertSucceeds(testEnv.authenticatedContext(ADMIN).firestore().doc(`records/${recordId}`).delete());
  });

  it('blocks a sharer or viewer from deleting', async () => {
    const recordId = 'delete-sharer-viewer-blocked';
    await seed(recordId, baseRecord({ owners: [OWNER], sharers: [SHARER], viewers: [VIEWER] }));

    await assertFails(testEnv.authenticatedContext(SHARER).firestore().doc(`records/${recordId}`).delete());
    await assertFails(testEnv.authenticatedContext(VIEWER).firestore().doc(`records/${recordId}`).delete());
  });
});
