// test/orchestration/createFirestoreRecord.test.ts
//
// Layer 3 (orchestration) — src/firebase/uploadUtils.ts's createFirestoreRecord, the write side
// of the AddRecord pipeline. Unlike PermissionsService/SubjectQueryService (which call
// getFirestore()/getAuth() fresh with no app arg, so connectTestFirestore's default-app swap
// just works), uploadUtils.ts imports `db`/`auth` as pre-bound consts from '@/firebase/config' —
// which itself eagerly calls initializeApp() with real import.meta.env.VITE_FIREBASE_* config at
// module load. Left alone, that module would bind to the *real* Firebase project under this
// vitest environment, not the emulator. So '@/firebase/config' is mocked here with getters that
// lazily read `testDb`/`callerUid` — since they're getters (not values captured at factory-
// definition time), it doesn't matter that `testDb` is only assigned after this file's own
// imports finish resolving; by the time any test actually calls createFirestoreRecord, it's set.
//
// Only firebase/config is mocked. RecordHashService and the ethers keccak256 recordIdHash
// computation are real, so this test also locks down the actual on-chain-lookup hash shape.

import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'firebase/firestore';
import { ethers } from 'ethers';

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8090;

let testDb: ReturnType<typeof getFirestore>;
const callerState: { uid: string | null } = { uid: null };

vi.mock('@/firebase/config', () => ({
  get db() {
    return testDb;
  },
  auth: {
    get currentUser() {
      return callerState.uid ? { uid: callerState.uid } : null;
    },
  },
}));

import { createFirestoreRecord } from '@/firebase/uploadUtils';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import type { FileObject } from '@/types/core';

getApps().forEach(app => deleteApp(app));
const app = initializeApp({ projectId: 'belrose-orchestration-create-record' });
testDb = getFirestore(app);
connectFirestoreEmulator(testDb, EMULATOR_HOST, EMULATOR_PORT);

function setCaller(uid: string | null) {
  callerState.uid = uid;
}

async function buildEncryptedData(fhirData: any = { resourceType: 'Bundle' }) {
  const masterKey = await EncryptionService.generateFileKey(); // stand-in master key
  return EncryptionService.encryptCompleteRecord(
    'labs.pdf',
    undefined,
    'extracted text',
    null,
    null,
    fhirData,
    null,
    null,
    masterKey
  );
}

function makeFileObj(encryptedData: any, overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'local-id-1',
    fileSize: 1024,
    fileType: 'application/pdf',
    isVirtual: false,
    encryptedData,
    administrators: [],
    ...overrides,
  } as FileObject;
}

beforeEach(async () => {
  await fetch(
    `http://${EMULATOR_HOST}:${EMULATOR_PORT}/emulator/v1/projects/belrose-orchestration-create-record/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  setCaller(null);
});

afterAll(() => {
  getApps().forEach(a => deleteApp(a));
});

describe('createFirestoreRecord (orchestration)', () => {
  it('throws when there is no authenticated user', async () => {
    const encryptedData = await buildEncryptedData();
    await expect(
      createFirestoreRecord({ downloadURL: null, filePath: null, fileObj: makeFileObj(encryptedData) })
    ).rejects.toThrow('User not authenticated');
  });

  it('throws when the fileObj has no encryptedData', async () => {
    setCaller('creator-1');
    await expect(
      createFirestoreRecord({
        downloadURL: null,
        filePath: null,
        fileObj: makeFileObj(undefined),
      })
    ).rejects.toThrow('File must be encrypted before saving metadata.');
  });

  it('creates the record doc with correct ownership defaults, computes recordIdHash, and creates the creator wrappedKey', async () => {
    setCaller('creator-1');
    const encryptedData = await buildEncryptedData();

    const docId = await createFirestoreRecord({
      downloadURL: 'https://example.com/file',
      filePath: 'records/abc/file.encrypted',
      fileObj: makeFileObj(encryptedData),
    });

    const recordSnap = await getDoc(doc(testDb, 'records', docId));
    expect(recordSnap.exists()).toBe(true);
    const data = recordSnap.data()!;

    expect(data.uploadedBy).toBe('creator-1');
    // administrators defaults to [uploader] when fileObj.administrators is empty
    expect(data.administrators).toEqual(['creator-1']);
    expect(data.owners).toEqual([]);
    expect(data.isEncrypted).toBe(true);
    expect(data.versionNumber).toBe(0);
    expect(data.downloadURL).toBe('https://example.com/file');
    expect(data.storagePath).toBe('records/abc/file.encrypted');
    expect(data.encryptedFileName).toMatchObject({
      encrypted: encryptedData.fileName.encrypted,
      iv: encryptedData.fileName.iv,
    });
    expect(data.encryptedFhirData).toMatchObject({
      encrypted: encryptedData.fhirData!.encrypted,
      iv: encryptedData.fhirData!.iv,
    });

    // recordIdHash is keccak256 of the *Firestore-assigned* doc id, computed after addDoc
    expect(data.recordIdHash).toBe(ethers.keccak256(ethers.toUtf8Bytes(docId)));

    const wrappedKeySnap = await getDoc(doc(testDb, 'wrappedKeys', `${docId}_creator-1`));
    expect(wrappedKeySnap.exists()).toBe(true);
    const wrappedKeyData = wrappedKeySnap.data()!;
    expect(wrappedKeyData.isCreator).toBe(true);
    expect(wrappedKeyData.isActive).toBe(true);
    expect(wrappedKeyData.wrappedKey).toBe(encryptedData.encryptedKey);
  });

  it('preserves explicit administrators instead of defaulting to the uploader', async () => {
    setCaller('creator-1');
    const encryptedData = await buildEncryptedData();

    const docId = await createFirestoreRecord({
      downloadURL: null,
      filePath: null,
      fileObj: makeFileObj(encryptedData, { administrators: ['admin-a', 'admin-b'] }),
    });

    const data = (await getDoc(doc(testDb, 'records', docId))).data()!;
    expect(data.administrators).toEqual(['admin-a', 'admin-b']);
  });

  it('merges owners into administrators when they are not already included', async () => {
    setCaller('creator-1');
    const encryptedData = await buildEncryptedData();

    const docId = await createFirestoreRecord({
      downloadURL: null,
      filePath: null,
      fileObj: makeFileObj(encryptedData, {
        administrators: ['admin-a'],
        owners: ['owner-1'],
      }),
    });

    const data = (await getDoc(doc(testDb, 'records', docId))).data()!;
    expect(data.administrators).toEqual(['admin-a', 'owner-1']);
    expect(data.owners).toEqual(['owner-1']);
  });

  it('does not duplicate an owner who is already listed as an administrator', async () => {
    setCaller('creator-1');
    const encryptedData = await buildEncryptedData();

    const docId = await createFirestoreRecord({
      downloadURL: null,
      filePath: null,
      fileObj: makeFileObj(encryptedData, {
        administrators: ['owner-1'],
        owners: ['owner-1'],
      }),
    });

    const data = (await getDoc(doc(testDb, 'records', docId))).data()!;
    expect(data.administrators).toEqual(['owner-1']);
  });

  it('omits encrypted fields that were never provided, rather than writing them as undefined', async () => {
    setCaller('creator-1');
    // No fhirData this time — encryptCompleteRecord won't include a fhirData block at all.
    const encryptedData = await buildEncryptedData(null);

    const docId = await createFirestoreRecord({
      downloadURL: null,
      filePath: null,
      fileObj: makeFileObj(encryptedData),
    });

    const data = (await getDoc(doc(testDb, 'records', docId))).data()!;
    expect('encryptedFhirData' in data).toBe(false);
    expect('encryptedBelroseFields' in data).toBe(false);
    expect('encryptedOriginalText' in data).toBe(false);
    expect('encryptedContextText' in data).toBe(false);
  });
});
