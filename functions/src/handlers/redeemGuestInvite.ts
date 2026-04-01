// functions/src/handlers/redeemGuestInvite.ts

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface RedeemGuestInviteResult {
  customToken: string;
  guestUid: string;
}

export const redeemGuestInvite = onCall(async (request): Promise<RedeemGuestInviteResult> => {
  const { inviteCode } = request.data;

  if (!inviteCode || typeof inviteCode !== 'string') {
    throw new HttpsError('invalid-argument', 'Invite code is required.');
  }

  const db = admin.firestore();

  // ── Find invite by code ──────────────────────────────────────────────────
  const inviteSnap = await db
    .collection('guestInvites')
    .where('inviteCode', '==', inviteCode)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (inviteSnap.empty) {
    throw new HttpsError('not-found', 'Invite not found or already used.');
  }

  const inviteDoc = inviteSnap.docs[0];
  const invite = inviteDoc.data();

  // ── Check expiry ─────────────────────────────────────────────────────────
  const now = new Date();
  const expiresAt = invite.expiresAt?.toDate();

  if (!expiresAt || expiresAt < now) {
    throw new HttpsError(
      'failed-precondition',
      `This invite expired on ${
        expiresAt?.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }) ?? 'an unknown date'
      }.`
    );
  }

  // ── Mint a fresh custom token ────────────────────────────────────────────
  // Custom tokens expire in 1 hour — we mint fresh on each click so the
  // invite URL itself never expires, only the underlying guestInvites doc does.
  const customToken = await admin.auth().createCustomToken(invite.guestUserId, {
    isGuest: true,
  });

  console.log(`✅ Guest invite redeemed for: ${invite.guestUserId}`);

  return {
    customToken,
    guestUid: invite.guestUserId,
  };
});
