// src/features/Permissions/services/__tests__/permissionQueries.test.ts
//
// Unit tests for getRecordRoles — a read-only query returning a record's role arrays. It
// used to also compute canManage* flags via a now-removed canManageRole helper, but neither
// of its two real callers (usePermissionFlow, recordDeletionService) ever read those flags —
// dead code, removed. Real UI button-enabling is driven by getEligibleRoleTargets/
// canRevokeAccess instead (see permissionEligibility.test.ts).

import { describe, it, expect, vi } from 'vitest';

const { mockRecordState } = vi.hoisted(() => ({
  mockRecordState: { data: null as Record<string, unknown> | null },
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({
    exists: () => mockRecordState.data !== null,
    data: () => mockRecordState.data,
  })),
}));

import { PermissionsService } from '../permissionsService';

function setRecord(data: Record<string, unknown> | null) {
  mockRecordState.data = data;
}

describe('PermissionsService.getRecordRoles', () => {
  it('returns null when the record does not exist', async () => {
    setRecord(null);
    expect(await PermissionsService.getRecordRoles('rec1')).toBeNull();
  });

  it('returns the role arrays, defaulting missing ones to empty', async () => {
    setRecord({ owners: ['owner1'], sharers: ['sharer1'] });

    expect(await PermissionsService.getRecordRoles('rec1')).toEqual({
      owners: ['owner1'],
      administrators: [],
      sharers: ['sharer1'],
      viewers: [],
    });
  });
});
