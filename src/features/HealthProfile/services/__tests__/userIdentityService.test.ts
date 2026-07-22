// src/features/HealthProfile/services/__tests__/userIdentityService.test.ts
//
// Tier 3 — buildIdentityFHIRBundle/getIdentityRecordId are pure and tested directly.
// saveUserIdentityRecord mocks firebase/firestore, @/firebase/config (same getter trick as
// uploadUtils.ts's tests — auth is a pre-bound const from that module, not fetched fresh), and
// @/firebase/uploadUtils's updateFirestoreRecord (peer dependency). EncryptionService/
// EncryptionKeyManager/RecordHashService are real, so the encrypted-vs-plaintext branching is
// exercised with genuine crypto. The record + wrappedKey writes go through a single writeBatch —
// see the "batch commit" describe block for why that matters.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockCurrentUser, getDocMock, batchSetMock, batchCommitMock, updateFirestoreRecordMock } =
  vi.hoisted(() => ({
    mockCurrentUser: { uid: null as string | null },
    getDocMock: vi.fn(),
    batchSetMock: vi.fn(),
    batchCommitMock: vi.fn(),
    updateFirestoreRecordMock: vi.fn(),
  }));

vi.mock('@/firebase/config', () => ({
  get auth() {
    return { currentUser: mockCurrentUser.uid ? { uid: mockCurrentUser.uid } : null };
  },
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((..._args: any[]) => ({})),
  getDoc: getDocMock,
  writeBatch: vi.fn(() => ({ set: batchSetMock, commit: batchCommitMock })),
  Timestamp: { now: vi.fn(() => 'mock-timestamp') },
}));

vi.mock('@/firebase/uploadUtils', () => ({
  updateFirestoreRecord: updateFirestoreRecordMock,
}));

import { buildIdentityFHIRBundle, getIdentityRecordId, saveUserIdentityRecord } from '../userIdentityService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import type { UserIdentity } from '../../utils/parseUserIdentity';

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

beforeEach(() => {
  vi.clearAllMocks();
  installFakeSessionStorage();
  EncryptionKeyManager.clearSession();
  setCaller(null);
  getDocMock.mockResolvedValue({ exists: () => false });
  batchCommitMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getIdentityRecordId', () => {
  it('is deterministic and suffixed with _u_id', () => {
    const id1 = getIdentityRecordId('user-1');
    const id2 = getIdentityRecordId('user-1');
    expect(id1).toBe(id2);
    expect(id1.endsWith('_u_id')).toBe(true);
  });

  it('differs for different users', () => {
    expect(getIdentityRecordId('user-1')).not.toBe(getIdentityRecordId('user-2'));
  });
});

describe('buildIdentityFHIRBundle', () => {
  it('builds a full Patient resource when every field is provided', () => {
    const identity: UserIdentity = {
      fullName: 'Jane Doe',
      dateOfBirth: new Date('1990-06-15T12:00:00Z'),
      gender: 'female',
      city: 'London',
      country: 'UK',
      address: '123 Main St',
      phone: '555-1234',
      email: 'jane@example.com',
      maritalStatus: 'single',
      languages: ['English', 'French'],
    };

    const bundle = buildIdentityFHIRBundle(identity, 'user-1');
    const patient = bundle.entry[0].resource;

    expect(bundle.resourceType).toBe('Bundle');
    expect(patient.id).toBe('user-1');
    expect(patient.name).toEqual([{ text: 'Jane Doe', use: 'official' }]);
    expect(patient.gender).toBe('female');
    expect(patient.birthDate).toBe('1990-06-15');
    expect(patient.address).toEqual([{ text: '123 Main St', city: 'London', country: 'UK' }]);
    expect(patient.telecom).toEqual([
      { system: 'phone', value: '555-1234' },
      { system: 'email', value: 'jane@example.com' },
    ]);
    expect(patient.maritalStatus).toEqual({ text: 'single' });
    expect(patient.communication).toEqual([
      { language: { text: 'English' } },
      { language: { text: 'French' } },
    ]);
  });

  it('leaves optional fields undefined and telecom empty for a minimal identity', () => {
    const bundle = buildIdentityFHIRBundle({}, 'user-1');
    const patient = bundle.entry[0].resource;

    expect(patient.name).toBeUndefined();
    expect(patient.gender).toBeUndefined();
    expect(patient.birthDate).toBeUndefined();
    expect(patient.address).toBeUndefined();
    expect(patient.telecom).toEqual([]);
    expect(patient.maritalStatus).toBeUndefined();
  });

  it('builds an address block from city/country alone, without a street address', () => {
    const bundle = buildIdentityFHIRBundle({ city: 'Paris' }, 'user-1');
    expect(bundle.entry[0].resource.address).toEqual([
      { text: undefined, city: 'Paris', country: undefined },
    ]);
  });
});

describe('saveUserIdentityRecord', () => {
  it('throws when there is no authenticated user', async () => {
    await expect(saveUserIdentityRecord('user-1', {})).rejects.toThrow('User not authenticated');
  });

  it('delegates to updateFirestoreRecord when an identity record already exists', async () => {
    setCaller('user-1');
    getDocMock.mockResolvedValue({ exists: () => true });

    await saveUserIdentityRecord('user-1', { fullName: 'Jane Doe' });

    expect(updateFirestoreRecordMock).toHaveBeenCalledTimes(1);
    const [recordId, updateData] = updateFirestoreRecordMock.mock.calls[0]!;
    expect(recordId).toBe(getIdentityRecordId('user-1'));
    expect(updateData.fileName).toBe('User Identity');
    expect(batchSetMock).not.toHaveBeenCalled();
  });

  it('writes plaintext fhirData/belroseFields when there is no active encryption session (first save)', async () => {
    setCaller('user-1');

    await saveUserIdentityRecord('user-1', { fullName: 'Jane Doe' });

    expect(batchSetMock).toHaveBeenCalledTimes(1); // record only, no wrappedKeys
    expect(batchCommitMock).toHaveBeenCalledTimes(1);
    const [, recordData] = batchSetMock.mock.calls[0]!;
    expect(recordData.isEncrypted).toBe(false);
    expect(recordData.fhirData).toBeTruthy();
    expect(recordData.belroseFields).toBeTruthy();
    expect(recordData.fileName).toBe('User Identity');
    expect(recordData.owners).toEqual(['user-1']);
  });

  it('queues the record and wrappedKeys writes in the same batch when there is an active encryption session', async () => {
    setCaller('user-1');
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(masterKey);

    await saveUserIdentityRecord('user-1', { fullName: 'Jane Doe' });

    expect(batchSetMock).toHaveBeenCalledTimes(2); // record + wrappedKeys, queued on one batch
    expect(batchCommitMock).toHaveBeenCalledTimes(1); // committed together
    const [, recordData] = batchSetMock.mock.calls[0]!;
    expect(recordData.isEncrypted).toBe(true);
    expect(recordData.fhirData).toBeNull();
    expect(recordData.belroseFields).toBeNull();
    expect(recordData.encryptedFhirData).toBeTruthy();
    expect(recordData.fileName).toBeNull();

    const [, wrappedKeyData] = batchSetMock.mock.calls[1]!;
    expect(wrappedKeyData.isCreator).toBe(true);
    expect(wrappedKeyData.isActive).toBe(true);
    expect(wrappedKeyData.wrappedKey).toBeTruthy();
  });

  describe('batch commit — atomicity', () => {
    it('propagates the error when the commit fails, with no partial write possible', async () => {
      setCaller('user-1');
      const masterKey = await EncryptionKeyManager.generateMasterKey();
      EncryptionKeyManager.setSessionKey(masterKey);
      batchCommitMock.mockRejectedValue(new Error('network dropped mid-commit'));

      await expect(saveUserIdentityRecord('user-1', { fullName: 'Jane Doe' })).rejects.toThrow(
        'network dropped mid-commit'
      );

      // Both writes were queued onto the same batch before the single commit failed — there is
      // no longer a code path where the record write can land without its wrappedKey.
      expect(batchSetMock).toHaveBeenCalledTimes(2);
      expect(batchCommitMock).toHaveBeenCalledTimes(1);
    });
  });
});
