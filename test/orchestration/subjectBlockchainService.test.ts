// test/orchestration/subjectBlockchainService.test.ts
//
// Layer 3 (orchestration) — SubjectBlockchainService: wallet lookups (real Firestore) plus the
// anchor/unanchor wrappers around blockchainHealthRecordService, whose job is specifically to
// normalize failures into a logged sync-queue entry + a null return rather than throwing. The
// underlying blockchain call and BlockchainSyncQueueService are mocked — this is about
// SubjectBlockchainService's own wrapping behavior, not the chain call itself.

import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { doc, setDoc } from 'firebase/firestore';
import { deleteApp, getApps } from 'firebase/app';
import { connectTestFirestore, clearTestFirestore, seedUser } from './helpers/testFirestore';

const { blockchainMocks, syncQueueMocks } = vi.hoisted(() => ({
  blockchainMocks: {
    anchorRecord: vi.fn(),
    anchorRecordAsController: vi.fn(),
    unanchorRecord: vi.fn(),
  },
  syncQueueMocks: {
    logFailure: vi.fn(),
  },
}));

vi.mock('@/features/Credibility/services/blockchainHealthRecordService', () => ({
  blockchainHealthRecordService: blockchainMocks,
  VerificationLevel: { None: 0, Provenance: 1, Full: 2 },
}));

vi.mock('@/features/BlockchainWallet/services/blockchainSyncQueueService', () => ({
  BlockchainSyncQueueService: syncQueueMocks,
}));

import { SubjectBlockchainService } from '../../src/features/Subject/services/subjectBlockchainService';

const WALLETED_USER = 'subject-blockchain-walleted-user';
const NO_WALLET_USER = 'subject-blockchain-no-wallet-user';
const RECORD_ID = 'subject-blockchain-record';
const RECORD_HASH = '0xrecordhash';

const db = connectTestFirestore('belrose-orchestration-subject-blockchain');

describe('SubjectBlockchainService (orchestration)', () => {
  beforeEach(async () => {
    await clearTestFirestore();
    vi.resetAllMocks();
    await seedUser(db, WALLETED_USER, '0xWallet');
    await setDoc(doc(db, 'users', NO_WALLET_USER), {}); // profile exists but has no wallet
  });

  afterAll(() => {
    getApps().forEach(app => deleteApp(app));
  });

  describe('getUserWalletAddress / requireUserWalletAddress', () => {
    it('returns null when the user profile does not exist', async () => {
      await expect(SubjectBlockchainService.getUserWalletAddress('nonexistent')).resolves.toBeNull();
    });

    it('returns null when the user has no wallet', async () => {
      await expect(SubjectBlockchainService.getUserWalletAddress(NO_WALLET_USER)).resolves.toBeNull();
    });

    it('returns the wallet address when present', async () => {
      await expect(SubjectBlockchainService.getUserWalletAddress(WALLETED_USER)).resolves.toBe(
        '0xWallet'
      );
    });

    it('requireUserWalletAddress throws when there is no wallet', async () => {
      await expect(SubjectBlockchainService.requireUserWalletAddress(NO_WALLET_USER)).rejects.toThrow(
        'You must have a linked wallet to perform blockchain actions'
      );
    });

    it('requireUserWalletAddress returns the address when present', async () => {
      await expect(
        SubjectBlockchainService.requireUserWalletAddress(WALLETED_USER)
      ).resolves.toBe('0xWallet');
    });
  });

  describe('anchorSubject', () => {
    it('throws when the caller has no linked wallet', async () => {
      await expect(
        SubjectBlockchainService.anchorSubject(RECORD_ID, RECORD_HASH, NO_WALLET_USER)
      ).rejects.toThrow('You must have a linked wallet to perform blockchain actions');
    });

    it('returns the transaction result on success', async () => {
      blockchainMocks.anchorRecord.mockResolvedValue({ txHash: '0xabc', blockNumber: 1 });

      const result = await SubjectBlockchainService.anchorSubject(RECORD_ID, RECORD_HASH, WALLETED_USER);

      expect(result).toEqual({ txHash: '0xabc', blockNumber: 1 });
      expect(blockchainMocks.anchorRecord).toHaveBeenCalledWith(RECORD_ID, RECORD_HASH, undefined);
    });

    it('logs the failure and returns null instead of throwing when the chain call rejects', async () => {
      blockchainMocks.anchorRecord.mockRejectedValue(new Error('reverted'));

      const result = await SubjectBlockchainService.anchorSubject(RECORD_ID, RECORD_HASH, WALLETED_USER);

      expect(result).toBeNull();
      expect(syncQueueMocks.logFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          contract: 'HealthRecordCore',
          action: 'anchorRecord',
          userId: WALLETED_USER,
          userWalletAddress: '0xWallet',
          error: 'reverted',
          context: expect.objectContaining({
            type: 'anchorRecord',
            recordId: RECORD_ID,
            recordHash: RECORD_HASH,
            subjectId: WALLETED_USER,
          }),
        })
      );
    });
  });

  describe('anchorSubjectAsController', () => {
    it('throws when the controller has no linked wallet', async () => {
      await expect(
        SubjectBlockchainService.anchorSubjectAsController(
          RECORD_ID,
          RECORD_HASH,
          NO_WALLET_USER,
          'trustor-uid'
        )
      ).rejects.toThrow('You must have a linked wallet to perform blockchain actions');
    });

    it('returns the transaction result on success', async () => {
      blockchainMocks.anchorRecordAsController.mockResolvedValue({ txHash: '0xctrl', blockNumber: 2 });

      const result = await SubjectBlockchainService.anchorSubjectAsController(
        RECORD_ID,
        RECORD_HASH,
        WALLETED_USER,
        'trustor-uid'
      );

      expect(result).toEqual({ txHash: '0xctrl', blockNumber: 2 });
      expect(blockchainMocks.anchorRecordAsController).toHaveBeenCalledWith(
        RECORD_ID,
        RECORD_HASH,
        'trustor-uid',
        undefined
      );
    });

    it('logs the failure (attributed to the controller) and returns null on rejection', async () => {
      blockchainMocks.anchorRecordAsController.mockRejectedValue(new Error('reverted'));

      const result = await SubjectBlockchainService.anchorSubjectAsController(
        RECORD_ID,
        RECORD_HASH,
        WALLETED_USER,
        'trustor-uid'
      );

      expect(result).toBeNull();
      expect(syncQueueMocks.logFailure).toHaveBeenCalledWith(
        expect.objectContaining({ userId: WALLETED_USER, action: 'anchorRecord' })
      );
    });
  });

  describe('unanchorSubject', () => {
    it('throws when the caller has no linked wallet', async () => {
      await expect(
        SubjectBlockchainService.unanchorSubject(RECORD_ID, NO_WALLET_USER)
      ).rejects.toThrow('You must have a linked wallet to perform blockchain actions');
    });

    it('returns the transaction result on success', async () => {
      blockchainMocks.unanchorRecord.mockResolvedValue({ txHash: '0xun', blockNumber: 3 });

      const result = await SubjectBlockchainService.unanchorSubject(RECORD_ID, WALLETED_USER);

      expect(result).toEqual({ txHash: '0xun', blockNumber: 3 });
      expect(blockchainMocks.unanchorRecord).toHaveBeenCalledWith(RECORD_ID);
    });

    it('logs the failure and returns null instead of throwing when the chain call rejects', async () => {
      blockchainMocks.unanchorRecord.mockRejectedValue(new Error('reverted'));

      const result = await SubjectBlockchainService.unanchorSubject(RECORD_ID, WALLETED_USER);

      expect(result).toBeNull();
      expect(syncQueueMocks.logFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          contract: 'HealthRecordCore',
          action: 'unanchorRecord',
          userId: WALLETED_USER,
          userWalletAddress: '0xWallet',
          error: 'reverted',
          context: expect.objectContaining({
            type: 'unanchorRecord',
            recordId: RECORD_ID,
            subjectId: WALLETED_USER,
          }),
        })
      );
    });
  });
});
