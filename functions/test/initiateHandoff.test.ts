// functions/test/initiateHandoff.test.ts
//
// Functions layer — initiateHandoff: sends the "claim your account" email and stamps
// handoffInitiatedAt on the dependent's doc. That field name/semantics is exactly what
// removeDependentRelationship.ts's revoke-vs-delete branch reads later (see
// removeDependentRelationship.test.ts) — this test proves the two handlers agree on it.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as admin from 'firebase-admin';
import { buildRequest } from './helpers/callableRequest';
import { clearFirestore, deleteAllAuthUsers } from './helpers/testAdmin';

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

import { initiateHandoff } from '../src/handlers/initiateHandoff';

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

beforeEach(async () => {
  await clearFirestore();
  await deleteAllAuthUsers();
  vi.clearAllMocks();
  resendSendMock.mockResolvedValue({ data: { id: 'email-id' }, error: null });
});

describe('initiateHandoff — guard clauses', () => {
  it('throws unauthenticated when there is no caller', async () => {
    await expect(
      initiateHandoff.run(buildRequest({ dependentUid: DEPENDENT, contactEmail: 'a@b.com' }))
    ).rejects.toThrow('authenticated');
  });

  it('throws invalid-argument when dependentUid is missing', async () => {
    await expect(
      initiateHandoff.run(buildRequest({ contactEmail: 'a@b.com' }, GUARDIAN))
    ).rejects.toThrow('Missing dependentUid or contactEmail');
  });

  it('throws invalid-argument when contactEmail is missing', async () => {
    await expect(
      initiateHandoff.run(buildRequest({ dependentUid: DEPENDENT }, GUARDIAN))
    ).rejects.toThrow('Missing dependentUid or contactEmail');
  });

  it('throws permission-denied when there is no active controller relationship', async () => {
    await expect(
      initiateHandoff.run(
        buildRequest({ dependentUid: DEPENDENT, contactEmail: 'a@b.com' }, GUARDIAN)
      )
    ).rejects.toThrow('Not an active controller');
  });

  it('throws not-found when the dependent Auth account does not exist', async () => {
    await seedActiveControllerRelationship();
    await expect(
      initiateHandoff.run(
        buildRequest({ dependentUid: DEPENDENT, contactEmail: 'a@b.com' }, GUARDIAN)
      )
    ).rejects.toThrow('Dependent account not found');
  });
});

describe('initiateHandoff — happy path', () => {
  it('stamps handoffInitiatedAt and sends the handoff email to the given contact address', async () => {
    await seedActiveControllerRelationship();
    await admin.auth().createUser({
      uid: DEPENDENT,
      email: 'dep-abc@placeholder.belrose.health',
      displayName: 'Jane Doe',
    });
    // The handler .update()s this doc (handoffInitiatedAt) — it must already exist.
    await admin.firestore().collection('users').doc(DEPENDENT).set({ isDependent: true });
    await admin
      .firestore()
      .collection('users')
      .doc(GUARDIAN)
      .set({ displayName: 'Guardian Gary' });

    const result = await initiateHandoff.run(
      buildRequest({ dependentUid: DEPENDENT, contactEmail: 'contact@example.com' }, GUARDIAN)
    );

    expect(result).toEqual({ success: true });

    const snap = await admin.firestore().collection('users').doc(DEPENDENT).get();
    expect(snap.data()!.handoffInitiatedAt).toBeTruthy();

    expect(resendSendMock).toHaveBeenCalledTimes(1);
    const emailArgs = resendSendMock.mock.calls[0]![0] as any;
    expect(emailArgs.to).toBe('contact@example.com');
    expect(emailArgs.subject).toMatch(/ready to claim/);
    expect(emailArgs.html).toContain('dep-abc@placeholder.belrose.health');
    expect(emailArgs.html).toContain('Guardian Gary');
  });

  it('falls back to "Your guardian" when the guardian has no displayName', async () => {
    await seedActiveControllerRelationship();
    await admin.auth().createUser({ uid: DEPENDENT, email: 'dep-abc@placeholder.belrose.health' });
    await admin.firestore().collection('users').doc(DEPENDENT).set({ isDependent: true });
    // No guardian Firestore doc seeded at all.

    await initiateHandoff.run(
      buildRequest({ dependentUid: DEPENDENT, contactEmail: 'contact@example.com' }, GUARDIAN)
    );

    const emailArgs = resendSendMock.mock.calls[0]![0] as any;
    expect(emailArgs.html).toContain('Your guardian');
  });
});
