// src/features/Auth/services/__tests__/userService.test.ts
//
// Tier 3 (Firestore mocked at the module boundary) unit tests for UserService — the
// Firestore CRUD layer backing signup/login's "create the users/{uid} doc" step.
// createUserDocument's idempotency (update instead of overwrite when the doc already
// exists) is the behavior authServices.signUp/signIn/social sign-ins all rely on as a
// "safety net" — see authServices.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User as FirebaseUser } from 'firebase/auth';

const { mockDocState, setDocMock, updateDocMock } = vi.hoisted(() => ({
  mockDocState: { exists: false, data: null as Record<string, unknown> | null },
  setDocMock: vi.fn(async (_ref: unknown, _data: Record<string, unknown>) => undefined),
  updateDocMock: vi.fn(async (_ref: unknown, _data: Record<string, unknown>) => undefined),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((_db, collection, id) => ({ collection, id })),
  setDoc: setDocMock,
  updateDoc: updateDocMock,
  getDoc: vi.fn(async () => ({
    exists: () => mockDocState.exists,
    data: () => mockDocState.data,
  })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

import { UserService } from '../userService';

function setDoc(exists: boolean, data: Record<string, unknown> | null = null) {
  mockDocState.exists = exists;
  mockDocState.data = data;
}

function fakeUser(overrides: Partial<FirebaseUser> = {}): FirebaseUser {
  return {
    uid: 'uid-1',
    email: 'user@example.com',
    emailVerified: false,
    displayName: 'Jane Doe',
    ...overrides,
  } as FirebaseUser;
}

beforeEach(() => {
  vi.clearAllMocks();
  setDoc(false);
});

describe('UserService.createUserDocument', () => {
  it('creates a new doc with parsed name fields when none exists', async () => {
    setDoc(false);
    await UserService.createUserDocument(fakeUser({ displayName: 'Jane Middle Doe' }));

    expect(setDocMock).toHaveBeenCalledTimes(1);
    const [, payload] = setDocMock.mock.calls[0]!;
    expect(payload).toMatchObject({
      uid: 'uid-1',
      email: 'user@example.com',
      emailVerified: false,
      displayName: 'Jane Middle Doe',
      displayNameLower: 'jane middle doe',
      firstName: 'Jane',
      lastName: 'Middle Doe',
      createdAt: 'SERVER_TIMESTAMP',
      updatedAt: 'SERVER_TIMESTAMP',
    });
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('defaults firstName/lastName to empty strings when displayName is empty', async () => {
    setDoc(false);
    await UserService.createUserDocument(fakeUser({ displayName: '' }));

    const [, payload] = setDocMock.mock.calls[0]!;
    expect(payload).toMatchObject({ firstName: '', lastName: '', displayNameLower: '' });
  });

  it('is idempotent: updates emailVerified/updatedAt instead of overwriting when the doc exists', async () => {
    setDoc(true, { uid: 'uid-1', email: 'user@example.com' });
    await UserService.createUserDocument(fakeUser({ emailVerified: true }));

    expect(setDocMock).not.toHaveBeenCalled();
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ emailVerified: true, updatedAt: 'SERVER_TIMESTAMP' })
    );
  });

  it('wraps setDoc failures in a friendly error', async () => {
    setDoc(false);
    setDocMock.mockRejectedValueOnce(new Error('network down'));

    await expect(UserService.createUserDocument(fakeUser())).rejects.toThrow(
      'Failed to create user profile'
    );
  });
});

describe('UserService.getUserProfile', () => {
  it('returns the profile data when the doc exists', async () => {
    setDoc(true, { uid: 'uid-1', displayName: 'Jane Doe' });
    expect(await UserService.getUserProfile('uid-1')).toEqual({
      uid: 'uid-1',
      displayName: 'Jane Doe',
    });
  });

  it('returns null when the doc does not exist', async () => {
    setDoc(false);
    expect(await UserService.getUserProfile('uid-1')).toBeNull();
  });
});

describe('UserService.updateUserProfile', () => {
  it('merges the given updates with a fresh updatedAt', async () => {
    await UserService.updateUserProfile('uid-1', { displayName: 'New Name' } as any);

    expect(updateDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ displayName: 'New Name', updatedAt: 'SERVER_TIMESTAMP' })
    );
  });
});

describe('UserService.updateEmailVerificationStatus', () => {
  it('sets emailVerifiedAt when verified is true', async () => {
    await UserService.updateEmailVerificationStatus('uid-1', true);

    expect(updateDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ emailVerified: true, emailVerifiedAt: 'SERVER_TIMESTAMP' })
    );
  });

  it('nulls emailVerifiedAt when verified is false', async () => {
    await UserService.updateEmailVerificationStatus('uid-1', false);

    expect(updateDocMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ emailVerified: false, emailVerifiedAt: null })
    );
  });
});

describe('UserService.userDocumentExists', () => {
  it('returns true/false based on doc existence', async () => {
    setDoc(true);
    expect(await UserService.userDocumentExists('uid-1')).toBe(true);

    setDoc(false);
    expect(await UserService.userDocumentExists('uid-1')).toBe(false);
  });
});
