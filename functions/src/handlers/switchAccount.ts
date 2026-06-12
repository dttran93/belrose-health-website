// functions/src/handlers/switchAccount.ts
// Custom-token account switching for guardian ↔ dependent sessions.
//
// Guardian → dependent: verify caller has an active controller trustee
//   relationship with the target dependent, then issue a custom token.
//
// Dependent → guardian: verify the caller's profile shows this guardian
//   as dependentCreatedBy, then issue a custom token for the guardian.
//
// Using custom tokens (not signInWithEmailAndPassword) means the guardian's
// password is never needed for day-to-day switching — it's reserved for the
// dependent's eventual independent login and the handoff flow.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

export const switchToDependent = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

  const guardianUid = request.auth.uid;
  const { dependentUid } = request.data as { dependentUid: string };

  if (!dependentUid) throw new HttpsError('invalid-argument', 'dependentUid is required');
  if (dependentUid === guardianUid) throw new HttpsError('invalid-argument', 'Cannot switch to yourself');

  const db = getFirestore();

  // Verify the active controller relationship exists
  const relationshipId = `${dependentUid}_${guardianUid}`;
  const relDoc = await db.collection('trusteeRelationships').doc(relationshipId).get();

  if (!relDoc.exists) throw new HttpsError('not-found', 'No trustee relationship found');

  const rel = relDoc.data()!;
  if (!rel.isDependentRelationship || !rel.isActive || rel.trustLevel !== 'controller') {
    throw new HttpsError('permission-denied', 'Not an active controller for this dependent');
  }

  const token = await admin.auth().createCustomToken(dependentUid);
  console.log(`✅ Guardian ${guardianUid} switched to dependent ${dependentUid}`);
  return { token };
});

export const switchToGuardian = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

  const dependentUid = request.auth.uid;
  const { guardianUid } = request.data as { guardianUid: string };

  if (!guardianUid) throw new HttpsError('invalid-argument', 'guardianUid is required');

  const db = getFirestore();

  // Verify caller is actually a dependent of this guardian
  const userDoc = await db.collection('users').doc(dependentUid).get();
  if (!userDoc.exists) throw new HttpsError('not-found', 'User not found');

  const userData = userDoc.data()!;
  if (!userData.isDependent || userData.dependentCreatedBy !== guardianUid) {
    throw new HttpsError('permission-denied', 'Not a dependent of this guardian');
  }

  const token = await admin.auth().createCustomToken(guardianUid);
  console.log(`✅ Dependent ${dependentUid} returned to guardian ${guardianUid}`);
  return { token };
});
