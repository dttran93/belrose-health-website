// functions/test/removeDependentRelationship.test.ts
//
// Functions layer — removeDependentRelationship: the server's real revoke-vs-delete branch.
// The exhaustive 4-combination matrix below (isUnclaimed x handoffInitiated) is the highest-
// value test in this file — it's the source of truth the client's RemoveDialog.willDelete
// heuristic (isDependent && !handoffInitiatedAt) is cross-checked against (see
// RemoveDialog.test.tsx). Only one of the four combinations — unclaimed AND no handoff sent —
// results in a full delete; the other three are revoke-only. If this handler's branching ever
// drifts from RemoveDialog's client-side guess, this test starts failing independently of the
// client-side one.

import { beforeEach, describe, expect, it } from 'vitest';
import * as admin from 'firebase-admin';
import { buildRequest } from './helpers/callableRequest';
import { clearFirestore, deleteAllAuthUsers } from './helpers/testAdmin';

import { removeDependentRelationship } from '../src/handlers/removeDependentRelationship';

const DEPENDENT = 'dep-1';
const GUARDIAN = 'guardian-1';

async function seedActiveControllerRelationship(overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .collection('trusteeRelationships')
    .doc(`${DEPENDENT}_${GUARDIAN}`)
    .set({
      trustorId: DEPENDENT,
      trusteeId: GUARDIAN,
      trustLevel: 'controller',
      isActive: true,
      status: 'active',
      isDependentRelationship: true,
      ...overrides,
    });
}

async function seedDependentUser(overrides: Record<string, unknown> = {}) {
  await admin.auth().createUser({ uid: DEPENDENT, email: 'dep-abc@placeholder.belrose.health' });
  await admin
    .firestore()
    .collection('users')
    .doc(DEPENDENT)
    .set({ uid: DEPENDENT, isDependent: true, handoffInitiatedAt: null, ...overrides });
}

beforeEach(async () => {
  await clearFirestore();
  await deleteAllAuthUsers();
});

describe('removeDependentRelationship — guard clauses', () => {
  it('throws unauthenticated when there is no caller', async () => {
    await expect(
      removeDependentRelationship.run(buildRequest({ dependentUid: DEPENDENT }))
    ).rejects.toThrow('authenticated');
  });

  it('throws invalid-argument when dependentUid is missing', async () => {
    await expect(
      removeDependentRelationship.run(buildRequest({}, GUARDIAN))
    ).rejects.toThrow('Missing dependentUid');
  });

  it('throws permission-denied when there is no relationship doc at all', async () => {
    await expect(
      removeDependentRelationship.run(buildRequest({ dependentUid: DEPENDENT }, GUARDIAN))
    ).rejects.toThrow('Not an active controller');
  });

  it('throws permission-denied when the relationship is inactive', async () => {
    await seedActiveControllerRelationship({ isActive: false });
    await expect(
      removeDependentRelationship.run(buildRequest({ dependentUid: DEPENDENT }, GUARDIAN))
    ).rejects.toThrow('Not an active controller');
  });

  it('throws permission-denied when the trustLevel is not controller', async () => {
    await seedActiveControllerRelationship({ trustLevel: 'observer' });
    await expect(
      removeDependentRelationship.run(buildRequest({ dependentUid: DEPENDENT }, GUARDIAN))
    ).rejects.toThrow('Not an active controller');
  });
});

describe('removeDependentRelationship — the 4-combination revoke-vs-delete matrix', () => {
  it.each([
    { isUnclaimed: true, handoffInitiated: false, willDelete: true, label: 'unclaimed, no handoff -> DELETE' },
    { isUnclaimed: true, handoffInitiated: true, willDelete: false, label: 'unclaimed, handoff sent -> revoke only' },
    { isUnclaimed: false, handoffInitiated: false, willDelete: false, label: 'claimed, no handoff -> revoke only' },
    { isUnclaimed: false, handoffInitiated: true, willDelete: false, label: 'claimed, handoff sent -> revoke only' },
  ])('$label', async ({ isUnclaimed, handoffInitiated, willDelete }) => {
    await seedActiveControllerRelationship();
    await seedDependentUser({
      isDependent: isUnclaimed,
      handoffInitiatedAt: handoffInitiated ? admin.firestore.Timestamp.now() : null,
    });

    const result = await removeDependentRelationship.run(
      buildRequest({ dependentUid: DEPENDENT }, GUARDIAN)
    );
    expect(result).toEqual({ success: true });

    const relSnap = await admin
      .firestore()
      .collection('trusteeRelationships')
      .doc(`${DEPENDENT}_${GUARDIAN}`)
      .get();
    const relData = relSnap.data()!;
    expect(relData.isActive).toBe(false);
    expect(relData.status).toBe('revoked');
    expect(relData.revokedBy).toBe(GUARDIAN);

    const userSnap = await admin.firestore().collection('users').doc(DEPENDENT).get();
    let authUserExists = true;
    try {
      await admin.auth().getUser(DEPENDENT);
    } catch {
      authUserExists = false;
    }

    if (willDelete) {
      expect(userSnap.exists).toBe(false);
      expect(authUserExists).toBe(false);
    } else {
      expect(userSnap.exists).toBe(true);
      expect(authUserExists).toBe(true);
      // Revoke-only also clears isDependentRelationship, dropping it from the switcher query.
      expect(relData.isDependentRelationship).toBe(false);
    }
  });
});
