// src/features/Auth/services/__tests__/memberRegistryBlockchain.test.ts
//
// Tier 3 (httpsCallable mocked) unit tests for MemberRegistryBlockchain — the client wrapper
// around the memberRegistry Cloud Functions. This is a thin pass-through (real wallet
// generation and on-chain signing happen server-side, see functions/test/memberRegistry.test.ts)
// so these tests only check call-argument shapes and error-mapping, not blockchain behavior.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { httpsCallableMock, callableFnMock } = vi.hoisted(() => ({
  httpsCallableMock: vi.fn(),
  callableFnMock: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: httpsCallableMock,
}));

import { MemberRegistryBlockchain, MemberStatus } from '../memberRegistryBlockchain';

beforeEach(() => {
  vi.clearAllMocks();
  httpsCallableMock.mockReturnValue(callableFnMock);
});

describe('MemberStatus enum', () => {
  it('matches the smart contract enum order exactly', () => {
    // Order is contract-coupled — a reordering here would silently desync from the deployed
    // contract's MemberStatus enum.
    expect(MemberStatus.NotRegistered).toBe(0);
    expect(MemberStatus.Inactive).toBe(1);
    expect(MemberStatus.Active).toBe(2);
    expect(MemberStatus.Verified).toBe(3);
    expect(MemberStatus.VerifiedProvider).toBe(4);
  });
});

describe('MemberRegistryBlockchain.registerMemberOnChainComplete', () => {
  it('calls the registerMemberOnChainComplete callable with masterKeyHex', async () => {
    callableFnMock.mockResolvedValue({ data: { walletAddress: '0xabc', smartAccountAddress: '0xdef' } });

    const result = await MemberRegistryBlockchain.registerMemberOnChainComplete('hex-key');

    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'registerMemberOnChainComplete');
    expect(callableFnMock).toHaveBeenCalledWith({ masterKeyHex: 'hex-key' });
    expect(result).toEqual({ walletAddress: '0xabc', smartAccountAddress: '0xdef' });
  });

  it('maps an already-exists error to a friendly "Member already registered" message', async () => {
    callableFnMock.mockRejectedValue({ code: 'already-exists' });

    await expect(MemberRegistryBlockchain.registerMemberOnChainComplete('hex-key')).rejects.toThrow(
      'Member already registered'
    );
  });

  it('propagates other errors with their own message', async () => {
    callableFnMock.mockRejectedValue({ message: 'network down' });

    await expect(MemberRegistryBlockchain.registerMemberOnChainComplete('hex-key')).rejects.toThrow(
      'network down'
    );
  });
});

describe('MemberRegistryBlockchain.registerMemberWallet', () => {
  it('calls the registerMemberOnChain callable with the wallet address', async () => {
    callableFnMock.mockResolvedValue({ data: { success: true } });

    await MemberRegistryBlockchain.registerMemberWallet('0xwallet');

    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'registerMemberOnChain');
    expect(callableFnMock).toHaveBeenCalledWith({ walletAddress: '0xwallet' });
  });

  it('treats "already registered" errors as a soft success rather than throwing', async () => {
    callableFnMock.mockRejectedValue({ message: 'Wallet already registered' });

    const result = await MemberRegistryBlockchain.registerMemberWallet('0xwallet');
    expect(result).toEqual({ success: true, message: 'Already registered' });
  });
});

describe('MemberRegistryBlockchain status helpers', () => {
  it('markUserAsVerified calls setUserStatus with MemberStatus.Verified', async () => {
    callableFnMock.mockResolvedValue({ data: { success: true } });

    await MemberRegistryBlockchain.markUserAsVerified('uid-1');

    expect(callableFnMock).toHaveBeenCalledWith({ userId: 'uid-1', status: MemberStatus.Verified });
  });

  it('deactivateUser calls setUserStatus with MemberStatus.Inactive', async () => {
    callableFnMock.mockResolvedValue({ data: { success: true } });

    await MemberRegistryBlockchain.deactivateUser('uid-1');

    expect(callableFnMock).toHaveBeenCalledWith({ userId: 'uid-1', status: MemberStatus.Inactive });
  });

  it('reactivateUser calls setUserStatus with MemberStatus.Active', async () => {
    callableFnMock.mockResolvedValue({ data: { success: true } });

    await MemberRegistryBlockchain.reactivateUser('uid-1');

    expect(callableFnMock).toHaveBeenCalledWith({ userId: 'uid-1', status: MemberStatus.Active });
  });
});

describe('MemberRegistryBlockchain.deactivateWallet / reactivateWallet', () => {
  it('deactivateWallet calls the deactivateWalletOnChain callable', async () => {
    callableFnMock.mockResolvedValue({ data: { success: true, blockchainRef: {} } });

    await MemberRegistryBlockchain.deactivateWallet('0xwallet');

    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'deactivateWalletOnChain');
    expect(callableFnMock).toHaveBeenCalledWith({ walletAddress: '0xwallet' });
  });

  it('reactivateWallet calls the reactivateWalletOnChain callable', async () => {
    callableFnMock.mockResolvedValue({ data: { success: true, blockchainRef: {} } });

    await MemberRegistryBlockchain.reactivateWallet('0xwallet');

    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'reactivateWalletOnChain');
    expect(callableFnMock).toHaveBeenCalledWith({ walletAddress: '0xwallet' });
  });
});
