// functions/test/claimDependentAccount.test.ts
//
// Functions layer — claimDependentAccount: called when a dependent logs in directly and
// chooses to take ownership. 'resend' is mocked (no real email sent); createNotification is
// left real (a plain Firestore write, no network calls) so the happy-path test also proves the
// guardian-notification side effect doesn't throw.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as admin from 'firebase-admin';
import { buildRequest } from './helpers/callableRequest';
import { clearFirestore } from './helpers/testAdmin';

const { resendSendMock } = vi.hoisted(() => ({
  resendSendMock: vi.fn(async () => ({ data: { id: 'email-id' }, error: null })),
}));

vi.mock('resend', () => {
  // Must be constructible (the handler calls `new Resend(...)`) — a vi.fn() wrapping an arrow
  // function can't be used with `new`, so this uses a real class instead.
  class MockResend {
    emails = { send: resendSendMock };
  }
  return { Resend: MockResend };
});

import { claimDependentAccount } from '../src/handlers/claimDependentAccount';

const DEPENDENT = 'dep-1';
const GUARDIAN = 'guardian-1';

async function seedDependent(overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .collection('users')
    .doc(DEPENDENT)
    .set({
      uid: DEPENDENT,
      email: 'dep-abc@placeholder.belrose.health',
      emailVerified: true,
      isDependent: true,
      dependentCreatedBy: GUARDIAN,
      displayName: 'Jane Doe',
      ...overrides,
    });
}

async function seedGuardian(overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .collection('users')
    .doc(GUARDIAN)
    .set({ uid: GUARDIAN, email: 'guardian@example.com', displayName: 'Guardian Gary', ...overrides });
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
  vi.clearAllMocks();
  resendSendMock.mockResolvedValue({ data: { id: 'email-id' }, error: null });
});

describe('claimDependentAccount — guard clauses', () => {
  it('throws unauthenticated when there is no caller', async () => {
    await expect(claimDependentAccount.run(buildRequest({}))).rejects.toThrow('authenticated');
  });

  it('throws not-found when the caller has no Firestore doc', async () => {
    await expect(claimDependentAccount.run(buildRequest({}, DEPENDENT))).rejects.toThrow(
      'User not found'
    );
  });

  it('throws failed-precondition when isDependent is false', async () => {
    await seedDependent({ isDependent: false });
    await expect(claimDependentAccount.run(buildRequest({}, DEPENDENT))).rejects.toThrow(
      'not a dependent account'
    );
  });

  it('throws failed-precondition when dependentCreatedBy is missing', async () => {
    // null, not undefined — Firestore rejects an explicit `undefined` field value.
    await seedDependent({ dependentCreatedBy: null });
    await expect(claimDependentAccount.run(buildRequest({}, DEPENDENT))).rejects.toThrow(
      'not a dependent account'
    );
  });
});

describe('claimDependentAccount — happy path', () => {
  it('flips isDependent false, resets emailVerified, and removes dependentCreatedBy entirely', async () => {
    await seedDependent();
    await seedGuardian();
    await seedRelationship();

    const result = await claimDependentAccount.run(buildRequest({}, DEPENDENT));
    expect(result).toEqual({ success: true });

    const snap = await admin.firestore().collection('users').doc(DEPENDENT).get();
    const data = snap.data()!;
    expect(data.isDependent).toBe(false);
    expect(data.emailVerified).toBe(false);
    expect('dependentCreatedBy' in data).toBe(false);
  });

  it('flips the relationship isDependentRelationship false while leaving isActive/status/trustLevel untouched', async () => {
    await seedDependent();
    await seedGuardian();
    await seedRelationship();

    await claimDependentAccount.run(buildRequest({}, DEPENDENT));

    const relSnap = await admin
      .firestore()
      .collection('trusteeRelationships')
      .doc(`${DEPENDENT}_${GUARDIAN}`)
      .get();
    const relData = relSnap.data()!;
    expect(relData.isDependentRelationship).toBe(false);
    expect(relData.isActive).toBe(true);
    expect(relData.status).toBe('active');
    expect(relData.trustLevel).toBe('controller');
  });

  it('does not throw when there is no matching relationship doc', async () => {
    await seedDependent();
    await seedGuardian();
    // No trusteeRelationships doc seeded at all.

    await expect(claimDependentAccount.run(buildRequest({}, DEPENDENT))).resolves.toEqual({
      success: true,
    });
  });

  it('notifies the guardian without throwing (createNotification + best-effort email)', async () => {
    await seedDependent();
    await seedGuardian();
    await seedRelationship();

    await claimDependentAccount.run(buildRequest({}, DEPENDENT));

    const notifications = await admin
      .firestore()
      .collection('users')
      .doc(GUARDIAN)
      .collection('notifications')
      .get();
    expect(notifications.empty).toBe(false);
  });
});
