// src/features/Subject/services/__tests__/subjectPreparationService.test.ts
//
// Unit tests for SubjectPreparationService — mirrors permissionPreparationService.test.ts's
// approach: real multi-branch readiness logic, everything external (blockchain readiness, the
// Permissions feature's own preparation service, Firestore, auth) mocked. No emulator needed.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/BlockchainWallet/services/blockchainPreparationService', () => ({
  BlockchainPreparationService: {
    getStatus: vi.fn(),
    ensureReady: vi.fn(),
  },
}));

vi.mock('@/features/Permissions/services/permissionPreparationService', () => ({
  PermissionPreparationService: {
    getStatus: vi.fn(),
    initializeRecordRole: vi.fn(),
  },
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

import { SubjectPreparationService } from '../subjectPreparationService';
import { BlockchainPreparationService } from '@/features/BlockchainWallet/services/blockchainPreparationService';
import { PermissionPreparationService } from '@/features/Permissions/services/permissionPreparationService';
import { getAuth } from 'firebase/auth';
import { getDoc } from 'firebase/firestore';

const READY_CALLER = { ready: true, smartAccountAddress: '0xSmart', checks: { isRegisteredOnChain: true } };
const NOT_READY_CALLER = { ready: false, smartAccountAddress: null, checks: { isRegisteredOnChain: false } };

function mockUser(uid: string | null) {
  vi.mocked(getAuth).mockReturnValue({ currentUser: uid ? { uid } : null } as any);
}

function mockRecordDoc(data: Record<string, any> | null) {
  vi.mocked(getDoc).mockResolvedValue({
    exists: () => data !== null,
    data: () => data,
  } as any);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('SubjectPreparationService.verifyPrerequisites', () => {
  it('is not ready when not signed in', async () => {
    mockUser(null);
    const result = await SubjectPreparationService.verifyPrerequisites('rec1');

    expect(result).toEqual({
      ready: false,
      reason: 'Please sign in to continue.',
      checks: {
        callerReady: false,
        hasRecordPermission: false,
        hasRecordHash: false,
        recordInitialized: false,
      },
    });
  });

  it('is not ready when the caller wallet is not set up', async () => {
    mockUser('user1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(NOT_READY_CALLER as any);

    const result = await SubjectPreparationService.verifyPrerequisites('rec1');

    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/wallet needs to be set up/);
  });

  it('is not ready when the record does not exist', async () => {
    mockUser('user1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc(null);

    const result = await SubjectPreparationService.verifyPrerequisites('rec1');

    expect(result.ready).toBe(false);
    expect(result.reason).toBe('Record not found.');
  });

  it('is not ready when the caller cannot manage the record', async () => {
    mockUser('stranger');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc({ owners: ['owner1'], administrators: [], recordHash: '0xhash' });

    const result = await SubjectPreparationService.verifyPrerequisites('rec1');

    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/do not have permission to modify this record/);
  });

  it('is not ready when the record has not been initialized on-chain', async () => {
    mockUser('owner1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc({ owners: ['owner1'], recordHash: '0xhash' });
    vi.mocked(PermissionPreparationService.getStatus).mockResolvedValue({
      isRecordInitialized: false,
    } as any);

    const result = await SubjectPreparationService.verifyPrerequisites('rec1');

    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/has not been initialized/);
  });

  it('is not ready when the record has no recordHash', async () => {
    mockUser('owner1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc({ owners: ['owner1'], recordHash: '' });
    vi.mocked(PermissionPreparationService.getStatus).mockResolvedValue({
      isRecordInitialized: true,
    } as any);

    const result = await SubjectPreparationService.verifyPrerequisites('rec1');

    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/does not have a hash for blockchain anchoring/);
  });

  it('is not ready when the caller is already a subject', async () => {
    mockUser('owner1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc({ owners: ['owner1'], recordHash: '0xhash', subjects: ['owner1'] });
    vi.mocked(PermissionPreparationService.getStatus).mockResolvedValue({
      isRecordInitialized: true,
    } as any);

    const result = await SubjectPreparationService.verifyPrerequisites('rec1');

    expect(result.ready).toBe(false);
    expect(result.reason).toBe('You are already a subject of this record.');
  });

  it('is ready when every check passes', async () => {
    mockUser('owner1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc({ owners: ['owner1'], recordHash: '0xhash', subjects: [] });
    vi.mocked(PermissionPreparationService.getStatus).mockResolvedValue({
      isRecordInitialized: true,
    } as any);

    const result = await SubjectPreparationService.verifyPrerequisites('rec1');

    expect(result.ready).toBe(true);
    expect(result.checks).toEqual({
      callerReady: true,
      hasRecordPermission: true,
      hasRecordHash: true,
      recordInitialized: true,
    });
  });
});

describe('SubjectPreparationService.verifyAcceptPrerequisites', () => {
  it('is not ready when not signed in', async () => {
    mockUser(null);
    const result = await SubjectPreparationService.verifyAcceptPrerequisites('rec1');
    expect(result.ready).toBe(false);
    expect(result.reason).toBe('Please sign in to continue.');
  });

  it('is not ready when the caller wallet is not set up', async () => {
    mockUser('user1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(NOT_READY_CALLER as any);

    const result = await SubjectPreparationService.verifyAcceptPrerequisites('rec1');
    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/wallet needs to be set up/);
  });

  it('is not ready when the record does not exist', async () => {
    mockUser('user1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc(null);

    const result = await SubjectPreparationService.verifyAcceptPrerequisites('rec1');
    expect(result.ready).toBe(false);
    expect(result.reason).toBe('Record not found.');
  });

  it('is not ready when the record has not been initialized', async () => {
    mockUser('user1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc({ recordHash: '0xhash' });
    vi.mocked(PermissionPreparationService.getStatus).mockResolvedValue({
      isRecordInitialized: false,
    } as any);

    const result = await SubjectPreparationService.verifyAcceptPrerequisites('rec1');
    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/has not been initialized/);
  });

  it('is not ready when the record has no recordHash — different wording than verifyPrerequisites', async () => {
    mockUser('user1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc({ recordHash: '' });
    vi.mocked(PermissionPreparationService.getStatus).mockResolvedValue({
      isRecordInitialized: true,
    } as any);

    const result = await SubjectPreparationService.verifyAcceptPrerequisites('rec1');
    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/contact the record owner/);
  });

  it('is ready with no permission check at all — an invited user need not manage the record', async () => {
    mockUser('invited-stranger');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc({ owners: ['someone-else'], recordHash: '0xhash' });
    vi.mocked(PermissionPreparationService.getStatus).mockResolvedValue({
      isRecordInitialized: true,
    } as any);

    const result = await SubjectPreparationService.verifyAcceptPrerequisites('rec1');
    expect(result.ready).toBe(true);
  });
});

describe('SubjectPreparationService.verifyRemovePrerequisites', () => {
  it('is not ready when not signed in', async () => {
    mockUser(null);
    const result = await SubjectPreparationService.verifyRemovePrerequisites('rec1');
    expect(result.ready).toBe(false);
    expect(result.reason).toBe('Please sign in to continue.');
  });

  it('is not ready when the caller wallet is not set up', async () => {
    mockUser('user1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(NOT_READY_CALLER as any);

    const result = await SubjectPreparationService.verifyRemovePrerequisites('rec1');
    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/wallet needs to be set up/);
  });

  it('is not ready when the record does not exist', async () => {
    mockUser('user1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc(null);

    const result = await SubjectPreparationService.verifyRemovePrerequisites('rec1');
    expect(result.ready).toBe(false);
    expect(result.reason).toBe('Record not found.');
  });

  it('is not ready when the caller is not currently a subject', async () => {
    mockUser('user1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc({ subjects: [], recordHash: '0xhash' });

    const result = await SubjectPreparationService.verifyRemovePrerequisites('rec1');
    expect(result.ready).toBe(false);
    expect(result.reason).toBe('You are not a subject of this record.');
  });

  it('is ready when the caller is a subject', async () => {
    mockUser('user1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc({ subjects: ['user1'], recordHash: '0xhash' });

    const result = await SubjectPreparationService.verifyRemovePrerequisites('rec1');
    expect(result.ready).toBe(true);
  });
});

describe('SubjectPreparationService.getStatus', () => {
  it('is not ready and has no permission info when not signed in', async () => {
    mockUser(null);
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);

    const result = await SubjectPreparationService.getStatus('rec1');

    expect(result.hasRecordPermission).toBe(false);
    expect(result.hasRecordHash).toBe(false);
    expect(result.callerRole).toBeUndefined();
    expect(result.isReady).toBe(false);
  });

  it('is ready only when blockchain readiness, permission, and record hash all check out', async () => {
    mockUser('owner1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc({ owners: ['owner1'], recordHash: '0xhash' });

    const result = await SubjectPreparationService.getStatus('rec1');

    expect(result.hasRecordPermission).toBe(true);
    expect(result.hasRecordHash).toBe(true);
    expect(result.callerRole).toBe('owner');
    expect(result.isReady).toBe(true);
  });

  it('is not ready when the caller has permission but the record has no hash yet', async () => {
    mockUser('owner1');
    vi.mocked(BlockchainPreparationService.getStatus).mockResolvedValue(READY_CALLER as any);
    mockRecordDoc({ owners: ['owner1'], recordHash: '' });

    const result = await SubjectPreparationService.getStatus('rec1');
    expect(result.isReady).toBe(false);
  });
});

describe('SubjectPreparationService.prepare', () => {
  it('throws when not authenticated', async () => {
    mockUser(null);
    await expect(SubjectPreparationService.prepare('rec1')).rejects.toThrow(
      'User not authenticated'
    );
  });

  it('skips record initialization when already initialized', async () => {
    mockUser('owner1');
    vi.mocked(BlockchainPreparationService.ensureReady).mockResolvedValue('0xSmart');
    vi.mocked(PermissionPreparationService.getStatus).mockResolvedValue({
      isRecordInitialized: true,
    } as any);

    const address = await SubjectPreparationService.prepare('rec1');

    expect(address).toBe('0xSmart');
    expect(PermissionPreparationService.initializeRecordRole).not.toHaveBeenCalled();
  });

  it('initializes the record as owner when the caller owns it', async () => {
    mockUser('owner1');
    vi.mocked(BlockchainPreparationService.ensureReady).mockResolvedValue('0xSmart');
    vi.mocked(PermissionPreparationService.getStatus).mockResolvedValue({
      isRecordInitialized: false,
    } as any);
    mockRecordDoc({ owners: ['owner1'], recordHash: '0xhash' });

    await SubjectPreparationService.prepare('rec1');

    expect(PermissionPreparationService.initializeRecordRole).toHaveBeenCalledWith(
      'rec1',
      '0xSmart',
      'owner'
    );
  });

  it('initializes as administrator when the caller manages but does not own the record', async () => {
    mockUser('admin1');
    vi.mocked(BlockchainPreparationService.ensureReady).mockResolvedValue('0xSmart');
    vi.mocked(PermissionPreparationService.getStatus).mockResolvedValue({
      isRecordInitialized: false,
    } as any);
    mockRecordDoc({ owners: [], administrators: ['admin1'], recordHash: '0xhash' });

    await SubjectPreparationService.prepare('rec1');

    expect(PermissionPreparationService.initializeRecordRole).toHaveBeenCalledWith(
      'rec1',
      '0xSmart',
      'administrator'
    );
  });

  it('throws when the caller has no permission to initialize the record', async () => {
    mockUser('stranger');
    vi.mocked(BlockchainPreparationService.ensureReady).mockResolvedValue('0xSmart');
    vi.mocked(PermissionPreparationService.getStatus).mockResolvedValue({
      isRecordInitialized: false,
    } as any);
    mockRecordDoc({ owners: ['owner1'], administrators: [], recordHash: '0xhash' });

    await expect(SubjectPreparationService.prepare('rec1')).rejects.toThrow(
      'You do not have permission to initialize this record'
    );
  });
});

describe('SubjectPreparationService.getRecordSubjectInfo', () => {
  it('returns empty defaults when the record does not exist', async () => {
    mockRecordDoc(null);
    const result = await SubjectPreparationService.getRecordSubjectInfo('rec1');
    expect(result).toEqual({ subjects: [], hasSubjects: false, recordHash: null });
  });

  it('returns the record subject info when it exists', async () => {
    mockRecordDoc({ subjects: ['sub1', 'sub2'], recordHash: '0xhash' });
    const result = await SubjectPreparationService.getRecordSubjectInfo('rec1');
    expect(result).toEqual({ subjects: ['sub1', 'sub2'], hasSubjects: true, recordHash: '0xhash' });
  });
});
