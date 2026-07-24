// test/orchestration/trusteeRelationshipService.test.ts
//
// Layer 3 (orchestration) — TrusteeRelationshipService, the orchestrator for the whole trustee
// relationship lifecycle (invite/revoke/edit/stepDown/accept/decline/resign + queries).
// Real Firestore emulator; TrusteeBlockchainService and TrusteePermissionService (both tested on
// their own) are mocked at the boundary, along with getUserProfile and firebase/auth.

import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { deleteApp, getApps } from 'firebase/app';
import { connectTestFirestore, clearTestFirestore } from './helpers/testFirestore';

const { mockCurrentUser, blockchainMocks, permissionMocks, profileMocks } = vi.hoisted(() => ({
  mockCurrentUser: { uid: null as string | null },
  blockchainMocks: {
    proposeTrustee: vi.fn(),
    acceptTrustee: vi.fn(),
    declineTrustee: vi.fn(),
    revokeTrustee: vi.fn(),
    downgradeTrusteeLevel: vi.fn(),
    updateTrusteeLevel: vi.fn(),
  },
  permissionMocks: {
    getRecordsForTrustor: vi.fn(),
    grantPendingTrusteeAccess: vi.fn(),
    rollbackPendingTrusteeAccess: vi.fn(),
    revokeTrusteeAccess: vi.fn(),
    activateTrusteeAccess: vi.fn(),
    updateTrusteeAccess: vi.fn(),
  },
  profileMocks: {
    getUserProfile: vi.fn(),
  },
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser.uid ? { uid: mockCurrentUser.uid } : null }),
}));

vi.mock('@/features/Users/services/userProfileService', () => ({
  getUserProfile: profileMocks.getUserProfile,
}));

vi.mock('../../src/features/Trustee/services/trusteeBlockchainService', () => ({
  TrusteeBlockchainService: blockchainMocks,
}));

vi.mock('../../src/features/Trustee/services/trusteePermissionService', () => ({
  TrusteePermissionService: permissionMocks,
}));

import { TrusteeRelationshipService, getTrusteeRelationshipId } from '../../src/features/Trustee/services/trusteeRelationshipService';

const TRUSTOR = 'trustee-rel-trustor';
const TRUSTEE = 'trustee-rel-trustee';
const STRANGER = 'trustee-rel-stranger';

function setCaller(uid: string | null) {
  mockCurrentUser.uid = uid;
}

function walletedProfile(overrides: Record<string, unknown> = {}) {
  return {
    onChainIdentity: { linkedWallets: [{ address: '0xWallet', isWalletActive: true }] },
    ...overrides,
  };
}

function noWalletProfile() {
  return { onChainIdentity: { linkedWallets: [] } };
}

const db = connectTestFirestore('belrose-orchestration-trustee-relationship');

async function seedRelationship(
  trustorId: string,
  trusteeId: string,
  overrides: Record<string, unknown> = {}
) {
  await setDoc(doc(db, 'trusteeRelationships', getTrusteeRelationshipId(trustorId, trusteeId)), {
    trustorId,
    trusteeId,
    trustLevel: 'observer',
    isActive: false,
    status: 'pending',
    createdAt: Timestamp.now(),
    respondedAt: null,
    revokedAt: null,
    revokedBy: null,
    statusUpdateReason: null,
    onChainEvents: [],
    ...overrides,
  });
}

describe('TrusteeRelationshipService (orchestration)', () => {
  beforeEach(async () => {
    await clearTestFirestore();
    vi.resetAllMocks();
    setCaller(null);

    profileMocks.getUserProfile.mockImplementation(async (uid: string) => {
      if (uid === TRUSTOR || uid === TRUSTEE) return walletedProfile();
      return null;
    });
    permissionMocks.getRecordsForTrustor.mockResolvedValue([]);
    permissionMocks.grantPendingTrusteeAccess.mockResolvedValue(undefined);
    permissionMocks.rollbackPendingTrusteeAccess.mockResolvedValue(undefined);
    permissionMocks.revokeTrusteeAccess.mockResolvedValue(undefined);
    permissionMocks.activateTrusteeAccess.mockResolvedValue(undefined);
    permissionMocks.updateTrusteeAccess.mockResolvedValue(undefined);
    blockchainMocks.proposeTrustee.mockResolvedValue({
      success: true,
      blockchainRef: { txHash: '0xpropose', blockNumber: 1 },
    });
    blockchainMocks.acceptTrustee.mockResolvedValue({
      success: true,
      blockchainRef: { txHash: '0xaccept', blockNumber: 2 },
    });
    blockchainMocks.declineTrustee.mockResolvedValue({
      success: true,
      blockchainRef: { txHash: '0xdecline', blockNumber: 3 },
    });
    blockchainMocks.revokeTrustee.mockResolvedValue({
      success: true,
      blockchainRef: { txHash: '0xrevoke', blockNumber: 4 },
    });
    blockchainMocks.downgradeTrusteeLevel.mockResolvedValue({
      success: true,
      blockchainRef: { txHash: '0xdowngrade', blockNumber: 5 },
    });
    blockchainMocks.updateTrusteeLevel.mockResolvedValue({
      success: true,
      blockchainRef: { txHash: '0xupdate', blockNumber: 6 },
    });
  });

  afterAll(() => {
    getApps().forEach(app => deleteApp(app));
  });

  describe('inviteTrustee', () => {
    it('throws when not authenticated', async () => {
      await expect(TrusteeRelationshipService.inviteTrustee(TRUSTEE, 'observer')).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('throws when inviting yourself', async () => {
      setCaller(TRUSTOR);
      await expect(TrusteeRelationshipService.inviteTrustee(TRUSTOR, 'observer')).rejects.toThrow(
        'You cannot appoint yourself as a trustee'
      );
    });

    it('throws when the target user has no profile', async () => {
      setCaller(TRUSTOR);
      await expect(
        TrusteeRelationshipService.inviteTrustee('nonexistent-user', 'observer')
      ).rejects.toThrow('Target user does not exist or has no profile');
    });

    it('throws when the trustor has no active wallet', async () => {
      profileMocks.getUserProfile.mockImplementation(async (uid: string) => {
        if (uid === TRUSTOR) return noWalletProfile();
        if (uid === TRUSTEE) return walletedProfile();
        return null;
      });
      setCaller(TRUSTOR);

      await expect(TrusteeRelationshipService.inviteTrustee(TRUSTEE, 'observer')).rejects.toThrow(
        'Trustor does not have an existing blockchain account'
      );
    });

    it('throws when the trustee has no active wallet', async () => {
      profileMocks.getUserProfile.mockImplementation(async (uid: string) => {
        if (uid === TRUSTOR) return walletedProfile();
        if (uid === TRUSTEE) return noWalletProfile();
        return null;
      });
      setCaller(TRUSTOR);

      await expect(TrusteeRelationshipService.inviteTrustee(TRUSTEE, 'observer')).rejects.toThrow(
        'Trustee does not have an existing blockchain account'
      );
    });

    it('throws when the target is already an active trustee', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active' });
      setCaller(TRUSTOR);

      await expect(TrusteeRelationshipService.inviteTrustee(TRUSTEE, 'observer')).rejects.toThrow(
        'This user is already an active trustee'
      );
    });

    it('throws when an invite is already pending', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'pending' });
      setCaller(TRUSTOR);

      await expect(TrusteeRelationshipService.inviteTrustee(TRUSTEE, 'observer')).rejects.toThrow(
        'An invite is already pending for this user'
      );
    });

    it('throws when the blockchain proposal fails', async () => {
      blockchainMocks.proposeTrustee.mockResolvedValue({ success: false, blockchainRef: null });
      setCaller(TRUSTOR);

      await expect(TrusteeRelationshipService.inviteTrustee(TRUSTEE, 'observer')).rejects.toThrow(
        'Blockchain proposal failed — see sync queue for details'
      );
      expect(permissionMocks.grantPendingTrusteeAccess).not.toHaveBeenCalled();
    });

    it('creates a new pending relationship, proposes on-chain with the right level, and fans out permissions', async () => {
      permissionMocks.getRecordsForTrustor.mockResolvedValue([
        { recordId: 'r1', trustorRole: 'owner', recordTrustees: [] },
      ]);
      setCaller(TRUSTOR);

      await TrusteeRelationshipService.inviteTrustee(TRUSTEE, 'custodian');

      expect(permissionMocks.getRecordsForTrustor).toHaveBeenCalledWith(TRUSTOR, TRUSTEE);
      expect(blockchainMocks.proposeTrustee).toHaveBeenCalledWith(TRUSTOR, TRUSTEE, 1, ['r1']);
      expect(permissionMocks.grantPendingTrusteeAccess).toHaveBeenCalledWith(
        TRUSTEE,
        'custodian',
        { txHash: '0xpropose', blockNumber: 1 }
      );

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      const data = snap.data()!;
      expect(data.status).toBe('pending');
      expect(data.isActive).toBe(false);
      expect(data.trustLevel).toBe('custodian');
      expect(data.onChainEvents).toHaveLength(1);
      expect(data.onChainEvents[0].action).toBe('propose');
    });

    it('reactivates a previously revoked relationship as a new pending invite, appending to onChainEvents', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, {
        status: 'revoked',
        trustLevel: 'controller',
        onChainEvents: [{ action: 'propose', blockchainRef: { txHash: '0xold', blockNumber: 0 }, recordedAt: Timestamp.now() }],
      });
      setCaller(TRUSTOR);

      await TrusteeRelationshipService.inviteTrustee(TRUSTEE, 'observer');

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      const data = snap.data()!;
      expect(data.status).toBe('pending');
      expect(data.trustLevel).toBe('observer');
      expect(data.onChainEvents).toHaveLength(2);
    });
  });

  describe('revokeTrustee', () => {
    it('throws when not authenticated', async () => {
      await expect(TrusteeRelationshipService.revokeTrustee(TRUSTEE)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('throws when no relationship exists', async () => {
      setCaller(TRUSTOR);
      await expect(TrusteeRelationshipService.revokeTrustee(TRUSTEE)).rejects.toThrow(
        'Trustee relationship not found'
      );
    });

    it('throws when already revoked', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'revoked' });
      setCaller(TRUSTOR);
      await expect(TrusteeRelationshipService.revokeTrustee(TRUSTEE)).rejects.toThrow(
        'Relationship is already revoked'
      );
    });

    it('throws when the relationship was declined', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'declined' });
      setCaller(TRUSTOR);
      await expect(TrusteeRelationshipService.revokeTrustee(TRUSTEE)).rejects.toThrow(
        'Cannot revoke a declined relationship'
      );
    });

    it('throws when the blockchain revocation fails', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active' });
      blockchainMocks.revokeTrustee.mockResolvedValue({ success: false, blockchainRef: null });
      setCaller(TRUSTOR);

      await expect(TrusteeRelationshipService.revokeTrustee(TRUSTEE)).rejects.toThrow(
        'Blockchain revocation failed — see sync queue for details'
      );
    });

    it('revokes an active relationship via revokeTrusteeAccess', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', isActive: true });
      setCaller(TRUSTOR);

      await TrusteeRelationshipService.revokeTrustee(TRUSTEE);

      expect(permissionMocks.revokeTrusteeAccess).toHaveBeenCalledWith(
        TRUSTOR,
        TRUSTEE,
        { txHash: '0xrevoke', blockNumber: 4 }
      );
      expect(permissionMocks.rollbackPendingTrusteeAccess).not.toHaveBeenCalled();

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      const data = snap.data()!;
      expect(data.status).toBe('revoked');
      expect(data.isActive).toBe(false);
      expect(data.revokedBy).toBe(TRUSTOR);
      expect(data.statusUpdateReason).toBe('trustor_revoked');
    });

    it('revokes a pending relationship via rollbackPendingTrusteeAccess instead', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'pending' });
      setCaller(TRUSTOR);

      await TrusteeRelationshipService.revokeTrustee(TRUSTEE);

      expect(permissionMocks.rollbackPendingTrusteeAccess).toHaveBeenCalledWith(
        TRUSTOR,
        TRUSTEE,
        { txHash: '0xrevoke', blockNumber: 4 }
      );
      expect(permissionMocks.revokeTrusteeAccess).not.toHaveBeenCalled();
    });

    // Regression: TrusteeBlockchainService.revokeTrustee returns { success: true, blockchainRef:
    // null } when the relationship was already inactive on-chain from an earlier partial failure
    // (see trusteeBlockchainService.test.ts). Firestore still needs to catch up to match, but
    // there's no new on-chain event to append to the audit log.
    it('still syncs Firestore to revoked when the blockchain call reports already-inactive (null blockchainRef)', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', isActive: true });
      blockchainMocks.revokeTrustee.mockResolvedValue({ success: true, blockchainRef: null });
      setCaller(TRUSTOR);

      await TrusteeRelationshipService.revokeTrustee(TRUSTEE);

      expect(permissionMocks.revokeTrusteeAccess).toHaveBeenCalledWith(TRUSTOR, TRUSTEE, null);

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      const data = snap.data()!;
      expect(data.status).toBe('revoked');
      expect(data.isActive).toBe(false);
      // No new event appended — nothing new happened on-chain to record.
      expect(data.onChainEvents).toHaveLength(0);
    });
  });

  describe('editTrusteeRelationship', () => {
    it('throws when not authenticated', async () => {
      await expect(
        TrusteeRelationshipService.editTrusteeRelationship(TRUSTEE, 'controller')
      ).rejects.toThrow('User not authenticated');
    });

    it('throws when no relationship exists', async () => {
      setCaller(TRUSTOR);
      await expect(
        TrusteeRelationshipService.editTrusteeRelationship(TRUSTEE, 'controller')
      ).rejects.toThrow('Trustee relationship not found');
    });

    it('throws when the relationship is not active', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'pending' });
      setCaller(TRUSTOR);
      await expect(
        TrusteeRelationshipService.editTrusteeRelationship(TRUSTEE, 'controller')
      ).rejects.toThrow('Can only edit an active trustee relationship');
    });

    it('throws when selecting the same trust level', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', trustLevel: 'custodian' });
      setCaller(TRUSTOR);
      await expect(
        TrusteeRelationshipService.editTrusteeRelationship(TRUSTEE, 'custodian')
      ).rejects.toThrow('Trustee already has this trust level');
    });

    it('throws when the blockchain update fails', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', trustLevel: 'observer' });
      blockchainMocks.updateTrusteeLevel.mockResolvedValue({ success: false, blockchainRef: null });
      setCaller(TRUSTOR);

      await expect(
        TrusteeRelationshipService.editTrusteeRelationship(TRUSTEE, 'controller')
      ).rejects.toThrow('Blockchain update failed — see sync queue for details');
    });

    it('upgrades the trust level and marks statusUpdateReason as an upgrade', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', trustLevel: 'observer' });
      setCaller(TRUSTOR);

      await TrusteeRelationshipService.editTrusteeRelationship(TRUSTEE, 'custodian');

      expect(blockchainMocks.updateTrusteeLevel).toHaveBeenCalledWith(TRUSTOR, TRUSTEE, 1);
      expect(permissionMocks.updateTrusteeAccess).toHaveBeenCalledWith(
        TRUSTOR,
        TRUSTEE,
        'custodian',
        { txHash: '0xupdate', blockNumber: 6 }
      );

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      const data = snap.data()!;
      expect(data.trustLevel).toBe('custodian');
      expect(data.statusUpdateReason).toBe('trust_level_upgrade');
    });

    it('downgrades the trust level and marks statusUpdateReason as a downgrade', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', trustLevel: 'controller' });
      setCaller(TRUSTOR);

      await TrusteeRelationshipService.editTrusteeRelationship(TRUSTEE, 'custodian');

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      expect(snap.data()?.statusUpdateReason).toBe('trust_level_downgrade');
    });

    it('still updates Firestore even when the permission fan-out rejects (non-fatal)', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', trustLevel: 'observer' });
      permissionMocks.updateTrusteeAccess.mockRejectedValue(new Error('fan-out down'));
      setCaller(TRUSTOR);

      await TrusteeRelationshipService.editTrusteeRelationship(TRUSTEE, 'custodian');

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      expect(snap.data()?.trustLevel).toBe('custodian');
    });

    // Regression: TrusteeBlockchainService.updateTrusteeLevel returns { success: true,
    // blockchainRef: null } when chain already shows the requested level from an earlier
    // partial failure (see trusteeBlockchainService.test.ts). Firestore still needs to catch up
    // to match, but there's no new on-chain event to append to the audit log.
    it('still syncs Firestore to the new level when the blockchain call reports already-there (null blockchainRef)', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', trustLevel: 'observer' });
      blockchainMocks.updateTrusteeLevel.mockResolvedValue({ success: true, blockchainRef: null });
      setCaller(TRUSTOR);

      await TrusteeRelationshipService.editTrusteeRelationship(TRUSTEE, 'custodian');

      expect(permissionMocks.updateTrusteeAccess).toHaveBeenCalledWith(
        TRUSTOR,
        TRUSTEE,
        'custodian',
        null
      );

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      const data = snap.data()!;
      expect(data.trustLevel).toBe('custodian');
      expect(data.onChainEvents).toHaveLength(0);
    });
  });

  describe('stepDownTrusteeLevel', () => {
    it('throws when not authenticated', async () => {
      await expect(
        TrusteeRelationshipService.stepDownTrusteeLevel(TRUSTOR, 'observer')
      ).rejects.toThrow('User not authenticated');
    });

    it('throws when no relationship exists', async () => {
      setCaller(TRUSTEE);
      await expect(
        TrusteeRelationshipService.stepDownTrusteeLevel(TRUSTOR, 'observer')
      ).rejects.toThrow('Trustee relationship not found');
    });

    it('throws when the relationship is not active', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'pending' });
      setCaller(TRUSTEE);
      await expect(
        TrusteeRelationshipService.stepDownTrusteeLevel(TRUSTOR, 'observer')
      ).rejects.toThrow('Can only step down from an active relationship');
    });

    it('throws when attempting to step up (or sideways) instead of down', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', trustLevel: 'custodian' });
      setCaller(TRUSTEE);
      await expect(
        TrusteeRelationshipService.stepDownTrusteeLevel(TRUSTOR, 'controller')
      ).rejects.toThrow('Can only step down to a lower trust level');
      await expect(
        TrusteeRelationshipService.stepDownTrusteeLevel(TRUSTOR, 'custodian')
      ).rejects.toThrow('Can only step down to a lower trust level');
    });

    it('throws when the blockchain downgrade fails', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', trustLevel: 'controller' });
      blockchainMocks.downgradeTrusteeLevel.mockResolvedValue({ success: false, blockchainRef: null });
      setCaller(TRUSTEE);

      await expect(
        TrusteeRelationshipService.stepDownTrusteeLevel(TRUSTOR, 'observer')
      ).rejects.toThrow('Blockchain update failed — see sync queue for details');
    });

    it('steps down the trust level on success', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', trustLevel: 'controller' });
      setCaller(TRUSTEE);

      await TrusteeRelationshipService.stepDownTrusteeLevel(TRUSTOR, 'observer');

      expect(blockchainMocks.downgradeTrusteeLevel).toHaveBeenCalledWith(TRUSTOR, TRUSTEE, 0);
      expect(permissionMocks.updateTrusteeAccess).toHaveBeenCalledWith(
        TRUSTOR,
        TRUSTEE,
        'observer',
        { txHash: '0xdowngrade', blockNumber: 5 }
      );

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      const data = snap.data()!;
      expect(data.trustLevel).toBe('observer');
      expect(data.statusUpdateReason).toBe('trust_level_downgrade');
    });

    it('still updates Firestore even when the permission fan-out rejects (non-fatal)', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', trustLevel: 'controller' });
      permissionMocks.updateTrusteeAccess.mockRejectedValue(new Error('fan-out down'));
      setCaller(TRUSTEE);

      await TrusteeRelationshipService.stepDownTrusteeLevel(TRUSTOR, 'observer');

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      expect(snap.data()?.trustLevel).toBe('observer');
    });
  });

  describe('acceptInvite', () => {
    it('throws when not authenticated', async () => {
      await expect(TrusteeRelationshipService.acceptInvite(TRUSTOR)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('throws when no invite exists', async () => {
      setCaller(TRUSTEE);
      await expect(TrusteeRelationshipService.acceptInvite(TRUSTOR)).rejects.toThrow(
        'Trustee invite not found'
      );
    });

    it('throws with the current status when the invite is not pending', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active' });
      setCaller(TRUSTEE);
      await expect(TrusteeRelationshipService.acceptInvite(TRUSTOR)).rejects.toThrow(
        'Cannot accept an invite with status: active'
      );
    });

    it('throws when the caller is not the intended recipient', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'pending', trusteeId: STRANGER });
      setCaller(TRUSTEE);
      await expect(TrusteeRelationshipService.acceptInvite(TRUSTOR)).rejects.toThrow(
        'You are not the intended recipient of this invite'
      );
    });

    it('throws when the trustee has no active wallet', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'pending' });
      profileMocks.getUserProfile.mockImplementation(async (uid: string) =>
        uid === TRUSTEE ? noWalletProfile() : walletedProfile()
      );
      setCaller(TRUSTEE);

      await expect(TrusteeRelationshipService.acceptInvite(TRUSTOR)).rejects.toThrow(
        'You need an active blockchain wallet to accept a trustee invite'
      );
    });

    it('throws when the blockchain acceptance fails', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'pending' });
      blockchainMocks.acceptTrustee.mockResolvedValue({ success: false, blockchainRef: null });
      setCaller(TRUSTEE);

      await expect(TrusteeRelationshipService.acceptInvite(TRUSTOR)).rejects.toThrow(
        'Blockchain acceptance failed — see sync queue for details'
      );
    });

    it('activates the relationship on success', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'pending' });
      setCaller(TRUSTEE);

      await TrusteeRelationshipService.acceptInvite(TRUSTOR);

      expect(permissionMocks.activateTrusteeAccess).toHaveBeenCalledWith(TRUSTOR);

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      const data = snap.data()!;
      expect(data.status).toBe('active');
      expect(data.isActive).toBe(true);
      expect(data.respondedAt).toBeDefined();
      expect(data.onChainEvents).toHaveLength(1);
      expect(data.onChainEvents[0].action).toBe('accept');
    });

    // Regression: TrusteeBlockchainService.acceptTrustee returns { success: true, blockchainRef:
    // null } when chain already shows Active from an earlier partial failure (see
    // trusteeBlockchainService.test.ts). Firestore still needs to catch up to match, but there's
    // no new on-chain event to append to the audit log.
    it('still activates Firestore when the blockchain call reports already-active (null blockchainRef)', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'pending' });
      blockchainMocks.acceptTrustee.mockResolvedValue({ success: true, blockchainRef: null });
      setCaller(TRUSTEE);

      await TrusteeRelationshipService.acceptInvite(TRUSTOR);

      expect(permissionMocks.activateTrusteeAccess).toHaveBeenCalledWith(TRUSTOR);

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      const data = snap.data()!;
      expect(data.status).toBe('active');
      expect(data.isActive).toBe(true);
      expect(data.onChainEvents).toHaveLength(0);
    });
  });

  describe('declineInvite', () => {
    it('throws when not authenticated', async () => {
      await expect(TrusteeRelationshipService.declineInvite(TRUSTOR)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('throws when no invite exists', async () => {
      setCaller(TRUSTEE);
      await expect(TrusteeRelationshipService.declineInvite(TRUSTOR)).rejects.toThrow(
        'Trustee invite not found'
      );
    });

    it('throws with the current status when the invite is not pending', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'declined' });
      setCaller(TRUSTEE);
      await expect(TrusteeRelationshipService.declineInvite(TRUSTOR)).rejects.toThrow(
        'Cannot decline an invite with status: declined'
      );
    });

    it('throws when the blockchain decline fails', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'pending' });
      blockchainMocks.declineTrustee.mockResolvedValue({ success: false, blockchainRef: null });
      setCaller(TRUSTEE);

      await expect(TrusteeRelationshipService.declineInvite(TRUSTOR)).rejects.toThrow(
        'Blockchain decline failed — see sync queue for details'
      );
    });

    it('rolls back pending permissions and marks the relationship declined', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'pending' });
      setCaller(TRUSTEE);

      await TrusteeRelationshipService.declineInvite(TRUSTOR);

      expect(permissionMocks.rollbackPendingTrusteeAccess).toHaveBeenCalledWith(
        TRUSTOR,
        TRUSTEE,
        { txHash: '0xdecline', blockNumber: 3 }
      );

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      const data = snap.data()!;
      expect(data.status).toBe('declined');
      expect(data.isActive).toBe(false);
      expect(data.revokedBy).toBe(TRUSTEE);
    });
  });

  describe('resignAsTrustee', () => {
    it('throws when not authenticated', async () => {
      await expect(TrusteeRelationshipService.resignAsTrustee(TRUSTOR)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('throws when no relationship exists', async () => {
      setCaller(TRUSTEE);
      await expect(TrusteeRelationshipService.resignAsTrustee(TRUSTOR)).rejects.toThrow(
        'Trustee relationship not found'
      );
    });

    it('throws when the relationship is not active', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'pending' });
      setCaller(TRUSTEE);
      await expect(TrusteeRelationshipService.resignAsTrustee(TRUSTOR)).rejects.toThrow(
        'Can only resign from an active trustee relationship'
      );
    });

    it('throws when the blockchain revocation fails', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active' });
      blockchainMocks.revokeTrustee.mockResolvedValue({ success: false, blockchainRef: null });
      setCaller(TRUSTEE);

      await expect(TrusteeRelationshipService.resignAsTrustee(TRUSTOR)).rejects.toThrow(
        'Blockchain revocation failed — see sync queue for details'
      );
    });

    it('revokes access and marks the relationship declined with trustee_resigned as the reason', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', isActive: true });
      setCaller(TRUSTEE);

      await TrusteeRelationshipService.resignAsTrustee(TRUSTOR);

      expect(permissionMocks.revokeTrusteeAccess).toHaveBeenCalledWith(
        TRUSTOR,
        TRUSTEE,
        { txHash: '0xrevoke', blockNumber: 4 }
      );

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      const data = snap.data()!;
      // Resignation lands on 'declined', not 'revoked' — distinct from the trustor-initiated
      // revokeTrustee flow above, even though both call the same TrusteePermissionService method.
      expect(data.status).toBe('declined');
      expect(data.isActive).toBe(false);
      expect(data.revokedBy).toBe(TRUSTEE);
      expect(data.statusUpdateReason).toBe('trustee_resigned');
    });

    // Regression: same already-inactive-on-chain resilience as revokeTrustee above.
    it('still syncs Firestore to declined when the blockchain call reports already-inactive (null blockchainRef)', async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', isActive: true });
      blockchainMocks.revokeTrustee.mockResolvedValue({ success: true, blockchainRef: null });
      setCaller(TRUSTEE);

      await TrusteeRelationshipService.resignAsTrustee(TRUSTOR);

      expect(permissionMocks.revokeTrusteeAccess).toHaveBeenCalledWith(TRUSTOR, TRUSTEE, null);

      const snap = await getDoc(
        doc(db, 'trusteeRelationships', getTrusteeRelationshipId(TRUSTOR, TRUSTEE))
      );
      const data = snap.data()!;
      expect(data.status).toBe('declined');
      expect(data.isActive).toBe(false);
      expect(data.onChainEvents).toHaveLength(0);
    });
  });

  describe('query methods', () => {
    beforeEach(async () => {
      await seedRelationship(TRUSTOR, TRUSTEE, { status: 'active', isActive: true, trustLevel: 'controller' });
      await seedRelationship(TRUSTOR, STRANGER, { status: 'pending', isActive: false });
    });

    describe('getTrusteesForTrustor', () => {
      it('throws when not authenticated', async () => {
        await expect(TrusteeRelationshipService.getTrusteesForTrustor()).rejects.toThrow(
          'User not authenticated'
        );
      });

      it('returns only active relationships for the given trustor', async () => {
        setCaller(TRUSTOR);
        const result = await TrusteeRelationshipService.getTrusteesForTrustor(TRUSTOR);
        expect(result).toHaveLength(1);
        expect(result[0]!.trusteeId).toBe(TRUSTEE);
      });

      it('defaults to the current user when no trustorId is given', async () => {
        setCaller(TRUSTOR);
        const result = await TrusteeRelationshipService.getTrusteesForTrustor();
        expect(result).toHaveLength(1);
      });
    });

    describe('getTrustorAccountsForTrustee', () => {
      it('throws when not authenticated', async () => {
        await expect(TrusteeRelationshipService.getTrustorAccountsForTrustee()).rejects.toThrow(
          'User not authenticated'
        );
      });

      it("returns the accounts the caller actively manages", async () => {
        setCaller(TRUSTEE);
        const result = await TrusteeRelationshipService.getTrustorAccountsForTrustee();
        expect(result).toHaveLength(1);
        expect(result[0]!.trustorId).toBe(TRUSTOR);
      });
    });

    describe('getPendingInvitesForTrustee', () => {
      it('throws when not authenticated', async () => {
        await expect(TrusteeRelationshipService.getPendingInvitesForTrustee()).rejects.toThrow(
          'User not authenticated'
        );
      });

      it('returns only pending invites for the caller', async () => {
        setCaller(STRANGER);
        const result = await TrusteeRelationshipService.getPendingInvitesForTrustee();
        expect(result).toHaveLength(1);
        expect(result[0]!.trustorId).toBe(TRUSTOR);
      });
    });

    describe('getRelationship', () => {
      it('returns null when no relationship exists', async () => {
        await expect(
          TrusteeRelationshipService.getRelationship(TRUSTOR, 'nobody')
        ).resolves.toBeNull();
      });

      it('returns the relationship data when it exists', async () => {
        const result = await TrusteeRelationshipService.getRelationship(TRUSTOR, TRUSTEE);
        expect(result?.trustLevel).toBe('controller');
      });
    });

    describe('getControllerRelationshipWith', () => {
      it('returns null when not authenticated', async () => {
        await expect(
          TrusteeRelationshipService.getControllerRelationshipWith(TRUSTOR)
        ).resolves.toBeNull();
      });

      it('returns the relationship when the caller is an active controller trustee', async () => {
        setCaller(TRUSTEE);
        const result = await TrusteeRelationshipService.getControllerRelationshipWith(TRUSTOR);
        expect(result?.trustLevel).toBe('controller');
      });

      it('returns null when the caller is only a pending (not-yet-active) trustee', async () => {
        setCaller(STRANGER);
        const result = await TrusteeRelationshipService.getControllerRelationshipWith(TRUSTOR);
        expect(result).toBeNull();
      });
    });

    describe('getActiveControllerTrustors', () => {
      it('returns an empty array when not authenticated', async () => {
        await expect(TrusteeRelationshipService.getActiveControllerTrustors()).resolves.toEqual([]);
      });

      it('returns only active controller-level relationships for the caller', async () => {
        setCaller(TRUSTEE);
        const result = await TrusteeRelationshipService.getActiveControllerTrustors();
        expect(result).toHaveLength(1);
        expect(result[0]!.trustorId).toBe(TRUSTOR);
      });

      it('excludes active relationships at a lower trust level', async () => {
        await seedRelationship('another-trustor', TRUSTEE, {
          status: 'active',
          isActive: true,
          trustLevel: 'observer',
        });
        setCaller(TRUSTEE);

        const result = await TrusteeRelationshipService.getActiveControllerTrustors();
        expect(result.map(r => r.trustorId)).toEqual([TRUSTOR]);
      });
    });
  });
});
