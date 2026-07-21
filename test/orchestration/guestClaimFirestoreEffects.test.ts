// test/orchestration/guestClaimFirestoreEffects.test.ts
//
// Layer 3 (orchestration) — models the exact atomic-batch Firestore writes
// GuestClaimAccountModal.tsx's handleClaim performs (Step 1a wrappedKeys rewrap flags, Step 2
// user profile, Step 2b recordRequests targetUserId backfill) against the real Firestore
// emulator, using the client SDK the same way dependentClaimFlow.test.ts mirrors
// claimDependentAccount.ts. The component itself is covered at the unit layer
// (GuestClaimAccountModal.test.tsx, with Firestore mocked) — this file's job is validating that
// once those exact batched writes land against a real Firestore, the downstream reads that
// depend on them (wrappedKeys no longer flagged isGuest/expiring, recordRequests findable by
// targetUserId) actually reflect the new shape.

import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { deleteApp, getApps } from 'firebase/app';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { connectTestFirestore, clearTestFirestore, seedGuestUser } from './helpers/testFirestore';

const db = connectTestFirestore('belrose-orchestration-guest-claim');

const GUEST = 'guest-1';

/** Mirrors GuestClaimAccountModal.tsx's atomic batch (Steps 1a, 2, 2b) exactly. */
async function claimGuestAccount(
  guestUid: string,
  guestEmail: string,
  rewrapRecordIds: string[]
): Promise<void> {
  const batch = writeBatch(db);

  // Step 1a — rewrap guest file keys, clear expiresAt, flip isGuest/isCreator.
  for (const recordId of rewrapRecordIds) {
    const docId = `${recordId}_${guestUid}`;
    batch.update(doc(db, 'wrappedKeys', docId), {
      wrappedKey: 'rewrapped-key',
      isCreator: false,
      isGuest: false,
      expiresAt: deleteField(),
      claimedAt: serverTimestamp(),
    });
  }

  // Step 2 — user profile.
  batch.update(doc(db, 'users', guestUid), {
    displayName: 'Jane Smith',
    firstName: 'Jane',
    lastName: 'Smith',
    isGuest: false,
    emailVerified: true,
    emailVerifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    encryption: {
      enabled: true,
      encryptedMasterKey: 'enc-master-key',
      masterKeyIV: 'master-key-iv',
      masterKeySalt: 'master-key-salt',
      recoveryKeyHash: 'recovery-key-hash',
      publicKey: 'new-public-key',
      encryptedPrivateKey: 'enc-private-key',
      encryptedPrivateKeyIV: 'private-key-iv',
      setupAt: new Date().toISOString(),
    },
  });

  // Step 2b — backfill targetUserId on recordRequests addressed to this guest's email.
  const backfillSnap = await getDocs(
    query(
      collection(db, 'recordRequests'),
      where('targetEmail', '==', guestEmail),
      where('status', 'in', ['pending', 'fulfilled'])
    )
  );
  backfillSnap.docs.forEach(requestDoc => {
    batch.update(requestDoc.ref, { targetUserId: guestUid });
  });

  await batch.commit();
}

beforeEach(async () => {
  await clearTestFirestore();
});

afterAll(() => {
  getApps().forEach(app => deleteApp(app));
});

describe('guest claim atomic batch writes (orchestration)', () => {
  it('flips isGuest to false and writes the full encryption block on the user profile', async () => {
    await seedGuestUser(db, GUEST);

    await claimGuestAccount(GUEST, `${GUEST}@example.com`, []);

    const snap = await getDoc(doc(db, 'users', GUEST));
    const data = snap.data()!;
    expect(data.isGuest).toBe(false);
    expect(data.encryption.enabled).toBe(true);
    expect(data.encryption.publicKey).toBe('new-public-key');
  });

  it('rewraps wrappedKeys docs and REMOVES expiresAt entirely (not just falsy)', async () => {
    await seedGuestUser(db, GUEST);
    await setDoc(doc(db, 'wrappedKeys', `rec-1_${GUEST}`), {
      wrappedKey: 'guest-wrapped-key',
      isCreator: true,
      isGuest: true,
      expiresAt: new Date(Date.now() + 1000),
    });

    await claimGuestAccount(GUEST, `${GUEST}@example.com`, ['rec-1']);

    const snap = await getDoc(doc(db, 'wrappedKeys', `rec-1_${GUEST}`));
    const data = snap.data()!;
    expect(data.isGuest).toBe(false);
    expect(data.isCreator).toBe(false);
    expect('expiresAt' in data).toBe(false);
  });

  it('backfills targetUserId on matching pending/fulfilled recordRequests by email', async () => {
    await seedGuestUser(db, GUEST);
    await setDoc(doc(db, 'recordRequests', 'req-1'), {
      targetEmail: `${GUEST}@example.com`,
      status: 'pending',
    });
    await setDoc(doc(db, 'recordRequests', 'req-2'), {
      targetEmail: `${GUEST}@example.com`,
      status: 'fulfilled',
    });
    await setDoc(doc(db, 'recordRequests', 'req-3'), {
      targetEmail: `${GUEST}@example.com`,
      status: 'cancelled', // not in ['pending','fulfilled'] — should be left alone
    });

    await claimGuestAccount(GUEST, `${GUEST}@example.com`, []);

    const req1 = await getDoc(doc(db, 'recordRequests', 'req-1'));
    const req2 = await getDoc(doc(db, 'recordRequests', 'req-2'));
    const req3 = await getDoc(doc(db, 'recordRequests', 'req-3'));
    expect(req1.data()!.targetUserId).toBe(GUEST);
    expect(req2.data()!.targetUserId).toBe(GUEST);
    expect('targetUserId' in req3.data()!).toBe(false);
  });

  it('does not backfill recordRequests addressed to a different email', async () => {
    await seedGuestUser(db, GUEST);
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'recordRequests', 'req-1'), {
      targetEmail: 'someone-else@example.com',
      status: 'pending',
    });

    await claimGuestAccount(GUEST, `${GUEST}@example.com`, []);

    const req1 = await getDoc(doc(db, 'recordRequests', 'req-1'));
    expect('targetUserId' in req1.data()!).toBe(false);
  });
});
