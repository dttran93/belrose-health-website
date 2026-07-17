// test/orchestration/registrationCompletion.test.ts
//
// Layer 3 (orchestration) — models the exact Firestore writes
// RegistrationForm.handleCompleteRegistration performs
// (src/features/Auth/components/RegistrationForm.tsx, handleCompleteRegistration) against the
// real Firestore emulator. That logic lives inline in a form component rather than an exported
// service (a deliberate scope decision in the recent AccountEncryptionService refactor — the
// crypto-generation half was extracted since it was duplicated 3x, but this Firestore-completion
// half is unique to registration and stays coupled to the component's own step/dialog state).
// If handleCompleteRegistration's write shape changes, update completeRegistration() below to match.

import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { deleteApp, getApps } from 'firebase/app';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { connectTestFirestore, clearTestFirestore, seedInviteDoc } from './helpers/testFirestore';
import { assertValidEncryptionBundle } from '../helpers/assertEncryptionBundle';

const db = connectTestFirestore('belrose-orchestration-registration-completion');

interface RegistrationData {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  encryptedMasterKey: string;
  masterKeyIV: string;
  masterKeySalt: string;
  encryptedPrivateKey: string;
  encryptedPrivateKeyIV: string;
  publicKey: string;
  recoveryKeyHash: string;
}

function fakeRegistrationData(overrides: Partial<RegistrationData> = {}): RegistrationData {
  return {
    userId: 'uid-1',
    email: 'user@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    encryptedMasterKey: 'encrypted-master-key',
    masterKeyIV: 'master-key-iv',
    masterKeySalt: 'master-key-salt',
    encryptedPrivateKey: 'encrypted-private-key',
    encryptedPrivateKeyIV: 'encrypted-private-key-iv',
    publicKey: 'public-key',
    recoveryKeyHash: 'recovery-key-hash',
    ...overrides,
  };
}

/**
 * Mirrors RegistrationForm.handleCompleteRegistration's writes exactly (see file header).
 * Returns whether the best-effort invite-doc update succeeded, matching the component's own
 * swallow-and-continue behavior on that second write.
 */
async function completeRegistration(
  data: RegistrationData
): Promise<{ inviteUpdateSucceeded: boolean }> {
  const userDocRef = doc(db, 'users', data.userId);
  await updateDoc(userDocRef, {
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    encryption: {
      enabled: true,
      encryptedMasterKey: data.encryptedMasterKey,
      masterKeyIV: data.masterKeyIV,
      masterKeySalt: data.masterKeySalt,
      encryptedPrivateKey: data.encryptedPrivateKey,
      encryptedPrivateKeyIV: data.encryptedPrivateKeyIV,
      publicKey: data.publicKey,
      recoveryKeyHash: data.recoveryKeyHash,
      setupAt: new Date().toISOString(),
    },
    emailVerified: false,
    identityVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  let inviteUpdateSucceeded = true;
  try {
    const inviteRef = doc(db, 'invites', data.email.toLowerCase());
    await updateDoc(inviteRef, {
      registeredUserId: data.userId,
      registeredAt: new Date().toISOString(),
    });
  } catch {
    inviteUpdateSucceeded = false;
  }

  return { inviteUpdateSucceeded };
}

beforeEach(async () => {
  await clearTestFirestore();
  // updateDoc requires the doc to already exist — by the time handleCompleteRegistration runs,
  // step 1 (authService.signUp -> UserService.createUserDocument) has already created a bare
  // users/{uid} doc.
  await setDoc(doc(db, 'users', 'uid-1'), { uid: 'uid-1', email: 'placeholder@example.com' });
});

afterAll(() => {
  getApps().forEach(app => deleteApp(app));
});

describe('registration completion writes (orchestration)', () => {
  it('writes a full valid encryption bundle to users/{uid}', async () => {
    await completeRegistration(fakeRegistrationData());

    const snap = await getDoc(doc(db, 'users', 'uid-1'));
    const data = snap.data()!;
    expect(data.encryption.enabled).toBe(true);
    assertValidEncryptionBundle(data.encryption);
    expect(data).toMatchObject({
      email: 'user@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      emailVerified: false,
      identityVerified: false,
    });
    expect(data.createdAt).toBeInstanceOf(Timestamp);
  });

  it('stamps the invite doc with registeredUserId when the invite exists', async () => {
    await seedInviteDoc(db, 'user@example.com', { approved: true, code: 'AAAABBBBCCCCDDDD' });

    await completeRegistration(fakeRegistrationData());

    const inviteSnap = await getDoc(doc(db, 'invites', 'user@example.com'));
    expect(inviteSnap.data()?.registeredUserId).toBe('uid-1');
  });

  it('completes registration even when the invite update fails (best-effort, swallowed)', async () => {
    // No invite doc seeded — updateDoc on a nonexistent doc rejects in real Firestore, but the
    // component only warns and continues (RegistrationForm.tsx wraps this write in its own
    // try/catch, separate from the user-doc write above it).
    const result = await completeRegistration(fakeRegistrationData());

    expect(result.inviteUpdateSucceeded).toBe(false);
    const snap = await getDoc(doc(db, 'users', 'uid-1'));
    expect(snap.data()?.encryption?.enabled).toBe(true);
  });
});
