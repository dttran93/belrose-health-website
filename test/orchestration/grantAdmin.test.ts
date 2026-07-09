// test/orchestration/grantAdmin.test.ts
//
// Layer 3 (orchestration) — PermissionsService.grantAdmin.
// Same setup as grantViewer/grantSharer: real Firestore emulator (permissive rules),
// BlockchainRoleManagerService/SharingService/firebase-auth mocked.
//
// Includes regression coverage for the dead "subject caller" branch removed this session:
// Check 2/3 used to require a subject to already hold administrator/owner role to pass —
// impossible, since the outer condition already excluded admins/owners. A subject-only
// caller now gets denied cleanly at Check 2 instead of falling through unreachable logic.

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

const OWNER = 'grant-admin-owner';
const ADMIN = 'grant-admin-admin-caller';
const SHARER = 'grant-admin-sharer';
const SUBJECT_ONLY = 'grant-admin-subject-only';
const STRANGER = 'grant-admin-stranger';
const TARGET = 'grant-admin-target';
const RECORD_ID = 'grant-admin-record';

function setCaller(uid: string | null) {
  mockCurrentUser.uid = uid;
}

const db = connectTestFirestore('belrose-orchestration-grant-admin');

describe('PermissionsService.grantAdmin (orchestration)', () => {
  beforeEach(async () => {
    await clearTestFirestore();
    vi.clearAllMocks();
    await seedUser(db, OWNER, '0xOwnerWallet');
    await seedUser(db, ADMIN, '0xAdminWallet');
    await seedUser(db, SHARER, '0xSharerWallet');
    await seedUser(db, SUBJECT_ONLY, '0xSubjectOnlyWallet');
    await seedUser(db, STRANGER, '0xStrangerWallet');
    await seedUser(db, TARGET, '0xTargetWallet');
  });

  afterAll(() => {
    getApps().forEach(app => deleteApp(app));
  });

  it('owner grants admin to a user with no existing role', async () => {
    await seedRecord(db, RECORD_ID, { owners: [OWNER] });
    setCaller(OWNER);

    vi.mocked(BlockchainRoleManagerService.grantRole).mockResolvedValue({
      txHash: '0xgrant',
      blockNumber: 1,
    });

    await PermissionsService.grantAdmin(RECORD_ID, TARGET);

    expect(BlockchainRoleManagerService.grantRole).toHaveBeenCalledWith(
      RECORD_ID,
      '0xTargetWallet',
      'administrator'
    );
    expect(SharingService.grantEncryptionAccess).toHaveBeenCalledWith(RECORD_ID, TARGET, OWNER);

    const recordSnap = await getDoc(doc(db, 'records', RECORD_ID));
    expect(recordSnap.data()?.administrators).toEqual([TARGET]);

    const events = await getDocs(collection(db, 'records', RECORD_ID, 'permissionHistory'));
    expect(events.docs[0]!.data().changes).toEqual([
      { userId: TARGET, action: 'granted', previousRole: null, newRole: 'administrator' },
    ]);
  });

  it('admin upgrades an existing sharer to administrator via changeRole, not grantRole', async () => {
    await seedRecord(db, RECORD_ID, { owners: [OWNER], administrators: [ADMIN], sharers: [TARGET] });
    setCaller(ADMIN);

    vi.mocked(BlockchainRoleManagerService.changeRole).mockResolvedValue({
      txHash: '0xupgrade',
      blockNumber: 2,
    });

    await PermissionsService.grantAdmin(RECORD_ID, TARGET);

    expect(BlockchainRoleManagerService.changeRole).toHaveBeenCalledWith(
      RECORD_ID,
      '0xTargetWallet',
      'administrator'
    );
    expect(BlockchainRoleManagerService.grantRole).not.toHaveBeenCalled();

    const recordSnap = await getDoc(doc(db, 'records', RECORD_ID));
    expect(recordSnap.data()?.administrators).toEqual([ADMIN, TARGET]);
    expect(recordSnap.data()?.sharers).toEqual([]);

    const events = await getDocs(collection(db, 'records', RECORD_ID, 'permissionHistory'));
    expect(events.docs[0]!.data().changes).toEqual([
      { userId: TARGET, action: 'upgraded', previousRole: 'sharer', newRole: 'administrator' },
    ]);
  });

  it('owner upgrades an existing viewer to administrator via changeRole, not grantRole', async () => {
    await seedRecord(db, RECORD_ID, { owners: [OWNER], viewers: [TARGET] });
    setCaller(OWNER);

    vi.mocked(BlockchainRoleManagerService.changeRole).mockResolvedValue({
      txHash: '0xupgrade-viewer',
      blockNumber: 3,
    });

    await PermissionsService.grantAdmin(RECORD_ID, TARGET);

    expect(BlockchainRoleManagerService.changeRole).toHaveBeenCalledWith(
      RECORD_ID,
      '0xTargetWallet',
      'administrator'
    );
    expect(BlockchainRoleManagerService.grantRole).not.toHaveBeenCalled();

    const recordSnap = await getDoc(doc(db, 'records', RECORD_ID));
    expect(recordSnap.data()?.administrators).toEqual([TARGET]);
    expect(recordSnap.data()?.viewers).toEqual([]);

    const events = await getDocs(collection(db, 'records', RECORD_ID, 'permissionHistory'));
    expect(events.docs[0]!.data().changes).toEqual([
      { userId: TARGET, action: 'upgraded', previousRole: 'viewer', newRole: 'administrator' },
    ]);
  });

  it('denies a caller with no role on the record', async () => {
    await seedRecord(db, RECORD_ID, { owners: [OWNER] });
    setCaller(STRANGER);

    await expect(PermissionsService.grantAdmin(RECORD_ID, TARGET)).rejects.toThrow(
      'Only administrators or owners can add administrators'
    );
    expect(BlockchainRoleManagerService.grantRole).not.toHaveBeenCalled();
  });

  it('denies granting to a target with no user profile', async () => {
    const nonexistentTarget = 'grant-admin-nonexistent-target';
    await seedRecord(db, RECORD_ID, { owners: [OWNER] });
    setCaller(OWNER);

    await expect(PermissionsService.grantAdmin(RECORD_ID, nonexistentTarget)).rejects.toThrow(
      'Target user does not exist or has no profile'
    );
    expect(BlockchainRoleManagerService.grantRole).not.toHaveBeenCalled();
    expect(SharingService.grantEncryptionAccess).not.toHaveBeenCalled();
  });

  it('denies a plain sharer', async () => {
    await seedRecord(db, RECORD_ID, { owners: [OWNER], sharers: [SHARER] });
    setCaller(SHARER);

    await expect(PermissionsService.grantAdmin(RECORD_ID, TARGET)).rejects.toThrow(
      'Only administrators or owners can add administrators'
    );
    expect(BlockchainRoleManagerService.grantRole).not.toHaveBeenCalled();
  });

  it('regression: denies a caller who is only a subject, with no other role', async () => {
    await seedRecord(db, RECORD_ID, { owners: [OWNER], subjects: [SUBJECT_ONLY] });
    setCaller(SUBJECT_ONLY);

    await expect(PermissionsService.grantAdmin(RECORD_ID, TARGET)).rejects.toThrow(
      'Only administrators or owners can add administrators'
    );
    expect(BlockchainRoleManagerService.grantRole).not.toHaveBeenCalled();
  });

  it('refuses to grant admin to an existing owner', async () => {
    await seedRecord(db, RECORD_ID, { owners: [OWNER, TARGET] });
    setCaller(OWNER);

    await expect(PermissionsService.grantAdmin(RECORD_ID, TARGET)).rejects.toThrow(
      'User is already an owner (higher role than administrator)'
    );
    expect(BlockchainRoleManagerService.grantRole).not.toHaveBeenCalled();
  });

  it('refuses to grant admin to an existing administrator', async () => {
    await seedRecord(db, RECORD_ID, { owners: [OWNER], administrators: [TARGET] });
    setCaller(OWNER);

    await expect(PermissionsService.grantAdmin(RECORD_ID, TARGET)).rejects.toThrow(
      'User is already an administrator'
    );
    expect(BlockchainRoleManagerService.grantRole).not.toHaveBeenCalled();
  });

  it('leaves Firestore untouched and logs a sync-queue failure when the blockchain call rejects', async () => {
    await seedRecord(db, RECORD_ID, { owners: [OWNER] });
    setCaller(OWNER);

    vi.mocked(BlockchainRoleManagerService.grantRole).mockRejectedValue(
      new Error('transaction reverted')
    );

    await expect(PermissionsService.grantAdmin(RECORD_ID, TARGET)).rejects.toThrow(
      'transaction reverted'
    );

    expect(SharingService.grantEncryptionAccess).not.toHaveBeenCalled();
    const recordSnap = await getDoc(doc(db, 'records', RECORD_ID));
    expect(recordSnap.data()?.administrators).toEqual([]);

    const failures = await getDocs(collection(db, 'blockchainSyncQueue'));
    expect(failures.size).toBe(1);
    expect(failures.docs[0]!.data().action).toBe('grantRole');
  });
});
