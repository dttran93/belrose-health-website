// src/features/Dependents/services/__tests__/dependentAccountService.test.ts
//
// Tier 3 (AccountEncryptionService/WalletGenerationService/httpsCallable mocked) unit tests
// for DependentAccountService — the single home for all dependent-account lifecycle actions
// (creation, handoff, claim). AccountEncryptionService itself has no dedicated unit test yet
// (it's pure crypto orchestration, exercised indirectly via the e2e signup spec and this
// file's mocked call-wiring assertions) — this file only checks that createAccount sends the
// Cloud Function *encrypted* key material only, never the raw master key or RSA private key.
// The plaintext `password` field IS legitimately sent — the Cloud Function needs it to create
// the Firebase Auth user via the Admin SDK — this is not a bug, just worth being explicit about
// in the assertions below so a future reader doesn't mistake it for a leak.
// initiateHandoff/claimAccount are thin httpsCallable wrappers — real server behavior for those
// lives in the Functions-layer tests for those handlers; this file only checks call wiring.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { generateEncryptionBundleMock, convertMasterKeyToHexMock, httpsCallableMock, callableFnMock } =
  vi.hoisted(() => ({
    generateEncryptionBundleMock: vi.fn(),
    convertMasterKeyToHexMock: vi.fn(),
    httpsCallableMock: vi.fn(),
    callableFnMock: vi.fn(),
  }));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: httpsCallableMock,
}));

vi.mock('@/features/Auth/services/accountEncryptionService', () => ({
  AccountEncryptionService: { generateEncryptionBundle: generateEncryptionBundleMock },
}));

vi.mock('@/features/Auth/services/walletGenerationService', () => ({
  WalletGenerationService: { convertMasterKeyToHex: convertMasterKeyToHexMock },
}));

import { DependentAccountService, generatePlaceholderEmail } from '../dependentAccountService';

const FAKE_MASTER_KEY = { fake: 'crypto-key' } as unknown as CryptoKey;

function fakeBundle() {
  return {
    masterKey: FAKE_MASTER_KEY,
    encryptedMasterKey: 'enc-master-key',
    masterKeyIV: 'master-iv',
    masterKeySalt: 'master-salt',
    recoveryKey: 'word1 word2 ... word24',
    recoveryKeyHash: 'recovery-hash',
    publicKey: 'public-key',
    encryptedPrivateKey: 'enc-private-key',
    encryptedPrivateKeyIV: 'private-iv',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  httpsCallableMock.mockReturnValue(callableFnMock);
  generateEncryptionBundleMock.mockResolvedValue(fakeBundle());
  convertMasterKeyToHexMock.mockResolvedValue('master-key-hex');
  callableFnMock.mockResolvedValue({
    data: { uid: 'dep-uid', walletAddress: '0xabc', smartAccountAddress: '0xdef' },
  });
});

describe('generatePlaceholderEmail', () => {
  it('produces a dep-{16 hex chars}@placeholder.belrose.health address', () => {
    const email = generatePlaceholderEmail();
    expect(email).toMatch(/^dep-[0-9a-f]{16}@placeholder\.belrose\.health$/);
  });

  it('generates a fresh id on each call', () => {
    expect(generatePlaceholderEmail()).not.toBe(generatePlaceholderEmail());
  });
});

describe('DependentAccountService.createAccount', () => {
  it('generates the encryption bundle with the guardian-supplied password', async () => {
    await DependentAccountService.createAccount({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'dep-abc@placeholder.belrose.health',
      password: 'guardian-password',
    });

    expect(generateEncryptionBundleMock).toHaveBeenCalledWith('guardian-password');
    expect(convertMasterKeyToHexMock).toHaveBeenCalledWith(FAKE_MASTER_KEY);
  });

  it('sends only the encrypted key material to the Cloud Function, never the raw master key or private key', async () => {
    await DependentAccountService.createAccount({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'dep-abc@placeholder.belrose.health',
      password: 'guardian-password',
    });

    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'createDependentAccount');
    const payload = callableFnMock.mock.calls[0]![0];

    expect(payload).toMatchObject({
      email: 'dep-abc@placeholder.belrose.health',
      password: 'guardian-password', // legitimate — the CF needs this to create the Auth user
      firstName: 'Jane',
      lastName: 'Doe',
      encryptedMasterKey: 'enc-master-key',
      masterKeyIV: 'master-iv',
      masterKeySalt: 'master-salt',
      publicKey: 'public-key',
      encryptedPrivateKey: 'enc-private-key',
      encryptedPrivateKeyIV: 'private-iv',
      recoveryKeyHash: 'recovery-hash',
      masterKeyHex: 'master-key-hex',
    });
    expect(payload).not.toHaveProperty('masterKey');
    expect(payload).not.toHaveProperty('recoveryKey');
    expect(payload).not.toHaveProperty('privateKey');
  });

  it('calls onProgress with "keys" then "registering" in order', async () => {
    const phases: string[] = [];
    await DependentAccountService.createAccount({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'dep-abc@placeholder.belrose.health',
      password: 'guardian-password',
      onProgress: phase => phases.push(phase),
    });

    expect(phases).toEqual(['keys', 'registering']);
  });

  it('returns the CF result merged with the client-only plaintext recoveryKey', async () => {
    const result = await DependentAccountService.createAccount({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'dep-abc@placeholder.belrose.health',
      password: 'guardian-password',
    });

    expect(result).toEqual({
      uid: 'dep-uid',
      walletAddress: '0xabc',
      smartAccountAddress: '0xdef',
      recoveryKey: 'word1 word2 ... word24',
    });
  });
});

describe('DependentAccountService.initiateHandoff', () => {
  it('calls the initiateHandoff callable with dependentUid and contactEmail', async () => {
    await DependentAccountService.initiateHandoff('dep-1', 'contact@example.com');

    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'initiateHandoff');
    expect(callableFnMock).toHaveBeenCalledWith({
      dependentUid: 'dep-1',
      contactEmail: 'contact@example.com',
    });
  });

  it('propagates errors from the callable', async () => {
    callableFnMock.mockRejectedValueOnce(new Error('not authorized'));
    await expect(
      DependentAccountService.initiateHandoff('dep-1', 'contact@example.com')
    ).rejects.toThrow('not authorized');
  });
});

describe('DependentAccountService.claimAccount', () => {
  it('calls the claimDependentAccount callable with no arguments', async () => {
    await DependentAccountService.claimAccount();

    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'claimDependentAccount');
    expect(callableFnMock).toHaveBeenCalledWith({});
  });

  it('propagates errors from the callable', async () => {
    callableFnMock.mockRejectedValueOnce(new Error('not authorized'));
    await expect(DependentAccountService.claimAccount()).rejects.toThrow('not authorized');
  });
});
