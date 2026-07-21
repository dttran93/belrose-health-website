// functions/test/createGuestInvite.test.ts
//
// Functions layer — createGuestInvite: the patient-shares-outward flow. Verifies ownership of
// every recordId before creating/reusing a guest Firebase Auth account (via
// createOrRetrieveGuestAccount) and writing the guestInvites doc (via writeGuestInviteDoc) —
// both in functions/src/utils/guestAccountUtils.ts, not re-mocked here so this test also proves
// those shared utils actually produce the right Firestore/Auth side effects. 'resend' is mocked
// (no real email sent) — the handler intentionally swallows email-send failures (invite doc and
// token already exist by that point), which is pinned below.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as admin from 'firebase-admin';
import { buildRequest } from './helpers/callableRequest';
import { clearFirestore, deleteAllAuthUsers } from './helpers/testAdmin';

const { resendSendMock } = vi.hoisted(() => ({
  resendSendMock: vi.fn(async () => ({ data: { id: 'email-id' }, error: null })),
}));

vi.mock('resend', () => {
  class MockResend {
    emails = { send: resendSendMock };
  }
  return { Resend: MockResend };
});

import { createGuestInvite } from '../src/handlers/createGuestInvite';

const PATIENT = 'patient-1';
const GUEST_EMAIL = 'doctor@example.com';

async function seedRecord(recordId: string, overrides: Record<string, unknown> = {}) {
  await admin
    .firestore()
    .collection('records')
    .doc(recordId)
    .set({ owners: [PATIENT], administrators: [], ...overrides });
}

beforeEach(async () => {
  await clearFirestore();
  await deleteAllAuthUsers();
  vi.clearAllMocks();
  resendSendMock.mockResolvedValue({ data: { id: 'email-id' }, error: null });
});

describe('createGuestInvite — guard clauses', () => {
  it('throws unauthenticated when there is no caller', async () => {
    await expect(
      createGuestInvite.run(
        buildRequest({ guestEmail: GUEST_EMAIL, recordIds: ['rec-1'], patientName: 'Jane' })
      )
    ).rejects.toThrow('logged in');
  });

  it('throws invalid-argument when recordIds is empty', async () => {
    await expect(
      createGuestInvite.run(
        buildRequest({ guestEmail: GUEST_EMAIL, recordIds: [], patientName: 'Jane' }, PATIENT)
      )
    ).rejects.toThrow('required');
  });

  it('throws invalid-argument for a malformed email', async () => {
    await expect(
      createGuestInvite.run(
        buildRequest({ guestEmail: 'not-an-email', recordIds: ['rec-1'], patientName: 'Jane' }, PATIENT)
      )
    ).rejects.toThrow('Invalid email');
  });

  it('throws not-found when a recordId does not exist', async () => {
    await expect(
      createGuestInvite.run(
        buildRequest({ guestEmail: GUEST_EMAIL, recordIds: ['missing-rec'], patientName: 'Jane' }, PATIENT)
      )
    ).rejects.toThrow('not found');
  });

  it('throws permission-denied when the caller is neither owner nor administrator', async () => {
    await seedRecord('rec-1', { owners: ['someone-else'], administrators: [] });

    await expect(
      createGuestInvite.run(
        buildRequest({ guestEmail: GUEST_EMAIL, recordIds: ['rec-1'], patientName: 'Jane' }, PATIENT)
      )
    ).rejects.toThrow('permission');
  });

  it('allows an administrator (not just an owner) to invite', async () => {
    await seedRecord('rec-1', { owners: ['someone-else'], administrators: [PATIENT] });

    const result: any = await createGuestInvite.run(
      buildRequest({ guestEmail: GUEST_EMAIL, recordIds: ['rec-1'], patientName: 'Jane' }, PATIENT)
    );
    expect(result.success).toBe(true);
  });
});

describe('createGuestInvite — happy path', () => {
  it('creates a new guest Auth account and a minimal Firestore profile', async () => {
    await seedRecord('rec-1');

    const result: any = await createGuestInvite.run(
      buildRequest({ guestEmail: GUEST_EMAIL, recordIds: ['rec-1'], patientName: 'Jane' }, PATIENT)
    );

    expect(result.success).toBe(true);
    expect(result.guestUid).toBeTruthy();
    expect(result.guestPrivateKeyBase64).toBeTruthy();

    const authUser = await admin.auth().getUser(result.guestUid);
    expect(authUser.email).toBe(GUEST_EMAIL);

    const profile = await admin.firestore().collection('users').doc(result.guestUid).get();
    const data = profile.data()!;
    expect(data.isGuest).toBe(true);
    expect(data.encryption.publicKey).toBeTruthy();
    expect(data.onChainIdentity).toBeUndefined();
    expect(data.wallet).toBeUndefined();
  });

  it('writes a guestInvites doc with context "sharing" and the requested recordIds', async () => {
    await seedRecord('rec-1');

    const result: any = await createGuestInvite.run(
      buildRequest({ guestEmail: GUEST_EMAIL, recordIds: ['rec-1'], patientName: 'Jane' }, PATIENT)
    );

    const inviteSnap = await admin
      .firestore()
      .collection('guestInvites')
      .where('guestUserId', '==', result.guestUid)
      .get();
    expect(inviteSnap.docs).toHaveLength(1);
    const invite = inviteSnap.docs[0]!.data();
    expect(invite.context).toBe('sharing');
    expect(invite.status).toBe('pending');
    expect(invite.invitedBy).toBe(PATIENT);
    expect(invite.recordIds).toEqual(['rec-1']);
  });

  it('reuses the existing guest Auth account on a second invite to the same email', async () => {
    await seedRecord('rec-1');
    await seedRecord('rec-2');

    const first: any = await createGuestInvite.run(
      buildRequest({ guestEmail: GUEST_EMAIL, recordIds: ['rec-1'], patientName: 'Jane' }, PATIENT)
    );
    const second: any = await createGuestInvite.run(
      buildRequest({ guestEmail: GUEST_EMAIL, recordIds: ['rec-2'], patientName: 'Jane' }, PATIENT)
    );

    expect(second.guestUid).toBe(first.guestUid);
    // Keys are regenerated fresh per invite link — each link gets its own private key.
    expect(second.guestPrivateKeyBase64).not.toBe(first.guestPrivateKeyBase64);
  });

  it('still succeeds when the email send fails (invite doc/token already created)', async () => {
    await seedRecord('rec-1');
    resendSendMock.mockRejectedValueOnce(new Error('resend down'));

    await expect(
      createGuestInvite.run(
        buildRequest({ guestEmail: GUEST_EMAIL, recordIds: ['rec-1'], patientName: 'Jane' }, PATIENT)
      )
    ).resolves.toMatchObject({ success: true });
  });

  it('defaults to a 7-day (604800s) expiry when durationSeconds is not given', async () => {
    await seedRecord('rec-1');
    const before = Date.now();

    const result: any = await createGuestInvite.run(
      buildRequest({ guestEmail: GUEST_EMAIL, recordIds: ['rec-1'], patientName: 'Jane' }, PATIENT)
    );

    const inviteSnap = await admin
      .firestore()
      .collection('guestInvites')
      .where('guestUserId', '==', result.guestUid)
      .get();
    const expiresAt = inviteSnap.docs[0]!.data().expiresAt.toDate().getTime();
    expect(expiresAt).toBeGreaterThan(before + 604800 * 1000 - 5000);
    expect(expiresAt).toBeLessThan(before + 604800 * 1000 + 60000);
  });
});
