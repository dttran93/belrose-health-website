// @vitest-environment jsdom
//
// src/features/Trustee/hooks/__tests__/useRecordTrustees.test.ts
//
// Tier 3 — useRecordTrustees. Firestore is mocked at the module boundary (getFirestore/
// collection/query/where/getDocs) along with getUserProfiles; this test is about the hook's own
// chunking/filtering/map-building logic, not real Firestore behavior (already covered by the
// pure `chunk` helper in useRecordTrusteesHelpers.test.ts).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { BelroseUserProfile } from '@/types/core';

const { getDocsMock, whereMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  whereMock: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(() => ({})),
  query: vi.fn((..._args: unknown[]) => ({})),
  where: whereMock,
  getDocs: getDocsMock,
}));

vi.mock('@/features/Users/services/userProfileService', () => ({
  getUserProfiles: vi.fn(),
}));

import { useRecordTrustees } from '../useRecordTrustees';
import { getUserProfiles } from '@/features/Users/services/userProfileService';

function makeSnapshot(docs: Record<string, unknown>[]) {
  return { docs: docs.map(data => ({ data: () => data })) };
}

function makeProfile(uid: string): BelroseUserProfile {
  return { uid, displayName: uid } as BelroseUserProfile;
}

beforeEach(() => {
  vi.resetAllMocks();
  whereMock.mockImplementation((field: string, op: string, value: unknown) => ({ field, op, value }));
  getDocsMock.mockResolvedValue(makeSnapshot([]));
  vi.mocked(getUserProfiles).mockResolvedValue(new Map());
});

describe('useRecordTrustees — empty inputs', () => {
  it('skips fetching and resets to empty maps when recordUserIds is empty', async () => {
    const { result } = renderHook(() => useRecordTrustees([], ['trustee1']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.trusteeMap.size).toBe(0);
    expect(result.current.trustorMap.size).toBe(0);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it('skips fetching when recordTrustees is empty (the default)', async () => {
    const { result } = renderHook(() => useRecordTrustees(['trustor1']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getDocsMock).not.toHaveBeenCalled();
  });
});

describe('useRecordTrustees — fetch and map building', () => {
  it('builds both trusteeMap and trustorMap from a matching relationship', async () => {
    getDocsMock.mockResolvedValue(
      makeSnapshot([{ trustorId: 'trustor1', trusteeId: 'trustee1', trustLevel: 'custodian' }])
    );
    vi.mocked(getUserProfiles).mockResolvedValue(
      new Map([
        ['trustor1', makeProfile('trustor1')],
        ['trustee1', makeProfile('trustee1')],
      ])
    );

    const { result } = renderHook(() => useRecordTrustees(['trustor1'], ['trustee1']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const trusteeEntry = result.current.trusteeMap.get('trustee1');
    expect(trusteeEntry).toEqual({
      trusteeId: 'trustee1',
      trustorId: 'trustor1',
      trustLevel: 'custodian',
      trusteeProfile: makeProfile('trustee1'),
      trustorProfile: makeProfile('trustor1'),
    });

    expect(result.current.trustorMap.get('trustor1')).toEqual([trusteeEntry]);
  });

  it('filters out relationships whose trustor is not among recordUserIds', async () => {
    getDocsMock.mockResolvedValue(
      makeSnapshot([
        { trustorId: 'trustor1', trusteeId: 'trustee1', trustLevel: 'observer' },
        { trustorId: 'unrelated-trustor', trusteeId: 'trustee1', trustLevel: 'observer' },
      ])
    );

    const { result } = renderHook(() => useRecordTrustees(['trustor1'], ['trustee1']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.trustorMap.has('unrelated-trustor')).toBe(false);
    expect(result.current.trustorMap.get('trustor1')).toHaveLength(1);
  });

  it('groups multiple trustees under the same trustor', async () => {
    getDocsMock.mockResolvedValue(
      makeSnapshot([
        { trustorId: 'trustor1', trusteeId: 'trustee1', trustLevel: 'observer' },
        { trustorId: 'trustor1', trusteeId: 'trustee2', trustLevel: 'controller' },
      ])
    );

    const { result } = renderHook(() => useRecordTrustees(['trustor1'], ['trustee1', 'trustee2']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.trustorMap.get('trustor1')).toHaveLength(2);
    expect(result.current.trusteeMap.get('trustee1')?.trustLevel).toBe('observer');
    expect(result.current.trusteeMap.get('trustee2')?.trustLevel).toBe('controller');
  });

  it('resolves profiles to null when no profile was returned for that id', async () => {
    getDocsMock.mockResolvedValue(
      makeSnapshot([{ trustorId: 'trustor1', trusteeId: 'trustee1', trustLevel: 'observer' }])
    );
    vi.mocked(getUserProfiles).mockResolvedValue(new Map());

    const { result } = renderHook(() => useRecordTrustees(['trustor1'], ['trustee1']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const entry = result.current.trusteeMap.get('trustee1')!;
    expect(entry.trusteeProfile).toBeNull();
    expect(entry.trustorProfile).toBeNull();
  });

  it('does not call getUserProfiles when no relationships matched', async () => {
    getDocsMock.mockResolvedValue(makeSnapshot([]));

    const { result } = renderHook(() => useRecordTrustees(['trustor1'], ['trustee1']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getUserProfiles).not.toHaveBeenCalled();
  });

  it('queries status "active" only', async () => {
    renderHook(() => useRecordTrustees(['trustor1'], ['trustee1']));
    await waitFor(() => expect(getDocsMock).toHaveBeenCalled());

    expect(whereMock).toHaveBeenCalledWith('status', '==', 'active');
  });
});

describe('useRecordTrustees — chunking for large trustee lists', () => {
  it('splits recordTrustees into chunks of 30 and issues one query per chunk', async () => {
    const manyTrustees = Array.from({ length: 35 }, (_, i) => `trustee-${i}`);
    getDocsMock
      .mockResolvedValueOnce(makeSnapshot([{ trustorId: 'trustor1', trusteeId: 'trustee-0', trustLevel: 'observer' }]))
      .mockResolvedValueOnce(makeSnapshot([{ trustorId: 'trustor1', trusteeId: 'trustee-30', trustLevel: 'observer' }]));

    const { result } = renderHook(() => useRecordTrustees(['trustor1'], manyTrustees));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getDocsMock).toHaveBeenCalledTimes(2);
    const inCalls = whereMock.mock.calls.filter(([field]) => field === 'trusteeId');
    expect(inCalls[0]![2]).toHaveLength(30);
    expect(inCalls[1]![2]).toHaveLength(5);

    expect(result.current.trusteeMap.has('trustee-0')).toBe(true);
    expect(result.current.trusteeMap.has('trustee-30')).toBe(true);
  });
});

describe('useRecordTrustees — error handling', () => {
  it('stops loading and leaves empty maps when the fetch throws', async () => {
    getDocsMock.mockRejectedValue(new Error('firestore down'));

    const { result } = renderHook(() => useRecordTrustees(['trustor1'], ['trustee1']));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.trusteeMap.size).toBe(0);
    expect(result.current.trustorMap.size).toBe(0);
  });
});

describe('useRecordTrustees — refetch', () => {
  it('re-runs the fetch and reflects updated data', async () => {
    getDocsMock.mockResolvedValue(
      makeSnapshot([{ trustorId: 'trustor1', trusteeId: 'trustee1', trustLevel: 'observer' }])
    );

    const { result } = renderHook(() => useRecordTrustees(['trustor1'], ['trustee1']));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trusteeMap.get('trustee1')?.trustLevel).toBe('observer');

    getDocsMock.mockResolvedValue(
      makeSnapshot([{ trustorId: 'trustor1', trusteeId: 'trustee1', trustLevel: 'controller' }])
    );

    await result.current.refetch();
    await waitFor(() =>
      expect(result.current.trusteeMap.get('trustee1')?.trustLevel).toBe('controller')
    );
  });
});
