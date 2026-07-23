// test/rules/recordVersions.test.ts
//
// firestore.rules — recordVersions/{versionId} — the version-history documents
// versionControlService reads/writes. No prior test coverage existed for this collection.

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { OWNER, ADMIN, VIEWER, baseRecord } from './fixtures/recordPermissionMatrix';

const STRANGER = 'stranger-uid';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'belrose-rules-test-record-versions',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(() => testEnv.cleanup());
beforeEach(() => testEnv.clearFirestore());

async function seedRecord(recordId: string, overrides: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx
      .firestore()
      .doc(`records/${recordId}`)
      .set(baseRecord({ owners: [OWNER], administrators: [ADMIN], viewers: [VIEWER], ...overrides }));
  });
}

async function seedVersion(recordId: string, versionId: string, overrides: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx
      .firestore()
      .doc(`recordVersions/${versionId}`)
      .set({ recordId, versionNumber: 0, encryptedChanges: null, ...overrides });
  });
}

describe('firestore.rules — recordVersions — create', () => {
  it('lets an admin/owner create the baseline (version 0)', async () => {
    const recordId = 'rv-create-baseline';
    await seedRecord(recordId);

    await assertSucceeds(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc('recordVersions/v0')
        .set({
          recordId,
          versionNumber: 0,
          encryptedChanges: null,
          commitMessage: 'Original Upload (auto-created baseline)',
        })
    );
  });

  it('lets an admin/owner create a standard edit (version 1+) with editedBy set to themselves', async () => {
    const recordId = 'rv-create-edit';
    await seedRecord(recordId);

    await assertSucceeds(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc('recordVersions/v1')
        .set({ recordId, versionNumber: 1, editedBy: ADMIN, encryptedChanges: { some: 'diff' } })
    );
  });

  it('denies a viewer (not admin/owner) from creating a version', async () => {
    const recordId = 'rv-create-denied-viewer';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(VIEWER)
        .firestore()
        .doc('recordVersions/v1')
        .set({ recordId, versionNumber: 1, editedBy: VIEWER, encryptedChanges: { some: 'diff' } })
    );
  });

  it("denies editedBy not matching the caller on a version 1+ edit (can't attribute someone else's edit to yourself)", async () => {
    const recordId = 'rv-create-editedby-mismatch';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc('recordVersions/v1')
        .set({ recordId, versionNumber: 1, editedBy: OWNER, encryptedChanges: { some: 'diff' } })
    );
  });
});

describe('firestore.rules — recordVersions — read', () => {
  it('lets anyone with a role on the record read its versions', async () => {
    const recordId = 'rv-read-role-holder';
    await seedRecord(recordId);
    await seedVersion(recordId, 'v0');

    await assertSucceeds(testEnv.authenticatedContext(VIEWER).firestore().doc('recordVersions/v0').get());
  });

  it('denies a stranger with no role on the record', async () => {
    const recordId = 'rv-read-stranger-denied';
    await seedRecord(recordId);
    await seedVersion(recordId, 'v0');

    await assertFails(testEnv.authenticatedContext(STRANGER).firestore().doc('recordVersions/v0').get());
  });
});

describe('firestore.rules — recordVersions — update', () => {
  it('denies any update — versions are immutable', async () => {
    const recordId = 'rv-update-denied';
    await seedRecord(recordId);
    await seedVersion(recordId, 'v0');

    await assertFails(
      testEnv.authenticatedContext(ADMIN).firestore().doc('recordVersions/v0').update({ versionNumber: 99 })
    );
  });
});

describe('firestore.rules — recordVersions — delete', () => {
  it('lets an admin/owner delete a version while the record still exists', async () => {
    const recordId = 'rv-delete-admin-owner';
    await seedRecord(recordId);
    await seedVersion(recordId, 'v0');

    await assertSucceeds(testEnv.authenticatedContext(ADMIN).firestore().doc('recordVersions/v0').delete());
  });

  it('denies a viewer (not admin/owner) from deleting a version while the record still exists', async () => {
    const recordId = 'rv-delete-denied-viewer';
    await seedRecord(recordId);
    await seedVersion(recordId, 'v0');

    await assertFails(testEnv.authenticatedContext(VIEWER).firestore().doc('recordVersions/v0').delete());
  });

  // Regression: recordVersions are deleted before the record itself in
  // RecordDeletionService.deleteRecord (isAdminOrOwnerOfRecord needs the record to still exist),
  // so an orphan can only arise from a partial failure elsewhere. A version 0 baseline has no
  // per-doc owner field (editedBy is only ever set on version 1+ edits) — once its record is
  // gone there's no meaningful identity left to check, so any authenticated user may clean it
  // up rather than it being permanently stuck.
  it('lets any authenticated user delete an orphaned version once its record no longer exists', async () => {
    const recordId = 'rv-delete-orphan-allowed';
    await seedVersion(recordId, 'v0');

    await assertSucceeds(testEnv.authenticatedContext(STRANGER).firestore().doc('recordVersions/v0').delete());
  });
});
