// test/orchestration/accountDeletionService.test.ts
//
// Layer 3 (orchestration) — AccountDeletionService is a thin orchestrator over three
// already-tested services (RecordDeletionService, SubjectService, TrusteeRelationshipService),
// so those are mocked at their own module boundary here — this file only verifies the
// orchestration decisions: which cleanup path each record gets dispatched to based on role/
// subject status, that both trustee directions get revoked, that a per-record failure doesn't
// abort the rest of the run, and that the by-user subject-request sweep (the one piece of
// Firestore logic that actually lives in this service) hits the real emulator correctly.

import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { deleteApp, getApps } from 'firebase/app';
import { connectTestFirestore, clearTestFirestore, seedRecord } from './helpers/testFirestore';

const {
  mockCurrentUser,
  signOutMock,
  httpsCallableMock,
  clearSessionMock,
  recordDeletionMocks,
  subjectServiceMocks,
  trusteeRelationshipMocks,
} = vi.hoisted(() => ({
  mockCurrentUser: { uid: null as string | null },
  signOutMock: vi.fn(),
  httpsCallableMock: vi.fn(),
  clearSessionMock: vi.fn(),
  recordDeletionMocks: {
    checkDeletionPermissions: vi.fn(),
    deleteRecord: vi.fn(),
    removeUserFromRecord: vi.fn(),
  },
  subjectServiceMocks: {
    rejectSubjectStatus: vi.fn(),
  },
  trusteeRelationshipMocks: {
    getTrusteesForTrustor: vi.fn(),
    getTrustorAccountsForTrustee: vi.fn(),
    revokeTrustee: vi.fn(),
    resignAsTrustee: vi.fn(),
  },
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser.uid ? { uid: mockCurrentUser.uid } : null }),
  signOut: signOutMock,
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: () => httpsCallableMock,
}));

vi.mock('@/features/Encryption/services/encryptionKeyManager', () => ({
  EncryptionKeyManager: { clearSession: clearSessionMock },
}));

vi.mock('@/features/ViewEditRecord/services/recordDeletionService', () => ({
  default: recordDeletionMocks,
}));

vi.mock('@/features/Subject/services/subjectService', () => ({
  SubjectService: subjectServiceMocks,
}));

vi.mock('@/features/Trustee/services/trusteeRelationshipService', () => ({
  TrusteeRelationshipService: trusteeRelationshipMocks,
}));

import { AccountDeletionService } from '../../src/features/Settings/services/accountDeletionService';

const UID = 'account-deletion-uid';
const OTHER = 'account-deletion-other-user';

function setCaller(uid: string | null) {
  mockCurrentUser.uid = uid;
}

const db = connectTestFirestore('belrose-orchestration-account-deletion');

describe('AccountDeletionService (orchestration)', () => {
  beforeEach(async () => {
    await clearTestFirestore();
    vi.resetAllMocks();
    setCaller(null);

    recordDeletionMocks.checkDeletionPermissions.mockResolvedValue({ canDelete: false });
    recordDeletionMocks.deleteRecord.mockResolvedValue(undefined);
    recordDeletionMocks.removeUserFromRecord.mockResolvedValue(undefined);
    subjectServiceMocks.rejectSubjectStatus.mockResolvedValue({
      success: true,
      pendingCreatorDecision: false,
    });
    trusteeRelationshipMocks.getTrusteesForTrustor.mockResolvedValue([]);
    trusteeRelationshipMocks.getTrustorAccountsForTrustee.mockResolvedValue([]);
    trusteeRelationshipMocks.revokeTrustee.mockResolvedValue(undefined);
    trusteeRelationshipMocks.resignAsTrustee.mockResolvedValue(undefined);
    httpsCallableMock.mockResolvedValue({ data: { success: true } });

    await setDoc(doc(db, 'users', UID), { displayName: 'Deletion Test User' });
  });

  afterAll(() => {
    getApps().forEach(app => deleteApp(app));
  });

  it('throws when not authenticated', async () => {
    await expect(AccountDeletionService.deleteMyAccount()).rejects.toThrow(
      'User not authenticated'
    );
  });

  it('deletes a solo-owned record outright', async () => {
    await seedRecord(db, 'solo-record', { owners: [UID] });
    recordDeletionMocks.checkDeletionPermissions.mockResolvedValue({ canDelete: true });
    setCaller(UID);

    await AccountDeletionService.deleteMyAccount();

    expect(recordDeletionMocks.deleteRecord).toHaveBeenCalledTimes(1);
    expect(recordDeletionMocks.deleteRecord.mock.calls[0]![0].id).toBe('solo-record');
    expect(recordDeletionMocks.removeUserFromRecord).not.toHaveBeenCalled();
  });

  it('strips the role from a shared record instead of deleting it', async () => {
    await seedRecord(db, 'shared-record', { owners: [UID, OTHER] });
    recordDeletionMocks.checkDeletionPermissions.mockResolvedValue({ canDelete: false });
    setCaller(UID);

    await AccountDeletionService.deleteMyAccount();

    expect(recordDeletionMocks.removeUserFromRecord).toHaveBeenCalledTimes(1);
    expect(recordDeletionMocks.removeUserFromRecord.mock.calls[0]![0].id).toBe('shared-record');
    expect(recordDeletionMocks.deleteRecord).not.toHaveBeenCalled();
  });

  it('unanchors the user as subject before evaluating the record for deletion', async () => {
    await seedRecord(db, 'subject-owned-record', { owners: [UID], subjects: [UID] });
    recordDeletionMocks.checkDeletionPermissions.mockResolvedValue({ canDelete: true });
    setCaller(UID);

    await AccountDeletionService.deleteMyAccount();

    expect(subjectServiceMocks.rejectSubjectStatus).toHaveBeenCalledWith(
      'subject-owned-record',
      'other'
    );
    expect(recordDeletionMocks.deleteRecord).toHaveBeenCalledTimes(1);
  });

  it('unanchors a subject-only record but does not call deleteRecord/removeUserFromRecord', async () => {
    await seedRecord(db, 'subject-only-record', { subjects: [UID] });
    setCaller(UID);

    await AccountDeletionService.deleteMyAccount();

    expect(subjectServiceMocks.rejectSubjectStatus).toHaveBeenCalledWith(
      'subject-only-record',
      'other'
    );
    expect(recordDeletionMocks.deleteRecord).not.toHaveBeenCalled();
    expect(recordDeletionMocks.removeUserFromRecord).not.toHaveBeenCalled();
  });

  it('captures a per-record failure without aborting the rest of the run', async () => {
    await seedRecord(db, 'failing-record', { owners: [UID] });
    await seedRecord(db, 'ok-record', { owners: [UID, OTHER] });
    recordDeletionMocks.checkDeletionPermissions.mockImplementation(async (record: any) =>
      record.id === 'failing-record' ? { canDelete: true } : { canDelete: false }
    );
    recordDeletionMocks.deleteRecord.mockRejectedValue(new Error('other subjects must unanchor'));
    setCaller(UID);

    const result = await AccountDeletionService.deleteMyAccount();

    expect(result.recordFailures).toEqual([
      { recordId: 'failing-record', error: 'other subjects must unanchor' },
    ]);
    // The other record's cleanup still ran despite the failure above.
    expect(recordDeletionMocks.removeUserFromRecord).toHaveBeenCalledTimes(1);
    expect(recordDeletionMocks.removeUserFromRecord.mock.calls[0]![0].id).toBe('ok-record');
  });

  it('revokes trustee relationships in both directions', async () => {
    trusteeRelationshipMocks.getTrusteesForTrustor.mockResolvedValue([
      { trustorId: UID, trusteeId: 'guardian-1' },
    ]);
    trusteeRelationshipMocks.getTrustorAccountsForTrustee.mockResolvedValue([
      { trustorId: 'some-trustor', trusteeId: UID },
    ]);
    setCaller(UID);

    await AccountDeletionService.deleteMyAccount();

    expect(trusteeRelationshipMocks.revokeTrustee).toHaveBeenCalledWith('guardian-1');
    expect(trusteeRelationshipMocks.resignAsTrustee).toHaveBeenCalledWith('some-trustor');
  });

  it('cancels only the caller\'s own pending subject requests, not another user\'s', async () => {
    await setDoc(doc(db, 'subjectConsentRequests', 'rec1_someSubject'), {
      recordId: 'rec1',
      subjectId: 'someSubject',
      requestedBy: UID,
      status: 'pending',
    });
    await setDoc(doc(db, 'subjectRemovalRequests', 'rec2_someSubject'), {
      recordId: 'rec2',
      subjectId: 'someSubject',
      requestedBy: UID,
      status: 'pending',
    });
    await setDoc(doc(db, 'subjectConsentRequests', 'rec3_someSubject'), {
      recordId: 'rec3',
      subjectId: 'someSubject',
      requestedBy: OTHER,
      status: 'pending',
    });
    setCaller(UID);

    await AccountDeletionService.deleteMyAccount();

    expect((await getDoc(doc(db, 'subjectConsentRequests', 'rec1_someSubject'))).exists()).toBe(
      false
    );
    expect((await getDoc(doc(db, 'subjectRemovalRequests', 'rec2_someSubject'))).exists()).toBe(
      false
    );
    expect((await getDoc(doc(db, 'subjectConsentRequests', 'rec3_someSubject'))).exists()).toBe(
      true
    );
  });

  it('deletes the Firestore user doc, calls deleteOwnAccount, and signs out', async () => {
    setCaller(UID);

    await AccountDeletionService.deleteMyAccount();

    expect((await getDoc(doc(db, 'users', UID))).exists()).toBe(false);
    expect(httpsCallableMock).toHaveBeenCalledWith({});
    expect(clearSessionMock).toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalled();
  });
});
