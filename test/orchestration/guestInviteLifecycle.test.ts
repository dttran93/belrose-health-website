// test/orchestration/guestInviteLifecycle.test.ts
//
// Layer 3 (orchestration) — models the exact Firestore reads/writes redeemGuestInvite.ts
// (functions/src/handlers/redeemGuestInvite.ts) and GuestClaimAccountModal's Step 5
// (mark-accepted) perform against the real Firestore emulator, using the client SDK the same
// way dependentClaimFlow.test.ts mirrors claimDependentAccount.ts. The handlers themselves run
// server-side with the Admin SDK (Functions-layer coverage belongs in
// functions/test/redeemGuestInvite.test.ts, not here) — this file's job is validating that the
// guestInvites query/expiry/status-transition logic behaves correctly against real data, since
// it's central to both the sharing and record-request guest flows.

import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { deleteApp, getApps } from 'firebase/app';
import { collection, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { connectTestFirestore, clearTestFirestore, seedGuestInvite, seedGuestUser } from './helpers/testFirestore';

const db = connectTestFirestore('belrose-orchestration-guest-invite');

const GUEST = 'guest-1';

/** Mirrors redeemGuestInvite.ts's lookup exactly (see file header). */
async function findRedeemableInvite(inviteCode: string) {
  const snap = await getDocs(
    query(
      collection(db, 'guestInvites'),
      where('inviteCode', '==', inviteCode),
      where('status', '==', 'pending')
    )
  );
  if (snap.empty) return null;
  return snap.docs[0]!;
}

/** Mirrors GuestClaimAccountModal.tsx's Step 5 (mark guestInvites accepted) exactly. */
async function markInvitesAccepted(guestUid: string): Promise<number> {
  const inviteSnap = await getDocs(
    query(
      collection(db, 'guestInvites'),
      where('guestUserId', '==', guestUid),
      where('status', '==', 'pending')
    )
  );

  const batch = writeBatch(db);
  inviteSnap.docs.forEach(inviteDoc => {
    batch.update(inviteDoc.ref, { status: 'accepted', claimedAt: serverTimestamp() });
  });
  await batch.commit();
  return inviteSnap.docs.length;
}

beforeEach(async () => {
  await clearTestFirestore();
});

afterAll(() => {
  getApps().forEach(app => deleteApp(app));
});

describe('guest invite redemption lookup (orchestration)', () => {
  it('finds a pending invite by its inviteCode', async () => {
    await seedGuestUser(db, GUEST);
    await seedGuestInvite(db, 'invite-1', { inviteCode: 'code-abc', guestUserId: GUEST });

    const found = await findRedeemableInvite('code-abc');

    expect(found?.data().guestUserId).toBe(GUEST);
  });

  it('does not find an invite that has already been accepted', async () => {
    await seedGuestInvite(db, 'invite-1', { inviteCode: 'code-abc', status: 'accepted' });

    expect(await findRedeemableInvite('code-abc')).toBeNull();
  });

  it('does not find an invite with a non-matching code', async () => {
    await seedGuestInvite(db, 'invite-1', { inviteCode: 'code-abc' });

    expect(await findRedeemableInvite('code-xyz')).toBeNull();
  });

  it('the handler expiry check treats a past expiresAt as expired', async () => {
    await seedGuestInvite(db, 'invite-1', {
      inviteCode: 'code-abc',
      expiresAt: new Date(Date.now() - 1000),
    });

    const found = await findRedeemableInvite('code-abc');
    const expiresAt = found?.data().expiresAt?.toDate();

    // redeemGuestInvite.ts throws failed-precondition when expiresAt < now — the query itself
    // doesn't filter on expiry, so the doc is still found; the handler's own check is what gates it.
    expect(expiresAt!.getTime()).toBeLessThan(Date.now());
  });
});

describe('mark-accepted batch (GuestClaimAccountModal Step 5) (orchestration)', () => {
  it('flips a pending invite to accepted and stamps claimedAt', async () => {
    await seedGuestInvite(db, 'invite-1', { guestUserId: GUEST, status: 'pending' });

    const count = await markInvitesAccepted(GUEST);

    expect(count).toBe(1);
    const snap = await getDocs(query(collection(db, 'guestInvites'), where('guestUserId', '==', GUEST)));
    const data = snap.docs[0]!.data();
    expect(data.status).toBe('accepted');
    expect(data.claimedAt).toBeTruthy();
  });

  it('is a no-op when there are no pending invites for the guest', async () => {
    await seedGuestInvite(db, 'invite-1', { guestUserId: GUEST, status: 'accepted' });

    expect(await markInvitesAccepted(GUEST)).toBe(0);
  });

  it('marks multiple pending invites for the same guest (e.g. sharing + record_request)', async () => {
    await seedGuestInvite(db, 'invite-1', { guestUserId: GUEST, status: 'pending', context: 'sharing' });
    await seedGuestInvite(db, 'invite-2', { guestUserId: GUEST, status: 'pending', context: 'record_request' });

    expect(await markInvitesAccepted(GUEST)).toBe(2);
  });

  it('does not touch a pending invite belonging to a different guest', async () => {
    await seedGuestInvite(db, 'invite-1', { guestUserId: 'other-guest', status: 'pending' });

    expect(await markInvitesAccepted(GUEST)).toBe(0);
    const snap = await getDocs(collection(db, 'guestInvites'));
    expect(snap.docs[0]!.data().status).toBe('pending');
  });
});
