// src/features/Trustee/services/__tests__/trusteePermissionService.test.ts
//
// Tier 1 — the one pure helper trusteePermissionService.ts exports: getRoleFromRecordData.
// TrusteePermissionService's public methods all talk to Firestore directly and are covered by
// the Tier 2 orchestration suite (test/orchestration/trusteePermissionService.test.ts).

import { describe, it, expect } from 'vitest';
import { getRoleFromRecordData } from '../trusteePermissionService';

describe('getRoleFromRecordData', () => {
  it('returns "owner" when the user is in the owners array', () => {
    expect(getRoleFromRecordData({ owners: ['u1'] }, 'u1')).toBe('owner');
  });

  it('returns "administrator" when the user is in the administrators array', () => {
    expect(getRoleFromRecordData({ administrators: ['u1'] }, 'u1')).toBe('administrator');
  });

  it('returns "sharer" when the user is in the sharers array', () => {
    expect(getRoleFromRecordData({ sharers: ['u1'] }, 'u1')).toBe('sharer');
  });

  it('returns "viewer" when the user is in the viewers array', () => {
    expect(getRoleFromRecordData({ viewers: ['u1'] }, 'u1')).toBe('viewer');
  });

  it('returns null when the user is in none of the role arrays', () => {
    expect(getRoleFromRecordData({ owners: ['other'] }, 'u1')).toBeNull();
  });

  it('returns null when no role arrays are present at all', () => {
    expect(getRoleFromRecordData({}, 'u1')).toBeNull();
  });

  it('gives owner precedence over lower roles when the user appears in multiple arrays (although that should never happen)', () => {
    const data = { owners: ['u1'], administrators: ['u1'], sharers: ['u1'], viewers: ['u1'] };
    expect(getRoleFromRecordData(data, 'u1')).toBe('owner');
  });

  it('gives administrator precedence over sharer/viewer (although that should never happen)', () => {
    const data = { administrators: ['u1'], sharers: ['u1'], viewers: ['u1'] };
    expect(getRoleFromRecordData(data, 'u1')).toBe('administrator');
  });

  it('gives sharer precedence over viewer (although that should never happen)', () => {
    const data = { sharers: ['u1'], viewers: ['u1'] };
    expect(getRoleFromRecordData(data, 'u1')).toBe('sharer');
  });
});
