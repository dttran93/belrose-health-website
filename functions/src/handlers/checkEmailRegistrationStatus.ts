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
    const usersRef = admin.firestore().collection('users');

    const snapshot = await usersRef
      .where('email', '==', email.toLowerCase().trim())
      .where('isGuest', '==', false)
      .limit(1)
      .select()
      .get();

    return {
      isRegistered: !snapshot.empty,
    };
  } catch (error) {
    console.error('Error checking user registration status:', error);
    throw new functions.https.HttpsError('internal', 'Unable to check registration status.');
  }
});
