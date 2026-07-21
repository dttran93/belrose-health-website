// src/features/GuestAccess/services/__tests__/guestShareableRecords.test.ts
//
// Tier 3 (Firestore mocked) unit tests for getShareableRecords — 3 separate array-contains
// queries (Firestore has no native OR), deduplicated by Map. Queries owners/administrators/
// sharers — the actual RecordRole hierarchy (see permissions.ts: viewer < sharer < administrator
// < owner) — a sharer can already grant a registered user viewer access via the records rules'
// sharer-grants-viewer branch, so they must be able to do the guest-invite equivalent too.
// Deliberately excludes:
//   - uploadedBy: not a permission tier on its own. Upload-time defaults already add the
//     uploader to `administrators`; querying uploadedBy separately meant someone removed from
//     administrators could still guest-share via their stale uploader status.
//   - subjects: not a RecordRole either (record-is-about-them, not a granted role). Letting bare
//     subject status guest-share would bypass the dedicated SubjectConsentRequests/
//     SubjectRemovalRequests flow that already governs subject-driven actions on a record.
// The dedup logic is the other thing worth testing here — a record matching more than one query
// (e.g. both owner and sharer) must only appear once in the result.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getDocsMock } = vi.hoisted(() => ({ getDocsMock: vi.fn() }));

vi.mock('@/firebase/config', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'records-collection'),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  getDocs: getDocsMock,
}));

import { where } from 'firebase/firestore';
import { getShareableRecords } from '../guestShareableRecords';

function fakeSnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
      docs.forEach(d => cb({ id: d.id, data: () => d.data }));
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getShareableRecords', () => {
  it('combines results from the owners/administrators/sharers queries', async () => {
    getDocsMock
      .mockResolvedValueOnce(fakeSnapshot([{ id: 'rec-owner', data: { title: 'Owner rec' } }])) // owners
      .mockResolvedValueOnce(fakeSnapshot([{ id: 'rec-admin', data: { title: 'Admin rec' } }])) // administrators
      .mockResolvedValueOnce(fakeSnapshot([{ id: 'rec-sharer', data: { title: 'Sharer rec' } }])); // sharers

    const result = await getShareableRecords('user-1');

    expect(result.map(r => r.id).sort()).toEqual(['rec-admin', 'rec-owner', 'rec-sharer']);
  });

  it('does NOT include a record where the caller is only a subject, not a granted role', async () => {
    getDocsMock
      .mockResolvedValueOnce(fakeSnapshot([])) // owners
      .mockResolvedValueOnce(fakeSnapshot([])) // administrators
      .mockResolvedValueOnce(fakeSnapshot([])); // sharers
    // No query is issued against `subjects` at all — bare subject status must not grant.
    // Shouldn't be possible to give a subject a record without a role higher than sharer. But principal is that
    // Owner/Admin/Sharers are the only roles that can share. UploadedBy/Subject are informational. Although also very important.

    expect(await getShareableRecords('user-1')).toEqual([]);
    expect(where).toHaveBeenCalledTimes(3);
    expect(where).not.toHaveBeenCalledWith('subjects', 'array-contains', 'user-1');
  });

  it('does NOT include a record where the caller is only the uploader, not a granted role', async () => {
    getDocsMock
      .mockResolvedValueOnce(fakeSnapshot([])) // owners
      .mockResolvedValueOnce(fakeSnapshot([])) // administrators
      .mockResolvedValueOnce(fakeSnapshot([])); // sharers
    // No query is issued against `uploadedBy` — upload-time defaults already add the uploader
    // to `administrators`, so a stale uploadedBy field must not be an independent permission path.

    expect(await getShareableRecords('user-1')).toEqual([]);
    expect(where).not.toHaveBeenCalledWith('uploadedBy', '==', 'user-1');
  });

  it('deduplicates a record that matches more than one query', async () => {
    const shared = { id: 'rec-shared', data: { title: 'Owned and shared' } };
    getDocsMock
      .mockResolvedValueOnce(fakeSnapshot([shared])) // owners
      .mockResolvedValueOnce(fakeSnapshot([])) // administrators
      .mockResolvedValueOnce(fakeSnapshot([shared])); // sharers — same id again

    const result = await getShareableRecords('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('rec-shared');
  });

  it('merges the doc id with its data', async () => {
    getDocsMock
      .mockResolvedValueOnce(fakeSnapshot([{ id: 'rec-1', data: { title: 'Hello' } }]))
      .mockResolvedValueOnce(fakeSnapshot([]))
      .mockResolvedValueOnce(fakeSnapshot([]));

    const result = await getShareableRecords('user-1');

    expect(result).toEqual([{ id: 'rec-1', title: 'Hello' }]);
  });

  it('returns an empty array when no query matches anything', async () => {
    getDocsMock
      .mockResolvedValueOnce(fakeSnapshot([]))
      .mockResolvedValueOnce(fakeSnapshot([]))
      .mockResolvedValueOnce(fakeSnapshot([]));

    expect(await getShareableRecords('user-1')).toEqual([]);
  });

  it('rethrows when a query fails', async () => {
    getDocsMock.mockRejectedValue(new Error('firestore down'));

    await expect(getShareableRecords('user-1')).rejects.toThrow('firestore down');
  });
});
