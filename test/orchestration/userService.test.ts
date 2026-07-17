// test/orchestration/userService.test.ts
//
// Layer 3 (orchestration) — UserService against the real Firestore emulator. The unit suite
// (src/features/Auth/services/__tests__/userService.test.ts) mocks firebase/firestore entirely
// and only checks call-wiring; this suite proves the actual reads/writes land correctly,
// including createUserDocument's idempotency (the "safety net" authServices.signIn/signUp/social
// sign-ins all rely on) against real Firestore semantics rather than a mock.

import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { deleteApp, getApps } from 'firebase/app';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { connectTestFirestore, clearTestFirestore } from './helpers/testFirestore';
import { UserService } from '../../src/features/Auth/services/userService';
import type { User as FirebaseUser } from 'firebase/auth';

const db = connectTestFirestore('belrose-orchestration-user-service');

function fakeUser(overrides: Partial<FirebaseUser> = {}): FirebaseUser {
  return {
    uid: 'uid-1',
    email: 'user@example.com',
    emailVerified: false,
    displayName: 'Jane Doe',
    ...overrides,
  } as FirebaseUser;
}

beforeEach(async () => {
  await clearTestFirestore();
});

afterAll(() => {
  getApps().forEach(app => deleteApp(app));
});

describe('UserService.createUserDocument (orchestration)', () => {
  it('creates a new doc with parsed name fields and real server timestamps', async () => {
    await UserService.createUserDocument(fakeUser({ displayName: 'Jane Middle Doe' }));

    const snap = await getDoc(doc(db, 'users', 'uid-1'));
    expect(snap.exists()).toBe(true);
    const data = snap.data()!;
    expect(data).toMatchObject({
      uid: 'uid-1',
      email: 'user@example.com',
      emailVerified: false,
      displayName: 'Jane Middle Doe',
      displayNameLower: 'jane middle doe',
      firstName: 'Jane',
      lastName: 'Middle Doe',
    });
    expect(data.createdAt).toBeInstanceOf(Timestamp);
    expect(data.updatedAt).toBeInstanceOf(Timestamp);
  });

  it('is idempotent: a second call updates emailVerified/updatedAt without touching other fields', async () => {
    await UserService.createUserDocument(fakeUser({ emailVerified: false }));
    const firstSnap = await getDoc(doc(db, 'users', 'uid-1'));
    const firstCreatedAt = firstSnap.data()!.createdAt as Timestamp;

    await UserService.createUserDocument(fakeUser({ emailVerified: true, displayName: 'Ignored' }));

    const secondSnap = await getDoc(doc(db, 'users', 'uid-1'));
    const data = secondSnap.data()!;
    expect(data.emailVerified).toBe(true);
    // Untouched by the idempotent update path — still the original signup name, not "Ignored".
    expect(data.displayName).toBe('Jane Doe');
    expect((data.createdAt as Timestamp).isEqual(firstCreatedAt)).toBe(true);
  });
});

describe('UserService.getUserProfile (orchestration)', () => {
  it('returns the real profile document', async () => {
    await UserService.createUserDocument(fakeUser());
    const profile = await UserService.getUserProfile('uid-1');
    expect(profile).toMatchObject({ uid: 'uid-1', email: 'user@example.com' });
  });

  it('returns null for a uid with no document', async () => {
    expect(await UserService.getUserProfile('nonexistent-uid')).toBeNull();
  });
});

describe('UserService.updateUserProfile (orchestration)', () => {
  it('merges updates into the existing doc rather than overwriting it', async () => {
    await UserService.createUserDocument(fakeUser());
    await UserService.updateUserProfile('uid-1', { firstName: 'Updated' } as any);

    const snap = await getDoc(doc(db, 'users', 'uid-1'));
    const data = snap.data()!;
    expect(data.firstName).toBe('Updated');
    // Untouched fields from the original create survive the partial update.
    expect(data.email).toBe('user@example.com');
  });
});

describe('UserService.updateEmailVerificationStatus (orchestration)', () => {
  it('sets emailVerified and a real emailVerifiedAt timestamp', async () => {
    await UserService.createUserDocument(fakeUser());
    await UserService.updateEmailVerificationStatus('uid-1', true);

    const snap = await getDoc(doc(db, 'users', 'uid-1'));
    const data = snap.data()!;
    expect(data.emailVerified).toBe(true);
    expect(data.emailVerifiedAt).toBeInstanceOf(Timestamp);
  });
});

describe('UserService.userDocumentExists (orchestration)', () => {
  it('reflects real document existence', async () => {
    expect(await UserService.userDocumentExists('uid-1')).toBe(false);
    await UserService.createUserDocument(fakeUser());
    expect(await UserService.userDocumentExists('uid-1')).toBe(true);
  });
});
