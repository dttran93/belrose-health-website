// test/orchestration/recordRequestService.test.ts
//
// Layer 3 (orchestration) — RecordRequestService.createRequest's registered-user branch (client
// does the RSA/AES note encryption directly and writes recordRequests/{inviteCode} itself) vs.
// its guest branch (defers entirely to the createRecordRequest Cloud Function), plus
// cancelRequest/resendRequest/getMyRequests. Real Firestore emulator + REAL
// SharingKeyManagementService/crypto.subtle — only firebase/auth and firebase/functions (the
// Cloud Function calls) are mocked.

import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { deleteApp, getApps } from 'firebase/app';
import { connectTestFirestore, clearTestFirestore } from './helpers/testFirestore';
import { base64ToArrayBuffer } from '../../src/utils/dataFormattingUtils';

const { mockCurrentUser, httpsCallableMock } = vi.hoisted(() => ({
  mockCurrentUser: { uid: null as string | null },
  httpsCallableMock: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser.uid ? { uid: mockCurrentUser.uid } : null }),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: () => httpsCallableMock,
}));

import { RecordRequestService } from '../../src/features/RequestRecord/services/recordRequestService';
import { SharingKeyManagementService } from '../../src/features/Sharing/services/sharingKeyManagementService';
import type { BelroseUserProfile } from '@/types/core';

const REQUESTER_UID = 'requester-1';

const db = connectTestFirestore('belrose-orchestration-record-request');

function setCaller(uid: string | null) {
  mockCurrentUser.uid = uid;
}

function makeRequesterProfile(publicKey: string): BelroseUserProfile {
  return {
    uid: REQUESTER_UID,
    email: 'requester@example.com',
    encryption: { publicKey } as any,
  } as BelroseUserProfile;
}

beforeEach(async () => {
  await clearTestFirestore();
  httpsCallableMock.mockReset();
  setCaller(null);
});

afterAll(() => {
  getApps().forEach(app => deleteApp(app));
});

describe('RecordRequestService.createRequest — registered target', () => {
  it('writes the request document directly, with no Cloud Function call', async () => {
    const { publicKey } = await SharingKeyManagementService.generateUserKeyPair();
    await setDoc(doc(db, 'users', 'provider-1'), {
      email: 'provider@example.com',
      isGuest: false,
      encryption: { publicKey },
    });

    const result = await RecordRequestService.createRequest(
      { targetEmail: 'provider@example.com', requesterName: 'Jane Patient' },
      makeRequesterProfile(publicKey)
    );

    expect(result.success).toBe(true);
    expect(httpsCallableMock).not.toHaveBeenCalled();

    const requestSnap = await getDoc(doc(db, 'recordRequests', result.requestId));
    expect(requestSnap.exists()).toBe(true);
    const data = requestSnap.data()!;
    expect(data.status).toBe('pending');
    expect(data.requesterId).toBe(REQUESTER_UID);
    expect(data.targetEmail).toBe('provider@example.com');
    expect(data.targetUserId).toBe('provider-1');
    expect(data.fulfilledRecordIds).toEqual([]);
    expect('encryptedRequestNote' in data).toBe(false);
  });

  it('encrypts the request note so both the provider and requester can independently decrypt it', async () => {
    const provider = await SharingKeyManagementService.generateUserKeyPair();
    const requester = await SharingKeyManagementService.generateUserKeyPair();
    await setDoc(doc(db, 'users', 'provider-2'), {
      email: 'provider2@example.com',
      isGuest: false,
      encryption: { publicKey: provider.publicKey },
    });

    const note = { practice: 'City Clinic', freeText: 'Please send my 2023 records' };
    const result = await RecordRequestService.createRequest(
      { targetEmail: 'provider2@example.com', requesterName: 'Jane Patient', requestNote: note },
      makeRequesterProfile(requester.publicKey)
    );

    const data = (await getDoc(doc(db, 'recordRequests', result.requestId))).data()!;
    expect(data.encryptedRequestNote).toBeTruthy();

    async function decryptWith(privateKeyBase64: string, wrappedKeyBase64: string) {
      const rsaPrivateKey = await SharingKeyManagementService.importPrivateKey(privateKeyBase64);
      const aesKey = await SharingKeyManagementService.unwrapKey(wrappedKeyBase64, rsaPrivateKey);
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToArrayBuffer(data.encryptedNoteIv) },
        aesKey,
        base64ToArrayBuffer(data.encryptedRequestNote)
      );
      return JSON.parse(new TextDecoder().decode(plaintext));
    }

    await expect(decryptWith(provider.privateKey, data.encryptedNoteKeyForProvider)).resolves.toEqual(
      note
    );
    await expect(
      decryptWith(requester.privateKey, data.encryptedNoteKeyForRequester)
    ).resolves.toEqual(note);
  });
});

describe('RecordRequestService.createRequest — guest / unknown target', () => {
  it('defers to the createRecordRequest Cloud Function when the target has no account', async () => {
    httpsCallableMock.mockResolvedValue({ data: { success: true, requestId: 'guest-invite-1' } });
    const { publicKey } = await SharingKeyManagementService.generateUserKeyPair();

    const input = { targetEmail: 'unknown@example.com', requesterName: 'Jane Patient' };
    const result = await RecordRequestService.createRequest(input, makeRequesterProfile(publicKey));

    expect(httpsCallableMock).toHaveBeenCalledWith(input);
    expect(result).toEqual({ success: true, requestId: 'guest-invite-1' });
  });

  it('defers to the Cloud Function when the matching user account is a guest', async () => {
    httpsCallableMock.mockResolvedValue({ data: { success: true, requestId: 'guest-invite-2' } });
    const { publicKey } = await SharingKeyManagementService.generateUserKeyPair();
    await setDoc(doc(db, 'users', 'guest-provider-1'), {
      email: 'guestprovider@example.com',
      isGuest: true,
    });

    await RecordRequestService.createRequest(
      { targetEmail: 'guestprovider@example.com', requesterName: 'Jane Patient' },
      makeRequesterProfile(publicKey)
    );

    expect(httpsCallableMock).toHaveBeenCalledTimes(1);
  });
});

describe('RecordRequestService.cancelRequest', () => {
  it('marks the request cancelled', async () => {
    await setDoc(doc(db, 'recordRequests', 'req-cancel'), { status: 'pending' });
    await RecordRequestService.cancelRequest('req-cancel');

    const data = (await getDoc(doc(db, 'recordRequests', 'req-cancel'))).data()!;
    expect(data.status).toBe('cancelled');
    expect(data.cancelledAt).toBeDefined();
  });
});

describe('RecordRequestService.resendRequest', () => {
  it('calls the resendRecordRequest Cloud Function with the requestId', async () => {
    httpsCallableMock.mockResolvedValue({ data: { success: true } });

    const result = await RecordRequestService.resendRequest('req-1');

    expect(httpsCallableMock).toHaveBeenCalledWith({ requestId: 'req-1' });
    expect(result).toEqual({ success: true });
  });
});

describe('RecordRequestService.getMyRequests', () => {
  it('throws when there is no authenticated user', async () => {
    await expect(RecordRequestService.getMyRequests()).rejects.toThrow('Not authenticated');
  });

  it('returns only the current user’s requests, newest first', async () => {
    setCaller(REQUESTER_UID);
    await setDoc(doc(db, 'recordRequests', 'req-old'), {
      requesterId: REQUESTER_UID,
      createdAt: Timestamp.fromMillis(1000),
    });
    await setDoc(doc(db, 'recordRequests', 'req-new'), {
      requesterId: REQUESTER_UID,
      createdAt: Timestamp.fromMillis(3000),
    });
    await setDoc(doc(db, 'recordRequests', 'req-other-user'), {
      requesterId: 'someone-else',
      createdAt: Timestamp.fromMillis(2000),
    });

    const requests = await RecordRequestService.getMyRequests();

    expect(requests.map(r => r.inviteCode)).toEqual(['req-new', 'req-old']);
  });
});
