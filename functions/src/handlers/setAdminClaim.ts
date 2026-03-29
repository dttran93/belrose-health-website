// functions/src/handlers/setAdminClaim.ts
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const setPlatformAdmin = onCall(async request => {
  // Gate: only existing platform admins can grant this role
  if (!request.auth?.token?.platformAdmin) {
    throw new HttpsError('permission-denied', 'Not authorized');
  }

  // The UID of the user you want to make admin comes from the call data
  const { uid } = request.data;
  if (!uid || typeof uid !== 'string') {
    throw new HttpsError('invalid-argument', 'A valid uid is required');
  }

  await admin.auth().setCustomUserClaims(uid, { platformAdmin: true });
  return { success: true };
});
