// test/orchestration/dependentClaimFlow.test.ts
//
// Layer 3 (orchestration) — models the exact Firestore writes claimDependentAccount.ts performs
// (functions/src/handlers/claimDependentAccount.ts) against the real Firestore emulator, using
// the client SDK the same way registrationCompletion.test.ts mirrors RegistrationForm's writes.
// The real handler runs with the Admin SDK server-side (Functions-layer coverage for its own
// auth/precondition guards belongs in a future functions/test/claimDependentAccount.test.ts,
// not here) — this file's job is validating that once those exact writes land, the client-side
// reads that depend on them (the guardian-view dependents query) react correctly to the new
// shape: dependentCreatedBy actually REMOVED (not just falsy), isDependentRelationship flipped
// while isActive/status are left untouched (the guardian keeps controller access).

import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { deleteApp, getApps } from 'firebase/app';
import { collection, deleteField, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import {
  connectTestFirestore,
  clearTestFirestore,
  seedTrusteeRelationship,
  seedDependentUser,
} from './helpers/testFirestore';

const db = connectTestFirestore('belrose-orchestration-dependent-claim');

const DEPENDENT = 'dep-1';
const GUARDIAN = 'guardian-1';

/** Mirrors claimDependentAccount.ts's writes exactly (see file header). */
async function claimDependentAccount(dependentUid: string, guardianUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', dependentUid), {
    isDependent: false,
    emailVerified: false,
    dependentCreatedBy: deleteField(),
  });

  const relId = `${dependentUid}_${guardianUid}`;
  const relSnap = await getDoc(doc(db, 'trusteeRelationships', relId));
  if (relSnap.exists()) {
    await updateDoc(doc(db, 'trusteeRelationships', relId), { isDependentRelationship: false });
  }
}

async function queryGuardianDependents(guardianUid: string): Promise<string[]> {
  const snap = await getDocs(
    query(
      collection(db, 'trusteeRelationships'),
      where('trusteeId', '==', guardianUid),
      where('isDependentRelationship', '==', true),
      where('isActive', '==', true)
    )
  );
  return snap.docs.map(d => d.data().trustorId as string);
}

beforeEach(async () => {
  await clearTestFirestore();
});

afterAll(() => {
  getApps().forEach(app => deleteApp(app));
});

describe('dependent claim flow writes (orchestration)', () => {
  it('flips isDependent to false, resets emailVerified, and REMOVES dependentCreatedBy entirely', async () => {
    await seedDependentUser(db, DEPENDENT, GUARDIAN, { emailVerified: true });

    await claimDependentAccount(DEPENDENT, GUARDIAN);

    const snap = await getDoc(doc(db, 'users', DEPENDENT));
    const data = snap.data()!;
    expect(data.isDependent).toBe(false);
    expect(data.emailVerified).toBe(false);
    expect('dependentCreatedBy' in data).toBe(false);
  });

  it('flips the relationship isDependentRelationship to false while leaving isActive/status untouched', async () => {
    await seedDependentUser(db, DEPENDENT, GUARDIAN);
    await seedTrusteeRelationship(db, DEPENDENT, GUARDIAN);

    await claimDependentAccount(DEPENDENT, GUARDIAN);

    const snap = await getDoc(doc(db, 'trusteeRelationships', `${DEPENDENT}_${GUARDIAN}`));
    const data = snap.data()!;
    expect(data.isDependentRelationship).toBe(false);
    // The guardian keeps controller access — claiming does NOT deactivate the relationship.
    expect(data.isActive).toBe(true);
    expect(data.status).toBe('active');
    expect(data.trustLevel).toBe('controller');
  });

  it('does not throw when there is no matching relationship doc (defensive .exists() check)', async () => {
    await seedDependentUser(db, DEPENDENT, GUARDIAN);
    // No trusteeRelationships doc seeded at all.
    await expect(claimDependentAccount(DEPENDENT, GUARDIAN)).resolves.toBeUndefined();
  });

  it('downstream read: the claimed dependent drops out of the guardian-view query', async () => {
    await seedDependentUser(db, DEPENDENT, GUARDIAN);
    await seedTrusteeRelationship(db, DEPENDENT, GUARDIAN);
    expect(await queryGuardianDependents(GUARDIAN)).toEqual([DEPENDENT]);

    await claimDependentAccount(DEPENDENT, GUARDIAN);

    expect(await queryGuardianDependents(GUARDIAN)).toEqual([]);
  });
});
