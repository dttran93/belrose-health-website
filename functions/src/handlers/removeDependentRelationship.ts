// functions/src/handlers/removeDependentRelationship.ts
// Removes the guardian's controller relationship with a dependent.
//
// Behaviour depends on account state:
//   - Unclaimed AND handoff not initiated: deletes the Firebase Auth user entirely
//     (nobody is expecting this account; safe to clean up fully)
//   - Unclaimed BUT handoff initiated: revoke only — dependent may be mid-claim
//   - Claimed: revoke only — dependent keeps their account, guardian loses Controller access.
//     The dependent keeps their account; the guardian loses Controller access.
//
// On-chain note: revokeTrustee on MemberRoleManager is onlyActiveMember, so the admin
// wallet cannot call it. Firestore is the primary access gate for the app. On-chain
// revocation from the guardian's client wallet can be wired separately if needed.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';

interface RemoveDependentRequest {
  dependentUid: string;
}

export const removeDependentRelationship = onCall(
  {},
  async (request): Promise<{ success: boolean }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

    const guardianUid = request.auth.uid;
    const { dependentUid } = request.data as RemoveDependentRequest;

    if (!dependentUid) throw new HttpsError('invalid-argument', 'Missing dependentUid');

    const db = getFirestore();

    // Verify caller is an active controller trustee of the dependent
    const relId = `${dependentUid}_${guardianUid}`;
    const relRef = db.collection('trusteeRelationships').doc(relId);
    const relDoc = await relRef.get();

    if (!relDoc.exists || !relDoc.data()?.isActive || relDoc.data()?.trustLevel !== 'controller') {
      throw new HttpsError('permission-denied', 'Not an active controller of this account');
    }

    // Check account state
    const dependentDoc = await db.collection('users').doc(dependentUid).get();
    const dependentData = dependentDoc.data() ?? {};
    const isUnclaimed = dependentData.isDependent === true;
    const handoffInitiated = !!dependentData.handoffInitiatedAt;

    const now = Timestamp.now();

    const revokeOnly = !isUnclaimed || handoffInitiated;

    if (revokeOnly) {
      // Claimed or handoff already sent — revoke access, leave account intact
      await relRef.update({
        isActive: false,
        status: 'revoked',
        isDependentRelationship: false,
        revokedAt: now,
        revokedBy: guardianUid,
      });

      console.log(
        `✅ Guardian access revoked for dependent ${dependentUid} by ${guardianUid}` +
          (handoffInitiated && isUnclaimed ? ' (handoff in progress — account preserved)' : '')
      );
    } else {
      // Unclaimed, no handoff initiated — full cleanup
      await relRef.update({
        isActive: false,
        status: 'revoked',
        revokedAt: now,
        revokedBy: guardianUid,
      });

      await db.collection('users').doc(dependentUid).delete();

      try {
        await admin.auth().deleteUser(dependentUid);
      } catch (err) {
        console.warn(`Could not delete Auth user ${dependentUid}:`, err);
      }

      console.log(`✅ Unclaimed dependent ${dependentUid} fully removed by ${guardianUid}`);
    }

    return { success: true };
  }
);
