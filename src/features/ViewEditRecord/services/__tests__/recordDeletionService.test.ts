// src/features/ViewEditRecord/services/__tests__/recordDeletionService.test.ts
//
// Tier 3 — mocks PermissionsService/SubjectQueryService/firebase/uploadUtils/firebase/firestore
// and drives the real 5-guard-clause permission logic in checkDeletionPermissions (owner-must-
// delete-if-owners-exist / sole-admin-if-no-owners / no-other-owners / no-other-admins /
// no-other-subjects), plus deleteRecord's final-recheck-before-deleting and step ordering.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  getRecordRolesMock,
  getUserRoleMock,
  removeRoleMock,
  getRecordSubjectsMock,
  getFileMetadataMock,
  deleteFromStorageMock,
  deleteFromFirestoreMock,
  deleteRecordVersionsMock,
  deleteWrappedKeysMock,
  deleteSubjectRequestsMock,
  setDocMock,
  updateDocMock,
} = vi.hoisted(() => ({
  getRecordRolesMock: vi.fn(),
  getUserRoleMock: vi.fn(),
  removeRoleMock: vi.fn(),
  getRecordSubjectsMock: vi.fn(),
  getFileMetadataMock: vi.fn(),
  deleteFromStorageMock: vi.fn(),
  deleteFromFirestoreMock: vi.fn(),
  deleteRecordVersionsMock: vi.fn(),
  deleteWrappedKeysMock: vi.fn(),
  deleteSubjectRequestsMock: vi.fn(),
  setDocMock: vi.fn(),
  updateDocMock: vi.fn(),
}));

vi.mock('@/features/Permissions/services/permissionsService', () => ({
  PermissionsService: {
    getRecordRoles: getRecordRolesMock,
    getUserRole: getUserRoleMock,
    removeRole: removeRoleMock,
  },
}));

vi.mock('@/features/Subject/services/subjectQueryService', () => ({
  default: { getRecordSubjects: getRecordSubjectsMock },
}));

vi.mock('@/firebase/uploadUtils', () => ({
  getFileMetadata: getFileMetadataMock,
  deleteFromStorage: deleteFromStorageMock,
  deleteFromFirestore: deleteFromFirestoreMock,
  deleteRecordVersions: deleteRecordVersionsMock,
  deleteWrappedKeys: deleteWrappedKeysMock,
  deleteSubjectRequests: deleteSubjectRequestsMock,
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  setDoc: setDocMock,
  updateDoc: updateDocMock,
  Timestamp: { now: vi.fn(() => 'now') },
}));

import RecordDeletionService from '../recordDeletionService';
import type { FileObject } from '@/types/core';

const USER = 'user-1';

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return { id: 'record-1', administrators: [USER], ...overrides } as FileObject;
}

function roles(overrides: { owners?: string[]; administrators?: string[]; viewers?: string[] } = {}) {
  return {
    owners: overrides.owners ?? [],
    administrators: overrides.administrators ?? [USER],
    viewers: overrides.viewers ?? [],
    sharers: [] as string[],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getRecordSubjectsMock.mockResolvedValue([]);
  getUserRoleMock.mockImplementation((r: any, uid: string) => {
    if (r.owners?.includes(uid)) return 'owner';
    if (r.administrators?.includes(uid)) return 'administrator';
    if (r.viewers?.includes(uid)) return 'viewer';
    return null;
  });
});

describe('checkDeletionPermissions — guard clause ordering', () => {
  it('denies when permissions cannot be loaded at all', async () => {
    getRecordRolesMock.mockResolvedValue(null);

    const result = await RecordDeletionService.checkDeletionPermissions(makeRecord(), USER);

    expect(result.canDelete).toBe(false);
    expect(result.reason).toBe('Could not load record permissions');
  });

  it('denies a non-owner when owners exist on the record', async () => {
    getRecordRolesMock.mockResolvedValue(roles({ owners: ['other-owner'] }));

    const result = await RecordDeletionService.checkDeletionPermissions(makeRecord(), USER);

    expect(result.canDelete).toBe(false);
    expect(result.reason).toBe('Only owners can delete a record');
  });

  it('denies a non-administrator when there are no owners', async () => {
    getRecordRolesMock.mockResolvedValue(roles({ administrators: [], viewers: [USER] }));

    const result = await RecordDeletionService.checkDeletionPermissions(makeRecord(), USER);

    expect(result.canDelete).toBe(false);
    expect(result.reason).toBe('You must be an administrator to delete this record');
  });

  it('denies an owner when other owners still remain', async () => {
    getRecordRolesMock.mockResolvedValue(roles({ owners: [USER, 'other-owner'] }));

    const result = await RecordDeletionService.checkDeletionPermissions(makeRecord(), USER);

    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('other owners');
    expect(result.otherOwners).toEqual(['other-owner']);
  });

  it('denies the sole admin when other administrators still remain (no owners)', async () => {
    getRecordRolesMock.mockResolvedValue(roles({ administrators: [USER, 'other-admin'] }));

    const result = await RecordDeletionService.checkDeletionPermissions(makeRecord(), USER);

    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('other administrators');
    expect(result.otherAdmins).toEqual(['other-admin']);
  });

  it('denies deletion when other subjects have not unanchored themselves', async () => {
    getRecordRolesMock.mockResolvedValue(roles());
    getRecordSubjectsMock.mockResolvedValue(['other-subject']);

    const result = await RecordDeletionService.checkDeletionPermissions(makeRecord(), USER);

    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('must unanchor');
    expect(result.otherSubjects).toEqual(['other-subject']);
  });

  it('pluralizes the subject-unanchor message for multiple other subjects', async () => {
    getRecordRolesMock.mockResolvedValue(roles());
    getRecordSubjectsMock.mockResolvedValue(['subject-a', 'subject-b']);

    const result = await RecordDeletionService.checkDeletionPermissions(makeRecord(), USER);

    expect(result.reason).toBe(
      'This record has 2 subjects who must all unanchor themselves before it can be deleted'
    );
  });

  it('allows deletion when the calling user is the only remaining subject', async () => {
    getRecordRolesMock.mockResolvedValue(roles());
    getRecordSubjectsMock.mockResolvedValue([USER]);

    const result = await RecordDeletionService.checkDeletionPermissions(makeRecord(), USER);

    expect(result.canDelete).toBe(true);
    expect(result.hasSubjects).toBe(true);
    expect(result.subjectCount).toBe(1);
  });

  it('allows a sole owner to delete and warns about affected viewers', async () => {
    getRecordRolesMock.mockResolvedValue(
      roles({ owners: [USER], administrators: [], viewers: ['viewer-1', 'viewer-2'] })
    );

    const result = await RecordDeletionService.checkDeletionPermissions(makeRecord(), USER);

    expect(result.canDelete).toBe(true);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.confirmationMessage).toContain('2 other users');
    expect(result.confirmationMessage).toContain('This action cannot be undone');
  });

  it('allows a sole owner to delete even while other admins remain — they are warned, not blocked', async () => {
    // Owners have ultimate authority: unlike the no-owner/admin-deleting path, remaining
    // admins don't block a sole owner from deleting — they're just included in the warning.
    getRecordRolesMock.mockResolvedValue(
      roles({ owners: [USER], administrators: ['admin-1'], viewers: ['viewer-1'] })
    );

    const result = await RecordDeletionService.checkDeletionPermissions(makeRecord(), USER);

    expect(result.canDelete).toBe(true);
    expect(result.otherAdmins).toEqual(['admin-1']);
    expect(result.confirmationMessage).toContain('2 other users');
    expect(result.confirmationMessage).toContain('1 admin');
    expect(result.confirmationMessage).toContain('1 viewer');
  });

  it('allows the sole administrator to delete when there are no owners and no other users', async () => {
    getRecordRolesMock.mockResolvedValue(roles({ administrators: [USER] }));

    const result = await RecordDeletionService.checkDeletionPermissions(makeRecord(), USER);

    expect(result.canDelete).toBe(true);
    expect(result.affectsOtherUsers).toBe(false);
  });
});

describe('deleteRecord', () => {
  it('throws immediately if a final recheck finds deletion is no longer permitted', async () => {
    getRecordRolesMock.mockResolvedValue(roles({ owners: ['other-owner'] }));

    await expect(RecordDeletionService.deleteRecord(makeRecord(), USER)).rejects.toThrow(
      'Only owners can delete a record'
    );
    expect(getFileMetadataMock).not.toHaveBeenCalled();
  });

  it('deletes storage, subject requests, versions, wrapped keys, and the Firestore record in order', async () => {
    getRecordRolesMock.mockResolvedValue(roles({ administrators: [USER] }));
    getFileMetadataMock.mockResolvedValue({ storagePath: 'path/to/file' });

    const calls: string[] = [];
    deleteFromStorageMock.mockImplementation(async () => calls.push('storage'));
    deleteSubjectRequestsMock.mockImplementation(async () => calls.push('subjectRequests'));
    deleteRecordVersionsMock.mockImplementation(async () => calls.push('versions'));
    deleteWrappedKeysMock.mockImplementation(async () => calls.push('wrappedKeys'));
    deleteFromFirestoreMock.mockImplementation(async () => calls.push('firestore'));

    await RecordDeletionService.deleteRecord(makeRecord(), USER);

    expect(calls).toEqual(['storage', 'subjectRequests', 'versions', 'wrappedKeys', 'firestore']);
    expect(setDocMock).toHaveBeenCalled(); // creates the deletion event
    expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), { deletionComplete: true });
  });

  it('skips storage deletion when the file has no storagePath (virtual records)', async () => {
    getRecordRolesMock.mockResolvedValue(roles({ administrators: [USER] }));
    getFileMetadataMock.mockResolvedValue({ storagePath: null });

    await RecordDeletionService.deleteRecord(makeRecord(), USER);

    expect(deleteFromStorageMock).not.toHaveBeenCalled();
    expect(deleteFromFirestoreMock).toHaveBeenCalled();
  });

  it('still deletes the record even if creating the deletion-event notification fails', async () => {
    getRecordRolesMock.mockResolvedValue(roles({ administrators: [USER] }));
    getFileMetadataMock.mockResolvedValue({ storagePath: null });
    setDocMock.mockRejectedValueOnce(new Error('notification write failed'));

    await expect(RecordDeletionService.deleteRecord(makeRecord(), USER)).resolves.toBeUndefined();
    expect(deleteFromFirestoreMock).toHaveBeenCalled();
  });
});

describe('removeUserFromRecord', () => {
  it('removes the role the user actually has', async () => {
    const record = makeRecord({ viewers: ['user-1'] } as any);
    getUserRoleMock.mockReturnValue('viewer');

    await RecordDeletionService.removeUserFromRecord(record, USER);

    expect(removeRoleMock).toHaveBeenCalledWith('record-1', USER, 'viewer');
  });

  it('throws when the user has no role on the record', async () => {
    getUserRoleMock.mockReturnValue(null);

    await expect(RecordDeletionService.removeUserFromRecord(makeRecord(), USER)).rejects.toThrow(
      'User does not have a role on this record'
    );
    expect(removeRoleMock).not.toHaveBeenCalled();
  });
});
