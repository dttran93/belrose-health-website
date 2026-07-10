// src/features/Subject/hooks/__tests__/useSubjectFlowHelpers.test.ts
//
// Tier 1 — the three pure helpers useSubjectFlow.ts exports (getUserRoleForRecord,
// isRoleDowngrade, getMinimumAllowedRole). No React/hook rendering involved, no mocking —
// these are plain functions over a record shape, same as PermissionsService.getEligibleRoleTargets.

import { describe, it, expect } from 'vitest';
import {
  getUserRoleForRecord,
  isRoleDowngrade,
  getMinimumAllowedRole,
} from '../useSubjectFlow';
import type { FileObject } from '@/types/core';

const OWNER = 'owner-uid';
const ADMIN = 'admin-uid';
const UPLOADER = 'uploader-uid';
const SHARER = 'sharer-uid';
const STRANGER = 'stranger-uid';

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'record1',
    uploadedBy: UPLOADER,
    owners: [OWNER],
    administrators: [ADMIN],
    sharers: [SHARER],
    ...overrides,
  } as unknown as FileObject;
}

describe('getUserRoleForRecord', () => {
  it('returns "owner" for an owner', () => {
    expect(getUserRoleForRecord(OWNER, makeRecord())).toBe('owner');
  });

  it('returns "administrator" for an administrator', () => {
    expect(getUserRoleForRecord(ADMIN, makeRecord())).toBe('administrator');
  });

  it('returns "administrator" for the uploader while they are still in the administrators array', () => {
    const record = makeRecord({ administrators: [UPLOADER], uploadedBy: UPLOADER });
    expect(getUserRoleForRecord(UPLOADER, record)).toBe('administrator');
  });

  it('returns null for a removed uploader — uploadedBy is permanent audit metadata, not a live role', () => {
    // Regression test: this used to fall back to 'administrator' via uploadedBy, which fed a
    // stale role into confirmSetSubjectAsSelf/confirmRequestConsent's grant-needed check and
    // silently skipped granting a real role to a removed uploader.
    const record = makeRecord({ owners: [OWNER], administrators: [ADMIN], uploadedBy: UPLOADER });
    expect(getUserRoleForRecord(UPLOADER, record)).toBeNull();
  });

  it('returns "sharer" for a sharer', () => {
    expect(getUserRoleForRecord(SHARER, makeRecord())).toBe('sharer');
  });

  it('returns null for a viewer — viewers are not considered a role here', () => {
    const record = makeRecord({ viewers: ['viewer-uid'] } as any);
    expect(getUserRoleForRecord('viewer-uid', record)).toBeNull();
  });

  it('returns null for a stranger with no relationship to the record', () => {
    expect(getUserRoleForRecord(STRANGER, makeRecord())).toBeNull();
  });

  it('gives owner precedence when a user is both owner and administrator', () => {
    const record = makeRecord({ owners: [OWNER], administrators: [OWNER] });
    expect(getUserRoleForRecord(OWNER, record)).toBe('owner');
  });
});

describe('isRoleDowngrade', () => {
  it('is not a downgrade when moving from no role to any role', () => {
    expect(isRoleDowngrade(null, 'sharer')).toBe(false);
    expect(isRoleDowngrade(null, 'owner')).toBe(false);
  });

  it('is a downgrade when selecting a lower role than the current one', () => {
    expect(isRoleDowngrade('owner', 'sharer')).toBe(true);
    expect(isRoleDowngrade('administrator', 'sharer')).toBe(true);
  });

  it('is not a downgrade when selecting a higher role than the current one', () => {
    expect(isRoleDowngrade('sharer', 'owner')).toBe(false);
  });

  it('is not a downgrade when the selected role equals the current role', () => {
    expect(isRoleDowngrade('administrator', 'administrator')).toBe(false);
  });
});

describe('getMinimumAllowedRole', () => {
  it("returns the user's current role when they already have one", () => {
    expect(getMinimumAllowedRole(ADMIN, makeRecord())).toBe('administrator');
    expect(getMinimumAllowedRole(OWNER, makeRecord())).toBe('owner');
  });

  it('defaults to "sharer" when the user has no existing role', () => {
    expect(getMinimumAllowedRole(STRANGER, makeRecord())).toBe('sharer');
  });
});
