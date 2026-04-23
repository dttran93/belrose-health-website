// functions/src/handlers/guestPasswordUpdate.ts

/**
 * Guest password update function. Important because the guest password only updates after 5 minutes by default
 * to prevent abuse. This allows guests to set their password in the guest flow, even if it takes longer than 5 minutes (which it usually does)
 */

import { HttpsError, onCall } from 'firebase-functions/https';
import * as admin from 'firebase-admin';

export const guestPasswordUpdate = onCall(async request => {
  const { newPassword } = request.data;
  const uid = request.auth?.uid;

  if (!uid) throw new HttpsError('unauthenticated', 'Not signed in');
  if (!newPassword || newPassword.length < 8) {
    throw new HttpsError('invalid-argument', 'Password must be at least 8 characters');
  }

  // Verify it's actually a guest account before allowing password set
  const inviteSnap = await admin
    .firestore()
    .collection('guestInvites')
    .where('guestUserId', '==', uid)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (inviteSnap.empty) {
    throw new HttpsError('permission-denied', 'Not an active guest account');
  }

  await admin.auth().updateUser(uid, { password: newPassword });

  // Return a fresh token so client can re-authenticate immediately
  const customToken = await admin.auth().createCustomToken(uid);
  return { success: true, customToken };
});
