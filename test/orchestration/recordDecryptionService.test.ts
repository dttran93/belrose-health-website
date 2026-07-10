// test/orchestration/recordDecryptionService.test.ts
//
// Layer 3 (orchestration) — RecordDecryptionService, the "read side" of E2EE. Every Sharing
// orchestration test mocks this service out entirely, so this is the first test that proves the
// full loop end-to-end: real Firestore emulator + REAL EncryptionService + REAL EncryptionKeyManager
// + REAL SharingKeyManagementService, seeding data the exact same way the real grant/registration
// code would produce it, then asserting the original plaintext comes back out. Only firebase/auth
// is mocked (to control which uid is "current user") — every crypto primitive here is real, since
// all three of those services now have their own dedicated, passing unit test suites.

import { beforeEach, afterEach, afterAll, describe, it, expect, vi } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { deleteApp, getApps } from 'firebase/app';
import { connectTestFirestore, clearTestFirestore } from './helpers/testFirestore';
import { arrayBufferToBase64, base64ToArrayBuffer } from '../../src/utils/dataFormattingUtils';

const { mockCurrentUser } = vi.hoisted(() => ({
  mockCurrentUser: { uid: null as string | null },
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser.uid ? { uid: mockCurrentUser.uid } : null }),
}));

import { RecordDecryptionService } from '../../src/features/Encryption/services/recordDecryptionService';
import { EncryptionService } from '../../src/features/Encryption/services/encryptionService';
import { EncryptionKeyManager } from '../../src/features/Encryption/services/encryptionKeyManager';
import { SharingKeyManagementService } from '../../src/features/Sharing/services/sharingKeyManagementService';

const CREATOR = 'record-decryption-creator';
const SHARED_USER = 'record-decryption-shared-user';
const RECORD_ID = 'record-decryption-record';

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

async function encryptField(fileKey: CryptoKey, text: string): Promise<{ encrypted: string; iv: string }> {
  const { encrypted, iv } = await EncryptionService.encryptText(text, fileKey);
  return { encrypted: arrayBufferToBase64(encrypted), iv: arrayBufferToBase64(iv) };
}

async function encryptJSONField(fileKey: CryptoKey, data: any): Promise<{ encrypted: string; iv: string }> {
  const { encrypted, iv } = await EncryptionService.encryptJSON(data, fileKey);
  return { encrypted: arrayBufferToBase64(encrypted), iv: arrayBufferToBase64(iv) };
}

/** Seeds a wrappedKeys doc the way SharingService.grantEncryptionAccess (creator path) would. */
async function seedCreatorWrappedKey(
  db: any,
  recordId: string,
  creatorId: string,
  fileKey: CryptoKey,
  masterKey: CryptoKey
) {
  const wrapped = await EncryptionService.encryptKeyWithMasterKey(fileKey, masterKey);
  await setDoc(doc(db, 'wrappedKeys', `${recordId}_${creatorId}`), {
    recordId,
    userId: creatorId,
    wrappedKey: arrayBufferToBase64(wrapped),
    isActive: true,
    isCreator: true,
    isGuest: false,
  });
}

/**
 * Seeds a wrappedKeys doc + users profile the way a real grant + registration would produce for a
 * shared (non-creator) user: their RSA keypair, their private key encrypted with their OWN master
 * key (as stored at registration), and the record's fileKey wrapped with their RSA public key.
 */
async function seedSharedUserAccess(
  db: any,
  recordId: string,
  sharedUserId: string,
  fileKey: CryptoKey,
  sharedUserMasterKey: CryptoKey
) {
  const { publicKey, privateKey } = await SharingKeyManagementService.generateUserKeyPair();

  const { encrypted, iv } = await EncryptionService.encryptFile(
    base64ToArrayBuffer(privateKey),
    sharedUserMasterKey
  );
  await setDoc(doc(db, 'users', sharedUserId), {
    encryption: {
      encryptedPrivateKey: arrayBufferToBase64(encrypted),
      encryptedPrivateKeyIV: arrayBufferToBase64(iv),
      publicKey,
    },
  });

  const rsaPublicKey = await SharingKeyManagementService.importPublicKey(publicKey);
  const wrappedForSharedUser = await SharingKeyManagementService.wrapKey(fileKey, rsaPublicKey);
  await setDoc(doc(db, 'wrappedKeys', `${recordId}_${sharedUserId}`), {
    recordId,
    userId: sharedUserId,
    wrappedKey: wrappedForSharedUser,
    isActive: true,
    isCreator: false,
    isGuest: false,
  });
}

const db = connectTestFirestore('belrose-orchestration-record-decryption');

describe('RecordDecryptionService (orchestration)', () => {
  beforeEach(async () => {
    await clearTestFirestore();
    installFakeSessionStorage();
    EncryptionKeyManager.clearSession();
    setCaller(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    getApps().forEach(app => deleteApp(app));
  });

  describe('getRecordKey', () => {
    it('returns the guest file key directly, bypassing auth and Firestore entirely', async () => {
      const fileKey = await EncryptionService.generateFileKey();
      EncryptionKeyManager.setGuestFileKeys(new Map([[RECORD_ID, fileKey]]));

      const recovered = await RecordDecryptionService.getRecordKey(RECORD_ID, fileKey);

      const raw = await crypto.subtle.exportKey('raw', recovered);
      expect(Buffer.from(raw).toString('base64')).toBe(
        Buffer.from(await crypto.subtle.exportKey('raw', fileKey)).toString('base64')
      );
    });

    it('throws when not authenticated and no guest key is loaded', async () => {
      await expect(
        RecordDecryptionService.getRecordKey(RECORD_ID, await EncryptionService.generateFileKey())
      ).rejects.toThrow('User not authenticated');
    });

    it('throws when no wrappedKey doc exists for this user', async () => {
      setCaller(CREATOR);
      await expect(
        RecordDecryptionService.getRecordKey(RECORD_ID, await EncryptionService.generateFileKey())
      ).rejects.toThrow('You do not have access to this record');
    });

    it('throws when the wrappedKey is inactive', async () => {
      setCaller(CREATOR);
      await setDoc(doc(db, 'wrappedKeys', `${RECORD_ID}_${CREATOR}`), {
        recordId: RECORD_ID,
        userId: CREATOR,
        wrappedKey: 'irrelevant',
        isActive: false,
        isCreator: true,
      });

      await expect(
        RecordDecryptionService.getRecordKey(RECORD_ID, await EncryptionService.generateFileKey())
      ).rejects.toThrow('Your access to this record has been revoked');
    });

    it('recovers the exact file key for the creator path (AES-wrapped with the master key)', async () => {
      setCaller(CREATOR);
      const masterKey = await EncryptionKeyManager.generateMasterKey();
      const fileKey = await EncryptionService.generateFileKey();
      await seedCreatorWrappedKey(db, RECORD_ID, CREATOR, fileKey, masterKey);

      const recovered = await RecordDecryptionService.getRecordKey(RECORD_ID, masterKey);

      const rawRecovered = await crypto.subtle.exportKey('raw', recovered);
      const rawOriginal = await crypto.subtle.exportKey('raw', fileKey);
      expect(Buffer.from(rawRecovered).toString('base64')).toBe(Buffer.from(rawOriginal).toString('base64'));
    });

    it('recovers the exact file key for a shared (non-creator) user, via their RSA private key', async () => {
      setCaller(SHARED_USER);
      const fileKey = await EncryptionService.generateFileKey();
      const sharedUserMasterKey = await EncryptionKeyManager.generateMasterKey();
      await seedSharedUserAccess(db, RECORD_ID, SHARED_USER, fileKey, sharedUserMasterKey);

      const recovered = await RecordDecryptionService.getRecordKey(RECORD_ID, sharedUserMasterKey);

      const rawRecovered = await crypto.subtle.exportKey('raw', recovered);
      const rawOriginal = await crypto.subtle.exportKey('raw', fileKey);
      expect(Buffer.from(rawRecovered).toString('base64')).toBe(Buffer.from(rawOriginal).toString('base64'));
    });

    it('throws when the shared user has no profile doc at all', async () => {
      setCaller(SHARED_USER);
      await setDoc(doc(db, 'wrappedKeys', `${RECORD_ID}_${SHARED_USER}`), {
        recordId: RECORD_ID,
        userId: SHARED_USER,
        wrappedKey: 'irrelevant',
        isActive: true,
        isCreator: false,
      });

      await expect(
        RecordDecryptionService.getRecordKey(RECORD_ID, await EncryptionKeyManager.generateMasterKey())
      ).rejects.toThrow('User profile not found');
    });

    it('throws when the shared user profile has no encrypted private key', async () => {
      setCaller(SHARED_USER);
      await setDoc(doc(db, 'users', SHARED_USER), { encryption: {} });
      await setDoc(doc(db, 'wrappedKeys', `${RECORD_ID}_${SHARED_USER}`), {
        recordId: RECORD_ID,
        userId: SHARED_USER,
        wrappedKey: 'irrelevant',
        isActive: true,
        isCreator: false,
      });

      await expect(
        RecordDecryptionService.getRecordKey(RECORD_ID, await EncryptionKeyManager.generateMasterKey())
      ).rejects.toThrow('Private key not found. Please contact support.');
    });
  });

  describe('decryptRecord — full end-to-end (PATH 3: no key provided)', () => {
    it('throws when the encryption session is not active', async () => {
      setCaller(CREATOR);
      await expect(
        RecordDecryptionService.decryptRecord({ id: RECORD_ID } as any)
      ).rejects.toThrow('Encryption session not active. Please unlock your encryption.');
    });

    it('decrypts every field for the creator, recovering the exact original plaintext', async () => {
      setCaller(CREATOR);
      const masterKey = await EncryptionKeyManager.generateMasterKey();
      const fileKey = await EncryptionService.generateFileKey();
      await seedCreatorWrappedKey(db, RECORD_ID, CREATOR, fileKey, masterKey);
      EncryptionKeyManager.setSessionKey(masterKey);

      const encryptedRecord = {
        id: RECORD_ID,
        encryptedFileName: await encryptField(fileKey, 'lab-results.pdf'),
        encryptedExtractedText: await encryptField(fileKey, 'extracted body text'),
        encryptedOriginalText: await encryptField(fileKey, 'original typed note'),
        encryptedContextText: await encryptField(fileKey, 'some context'),
        encryptedFhirData: await encryptJSONField(fileKey, { resourceType: 'Observation' }),
        encryptedBelroseFields: await encryptJSONField(fileKey, { title: 'Lab Results' }),
        encryptedCustomData: await encryptJSONField(fileKey, { custom: 1 }),
      };

      const decrypted = await RecordDecryptionService.decryptRecord(encryptedRecord as any);

      expect(decrypted.fileName).toBe('lab-results.pdf');
      expect(decrypted.extractedText).toBe('extracted body text');
      expect(decrypted.originalText).toBe('original typed note');
      expect(decrypted.contextText).toBe('some context');
      expect(decrypted.fhirData).toEqual({ resourceType: 'Observation' });
      expect(decrypted.belroseFields).toEqual({ title: 'Lab Results' });
      expect(decrypted.customData).toEqual({ custom: 1 });
    });

    it('decrypts every field for a shared user, recovering the exact original plaintext', async () => {
      setCaller(SHARED_USER);
      const fileKey = await EncryptionService.generateFileKey();
      const sharedUserMasterKey = await EncryptionKeyManager.generateMasterKey();
      await seedSharedUserAccess(db, RECORD_ID, SHARED_USER, fileKey, sharedUserMasterKey);
      EncryptionKeyManager.setSessionKey(sharedUserMasterKey);

      const encryptedRecord = {
        id: RECORD_ID,
        encryptedFileName: await encryptField(fileKey, 'shared-record.pdf'),
        encryptedExtractedText: await encryptField(fileKey, 'shared extracted text'),
      };

      const decrypted = await RecordDecryptionService.decryptRecord(encryptedRecord as any);

      expect(decrypted.fileName).toBe('shared-record.pdf');
      expect(decrypted.extractedText).toBe('shared extracted text');
    });

    it('returns null for fields that are missing/absent rather than throwing', async () => {
      setCaller(CREATOR);
      const masterKey = await EncryptionKeyManager.generateMasterKey();
      const fileKey = await EncryptionService.generateFileKey();
      await seedCreatorWrappedKey(db, RECORD_ID, CREATOR, fileKey, masterKey);
      EncryptionKeyManager.setSessionKey(masterKey);

      const encryptedRecord = {
        id: RECORD_ID,
        encryptedFileName: await encryptField(fileKey, 'only-file-name.pdf'),
        // every other encrypted* field intentionally omitted
      };

      const decrypted = await RecordDecryptionService.decryptRecord(encryptedRecord as any);

      expect(decrypted.fileName).toBe('only-file-name.pdf');
      expect(decrypted.extractedText).toBeNull();
      expect(decrypted.originalText).toBeNull();
      expect(decrypted.contextText).toBeNull();
      expect(decrypted.fhirData).toBeNull();
      expect(decrypted.belroseFields).toBeNull();
      expect(decrypted.customData).toBeNull();
    });
  });

  describe('decryptRecord — PATH 1 & 2 (key already provided, e.g. from VersionControlService)', () => {
    it('PATH 1: decrypts using a provided AES-master-key-wrapped key without any Firestore wrappedKeys read', async () => {
      setCaller(CREATOR);
      const masterKey = await EncryptionKeyManager.generateMasterKey();
      const fileKey = await EncryptionService.generateFileKey();
      EncryptionKeyManager.setSessionKey(masterKey);
      // Deliberately do NOT seed a wrappedKeys doc — PATH 1 must not need one.

      const providedKey = arrayBufferToBase64(
        await EncryptionService.encryptKeyWithMasterKey(fileKey, masterKey)
      );
      const encryptedRecord = {
        id: RECORD_ID,
        encryptedFileName: await encryptField(fileKey, 'creator-provided-key.pdf'),
      };

      const decrypted = await RecordDecryptionService.decryptRecord(
        encryptedRecord as any,
        providedKey,
        true
      );

      expect(decrypted.fileName).toBe('creator-provided-key.pdf');
    });

    it('PATH 2: decrypts using a provided RSA-wrapped key, unwrapped via the shared user\'s private key', async () => {
      setCaller(SHARED_USER);
      const fileKey = await EncryptionService.generateFileKey();
      const sharedUserMasterKey = await EncryptionKeyManager.generateMasterKey();

      // Seed only the user's profile (RSA keypair) — no wrappedKeys doc needed for PATH 2 either.
      const { publicKey, privateKey } = await SharingKeyManagementService.generateUserKeyPair();
      const { encrypted, iv } = await EncryptionService.encryptFile(
        base64ToArrayBuffer(privateKey),
        sharedUserMasterKey
      );
      await setDoc(doc(db, 'users', SHARED_USER), {
        encryption: {
          encryptedPrivateKey: arrayBufferToBase64(encrypted),
          encryptedPrivateKeyIV: arrayBufferToBase64(iv),
          publicKey,
        },
      });
      EncryptionKeyManager.setSessionKey(sharedUserMasterKey);

      const rsaPublicKey = await SharingKeyManagementService.importPublicKey(publicKey);
      const providedKey = await SharingKeyManagementService.wrapKey(fileKey, rsaPublicKey);
      const encryptedRecord = {
        id: RECORD_ID,
        encryptedFileName: await encryptField(fileKey, 'shared-provided-key.pdf'),
      };

      const decrypted = await RecordDecryptionService.decryptRecord(
        encryptedRecord as any,
        providedKey,
        false
      );

      expect(decrypted.fileName).toBe('shared-provided-key.pdf');
    });
  });

  describe('decryptRecordWithKey', () => {
    it('decrypts all present fields off a raw (non-"encrypted"-prefixed) object using an already-unwrapped key', async () => {
      const fileKey = await EncryptionService.generateFileKey();
      const encryptedData = {
        fileName: await encryptField(fileKey, 'version-name.pdf'),
        extractedText: await encryptField(fileKey, 'version text'),
        fhirData: await encryptJSONField(fileKey, { resourceType: 'Condition' }),
      };

      const result = await RecordDecryptionService.decryptRecordWithKey(fileKey, encryptedData);

      expect(result.fileName).toBe('version-name.pdf');
      expect(result.extractedText).toBe('version text');
      expect(result.fhirData).toEqual({ resourceType: 'Condition' });
      expect(result.contextText).toBeNull();
      expect(result.originalText).toBeNull();
    });
  });

  describe('decryptRecords (batch)', () => {
    it('returns an empty array for empty input', async () => {
      expect(await RecordDecryptionService.decryptRecords([])).toEqual([]);
    });

    it('skips records that fail to decrypt and returns only the successful ones', async () => {
      setCaller(CREATOR);
      const masterKey = await EncryptionKeyManager.generateMasterKey();
      EncryptionKeyManager.setSessionKey(masterKey);

      const fileKeyA = await EncryptionService.generateFileKey();
      await seedCreatorWrappedKey(db, 'batch-record-a', CREATOR, fileKeyA, masterKey);
      const recordA = {
        id: 'batch-record-a',
        encryptedFileName: await encryptField(fileKeyA, 'a.pdf'),
      };

      // No wrappedKeys doc seeded for this one at all — it must fail and be skipped, not blow up the batch.
      const recordB = {
        id: 'batch-record-b-missing-key',
        encryptedFileName: await encryptField(fileKeyA, 'b.pdf'),
      };

      const fileKeyC = await EncryptionService.generateFileKey();
      await seedCreatorWrappedKey(db, 'batch-record-c', CREATOR, fileKeyC, masterKey);
      const recordC = {
        id: 'batch-record-c',
        encryptedFileName: await encryptField(fileKeyC, 'c.pdf'),
      };

      const results = await RecordDecryptionService.decryptRecords([recordA, recordB, recordC] as any);

      expect(results.map(r => r.fileName)).toEqual(['a.pdf', 'c.pdf']);
    });
  });
});
