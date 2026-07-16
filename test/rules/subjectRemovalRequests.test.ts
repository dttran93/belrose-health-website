// test/rules/subjectRemovalRequests.test.ts
//
// firestore.rules — subjectRemovalRequests/{requestId} — the request document
// SubjectRemovalService reads/writes (owner/admin requests a subject's removal; only the
// subject can accept/reject). Doc id is `${recordId}_${subjectId}`.
//
// The orchestration suite (test/orchestration/subjectRemovalService.test.ts) runs against
// permissive.rules and never exercises these rules — this file is what actually owns that.

import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { OWNER, ADMIN, VIEWER, baseRecord } from './fixtures/recordPermissionMatrix';

const SUBJECT = 'subject-uid';
const OTHER_SUBJECT = 'other-subject-uid';
const STRANGER = 'stranger-uid';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'belrose-rules-test-subject-removal',
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
      .set(
        baseRecord({
          owners: [OWNER],
          administrators: [ADMIN],
          viewers: [VIEWER],
          subjects: [SUBJECT, OTHER_SUBJECT],
          ...overrides,
        })
      );
  });
}

const reqPath = (recordId: string, subjectId: string) => `subjectRemovalRequests/${recordId}_${subjectId}`;

function pendingPayload(recordId: string, overrides: Record<string, unknown> = {}) {
  return {
    recordId,
    subjectId: SUBJECT,
    requestedBy: ADMIN,
    status: 'pending',
    createdAt: new Date(),
    ...overrides,
  };
}

async function seedRequest(recordId: string, subjectId: string, overrides: Record<string, unknown> = {}) {
  const data = pendingPayload(recordId, { subjectId, ...overrides });
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc(reqPath(recordId, subjectId)).set(data);
  });
  return data;
}

describe('firestore.rules — subjectRemovalRequests — create', () => {
  it('lets an admin/owner request removal of an actual subject', async () => {
    const recordId = 'sr-create-allowed';
    await seedRecord(recordId);

    await assertSucceeds(
      testEnv.authenticatedContext(ADMIN).firestore().doc(reqPath(recordId, SUBJECT)).set(pendingPayload(recordId))
    );
  });

  it('denies create from a caller who is not admin/owner of the record', async () => {
    const recordId = 'sr-create-not-admin-owner';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(VIEWER)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .set(pendingPayload(recordId, { requestedBy: VIEWER }))
    );
  });

  it('denies create when requestedBy does not match the caller (impersonation)', async () => {
    const recordId = 'sr-create-impersonation';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .set(pendingPayload(recordId, { requestedBy: OWNER }))
    );
  });

  it('denies a caller requesting removal of themselves', async () => {
    const recordId = 'sr-create-self-removal-denied';
    // ADMIN is also a subject here, standing in for an admin who happens to be a subject too.
    await seedRecord(recordId, { subjects: [ADMIN, OTHER_SUBJECT] });

    await assertFails(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, ADMIN))
        .set(pendingPayload(recordId, { subjectId: ADMIN, requestedBy: ADMIN }))
    );
  });

  it('denies create when the target is not actually a subject of the record', async () => {
    const recordId = 'sr-create-not-a-subject';
    await seedRecord(recordId, { subjects: [OTHER_SUBJECT] }); // SUBJECT deliberately excluded

    await assertFails(
      testEnv.authenticatedContext(ADMIN).firestore().doc(reqPath(recordId, SUBJECT)).set(pendingPayload(recordId))
    );
  });

  it('denies create with a status other than pending', async () => {
    const recordId = 'sr-create-bad-status';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .set(pendingPayload(recordId, { status: 'accepted' }))
    );
  });

  it('denies create with a non-timestamp createdAt', async () => {
    const recordId = 'sr-create-bad-timestamp';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .set(pendingPayload(recordId, { createdAt: 'not-a-timestamp' }))
    );
  });
});

describe('firestore.rules — subjectRemovalRequests — update (subject accepts/rejects)', () => {
  it('lets the subject accept', async () => {
    const recordId = 'sr-update-accept';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertSucceeds(
      testEnv
        .authenticatedContext(SUBJECT)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ status: 'accepted', respondedAt: new Date() })
    );
  });

  it('lets the subject reject with a subjectResponse note', async () => {
    const recordId = 'sr-update-reject';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertSucceeds(
      testEnv
        .authenticatedContext(SUBJECT)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ status: 'rejected', respondedAt: new Date(), subjectResponse: 'not ready to leave' })
    );
  });

  it('denies a target status outside [accepted, rejected]', async () => {
    const recordId = 'sr-update-bad-status';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertFails(
      testEnv
        .authenticatedContext(SUBJECT)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ status: 'pending', respondedAt: new Date() })
    );
  });

  it('denies responding to a request that is no longer pending', async () => {
    const recordId = 'sr-update-already-resolved';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { status: 'accepted' });

    await assertFails(
      testEnv
        .authenticatedContext(SUBJECT)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ status: 'rejected', respondedAt: new Date() })
    );
  });

  it('denies omitting respondedAt — unlike consent requests, it is required here, not optional', async () => {
    const recordId = 'sr-update-missing-respondedAt';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertFails(
      testEnv.authenticatedContext(SUBJECT).firestore().doc(reqPath(recordId, SUBJECT)).update({ status: 'accepted' })
    );
  });

  it('denies a non-timestamp respondedAt', async () => {
    const recordId = 'sr-update-bad-respondedAt';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertFails(
      testEnv
        .authenticatedContext(SUBJECT)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ status: 'accepted', respondedAt: 'not-a-timestamp' })
    );
  });

  it('denies the subject sneaking a change into an unrelated field (recordId)', async () => {
    const recordId = 'sr-update-disallowed-field';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertFails(
      testEnv
        .authenticatedContext(SUBJECT)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ status: 'accepted', respondedAt: new Date(), recordId: 'other-record' })
    );
  });

  it('denies the requester (or an admin/owner) from resolving it on the subject\'s behalf', async () => {
    const recordId = 'sr-update-non-subject-denied';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertFails(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ status: 'accepted', respondedAt: new Date() })
    );
    await assertFails(
      testEnv
        .authenticatedContext(OWNER)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ status: 'accepted', respondedAt: new Date() })
    );
  });
});

describe('firestore.rules — subjectRemovalRequests — delete', () => {
  it('lets the requester delete (cancellation)', async () => {
    const recordId = 'sr-delete-requester';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertSucceeds(testEnv.authenticatedContext(ADMIN).firestore().doc(reqPath(recordId, SUBJECT)).delete());
  });

  it('lets an admin/owner delete even if they did not request it', async () => {
    const recordId = 'sr-delete-admin-owner';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertSucceeds(testEnv.authenticatedContext(OWNER).firestore().doc(reqPath(recordId, SUBJECT)).delete());
  });

  it('denies delete from the subject (not the requester, not admin/owner)', async () => {
    const recordId = 'sr-delete-subject-denied';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertFails(testEnv.authenticatedContext(SUBJECT).firestore().doc(reqPath(recordId, SUBJECT)).delete());
  });

  it('denies delete from a stranger', async () => {
    const recordId = 'sr-delete-stranger-denied';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertFails(testEnv.authenticatedContext(STRANGER).firestore().doc(reqPath(recordId, SUBJECT)).delete());
  });
});

describe('firestore.rules — subjectRemovalRequests — read', () => {
  it('lets the subject, the requester, and an uninvolved admin/owner all read', async () => {
    const recordId = 'sr-read-allowed';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertSucceeds(testEnv.authenticatedContext(SUBJECT).firestore().doc(reqPath(recordId, SUBJECT)).get());
    await assertSucceeds(testEnv.authenticatedContext(ADMIN).firestore().doc(reqPath(recordId, SUBJECT)).get());
    await assertSucceeds(testEnv.authenticatedContext(OWNER).firestore().doc(reqPath(recordId, SUBJECT)).get());
  });

  it('lets a different subject of the same record read — the shared-subjects visibility clause', async () => {
    const recordId = 'sr-read-other-subject';
    await seedRecord(recordId); // OTHER_SUBJECT is also seeded as a subject of this record
    await seedRequest(recordId, SUBJECT);

    await assertSucceeds(testEnv.authenticatedContext(OTHER_SUBJECT).firestore().doc(reqPath(recordId, SUBJECT)).get());
  });

  it('denies a stranger with no relationship to the request or record', async () => {
    const recordId = 'sr-read-stranger-denied';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertFails(testEnv.authenticatedContext(STRANGER).firestore().doc(reqPath(recordId, SUBJECT)).get());
  });

  it('denies an unauthenticated read', async () => {
    const recordId = 'sr-read-unauthenticated-denied';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertFails(testEnv.unauthenticatedContext().firestore().doc(reqPath(recordId, SUBJECT)).get());
  });
});
