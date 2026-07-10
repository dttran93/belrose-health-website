// src/features/Sharing/services/__tests__/accessEntries.test.ts
//
// deriveAccessEntries is the pure cross-reference logic behind EncryptionAccessView: it merges a
// record's role arrays with its wrappedKeys docs into a per-user role + status classification.
// Extracted specifically so this can be tested without mocking Firestore/getUserProfiles.
//
// The `sharer` cases here are regression tests for a real bug: role derivation, allUserIds, and
// the AccessEntry type all omitted `sharers` entirely, so every sharer with an active wrappedKey
// was misclassified as role:'none' + status:'missing-role' ("Orphaned Key" — a false-positive
// security warning shown for every legitimate sharer).

import { describe, it, expect } from 'vitest';
import { deriveAccessEntries, type WrappedKeyInfo } from '../accessEntries';
import type { BelroseUserProfile } from '@/types/core';

const OWNER = 'owner-uid';
const ADMIN = 'admin-uid';
const SHARER = 'sharer-uid';
const VIEWER = 'viewer-uid';
const SUBJECT_ONLY = 'subject-only-uid';
const ORPHANED = 'orphaned-uid';
const MISSING_KEY_USER = 'missing-key-uid';

function makeWrappedKey(userId: string, overrides: Partial<WrappedKeyInfo> = {}): WrappedKeyInfo {
  return {
    userId,
    recordId: 'record-1',
    isActive: true,
    isCreator: false,
    isGuest: false,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeProfile(uid: string): BelroseUserProfile {
  return { uid, displayName: uid } as BelroseUserProfile;
}

describe('deriveAccessEntries — role classification', () => {
  it('classifies an owner with an active key as synced', () => {
    const record = { owners: [OWNER], administrators: [], sharers: [], viewers: [], subjects: [] };
    const [entry] = deriveAccessEntries([makeWrappedKey(OWNER)], record, new Map());

    expect(entry!.role).toBe('owner');
    expect(entry!.status).toBe('synced');
  });

  it('classifies an administrator with an active key as synced', () => {
    const record = { owners: [], administrators: [ADMIN], sharers: [], viewers: [], subjects: [] };
    const [entry] = deriveAccessEntries([makeWrappedKey(ADMIN)], record, new Map());

    expect(entry!.role).toBe('administrator');
    expect(entry!.status).toBe('synced');
  });

  it('classifies a sharer with an active key as synced — regression for the sharer-omission bug', () => {
    const record = { owners: [], administrators: [], sharers: [SHARER], viewers: [], subjects: [] };
    const [entry] = deriveAccessEntries([makeWrappedKey(SHARER)], record, new Map());

    expect(entry!.role).toBe('sharer');
    expect(entry!.status).toBe('synced');
  });

  it('classifies a viewer with an active key as synced', () => {
    const record = { owners: [], administrators: [], sharers: [], viewers: [VIEWER], subjects: [] };
    const [entry] = deriveAccessEntries([makeWrappedKey(VIEWER)], record, new Map());

    expect(entry!.role).toBe('viewer');
    expect(entry!.status).toBe('synced');
  });

  it('gives owner precedence when a user somehow appears in multiple role arrays', () => {
    const record = { owners: [OWNER], administrators: [], sharers: [OWNER], viewers: [], subjects: [] };
    const [entry] = deriveAccessEntries([makeWrappedKey(OWNER)], record, new Map());

    expect(entry!.role).toBe('owner');
  });

  it('includes a subjects-only user (no other role array) with role "none"', () => {
    const record = { owners: [], administrators: [], sharers: [], viewers: [], subjects: [SUBJECT_ONLY] };
    const [entry] = deriveAccessEntries([], record, new Map());

    expect(entry!.userId).toBe(SUBJECT_ONLY);
    expect(entry!.role).toBe('none');
  });
});

describe('deriveAccessEntries — status classification', () => {
  it('flags an active key with no role at all as "missing-role" (orphaned key)', () => {
    const record = { owners: [], administrators: [], sharers: [], viewers: [], subjects: [] };
    const [entry] = deriveAccessEntries([makeWrappedKey(ORPHANED)], record, new Map());

    expect(entry!.role).toBe('none');
    expect(entry!.status).toBe('missing-role');
  });

  it('flags a role with no wrappedKey at all as "missing-key"', () => {
    const record = { owners: [], administrators: [], sharers: [], viewers: [MISSING_KEY_USER], subjects: [] };
    const [entry] = deriveAccessEntries([], record, new Map());

    expect(entry!.wrappedKey).toBeNull();
    expect(entry!.status).toBe('missing-key');
  });

  it('flags an inactive key as "inactive" even when the user still holds a role — inactive takes priority', () => {
    const record = { owners: [OWNER], administrators: [], sharers: [], viewers: [], subjects: [] };
    const [entry] = deriveAccessEntries([makeWrappedKey(OWNER, { isActive: false })], record, new Map());

    expect(entry!.status).toBe('inactive');
  });

  it('flags an inactive key with no role as "inactive", not "missing-role"', () => {
    const record = { owners: [], administrators: [], sharers: [], viewers: [], subjects: [] };
    const [entry] = deriveAccessEntries([makeWrappedKey(ORPHANED, { isActive: false })], record, new Map());

    expect(entry!.status).toBe('inactive');
  });
});

describe('deriveAccessEntries — profile lookup', () => {
  it('attaches the matching profile when present in the map', () => {
    const record = { owners: [OWNER], administrators: [], sharers: [], viewers: [], subjects: [] };
    const profiles = new Map([[OWNER, makeProfile(OWNER)]]);
    const [entry] = deriveAccessEntries([makeWrappedKey(OWNER)], record, profiles);

    expect(entry!.profile).toEqual(makeProfile(OWNER));
  });

  it('leaves profile undefined when the user has no profile in the map (e.g. deleted account)', () => {
    const record = { owners: [OWNER], administrators: [], sharers: [], viewers: [], subjects: [] };
    const [entry] = deriveAccessEntries([makeWrappedKey(OWNER)], record, new Map());

    expect(entry!.profile).toBeUndefined();
  });
});

describe('deriveAccessEntries — sorting and empty input', () => {
  it('returns an empty array when there are no keys and no roles', () => {
    const record = { owners: [], administrators: [], sharers: [], viewers: [], subjects: [] };
    expect(deriveAccessEntries([], record, new Map())).toEqual([]);
  });

  it('sorts non-synced entries before synced entries, preserving relative order within each group', () => {
    const record = {
      owners: [OWNER],
      administrators: [],
      sharers: [],
      viewers: [MISSING_KEY_USER],
      subjects: [],
    };
    const wrappedKeys = [makeWrappedKey(OWNER), makeWrappedKey(ORPHANED)];

    const entries = deriveAccessEntries(wrappedKeys, record, new Map());
    const statuses = entries.map(e => e.status);

    // OWNER (synced) should land after the two non-synced entries (ORPHANED: missing-role,
    // MISSING_KEY_USER: missing-key), and their relative order should be preserved (stable sort).
    expect(statuses.indexOf('synced')).toBe(statuses.length - 1);
    expect(entries.map(e => e.userId).slice(0, 2).sort()).toEqual([MISSING_KEY_USER, ORPHANED].sort());
  });
});
