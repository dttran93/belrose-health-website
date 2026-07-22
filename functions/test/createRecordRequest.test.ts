// functions/test/createRecordRequest.test.ts
//
// Functions layer — createRecordRequest: the patient-requests-inward flow (a patient asks a
// provider to send records to them). Creates/reuses a guest Auth account for the provider via
// createOrRetrieveGuestAccount + writeGuestInviteDoc (functions/src/utils/guestAccountUtils.ts,
// shared with createGuestInvite — not re-mocked here, same as createGuestInvite.test.ts, so this
// also proves those shared utils produce the right side effects for this flow's context/duration).
// 'resend' is mocked (no real email sent); the handler intentionally swallows email-send failures.
// The requestNote encryption path uses real RSA-OAEP/AES-GCM (WebCrypto) — proven by round-tripping
// the requester's wrapped note key through a real key pair generated in this test, not a mock.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as admin from 'firebase-admin';
import { webcrypto, generateKeyPairSync } from 'crypto';
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

import { createRecordRequest } from '../src/handlers/createRecordRequest';

const REQUESTER = 'requester-1';
const REQUESTER_EMAIL = 'patient@example.com';
const TARGET_EMAIL = 'provider@example.com';

async function generateRequesterKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return {
    publicKeyBase64: (publicKey as Buffer).toString('base64'),
    privateKeyDer: privateKey as Buffer,
  };
}

async function seedRequester(publicKeyBase64?: string) {
  await admin
    .firestore()
    .collection('users')
    .doc(REQUESTER)
    .set({
      email: REQUESTER_EMAIL,
      ...(publicKeyBase64 && { encryption: { publicKey: publicKeyBase64 } }),
    });
}

beforeEach(async () => {
  await clearFirestore();
  await deleteAllAuthUsers();
  vi.clearAllMocks();
  resendSendMock.mockResolvedValue({ data: { id: 'email-id' }, error: null });
});

describe('createRecordRequest — guard clauses', () => {
  it('throws unauthenticated when there is no caller', async () => {
    await expect(
      createRecordRequest.run(
        buildRequest({ targetEmail: TARGET_EMAIL, requesterName: 'Jane' })
      )
    ).rejects.toThrow('logged in');
  });

  it('throws invalid-argument when targetEmail is missing', async () => {
    await expect(
      createRecordRequest.run(buildRequest({ requesterName: 'Jane' }, REQUESTER))
    ).rejects.toThrow('required');
  });

  it('throws invalid-argument when requesterName is missing', async () => {
    await expect(
      createRecordRequest.run(buildRequest({ targetEmail: TARGET_EMAIL }, REQUESTER))
    ).rejects.toThrow('required');
  });

  it('throws invalid-argument for a malformed email', async () => {
    await expect(
      createRecordRequest.run(
        buildRequest({ targetEmail: 'not-an-email', requesterName: 'Jane' }, REQUESTER)
      )
    ).rejects.toThrow('Invalid email');
  });

  it('throws not-found when the requester has no Firestore profile', async () => {
    await expect(
      createRecordRequest.run(
        buildRequest({ targetEmail: TARGET_EMAIL, requesterName: 'Jane' }, REQUESTER)
      )
    ).rejects.toThrow('Requester profile not found');
  });

  it('throws failed-precondition when the requester has no encryption public key', async () => {
    await seedRequester();

    await expect(
      createRecordRequest.run(
        buildRequest({ targetEmail: TARGET_EMAIL, requesterName: 'Jane' }, REQUESTER)
      )
    ).rejects.toThrow('encryption keys are not set up');
  });
});

describe('createRecordRequest — happy path (no note)', () => {
  it('creates a recordRequests doc, a guestInvites doc, and sends the email', async () => {
    const { publicKeyBase64 } = await generateRequesterKeyPair();
    await seedRequester(publicKeyBase64);

    const result: any = await createRecordRequest.run(
      buildRequest({ targetEmail: TARGET_EMAIL, requesterName: 'Jane' }, REQUESTER)
    );

    expect(result.success).toBe(true);
    expect(result.requestId).toBeTruthy();

    const requestSnap = await admin
      .firestore()
      .collection('recordRequests')
      .doc(result.requestId)
      .get();
    expect(requestSnap.exists).toBe(true);
    const requestData = requestSnap.data()!;
    expect(requestData).toMatchObject({
      requesterId: REQUESTER,
      requesterEmail: REQUESTER_EMAIL,
      requesterName: 'Jane',
      requesterPublicKey: publicKeyBase64,
      targetEmail: TARGET_EMAIL,
      targetUserId: null,
      status: 'pending',
      fulfilledRecordIds: null,
      encryptedRequestNote: null,
      encryptedNoteKeyForRequester: null,
      encryptedNoteKeyForProvider: null,
      encryptedNoteIv: null,
    });
    expect(requestData.providerGuestUid).toBeTruthy();
    expect(requestData.providerPublicKey).toBeTruthy();

    const inviteSnap = await admin
      .firestore()
      .collection('guestInvites')
      .where('recordRequestId', '==', result.requestId)
      .get();
    expect(inviteSnap.docs).toHaveLength(1);
    const invite = inviteSnap.docs[0]!.data();
    expect(invite.context).toBe('record_request');
    expect(invite.invitedBy).toBe(REQUESTER);
    expect(invite.guestUserId).toBe(requestData.providerGuestUid);

    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: TARGET_EMAIL, cc: REQUESTER_EMAIL })
    );
  });

  it('creates a guest Auth account for a brand-new provider email', async () => {
    const { publicKeyBase64 } = await generateRequesterKeyPair();
    await seedRequester(publicKeyBase64);

    const result: any = await createRecordRequest.run(
      buildRequest({ targetEmail: TARGET_EMAIL, requesterName: 'Jane' }, REQUESTER)
    );

    const requestData = (
      await admin.firestore().collection('recordRequests').doc(result.requestId).get()
    ).data()!;

    const authUser = await admin.auth().getUser(requestData.providerGuestUid);
    expect(authUser.email).toBe(TARGET_EMAIL);

    const guestProfile = await admin
      .firestore()
      .collection('users')
      .doc(requestData.providerGuestUid)
      .get();
    expect(guestProfile.data()!.isGuest).toBe(true);
  });

  it('still succeeds when the email send fails (request/invite docs already created)', async () => {
    const { publicKeyBase64 } = await generateRequesterKeyPair();
    await seedRequester(publicKeyBase64);
    resendSendMock.mockRejectedValueOnce(new Error('resend down'));

    await expect(
      createRecordRequest.run(
        buildRequest({ targetEmail: TARGET_EMAIL, requesterName: 'Jane' }, REQUESTER)
      )
    ).resolves.toMatchObject({ success: true });
  });

  it('sets a 30-day deadline from the request date', async () => {
    const { publicKeyBase64 } = await generateRequesterKeyPair();
    await seedRequester(publicKeyBase64);
    const before = Date.now();

    const result: any = await createRecordRequest.run(
      buildRequest({ targetEmail: TARGET_EMAIL, requesterName: 'Jane' }, REQUESTER)
    );

    const requestData = (
      await admin.firestore().collection('recordRequests').doc(result.requestId).get()
    ).data()!;
    const deadlineMs = requestData.deadline.toDate().getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(deadlineMs).toBeGreaterThan(before + thirtyDaysMs - 5000);
    expect(deadlineMs).toBeLessThan(before + thirtyDaysMs + 60000);
  });
});

describe('createRecordRequest — existing provider account', () => {
  it('fails closed instead of corrupting an already-registered account reached for this email', async () => {
    // RecordRequestService.createRequest is supposed to route registered-user targets to
    // createRequestForRegisteredUser client-side and never reach this Cloud Function at all —
    // this pins the server-side guard that exists in case it's ever reached anyway (direct
    // invocation, or a register-in-the-gap race), so a real user's isGuest/publicKey can never
    // get silently overwritten by the guest-account bootstrap below.
    const { publicKeyBase64 } = await generateRequesterKeyPair();
    await seedRequester(publicKeyBase64);

    const { publicKeyBase64: providerRealKey } = await generateRequesterKeyPair();
    const providerAuthUser = await admin.auth().createUser({ email: TARGET_EMAIL });
    await admin
      .firestore()
      .collection('users')
      .doc(providerAuthUser.uid)
      .set({ isGuest: false, encryption: { publicKey: providerRealKey } });

    await expect(
      createRecordRequest.run(
        buildRequest({ targetEmail: TARGET_EMAIL, requesterName: 'Jane' }, REQUESTER)
      )
    ).rejects.toThrow('registered Belrose account');

    // The real user's profile must be untouched — no isGuest flip, no key overwrite.
    const profile = await admin.firestore().collection('users').doc(providerAuthUser.uid).get();
    expect(profile.data()).toMatchObject({
      isGuest: false,
      encryption: { publicKey: providerRealKey },
    });
  });

  it('treats an existing guest account as a guest and proceeds normally', async () => {
    const { publicKeyBase64 } = await generateRequesterKeyPair();
    await seedRequester(publicKeyBase64);

    const providerAuthUser = await admin.auth().createUser({ email: TARGET_EMAIL });
    await admin
      .firestore()
      .collection('users')
      .doc(providerAuthUser.uid)
      .set({ isGuest: true, encryption: { publicKey: 'stale-guest-key' } });

    const result: any = await createRecordRequest.run(
      buildRequest({ targetEmail: TARGET_EMAIL, requesterName: 'Jane' }, REQUESTER)
    );

    const requestData = (
      await admin.firestore().collection('recordRequests').doc(result.requestId).get()
    ).data()!;
    expect(requestData.targetUserId).toBeNull();
    expect(requestData.providerGuestUid).toBe(providerAuthUser.uid);
    // A fresh ephemeral key is generated per invite link — the stale one is expected to be replaced.
    expect(requestData.providerPublicKey).not.toBe('stale-guest-key');
  });
});

describe('createRecordRequest — requestNote encryption', () => {
  it('encrypts the note so the requester can decrypt it back to the original plaintext', async () => {
    const { publicKeyBase64, privateKeyDer } = await generateRequesterKeyPair();
    await seedRequester(publicKeyBase64);

    const requestNote = {
      practice: 'Springfield General',
      provider: 'Dr. Hibbert',
      dateOfBirth: '1990-01-01',
      freeText: 'Please include recent labs.',
    };

    const result: any = await createRecordRequest.run(
      buildRequest({ targetEmail: TARGET_EMAIL, requesterName: 'Jane', requestNote }, REQUESTER)
    );

    const requestData = (
      await admin.firestore().collection('recordRequests').doc(result.requestId).get()
    ).data()!;

    expect(requestData.encryptedRequestNote).toBeTruthy();
    expect(requestData.encryptedNoteKeyForRequester).toBeTruthy();
    expect(requestData.encryptedNoteKeyForProvider).toBeTruthy();
    expect(requestData.encryptedNoteIv).toBeTruthy();

    // Round-trip: unwrap the AES key with the requester's real RSA private key, then decrypt.
    const subtle = webcrypto.subtle;
    const rsaPrivateKey = await subtle.importKey(
      'pkcs8',
      privateKeyDer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['unwrapKey']
    );
    const wrappedKeyBuffer = Buffer.from(requestData.encryptedNoteKeyForRequester, 'base64');
    const aesKey = await subtle.unwrapKey(
      'raw',
      wrappedKeyBuffer,
      rsaPrivateKey,
      { name: 'RSA-OAEP' },
      { name: 'AES-GCM', length: 256 },
      true,
      ['decrypt']
    );
    const iv = Buffer.from(requestData.encryptedNoteIv, 'base64');
    const ciphertext = Buffer.from(requestData.encryptedRequestNote, 'base64');
    const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
    const plaintext = JSON.parse(new TextDecoder().decode(decrypted));

    expect(plaintext).toEqual(requestNote);
  });

  it('leaves all note fields null when no requestNote is provided', async () => {
    const { publicKeyBase64 } = await generateRequesterKeyPair();
    await seedRequester(publicKeyBase64);

    const result: any = await createRecordRequest.run(
      buildRequest({ targetEmail: TARGET_EMAIL, requesterName: 'Jane' }, REQUESTER)
    );

    const requestData = (
      await admin.firestore().collection('recordRequests').doc(result.requestId).get()
    ).data()!;
    expect(requestData.encryptedRequestNote).toBeNull();
    expect(requestData.encryptedNoteKeyForRequester).toBeNull();
    expect(requestData.encryptedNoteKeyForProvider).toBeNull();
    expect(requestData.encryptedNoteIv).toBeNull();
  });
});
