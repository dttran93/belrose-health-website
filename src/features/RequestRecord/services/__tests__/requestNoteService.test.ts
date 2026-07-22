// src/features/RequestRecord/services/__tests__/requestNoteService.test.ts
//
// Tier 3 — mocks firebase/auth and firebase/firestore (the Firestore user-profile lookup);
// EncryptionKeyManager/EncryptionService/SharingKeyManagementService are real, so this proves
// the actual RSA-unwrap-then-AES-GCM-decrypt loop works for both the guest-ephemeral-key path
// and the registered-user stored-key path, matching decryptAsRequester/decryptAsProvider's real
// call sites.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockCurrentUser, getDocMock } = vi.hoisted(() => ({
  mockCurrentUser: { uid: null as string | null },
  getDocMock: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser.uid ? { uid: mockCurrentUser.uid } : null }),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDoc: getDocMock,
}));

import { RequestNoteService } from '../requestNoteService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { SharingKeyManagementService } from '@/features/Sharing/services/sharingKeyManagementService';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';
import type { RecordRequest } from '@belrose/shared';
import type { RequestNote } from '../../components/Request/NewRequestForm';

function setCaller(uid: string | null) {
  mockCurrentUser.uid = uid;
}

function installFakeSessionStorage() {
  const store = new Map<string, string>();
  const fakeStorage: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal('sessionStorage', fakeStorage);
}

async function encryptNote(note: RequestNote, aesKey: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(note));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
  return {
    encryptedRequestNote: arrayBufferToBase64(ciphertext),
    encryptedNoteIv: arrayBufferToBase64(iv.buffer),
  };
}

function makeRequest(overrides: Partial<RecordRequest> = {}): RecordRequest {
  return { inviteCode: 'invite-1', ...overrides } as RecordRequest;
}

beforeEach(() => {
  installFakeSessionStorage();
  EncryptionKeyManager.clearSession();
  setCaller(null);
  getDocMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequestNoteService — missing-fields guard', () => {
  it('decryptAsRequester returns null when the note fields are absent', async () => {
    const result = await RequestNoteService.decryptAsRequester(makeRequest());
    expect(result).toBeNull();
  });

  it('decryptAsProvider returns null when the note fields are absent', async () => {
    const result = await RequestNoteService.decryptAsProvider(makeRequest());
    expect(result).toBeNull();
  });
});

describe('RequestNoteService — guard clauses before key resolution', () => {
  it('throws when there is no active encryption session', async () => {
    setCaller('requester-1');
    const request = makeRequest({
      encryptedRequestNote: 'x',
      encryptedNoteKeyForRequester: 'y',
      encryptedNoteIv: 'z',
    });

    await expect(RequestNoteService.decryptAsRequester(request)).rejects.toThrow(
      'Encryption session not active.'
    );
  });

  it('throws when there is no authenticated user', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(masterKey);
    const request = makeRequest({
      encryptedRequestNote: 'x',
      encryptedNoteKeyForRequester: 'y',
      encryptedNoteIv: 'z',
    });

    await expect(RequestNoteService.decryptAsRequester(request)).rejects.toThrow(
      'Not authenticated.'
    );
  });
});

describe('RequestNoteService — registered-user path', () => {
  it('decrypts the note as the requester using their stored RSA private key', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    const { publicKey, privateKey } = await SharingKeyManagementService.generateUserKeyPair();

    const { encrypted, iv } = await EncryptionService.encryptFile(
      base64ToArrayBuffer(privateKey),
      masterKey
    );
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        encryption: {
          encryptedPrivateKey: arrayBufferToBase64(encrypted),
          encryptedPrivateKeyIV: arrayBufferToBase64(iv),
        },
      }),
    });

    const noteAesKey = await EncryptionService.generateFileKey();
    const rsaPublicKey = await SharingKeyManagementService.importPublicKey(publicKey);
    const encryptedNoteKeyForRequester = await SharingKeyManagementService.wrapKey(
      noteAesKey,
      rsaPublicKey
    );
    const note: RequestNote = { practice: 'City Clinic', freeText: 'Please send my records' };
    const { encryptedRequestNote, encryptedNoteIv } = await encryptNote(note, noteAesKey);

    setCaller('requester-1');
    EncryptionKeyManager.setSessionKey(masterKey);

    const result = await RequestNoteService.decryptAsRequester(
      makeRequest({ encryptedRequestNote, encryptedNoteKeyForRequester, encryptedNoteIv })
    );

    expect(result).toEqual(note);
  });

  it('throws when the user profile does not exist', async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    setCaller('requester-1');
    EncryptionKeyManager.setSessionKey(masterKey);

    await expect(
      RequestNoteService.decryptAsRequester(
        makeRequest({ encryptedRequestNote: 'x', encryptedNoteKeyForRequester: 'y', encryptedNoteIv: 'z' })
      )
    ).rejects.toThrow('User profile not found.');
  });

  it('throws when the profile has no stored encryption keys', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({}) });
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    setCaller('requester-1');
    EncryptionKeyManager.setSessionKey(masterKey);

    await expect(
      RequestNoteService.decryptAsRequester(
        makeRequest({ encryptedRequestNote: 'x', encryptedNoteKeyForRequester: 'y', encryptedNoteIv: 'z' })
      )
    ).rejects.toThrow('Encryption keys not set up. Please complete account setup.');
  });
});

describe('RequestNoteService — guest ephemeral-key path', () => {
  it('decrypts the note as a provider using the ephemeral guest RSA key, bypassing Firestore', async () => {
    const { publicKey, privateKey } = await SharingKeyManagementService.generateUserKeyPair();

    const noteAesKey = await EncryptionService.generateFileKey();
    const rsaPublicKey = await SharingKeyManagementService.importPublicKey(publicKey);
    const encryptedNoteKeyForProvider = await SharingKeyManagementService.wrapKey(
      noteAesKey,
      rsaPublicKey
    );
    const note: RequestNote = { provider: 'Dr. Jones', dateOfBirth: '1990-01-01' };
    const { encryptedRequestNote, encryptedNoteIv } = await encryptNote(note, noteAesKey);

    setCaller('guest-1');
    // Guests still need *some* active session key to pass decrypt()'s first guard, even though
    // it's never actually used to unwrap anything in this path — mirrors FulfillRequestPage's
    // throwaway AES session key.
    EncryptionKeyManager.setSessionKey(await EncryptionKeyManager.generateMasterKey());
    EncryptionKeyManager.setGuestRsaPrivateKey(privateKey);

    const result = await RequestNoteService.decryptAsProvider(
      makeRequest({ encryptedRequestNote, encryptedNoteKeyForProvider, encryptedNoteIv })
    );

    expect(result).toEqual(note);
    expect(getDocMock).not.toHaveBeenCalled();
  });
});
