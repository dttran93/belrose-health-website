// @vitest-environment jsdom
//
// src/features/RequestRecord/hooks/__tests__/useInboundRequests.test.ts
//
// Tier 3 (firebase/firestore + useAuthContext mocked) — drives the real dual targetUserId/
// targetEmail query merge-and-dedup logic (the guest-later-registers edge case: a doc might
// match both queries, or only the legacy targetEmail one), the client-side newest-first sort,
// and the pending/fulfilled/all filter + counts derivation.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { getDocsMock, authState } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  authState: { user: { uid: 'user-1', email: 'user-1@example.com' } as { uid: string; email: string } | null },
}));

vi.mock('@/features/Auth/AuthContext', () => ({
  useAuthContext: () => ({ user: authState.user }),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(() => ({})),
  query: vi.fn((...args: any[]) => args),
  where: vi.fn((field: string, op: string, value: any) => ({ field, op, value })),
  getDocs: getDocsMock,
}));

import { useInboundRequests } from '../useInboundRequests';

function makeSnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return { docs: docs.map(d => ({ id: d.id, data: () => d.data })) };
}

function makeRequestData(overrides: Record<string, unknown> = {}) {
  return {
    requesterId: 'requester-1',
    requesterName: 'Dr. Smith',
    status: 'pending',
    createdAt: { toMillis: () => 1000 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = { uid: 'user-1', email: 'user-1@example.com' };
});

describe('useInboundRequests — merge + dedup', () => {
  it('dedupes a request that matches both the targetUserId and targetEmail query', async () => {
    getDocsMock
      .mockResolvedValueOnce(makeSnapshot([{ id: 'req-both', data: makeRequestData() }]))
      .mockResolvedValueOnce(makeSnapshot([{ id: 'req-both', data: makeRequestData() }]));

    const { result } = renderHook(() => useInboundRequests());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.requests.map(r => r.inviteCode)).toEqual(['req-both']);
  });

  it('includes a legacy request that only matches by targetEmail', async () => {
    getDocsMock
      .mockResolvedValueOnce(makeSnapshot([]))
      .mockResolvedValueOnce(makeSnapshot([{ id: 'req-legacy', data: makeRequestData() }]));

    const { result } = renderHook(() => useInboundRequests());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.requests.map(r => r.inviteCode)).toEqual(['req-legacy']);
  });

  it('sorts merged requests newest-first', async () => {
    getDocsMock
      .mockResolvedValueOnce(
        makeSnapshot([
          { id: 'req-old', data: makeRequestData({ createdAt: { toMillis: () => 1000 } }) },
          { id: 'req-new', data: makeRequestData({ createdAt: { toMillis: () => 3000 } }) },
        ])
      )
      .mockResolvedValueOnce(
        makeSnapshot([{ id: 'req-mid', data: makeRequestData({ createdAt: { toMillis: () => 2000 } }) }])
      );

    const { result } = renderHook(() => useInboundRequests());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.requests.map(r => r.inviteCode)).toEqual(['req-new', 'req-mid', 'req-old']);
  });
});

describe('useInboundRequests — filter + counts', () => {
  async function setupThreeRequests() {
    getDocsMock
      .mockResolvedValueOnce(
        makeSnapshot([
          { id: 'req-pending-1', data: makeRequestData({ status: 'pending' }) },
          { id: 'req-pending-2', data: makeRequestData({ status: 'pending' }) },
          { id: 'req-fulfilled-1', data: makeRequestData({ status: 'fulfilled' }) },
        ])
      )
      .mockResolvedValueOnce(makeSnapshot([]));

    const { result } = renderHook(() => useInboundRequests());
    await waitFor(() => expect(result.current.loading).toBe(false));
    return result;
  }

  it('defaults to the "pending" filter', async () => {
    const result = await setupThreeRequests();
    expect(result.current.filter).toBe('pending');
    expect(result.current.filtered.map(r => r.inviteCode).sort()).toEqual([
      'req-pending-1',
      'req-pending-2',
    ]);
  });

  it('computes pending/fulfilled counts independent of the active filter', async () => {
    const result = await setupThreeRequests();
    expect(result.current.counts).toEqual({ pending: 2, fulfilled: 1 });
  });
});

describe('useInboundRequests — no user', () => {
  it('never resolves loading when the user has no uid/email yet', async () => {
    authState.user = null;

    const { result } = renderHook(() => useInboundRequests());
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(result.current.loading).toBe(true);
    expect(getDocsMock).not.toHaveBeenCalled();
  });
});

describe('useInboundRequests — error handling', () => {
  it('sets an error message and stops loading when the queries fail', async () => {
    getDocsMock.mockRejectedValue(new Error('permission denied'));

    const { result } = renderHook(() => useInboundRequests());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('permission denied');
  });
});
