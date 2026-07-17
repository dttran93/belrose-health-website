// test/orchestration/dependentAccountService.test.ts
//
// Layer 3 (orchestration) — DependentAccountService.createAccount only calls a Cloud Function
// (no direct Firestore writes from the client, see the unit suite for that call-wiring), so
// this file is more valuable pointed at the READS that happen after account creation: the
// guardian-view query useSwitchableAccounts builds (trusteeId==uid && isDependentRelationship==
// true && isActive==true), run here directly against the real Firestore emulator rather than
// through the React hook, mirroring the same "test the real query, not the hook" approach
// registrationCompletion.test.ts uses for RegistrationForm's writes.

import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { deleteApp, getApps } from 'firebase/app';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import {
  connectTestFirestore,
  clearTestFirestore,
  seedTrusteeRelationship,
  seedDependentUser,
} from './helpers/testFirestore';

const db = connectTestFirestore('belrose-orchestration-dependent-account');

const GUARDIAN = 'guardian-1';

/** Mirrors useSwitchableAccounts' guardian-view onSnapshot query exactly. */
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

describe('guardian-view dependents query (orchestration)', () => {
  it('returns dependents whose relationship matches all three filters', async () => {
    await seedDependentUser(db, 'dep-1', GUARDIAN);
    await seedTrusteeRelationship(db, 'dep-1', GUARDIAN);

    expect(await queryGuardianDependents(GUARDIAN)).toEqual(['dep-1']);
  });

  it('excludes a relationship belonging to a different guardian', async () => {
    await seedDependentUser(db, 'dep-1', 'other-guardian');
    await seedTrusteeRelationship(db, 'dep-1', 'other-guardian');

    expect(await queryGuardianDependents(GUARDIAN)).toEqual([]);
  });

  it('excludes an inactive relationship', async () => {
    await seedDependentUser(db, 'dep-1', GUARDIAN);
    await seedTrusteeRelationship(db, 'dep-1', GUARDIAN, { isActive: false });

    expect(await queryGuardianDependents(GUARDIAN)).toEqual([]);
  });

  it('excludes a plain (non-dependent) trustee relationship', async () => {
    await seedTrusteeRelationship(db, 'trustor-1', GUARDIAN, { isDependentRelationship: false });

    expect(await queryGuardianDependents(GUARDIAN)).toEqual([]);
  });

  it('drops a dependent from the results once isDependentRelationship flips to false (post-claim)', async () => {
    await seedDependentUser(db, 'dep-1', GUARDIAN);
    await seedTrusteeRelationship(db, 'dep-1', GUARDIAN);
    expect(await queryGuardianDependents(GUARDIAN)).toEqual(['dep-1']);

    await updateDoc(doc(db, 'trusteeRelationships', 'dep-1_guardian-1'), {
      isDependentRelationship: false,
    });

    expect(await queryGuardianDependents(GUARDIAN)).toEqual([]);
  });
});
