// test/orchestration/trusteeBlockchainService.test.ts
//
// Layer 3 (orchestration) — TrusteeBlockchainService: wallet lookups (real Firestore) plus the
// propose/accept/decline/revoke/downgrade/update wrappers around BlockchainRoleManagerService,
// whose job is specifically to normalize failures into a logged sync-queue entry + a
// `{ success: false, blockchainRef: null }` return rather than throwing. The underlying
// blockchain call and BlockchainSyncQueueService are mocked — this is about
// TrusteeBlockchainService's own wrapping behavior, not the chain call itself.

import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { doc, setDoc } from 'firebase/firestore';
import { deleteApp, getApps } from 'firebase/app';
import { connectTestFirestore, clearTestFirestore, seedUser } from './helpers/testFirestore';

const { blockchainMocks, syncQueueMocks } = vi.hoisted(() => ({
  blockchainMocks: {
    proposeTrustee: vi.fn(),
    acceptTrustee: vi.fn(),
    declineTrustee: vi.fn(),
    revokeTrustee: vi.fn(),
    downgradeTrusteeLevel: vi.fn(),
    updateTrusteeLevel: vi.fn(),
    getTrusteeRelationship: vi.fn(),
  },
  syncQueueMocks: {
    logFailure: vi.fn(),
  },
}));

vi.mock('@/features/Permissions/services/blockchainRoleManagerService', () => ({
  BlockchainRoleManagerService: blockchainMocks,
}));

vi.mock('@/features/BlockchainWallet/services/blockchainSyncQueueService', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/features/BlockchainWallet/services/blockchainSyncQueueService')>();
  return {
    ...actual,
    BlockchainSyncQueueService: syncQueueMocks,
  };
});

import { TrusteeBlockchainService } from '../../src/features/Trustee/services/trusteeBlockchainService';

const TRUSTOR = 'trustee-blockchain-trustor';
const TRUSTEE = 'trustee-blockchain-trustee';
const NO_WALLET_USER = 'trustee-blockchain-no-wallet-user';

const db = connectTestFirestore('belrose-orchestration-trustee-blockchain');

describe('TrusteeBlockchainService (orchestration)', () => {
  beforeEach(async () => {
    await clearTestFirestore();
    vi.resetAllMocks();
    await seedUser(db, TRUSTOR, '0xTrustorWallet');
    await seedUser(db, TRUSTEE, '0xTrusteeWallet');
    await setDoc(doc(db, 'users', NO_WALLET_USER), {}); // profile exists but has no wallet
  });

  afterAll(() => {
    getApps().forEach(app => deleteApp(app));
  });

  describe('getUserWalletAddress / requireUserWalletAddress', () => {
    it('returns null when the user profile does not exist', async () => {
      await expect(TrusteeBlockchainService.getUserWalletAddress('nonexistent')).resolves.toBeNull();
    });

    it('returns null when the user has no wallet', async () => {
      await expect(TrusteeBlockchainService.getUserWalletAddress(NO_WALLET_USER)).resolves.toBeNull();
    });

    it('returns the wallet address when present', async () => {
      await expect(TrusteeBlockchainService.getUserWalletAddress(TRUSTOR)).resolves.toBe(
        '0xTrustorWallet'
      );
    });

    it('requireUserWalletAddress throws when there is no wallet', async () => {
      await expect(
        TrusteeBlockchainService.requireUserWalletAddress(NO_WALLET_USER)
      ).rejects.toThrow('You must have a linked wallet to perform blockchain actions');
    });

    it('requireUserWalletAddress returns the address when present', async () => {
      await expect(TrusteeBlockchainService.requireUserWalletAddress(TRUSTOR)).resolves.toBe(
        '0xTrustorWallet'
      );
    });
  });

  describe('proposeTrustee', () => {
    it('throws when the trustor has no linked wallet', async () => {
      await expect(
        TrusteeBlockchainService.proposeTrustee(NO_WALLET_USER, TRUSTEE, 0, ['record-1'])
      ).rejects.toThrow('You must have a linked wallet to perform blockchain actions');
    });

    it('returns success with a blockchainRef on success', async () => {
      blockchainMocks.proposeTrustee.mockResolvedValue({ txHash: '0xpropose', blockNumber: 1 });

      const result = await TrusteeBlockchainService.proposeTrustee(TRUSTOR, TRUSTEE, 0, ['record-1']);

      expect(result.success).toBe(true);
      expect(result.blockchainRef).not.toBeNull();
      expect(blockchainMocks.proposeTrustee).toHaveBeenCalledWith(TRUSTEE, 0, ['record-1']);
    });

    it('logs the failure and returns a failure result instead of throwing when the chain call rejects', async () => {
      blockchainMocks.proposeTrustee.mockRejectedValue(new Error('reverted'));

      const result = await TrusteeBlockchainService.proposeTrustee(TRUSTOR, TRUSTEE, 1, ['record-1']);

      expect(result).toEqual({ success: false, blockchainRef: null });
      expect(syncQueueMocks.logFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          contract: 'MemberRoleManager',
          action: 'proposeTrustee',
          userId: TRUSTOR,
          userWalletAddress: '0xTrustorWallet',
          error: 'reverted',
          context: expect.objectContaining({
            type: 'trustee-propose',
            trustorId: TRUSTOR,
            trusteeId: TRUSTEE,
          }),
        })
      );
    });
  });

  describe('acceptTrustee', () => {
    it('throws when the trustee has no linked wallet', async () => {
      await expect(
        TrusteeBlockchainService.acceptTrustee(TRUSTOR, NO_WALLET_USER)
      ).rejects.toThrow('You must have a linked wallet to perform blockchain actions');
    });

    it('returns success with a blockchainRef on success', async () => {
      blockchainMocks.acceptTrustee.mockResolvedValue({ txHash: '0xaccept', blockNumber: 2 });

      const result = await TrusteeBlockchainService.acceptTrustee(TRUSTOR, TRUSTEE);

      expect(result.success).toBe(true);
      expect(blockchainMocks.acceptTrustee).toHaveBeenCalledWith(TRUSTOR);
    });

    it('logs the failure (attributed to the trustee) and returns a failure result on rejection', async () => {
      blockchainMocks.acceptTrustee.mockRejectedValue(new Error('reverted'));

      const result = await TrusteeBlockchainService.acceptTrustee(TRUSTOR, TRUSTEE);

      expect(result).toEqual({ success: false, blockchainRef: null });
      expect(syncQueueMocks.logFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'acceptTrustee',
          userId: TRUSTEE,
          userWalletAddress: '0xTrusteeWallet',
          context: expect.objectContaining({ type: 'trustee-accept' }),
        })
      );
    });

    // Regression: "No pending proposal" is ambiguous — it covers Active (a prior accept landed
    // on-chain but Firestore never caught up, same drift class as revokeTrustee) as well as
    // None/Revoked/Declined (a genuine failure — the invite is really gone). Only the Active
    // case should self-heal; everything else must still throw, which is why this disambiguates
    // with a free on-chain read rather than pattern-matching the revert message alone.
    it('treats "No pending proposal" as success when chain shows Active (already accepted), skipping the sync-queue log', async () => {
      const noPendingProposalRevert =
        '0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000134e6f2070656e64696e672070726f706f73616c00000000000000000000000000';
      blockchainMocks.acceptTrustee.mockRejectedValue(new Error(noPendingProposalRevert));
      blockchainMocks.getTrusteeRelationship.mockResolvedValue({
        status: 'Active',
        level: 'Controller',
      });

      const result = await TrusteeBlockchainService.acceptTrustee(TRUSTOR, TRUSTEE);

      expect(result).toEqual({ success: true, blockchainRef: null });
      expect(syncQueueMocks.logFailure).not.toHaveBeenCalled();
    });

    it('still fails and logs "No pending proposal" when chain shows the invite is actually gone (not Active)', async () => {
      const noPendingProposalRevert =
        '0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000134e6f2070656e64696e672070726f706f73616c00000000000000000000000000';
      blockchainMocks.acceptTrustee.mockRejectedValue(new Error(noPendingProposalRevert));
      blockchainMocks.getTrusteeRelationship.mockResolvedValue({
        status: 'Revoked',
        level: 'Observer',
      });

      const result = await TrusteeBlockchainService.acceptTrustee(TRUSTOR, TRUSTEE);

      expect(result).toEqual({ success: false, blockchainRef: null });
      expect(syncQueueMocks.logFailure).toHaveBeenCalled();
    });
  });

  describe('declineTrustee', () => {
    it('throws when the trustee has no linked wallet', async () => {
      await expect(
        TrusteeBlockchainService.declineTrustee(TRUSTOR, NO_WALLET_USER)
      ).rejects.toThrow('You must have a linked wallet to perform blockchain actions');
    });

    it('returns success with a blockchainRef on success', async () => {
      blockchainMocks.declineTrustee.mockResolvedValue({ txHash: '0xdecline', blockNumber: 3 });

      const result = await TrusteeBlockchainService.declineTrustee(TRUSTOR, TRUSTEE);

      expect(result.success).toBe(true);
      expect(blockchainMocks.declineTrustee).toHaveBeenCalledWith(TRUSTOR);
    });

    it('logs the failure (attributed to the trustee) and returns a failure result on rejection', async () => {
      blockchainMocks.declineTrustee.mockRejectedValue(new Error('reverted'));

      const result = await TrusteeBlockchainService.declineTrustee(TRUSTOR, TRUSTEE);

      expect(result).toEqual({ success: false, blockchainRef: null });
      expect(syncQueueMocks.logFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'declineTrustee',
          userId: TRUSTEE,
          userWalletAddress: '0xTrusteeWallet',
          context: expect.objectContaining({ type: 'trustee-decline' }),
        })
      );
    });
  });

  describe('revokeTrustee', () => {
    it('throws when the caller has no linked wallet', async () => {
      await expect(
        TrusteeBlockchainService.revokeTrustee(TRUSTOR, TRUSTEE, NO_WALLET_USER)
      ).rejects.toThrow('You must have a linked wallet to perform blockchain actions');
    });

    it('returns success with a blockchainRef on success, callable by either party', async () => {
      blockchainMocks.revokeTrustee.mockResolvedValue({ txHash: '0xrevoke', blockNumber: 4 });

      const result = await TrusteeBlockchainService.revokeTrustee(TRUSTOR, TRUSTEE, TRUSTEE);

      expect(result.success).toBe(true);
      expect(blockchainMocks.revokeTrustee).toHaveBeenCalledWith(TRUSTOR, TRUSTEE);
    });

    it('attributes the sync-queue failure log to whichever party called it', async () => {
      blockchainMocks.revokeTrustee.mockRejectedValue(new Error('reverted'));

      const result = await TrusteeBlockchainService.revokeTrustee(TRUSTOR, TRUSTEE, TRUSTOR);

      expect(result).toEqual({ success: false, blockchainRef: null });
      expect(syncQueueMocks.logFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'revokeTrustee',
          userId: TRUSTOR,
          userWalletAddress: '0xTrustorWallet',
          context: expect.objectContaining({ type: 'trustee-revoke' }),
        })
      );
    });

    // Regression: a prior revoke attempt can get the on-chain transaction through but die before
    // the Firestore write lands (this is exactly what the wrappedKeys list-query rules bug did —
    // see firestore.rules wrappedKeys read/update rules). Retrying then reverts on-chain with
    // "No active or pending relationship" since it's already in the state we're trying to reach.
    // That should be treated as success (with no new blockchainRef), not logged as a failure.
    it('treats an already-inactive-on-chain revert as success, with no blockchainRef, and does not log it', async () => {
      const alreadyRevokedRevert =
        '0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000214e6f20616374697665206f722070656e64696e672072656c6174696f6e7368697000000000000000000000000000000000000000000000000000000000000000';
      blockchainMocks.revokeTrustee.mockRejectedValue(new Error(alreadyRevokedRevert));

      const result = await TrusteeBlockchainService.revokeTrustee(TRUSTOR, TRUSTEE, TRUSTOR);

      expect(result).toEqual({ success: true, blockchainRef: null });
      expect(syncQueueMocks.logFailure).not.toHaveBeenCalled();
    });

    it('still logs and fails for any other revert reason (only the exact already-inactive message is swallowed)', async () => {
      blockchainMocks.revokeTrustee.mockRejectedValue(new Error('Not a party to this relationship'));

      const result = await TrusteeBlockchainService.revokeTrustee(TRUSTOR, TRUSTEE, TRUSTOR);

      expect(result).toEqual({ success: false, blockchainRef: null });
      expect(syncQueueMocks.logFailure).toHaveBeenCalled();
    });
  });

  describe('downgradeTrusteeLevel', () => {
    it('throws when the trustee has no linked wallet', async () => {
      await expect(
        TrusteeBlockchainService.downgradeTrusteeLevel(TRUSTOR, NO_WALLET_USER, 0)
      ).rejects.toThrow('You must have a linked wallet to perform blockchain actions');
    });

    it('returns success with a blockchainRef on success', async () => {
      blockchainMocks.downgradeTrusteeLevel.mockResolvedValue({ txHash: '0xdowngrade', blockNumber: 5 });

      const result = await TrusteeBlockchainService.downgradeTrusteeLevel(TRUSTOR, TRUSTEE, 0);

      expect(result.success).toBe(true);
      expect(blockchainMocks.downgradeTrusteeLevel).toHaveBeenCalledWith(TRUSTOR, 0);
    });

    it('logs the failure (attributed to the trustee) and returns a failure result on rejection', async () => {
      blockchainMocks.downgradeTrusteeLevel.mockRejectedValue(new Error('reverted'));

      const result = await TrusteeBlockchainService.downgradeTrusteeLevel(TRUSTOR, TRUSTEE, 0);

      expect(result).toEqual({ success: false, blockchainRef: null });
      expect(syncQueueMocks.logFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'downgradeTrusteeLevel',
          userId: TRUSTEE,
          userWalletAddress: '0xTrusteeWallet',
          context: expect.objectContaining({ type: 'trustee-level-update' }),
        })
      );
    });
  });

  describe('updateTrusteeLevel', () => {
    it('throws when the trustor has no linked wallet', async () => {
      await expect(
        TrusteeBlockchainService.updateTrusteeLevel(NO_WALLET_USER, TRUSTEE, 2)
      ).rejects.toThrow('You must have a linked wallet to perform blockchain actions');
    });

    it('returns success with a blockchainRef on success', async () => {
      blockchainMocks.updateTrusteeLevel.mockResolvedValue({ txHash: '0xupdate', blockNumber: 6 });

      const result = await TrusteeBlockchainService.updateTrusteeLevel(TRUSTOR, TRUSTEE, 2);

      expect(result.success).toBe(true);
      expect(blockchainMocks.updateTrusteeLevel).toHaveBeenCalledWith(TRUSTEE, 2);
    });

    it('logs the failure (attributed to the trustor) and returns a failure result on rejection', async () => {
      blockchainMocks.updateTrusteeLevel.mockRejectedValue(new Error('reverted'));

      const result = await TrusteeBlockchainService.updateTrusteeLevel(TRUSTOR, TRUSTEE, 2);

      expect(result).toEqual({ success: false, blockchainRef: null });
      expect(syncQueueMocks.logFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updateTrusteeLevel',
          userId: TRUSTOR,
          userWalletAddress: '0xTrustorWallet',
          context: expect.objectContaining({ type: 'trustee-level-update' }),
        })
      );
    });
  });
});
