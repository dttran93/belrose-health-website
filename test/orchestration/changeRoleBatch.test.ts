// test/orchestration/changeRoleBatch.test.ts
//
// Layer 3 (orchestration) — PermissionsService.changeRoleBatch. Unlike grantRoleBatch/
// revokeRoleBatch, this method's pre-flight uses one flat `isOwner || isAdmin` permission
// check regardless of the target role or direction of change — it never re-derives the
// finer-grained rules the single-record methods enforce. Three suspected drifts below:
// (A) no subject-floor check at all (unlike grantRoleBatch/revokeRoleBatch, which both have
// one), (B) no "owner bootstrap only" restriction (grantOwner/grantRoleBatch only let a
// non-owner admin grant owner when no owner exists yet — this method doesn't check that at
// all), (C) no "only the record owner may touch another administrator" restriction (mirrors
// removeAdmin's Rule 2 — this method lets any admin change any other admin's role).

import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { deleteApp, getApps } from 'firebase/app';
import { connectTestFirestore, clearTestFirestore, seedUser, seedRecord } from './helpers/testFirestore';

const { mockCurrentUser } = vi.hoisted(() => ({
  mockCurrentUser: { uid: null as string | null },
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser.uid ? { uid: mockCurrentUser.uid } : null }),
}));

vi.mock('../../src/features/Permissions/services/blockchainRoleManagerService', () => ({
  BlockchainRoleManagerService: {
    grantRole: vi.fn(),
    changeRole: vi.fn(),
    revokeRole: vi.fn(),
    voluntarilyLeaveOwnership: vi.fn(),
    grantRoleBatch: vi.fn(),
    changeRoleBatch: vi.fn(),
    revokeRoleBatch: vi.fn(),
  },
}));

vi.mock('@/features/Sharing/services/sharingService', () => ({
  SharingService: {
    grantEncryptionAccess: vi.fn(),
    revokeEncryptionAccess: vi.fn(),
  },
}));

import { PermissionsService } from '../../src/features/Permissions/services/permissionsService';
import { BlockchainRoleManagerService } from '../../src/features/Permissions/services/blockchainRoleManagerService';
import { SharingService } from '@/features/Sharing/services/sharingService';

const OWNER = 'batch-change-owner';
const ADMIN = 'batch-change-admin-caller';
const TARGET = 'batch-change-target';
const RECORD_A = 'batch-change-record-a';
const RECORD_B = 'batch-change-record-b';

function setCaller(uid: string | null) {
  mockCurrentUser.uid = uid;
}

const db = connectTestFirestore('belrose-orchestration-change-role-batch');

describe('PermissionsService.changeRoleBatch (orchestration)', () => {
  beforeEach(async () => {
    await clearTestFirestore();
    vi.resetAllMocks();
    vi.mocked(BlockchainRoleManagerService.changeRoleBatch).mockResolvedValue({
      txHash: '0xdefault',
      blockNumber: 0,
    });
    await seedUser(db, OWNER, '0xOwnerWallet');
    await seedUser(db, ADMIN, '0xAdminCallerWallet');
    await seedUser(db, TARGET, '0xTargetWallet');
  });

  afterAll(() => {
    getApps().forEach(app => deleteApp(app));
  });

  it('upgrades a viewer to sharer across one record and downgrades an admin to sharer on another', async () => {
    await seedRecord(db, RECORD_A, { owners: [OWNER], viewers: [TARGET] });
    await seedRecord(db, RECORD_B, { owners: [OWNER], administrators: [TARGET] });
    setCaller(OWNER);

    vi.mocked(BlockchainRoleManagerService.changeRoleBatch).mockResolvedValue({
      txHash: '0xbatch',
      blockNumber: 1,
    });

    await PermissionsService.changeRoleBatch([RECORD_A, RECORD_B], TARGET, ['sharer', 'sharer']);

    expect(BlockchainRoleManagerService.changeRoleBatch).toHaveBeenCalledWith(
      expect.arrayContaining([RECORD_A, RECORD_B]),
      '0xTargetWallet',
      expect.arrayContaining(['sharer'])
    );

    const recordA = await getDoc(doc(db, 'records', RECORD_A));
    expect(recordA.data()?.sharers).toEqual([TARGET]);
    expect(recordA.data()?.viewers).toEqual([]);
    const recordB = await getDoc(doc(db, 'records', RECORD_B));
    expect(recordB.data()?.sharers).toEqual([TARGET]);
    expect(recordB.data()?.administrators).toEqual([]);

    const eventsA = await getDocs(collection(db, 'records', RECORD_A, 'permissionHistory'));
    expect(eventsA.docs[0]!.data().changes).toEqual([
      { userId: TARGET, action: 'upgraded', previousRole: 'viewer', newRole: 'sharer' },
    ]);
    const eventsB = await getDocs(collection(db, 'records', RECORD_B, 'permissionHistory'));
    expect(eventsB.docs[0]!.data().changes).toEqual([
      { userId: TARGET, action: 'downgraded', previousRole: 'administrator', newRole: 'sharer' },
    ]);
  });

  it('grants encryption access only when crossing from viewer/sharer up to administrator/owner', async () => {
    await seedRecord(db, RECORD_A, { owners: [OWNER], viewers: [TARGET] });
    setCaller(OWNER);

    await PermissionsService.changeRoleBatch([RECORD_A], TARGET, ['administrator']);

    expect(SharingService.grantEncryptionAccess).toHaveBeenCalledWith(RECORD_A, TARGET, OWNER);
  });

  it('does not re-grant encryption access when moving between viewer and sharer', async () => {
    await seedRecord(db, RECORD_A, { owners: [OWNER], viewers: [TARGET] });
    setCaller(OWNER);

    await PermissionsService.changeRoleBatch([RECORD_A], TARGET, ['sharer']);

    expect(SharingService.grantEncryptionAccess).not.toHaveBeenCalled();
  });

  it('skips a record the caller has no permission on', async () => {
    await seedRecord(db, RECORD_A, { owners: ['someone-else'], viewers: [TARGET] });
    setCaller(OWNER);

    await PermissionsService.changeRoleBatch([RECORD_A], TARGET, ['sharer']);

    expect(BlockchainRoleManagerService.changeRoleBatch).not.toHaveBeenCalled();
  });

  it('skips a record where the target has no role at all', async () => {
    await seedRecord(db, RECORD_A, { owners: [OWNER] });
    setCaller(OWNER);

    await PermissionsService.changeRoleBatch([RECORD_A], TARGET, ['sharer']);

    expect(BlockchainRoleManagerService.changeRoleBatch).not.toHaveBeenCalled();
  });

  it('skips a record where the target is already an owner', async () => {
    await seedRecord(db, RECORD_A, { owners: [OWNER, TARGET] });
    setCaller(OWNER);

    await PermissionsService.changeRoleBatch([RECORD_A], TARGET, ['administrator']);

    expect(BlockchainRoleManagerService.changeRoleBatch).not.toHaveBeenCalled();
  });

  it('skips a record where the target already has the requested role', async () => {
    await seedRecord(db, RECORD_A, { owners: [OWNER], sharers: [TARGET] });
    setCaller(OWNER);

    await PermissionsService.changeRoleBatch([RECORD_A], TARGET, ['sharer']);

    expect(BlockchainRoleManagerService.changeRoleBatch).not.toHaveBeenCalled();
  });

  it('throws immediately on array length mismatch, before any Firestore reads', async () => {
    setCaller(OWNER);

    await expect(
      PermissionsService.changeRoleBatch([RECORD_A, RECORD_B], TARGET, ['sharer'])
    ).rejects.toThrow('Array length mismatch');
    expect(BlockchainRoleManagerService.changeRoleBatch).not.toHaveBeenCalled();
  });

  it('leaves Firestore untouched and logs a sync-queue failure when the blockchain batch call rejects', async () => {
    await seedRecord(db, RECORD_A, { owners: [OWNER], viewers: [TARGET] });
    setCaller(OWNER);

    vi.mocked(BlockchainRoleManagerService.changeRoleBatch).mockRejectedValue(
      new Error('transaction reverted')
    );

    await expect(
      PermissionsService.changeRoleBatch([RECORD_A], TARGET, ['sharer'])
    ).rejects.toThrow('transaction reverted');

    const recordA = await getDoc(doc(db, 'records', RECORD_A));
    expect(recordA.data()?.viewers).toEqual([TARGET]);

    const failures = await getDocs(collection(db, 'blockchainSyncQueue'));
    expect(failures.size).toBe(1);
    expect(failures.docs[0]!.data().action).toBe('changeRoleBatch');
  });

  // ── Suspected drifts from the single-record methods' permission rules ────────────────

  it('regression check (A): refuses to demote an active subject to viewer via batch (mirrors the sharer/owner/admin subject-floor fixes)', async () => {
    await seedRecord(db, RECORD_A, { owners: [OWNER], sharers: [TARGET], subjects: [TARGET] });
    setCaller(OWNER);

    await PermissionsService.changeRoleBatch([RECORD_A], TARGET, ['viewer']);

    expect(BlockchainRoleManagerService.changeRoleBatch).not.toHaveBeenCalled();
    const recordA = await getDoc(doc(db, 'records', RECORD_A));
    expect(recordA.data()?.sharers).toEqual([TARGET]);
  });

  it('regression check (B): a non-owner administrator cannot batch-promote someone to owner once an owner already exists (mirrors grantOwner)', async () => {
    await seedRecord(db, RECORD_A, { owners: [OWNER], administrators: [ADMIN], sharers: [TARGET] });
    setCaller(ADMIN);

    await PermissionsService.changeRoleBatch([RECORD_A], TARGET, ['owner']);

    expect(BlockchainRoleManagerService.changeRoleBatch).not.toHaveBeenCalled();
    const recordA = await getDoc(doc(db, 'records', RECORD_A));
    expect(recordA.data()?.owners).toEqual([OWNER]);
  });

  it('regression check (C): a non-owner administrator cannot batch-change a different administrator while an owner exists (mirrors removeAdmin Rule 2)', async () => {
    await seedRecord(db, RECORD_A, { owners: [OWNER], administrators: [ADMIN, TARGET] });
    setCaller(ADMIN);

    await PermissionsService.changeRoleBatch([RECORD_A], TARGET, ['sharer']);

    expect(BlockchainRoleManagerService.changeRoleBatch).not.toHaveBeenCalled();
    const recordA = await getDoc(doc(db, 'records', RECORD_A));
    expect(recordA.data()?.administrators).toEqual(expect.arrayContaining([TARGET]));
  });
});
