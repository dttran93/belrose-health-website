// functions/test/switchAccount.test.ts
//
// Functions layer — switchToDependent / switchToGuardian: mints a custom token for the target
// uid after verifying the caller's relationship to it. Each guard clause in the compound `&&`
// conditions is isolated into its own test so it's clear which specific clause fires, and the
// happy-path tests decode the returned custom token's JWT payload to confirm it targets the
// correct uid (not just "a token came back").

import { beforeEach, describe, expect, it } from 'vitest';
import * as admin from 'firebase-admin';
import { buildRequest } from './helpers/callableRequest';
import { clearFirestore, deleteAllAuthUsers } from './helpers/testAdmin';

import { switchToDependent, switchToGuardian } from '../src/handlers/switchAccount';

const DEPENDENT = 'dep-1';
const GUARDIAN = 'guardian-1';

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8'));
}

async function seedRelationship(overrides: Record<string, unknown> = {}) {
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

beforeEach(async () => {
  await clearFirestore();
  await deleteAllAuthUsers();
});

describe('switchToDependent', () => {
  it('throws unauthenticated when there is no caller', async () => {
    await expect(
      switchToDependent.run(buildRequest({ dependentUid: DEPENDENT }))
    ).rejects.toThrow('authenticated');
  });

  it('throws invalid-argument when dependentUid is missing', async () => {
    await expect(switchToDependent.run(buildRequest({}, GUARDIAN))).rejects.toThrow(
      'dependentUid is required'
    );
  });

  it('throws invalid-argument when switching to yourself', async () => {
    await expect(
      switchToDependent.run(buildRequest({ dependentUid: GUARDIAN }, GUARDIAN))
    ).rejects.toThrow('Cannot switch to yourself');
  });

  it('throws not-found when there is no relationship doc at all', async () => {
    await expect(
      switchToDependent.run(buildRequest({ dependentUid: DEPENDENT }, GUARDIAN))
    ).rejects.toThrow('No trustee relationship found');
  });

  it('throws permission-denied when isDependentRelationship is false', async () => {
    await seedRelationship({ isDependentRelationship: false });
    await expect(
      switchToDependent.run(buildRequest({ dependentUid: DEPENDENT }, GUARDIAN))
    ).rejects.toThrow('Not an active controller for this dependent');
  });

  it('throws permission-denied when the relationship is inactive', async () => {
    await seedRelationship({ isActive: false });
    await expect(
      switchToDependent.run(buildRequest({ dependentUid: DEPENDENT }, GUARDIAN))
    ).rejects.toThrow('Not an active controller for this dependent');
  });

  it('throws permission-denied when trustLevel is not controller', async () => {
    await seedRelationship({ trustLevel: 'observer' });
    await expect(
      switchToDependent.run(buildRequest({ dependentUid: DEPENDENT }, GUARDIAN))
    ).rejects.toThrow('Not an active controller for this dependent');
  });

  it('mints a custom token for the dependent uid on success', async () => {
    await seedRelationship();
    const result: any = await switchToDependent.run(
      buildRequest({ dependentUid: DEPENDENT }, GUARDIAN)
    );

    expect(typeof result.token).toBe('string');
    const payload = decodeJwtPayload(result.token);
    expect(payload.uid).toBe(DEPENDENT);
  });
});

describe('switchToGuardian', () => {
  it('throws unauthenticated when there is no caller', async () => {
    await expect(
      switchToGuardian.run(buildRequest({ guardianUid: GUARDIAN }))
    ).rejects.toThrow('authenticated');
  });

  it('throws invalid-argument when guardianUid is missing', async () => {
    await expect(switchToGuardian.run(buildRequest({}, DEPENDENT))).rejects.toThrow(
      'guardianUid is required'
    );
  });

  it('throws not-found when the caller has no Firestore doc', async () => {
    await expect(
      switchToGuardian.run(buildRequest({ guardianUid: GUARDIAN }, DEPENDENT))
    ).rejects.toThrow('User not found');
  });

  it('throws permission-denied when the caller is not a dependent', async () => {
    await admin.firestore().collection('users').doc(DEPENDENT).set({ isDependent: false });
    await expect(
      switchToGuardian.run(buildRequest({ guardianUid: GUARDIAN }, DEPENDENT))
    ).rejects.toThrow('Not a dependent of this guardian');
  });

  it('throws permission-denied when dependentCreatedBy does not match the given guardianUid', async () => {
    await admin
      .firestore()
      .collection('users')
      .doc(DEPENDENT)
      .set({ isDependent: true, dependentCreatedBy: 'someone-else' });
    await expect(
      switchToGuardian.run(buildRequest({ guardianUid: GUARDIAN }, DEPENDENT))
    ).rejects.toThrow('Not a dependent of this guardian');
  });

  it('mints a custom token for the guardian uid on success', async () => {
    await admin
      .firestore()
      .collection('users')
      .doc(DEPENDENT)
      .set({ isDependent: true, dependentCreatedBy: GUARDIAN });

    const result: any = await switchToGuardian.run(
      buildRequest({ guardianUid: GUARDIAN }, DEPENDENT)
    );

    expect(typeof result.token).toBe('string');
    const payload = decodeJwtPayload(result.token);
    expect(payload.uid).toBe(GUARDIAN);
  });
});
