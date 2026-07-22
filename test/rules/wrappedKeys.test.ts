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
import { doc, writeBatch } from 'firebase/firestore';
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

  // Bootstrap branch: uploadUtils.createFirestoreRecord and userIdentityService.saveUserIdentityRecord
  // write the records/{recordId} doc and its creator's wrappedKeys doc in a single writeBatch() so an
  // encrypted record can never end up with no wrappedKey. Security rules evaluate get()/exists() against
  // the pre-batch snapshot, so isSharerOrAboveOnRecord's get() on the sibling record can't see it — the
  // record genuinely doesn't exist yet from the rule's point of view during that same-batch write.
  it("lets the caller create their own creator wrappedKey in the same batch as the record's own creation", async () => {
    const recordId = 'wk-create-bootstrap-same-batch';
    const db = testEnv.authenticatedContext('uploader-uid').firestore();

    const batch = writeBatch(db);
    batch.set(doc(db, 'records', recordId), {
      uploadedBy: 'uploader-uid',
      owners: [],
      administrators: ['uploader-uid'],
      isEncrypted: true,
    });
    batch.set(doc(db, 'wrappedKeys', `${recordId}_uploader-uid`), {
      recordId,
      userId: 'uploader-uid',
      wrappedKey: 'fake',
      isCreator: true,
      isActive: true,
    });

    await assertSucceeds(batch.commit());
  });

  it('denies creating an isCreator wrappedKey for someone else on a record that does not exist yet', async () => {
    const recordId = 'wk-create-bootstrap-denies-other-user';

    await assertFails(
      testEnv
        .authenticatedContext(STRANGER)
        .firestore()
        .doc(`wrappedKeys/${recordId}_${RECEIVER}`)
        .set({ recordId, userId: RECEIVER, isCreator: true, isActive: true })
    );
  });

  it('denies the bootstrap branch once the record already exists — falls back to isSharerOrAboveOnRecord', async () => {
    const recordId = 'wk-create-bootstrap-denied-record-exists';
    await seedRecord(recordId);

    // VIEWER holds a role but is below sharer — same as the existing "denies a viewer" case above,
    // this just also pins that an existing record can't be routed through the bootstrap branch.
    await assertFails(
      testEnv
        .authenticatedContext(VIEWER)
        .firestore()
        .doc(`wrappedKeys/${recordId}_${VIEWER}`)
        .set({ recordId, userId: VIEWER, isCreator: true, isActive: true })
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

describe('firestore.rules — wrappedKeys — read (sharer+ management, or your own key while you hold a role)', () => {
  // Previously `allow read: if request.auth != null` — any authenticated user could read any
  // wrappedKey regardless of relationship to the record. RSA-wrapping makes that harmless for
  // OTHER people's keys (you can't unwrap without their private key), but it meant a
  // fully-revoked user (stripped from every role array) could still fetch — and re-fetch,
  // forever — their OWN wrappedKey directly from Firestore, bypassing the app's isActive check
  // in RecordDecryptionService. Current rule:
  //   allow read: if request.auth != null && (
  //     isSharerOrAboveOnRecord(resource.data.recordId) ||
  //     (resource.data.userId == request.auth.uid && hasRoleOnRecord(resource.data.recordId))
  //   );
  // hasRoleOnRecord already existed (used by the records/{recordId} read rule) and checks
  // uploadedBy/owners/administrators/sharers/viewers/subjects against request.auth.uid — no new
  // helper needed since the self-read clause only ever evaluates it for the caller's own uid.
  //
  // seedRecord always seeds: owners:[OWNER], administrators:[ADMIN], sharers:[SHARER,OTHER_SHARER],
  // viewers:[VIEWER]. RECEIVER holds no role on it at all — standing in for "never added yet"
  // (mid-grant, before the role-array update) and "fully revoked" (after it), which look
  // identical from the rule's point of view: no entry in any role array.

  it('denies a stranger with no role at all from reading someone else\'s key', async () => {
    const recordId = 'wk-read-stranger-denied';
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: VIEWER, grantedBy: SHARER, isActive: true });

    await assertFails(testEnv.authenticatedContext(STRANGER).firestore().doc('wrappedKeys/key-1').get());
  });

  it('denies a plain viewer (has a role, but not sharer+) from reading someone else\'s key', async () => {
    const recordId = 'wk-read-viewer-cannot-read-others';
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: RECEIVER, grantedBy: SHARER, isActive: true });

    await assertFails(testEnv.authenticatedContext(VIEWER).firestore().doc('wrappedKeys/key-1').get());
  });

  it('denies a user from reading their own key once they no longer hold any role on the record (revoked)', async () => {
    const recordId = 'wk-read-self-revoked-denied';
    await seedRecord(recordId);
    // RECEIVER has no role here — simulates the state AFTER a full revoke completes (role-array
    // removal is always the last step in removeViewer/removeAdmin/etc, so by the time a
    // standalone re-fetch happens, the user is already stripped from every array).
    await seedWrappedKey(recordId, 'key-1', { userId: RECEIVER, grantedBy: SHARER, isActive: false });

    await assertFails(testEnv.authenticatedContext(RECEIVER).firestore().doc('wrappedKeys/key-1').get());
  });

  it('lets a sharer read any key on a record they can manage', async () => {
    const recordId = 'wk-read-sharer-management';
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: RECEIVER, grantedBy: SHARER, isActive: true });

    await assertSucceeds(testEnv.authenticatedContext(SHARER).firestore().doc('wrappedKeys/key-1').get());
  });

  it('lets an admin read a key with no active role yet — the mid-grant reactivation check', async () => {
    const recordId = 'wk-read-admin-reactivation';
    // RECEIVER has no role on this record — simulates the moment mid-grant where
    // SharingService.grantEncryptionAccess reads a target's existing key BEFORE the record's
    // role arrays are updated (grantViewer only adds to viewers[] in its last step).
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: RECEIVER, grantedBy: ADMIN, isActive: false });

    await assertSucceeds(testEnv.authenticatedContext(ADMIN).firestore().doc('wrappedKeys/key-1').get());
  });

  it('lets a user read their own key while they still hold a role on the record', async () => {
    const recordId = 'wk-read-self-active-participant';
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: VIEWER, grantedBy: SHARER, isActive: true });

    await assertSucceeds(testEnv.authenticatedContext(VIEWER).firestore().doc('wrappedKeys/key-1').get());
  });

  it('lets a user read their own PENDING key even while inactive, as long as they already hold a role (trustee accept-flow)', async () => {
    const recordId = 'wk-read-self-pending-trustee';
    // Trustees are added to the record's role arrays at grant time, before they've accepted —
    // wrappedKey stays isActive:false until TrusteePermissionService.activatePendingTrusteeAccess
    // flips it. "Participant" and "wrappedKey active" are independent signals in this schema,
    // which is exactly what makes gating on participant-status safe for this flow.
    await seedRecord(recordId);
    await seedWrappedKey(recordId, 'key-1', { userId: VIEWER, grantedBy: SHARER, isActive: false });

    await assertSucceeds(testEnv.authenticatedContext(VIEWER).firestore().doc('wrappedKeys/key-1').get());
  });
});
