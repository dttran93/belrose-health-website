// src/features/Dependents/services/__tests__/accountSwitchService.test.ts
//
// Tier 3 (firebase/auth, firebase/functions, EncryptionKeyManager mocked) unit tests for
// AccountSwitchService. This only checks call-site wiring and ordering — not
// EncryptionKeyManager.clearSession's own internals, which already have dedicated coverage in
// encryptionKeyManagerSession.test.ts. The thing worth pinning here specifically is that
// clearSession fires AFTER signInWithCustomToken resolves, on both switch directions — clearing
// too early would leave a window where the OLD account's session key is still active under the
// NEW account's identity.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { httpsCallableMock, callableFnMock, signInWithCustomTokenMock, clearSessionMock } = vi.hoisted(
  () => ({
    httpsCallableMock: vi.fn(),
    callableFnMock: vi.fn(),
    signInWithCustomTokenMock: vi.fn(async () => undefined),
    clearSessionMock: vi.fn(),
  })
);

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: httpsCallableMock,
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithCustomToken: signInWithCustomTokenMock,
}));

vi.mock('@/features/Encryption/services/encryptionKeyManager', () => ({
  EncryptionKeyManager: { clearSession: clearSessionMock },
}));

import { AccountSwitchService } from '../accountSwitchService';

beforeEach(() => {
  vi.clearAllMocks();
  httpsCallableMock.mockReturnValue(callableFnMock);
  callableFnMock.mockResolvedValue({ data: { token: 'custom-token' } });
});

describe('AccountSwitchService.switchToDependent', () => {
  it('calls the switchToDependent callable with the dependent uid', async () => {
    await AccountSwitchService.switchToDependent('dep-1');

    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'switchToDependent');
    expect(callableFnMock).toHaveBeenCalledWith({ dependentUid: 'dep-1' });
  });

  it('signs in with the returned custom token, then clears the session — in that order', async () => {
    await AccountSwitchService.switchToDependent('dep-1');

    expect(signInWithCustomTokenMock).toHaveBeenCalledWith(expect.anything(), 'custom-token');
    expect(clearSessionMock).toHaveBeenCalledTimes(1);

    const signInOrder = signInWithCustomTokenMock.mock.invocationCallOrder[0]!;
    const clearOrder = clearSessionMock.mock.invocationCallOrder[0]!;
    expect(signInOrder).toBeLessThan(clearOrder);
  });

  it('does not clear the session if signInWithCustomToken rejects', async () => {
    signInWithCustomTokenMock.mockRejectedValueOnce(new Error('bad token'));

    await expect(AccountSwitchService.switchToDependent('dep-1')).rejects.toThrow('bad token');
    expect(clearSessionMock).not.toHaveBeenCalled();
  });
});

describe('AccountSwitchService.switchToGuardian', () => {
  it('calls the switchToGuardian callable with the guardian uid', async () => {
    await AccountSwitchService.switchToGuardian('guardian-1');

    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'switchToGuardian');
    expect(callableFnMock).toHaveBeenCalledWith({ guardianUid: 'guardian-1' });
  });

  it('signs in with the returned custom token, then clears the session — in that order', async () => {
    await AccountSwitchService.switchToGuardian('guardian-1');

    const signInOrder = signInWithCustomTokenMock.mock.invocationCallOrder[0]!;
    const clearOrder = clearSessionMock.mock.invocationCallOrder[0]!;
    expect(signInOrder).toBeLessThan(clearOrder);
  });
});
