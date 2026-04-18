// firebase/functions/src/handlers/checkEmailRegistrationStatus.ts

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Checks if an email is associated with a full account.
 * 'email' is the direct argument passed from the client.
 */
export const checkEmailRegistrationStatus = functions.https.onCall(async request => {
  const { email } = request.data as { email: string };

  if (!email || typeof email !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with a valid email string.'
    );
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email.toLowerCase().trim());
    const userDoc = await admin.firestore().collection('users').doc(userRecord.uid).get();

    return {
      isRegistered: userDoc.exists && !userDoc.data()?.isGuest,
    };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return { isRegistered: false };
    }
    throw new functions.https.HttpsError('internal', 'Unable to check registration status.');
  }
});
