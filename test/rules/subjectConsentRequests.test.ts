// test/rules/subjectConsentRequests.test.ts
//
// firestore.rules — subjectConsentRequests/{requestId} — the request document
// SubjectConsentService reads/writes (pending request / accept / reject / self-add /
// controller-anchor). Doc id is `${recordId}_${subjectId}`.
//
// The orchestration suite (test/orchestration/subjectConsentService.test.ts) runs against
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
const STRANGER = 'stranger-uid';
const PLATFORM_ADMIN = 'platform-admin-uid';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'belrose-rules-test-subject-consent',
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

const reqPath = (recordId: string, subjectId: string) => `subjectConsentRequests/${recordId}_${subjectId}`;

function pendingPayload(recordId: string, overrides: Record<string, unknown> = {}) {
  return {
    recordId,
    subjectId: SUBJECT,
    requestedBy: ADMIN,
    requestedSubjectRole: 'sharer',
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

describe('firestore.rules — subjectConsentRequests — create — BRANCH 1 (pending request)', () => {
  it('lets an admin/owner send a pending consent request', async () => {
    const recordId = 'sc-create-pending';
    await seedRecord(recordId);

    await assertSucceeds(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .set(pendingPayload(recordId, { grantedAccessOnSubjectRequest: true }))
    );
  });

  it('allows omitting the optional grantedAccessOnSubjectRequest field entirely', async () => {
    const recordId = 'sc-create-no-granted-flag';
    await seedRecord(recordId);

    await assertSucceeds(
      testEnv.authenticatedContext(ADMIN).firestore().doc(reqPath(recordId, SUBJECT)).set(pendingPayload(recordId))
    );
  });

  it('denies create from a caller who is not admin/owner of the record', async () => {
    const recordId = 'sc-create-not-admin-owner';
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
    const recordId = 'sc-create-impersonation';
    await seedRecord(recordId);

    await assertFails(
      testEnv.authenticatedContext(ADMIN).firestore().doc(reqPath(recordId, SUBJECT)).set(pendingPayload(recordId, { requestedBy: OWNER }))
    );
  });

  it('denies create with a non-timestamp createdAt', async () => {
    const recordId = 'sc-create-bad-timestamp';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .set(pendingPayload(recordId, { createdAt: 'not-a-timestamp' }))
    );
  });

  it('denies create when grantedAccessOnSubjectRequest is present but not a bool', async () => {
    const recordId = 'sc-create-bad-granted-flag';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .set(pendingPayload(recordId, { grantedAccessOnSubjectRequest: 'yes' }))
    );
  });

  it('denies a status that matches none of the three create branches', async () => {
    const recordId = 'sc-create-bad-status';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .set(pendingPayload(recordId, { status: 'accepted' }))
    );
  });
});

describe('firestore.rules — subjectConsentRequests — create — BRANCH 2 (self-add)', () => {
  it('lets an admin/owner self-consent (subjectId == requestedBy == caller)', async () => {
    const recordId = 'sc-create-self-consent';
    await seedRecord(recordId);

    await assertSucceeds(
      testEnv
        .authenticatedContext(OWNER)
        .firestore()
        .doc(reqPath(recordId, OWNER))
        .set(
          pendingPayload(recordId, {
            subjectId: OWNER,
            requestedBy: OWNER,
            status: 'self_consented',
            respondedAt: new Date(),
          })
        )
    );
  });

  it('denies self-consent from a caller with no admin/owner role on the record', async () => {
    const recordId = 'sc-create-self-consent-no-role';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(VIEWER)
        .firestore()
        .doc(reqPath(recordId, VIEWER))
        .set(
          pendingPayload(recordId, {
            subjectId: VIEWER,
            requestedBy: VIEWER,
            status: 'self_consented',
            respondedAt: new Date(),
          })
        )
    );
  });

  it('denies self-consent missing respondedAt', async () => {
    const recordId = 'sc-create-self-consent-no-respondedAt';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(OWNER)
        .firestore()
        .doc(reqPath(recordId, OWNER))
        .set(pendingPayload(recordId, { subjectId: OWNER, requestedBy: OWNER, status: 'self_consented' }))
    );
  });
});

describe('firestore.rules — subjectConsentRequests — create — BRANCH 3 (controller anchors trustor)', () => {
  it('lets an admin/owner anchor someone else as subject with status controller_consented', async () => {
    const recordId = 'sc-create-controller-anchor';
    await seedRecord(recordId);

    await assertSucceeds(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .set(pendingPayload(recordId, { status: 'controller_consented', respondedAt: new Date() }))
    );
  });

  it('denies controller_consented when subjectId equals the caller (that path is self-add, branch 2)', async () => {
    const recordId = 'sc-create-controller-self-mismatch';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, ADMIN))
        .set(pendingPayload(recordId, { subjectId: ADMIN, status: 'controller_consented', respondedAt: new Date() }))
    );
  });

  it('denies controller_consented missing respondedAt', async () => {
    const recordId = 'sc-create-controller-no-respondedAt';
    await seedRecord(recordId);

    await assertFails(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .set(pendingPayload(recordId, { status: 'controller_consented' }))
    );
  });
});

describe('firestore.rules — subjectConsentRequests — update — BRANCH 1 (subject accepts/rejects)', () => {
  it('lets the subject accept', async () => {
    const recordId = 'sc-update-accept';
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

  it('lets the subject reject with a rejection payload', async () => {
    const recordId = 'sc-update-reject';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertSucceeds(
      testEnv
        .authenticatedContext(SUBJECT)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ status: 'rejected', respondedAt: new Date(), rejection: { type: 'request_rejected' } })
    );
  });

  it('lets the subject accept without setting respondedAt — optional in the diff', async () => {
    const recordId = 'sc-update-accept-no-respondedAt';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertSucceeds(
      testEnv.authenticatedContext(SUBJECT).firestore().doc(reqPath(recordId, SUBJECT)).update({ status: 'accepted' })
    );
  });

  it('denies a target status outside [accepted, rejected]', async () => {
    const recordId = 'sc-update-bad-status';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertFails(
      testEnv
        .authenticatedContext(SUBJECT)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ status: 'self_consented' })
    );
  });

  it('denies a non-timestamp respondedAt', async () => {
    const recordId = 'sc-update-bad-respondedAt';
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

  it("denies the subject sneaking a change into grantedAccessOnSubjectRequest (that's branch 2's field)", async () => {
    const recordId = 'sc-update-subject-cannot-touch-granted-flag';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertFails(
      testEnv
        .authenticatedContext(SUBJECT)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ status: 'accepted', grantedAccessOnSubjectRequest: true })
    );
  });

  it('denies a non-subject (requester or stranger) from accepting/rejecting on the subject\'s behalf', async () => {
    const recordId = 'sc-update-non-subject-denied';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT);

    await assertFails(
      testEnv.authenticatedContext(ADMIN).firestore().doc(reqPath(recordId, SUBJECT)).update({ status: 'accepted' })
    );
    await assertFails(
      testEnv.authenticatedContext(STRANGER).firestore().doc(reqPath(recordId, SUBJECT)).update({ status: 'accepted' })
    );
  });
});

describe('firestore.rules — subjectConsentRequests — update — BRANCH 2 (requester updates grantedAccessOnSubjectRequest)', () => {
  it('lets the requester flip grantedAccessOnSubjectRequest', async () => {
    const recordId = 'sc-update-granted-flag';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertSucceeds(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ grantedAccessOnSubjectRequest: true, lastModified: new Date() })
    );
  });

  it('denies the requester changing status through this branch', async () => {
    const recordId = 'sc-update-requester-cannot-set-status';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertFails(
      testEnv
        .authenticatedContext(ADMIN)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ status: 'accepted', grantedAccessOnSubjectRequest: true })
    );
  });

  it('denies a non-requester from updating grantedAccessOnSubjectRequest', async () => {
    const recordId = 'sc-update-granted-flag-non-requester';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertFails(
      testEnv
        .authenticatedContext(OWNER)
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .update({ grantedAccessOnSubjectRequest: true })
    );
  });
});

describe('firestore.rules — subjectConsentRequests — delete', () => {
  it('lets the requester delete', async () => {
    const recordId = 'sc-delete-requester';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertSucceeds(testEnv.authenticatedContext(ADMIN).firestore().doc(reqPath(recordId, SUBJECT)).delete());
  });

  it('lets an admin/owner delete even if they did not request it', async () => {
    const recordId = 'sc-delete-admin-owner';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertSucceeds(testEnv.authenticatedContext(OWNER).firestore().doc(reqPath(recordId, SUBJECT)).delete());
  });

  it('denies delete from the subject (not the requester, not admin/owner)', async () => {
    const recordId = 'sc-delete-subject-denied';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertFails(testEnv.authenticatedContext(SUBJECT).firestore().doc(reqPath(recordId, SUBJECT)).delete());
  });

  it('denies delete from a stranger', async () => {
    const recordId = 'sc-delete-stranger-denied';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertFails(testEnv.authenticatedContext(STRANGER).firestore().doc(reqPath(recordId, SUBJECT)).delete());
  });

  // Regression: consent requests are deleted before the record itself in
  // RecordDeletionService.deleteRecord (their admin/owner check needs the record to still
  // exist), so an orphan can only arise from a partial failure elsewhere — but once it happens,
  // isAdminOrOwnerOfRecord can never succeed again for a record that's gone, so without this the
  // orphaned request would be permanently undeletable by anyone.
  it('lets the named subject delete an orphaned request once its record no longer exists', async () => {
    const recordId = 'sc-delete-orphan-subject-allowed';
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertSucceeds(testEnv.authenticatedContext(SUBJECT).firestore().doc(reqPath(recordId, SUBJECT)).delete());
  });

  it('still denies the subject from deleting a request while the record still exists (live workflow protection unchanged)', async () => {
    const recordId = 'sc-delete-subject-still-denied-live';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertFails(testEnv.authenticatedContext(SUBJECT).firestore().doc(reqPath(recordId, SUBJECT)).delete());
  });

  it('still denies a stranger from deleting an orphaned request they have no relationship to', async () => {
    const recordId = 'sc-delete-orphan-stranger-denied';
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertFails(testEnv.authenticatedContext(STRANGER).firestore().doc(reqPath(recordId, SUBJECT)).delete());
  });
});

describe('firestore.rules — subjectConsentRequests — read', () => {
  it('lets the subject, the requester, and an uninvolved admin/owner all read', async () => {
    const recordId = 'sc-read-allowed';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertSucceeds(testEnv.authenticatedContext(SUBJECT).firestore().doc(reqPath(recordId, SUBJECT)).get());
    await assertSucceeds(testEnv.authenticatedContext(ADMIN).firestore().doc(reqPath(recordId, SUBJECT)).get());
    await assertSucceeds(testEnv.authenticatedContext(OWNER).firestore().doc(reqPath(recordId, SUBJECT)).get());
  });

  it('lets a platform admin read regardless of any relationship to the record', async () => {
    const recordId = 'sc-read-platform-admin';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertSucceeds(
      testEnv
        .authenticatedContext(PLATFORM_ADMIN, { platformAdmin: true })
        .firestore()
        .doc(reqPath(recordId, SUBJECT))
        .get()
    );
  });

  it('denies a stranger with no relationship to the request or record', async () => {
    const recordId = 'sc-read-stranger-denied';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertFails(testEnv.authenticatedContext(STRANGER).firestore().doc(reqPath(recordId, SUBJECT)).get());
  });

  it('denies an unauthenticated read', async () => {
    const recordId = 'sc-read-unauthenticated-denied';
    await seedRecord(recordId);
    await seedRequest(recordId, SUBJECT, { requestedBy: ADMIN });

    await assertFails(testEnv.unauthenticatedContext().firestore().doc(reqPath(recordId, SUBJECT)).get());
  });
});
