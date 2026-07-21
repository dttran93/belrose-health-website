// @vitest-environment jsdom
//
// src/features/GuestAccess/hooks/__tests__/useGuestContext.test.ts
//
// Tier 3 (Firestore/AuthContext mocked) unit tests for useGuestContext — a one-shot lookup
// distinguishing "sharing" vs "record_request" guests. The memoization guard
// (`if (guestContext || !user?.uid) return`) means a second fetchGuestContext() call after the
// first resolves should be a no-op — pinned explicitly below.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { mockUserState, getDocsMock } = vi.hoisted(() => ({
  mockUserState: { user: null as any },
  getDocsMock: vi.fn(),
}));

vi.mock('@/features/Auth/AuthContext', () => ({
  useAuthContext: () => ({ user: mockUserState.user }),
}));

vi.mock('@/firebase/config', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'guestInvites-collection'),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  limit: vi.fn((n: number) => ({ limit: n })),
  getDocs: getDocsMock,
}));

import { useGuestContext } from '../useGuestContext';

function fakeSnapshot(context?: 'sharing' | 'record_request') {
  return {
    docs: context ? [{ data: () => ({ context }) }] : [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUserState.user = null;
});

describe('useGuestContext', () => {
  it('does nothing when there is no user', async () => {
    const { result } = renderHook(() => useGuestContext());
    await act(async () => result.current.fetchGuestContext());

    expect(getDocsMock).not.toHaveBeenCalled();
    expect(result.current.guestContext).toBeUndefined();
  });

  it('sets guestContext to "sharing" when the matching invite has that context', async () => {
    mockUserState.user = { uid: 'guest-1' };
    getDocsMock.mockResolvedValue(fakeSnapshot('sharing'));

    const { result } = renderHook(() => useGuestContext());
    await act(async () => result.current.fetchGuestContext());

    expect(result.current.guestContext).toBe('sharing');
  });

  it('sets guestContext to "record_request" when the matching invite has that context', async () => {
    mockUserState.user = { uid: 'guest-1' };
    getDocsMock.mockResolvedValue(fakeSnapshot('record_request'));

    const { result } = renderHook(() => useGuestContext());
    await act(async () => result.current.fetchGuestContext());

    expect(result.current.guestContext).toBe('record_request');
  });

  it('sets guestContext to undefined when no matching invite is found', async () => {
    mockUserState.user = { uid: 'guest-1' };
    getDocsMock.mockResolvedValue(fakeSnapshot(undefined));

    const { result } = renderHook(() => useGuestContext());
    await act(async () => result.current.fetchGuestContext());

    expect(result.current.guestContext).toBeUndefined();
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('queries by guestUserId with a limit of 1', async () => {
    mockUserState.user = { uid: 'guest-1' };
    getDocsMock.mockResolvedValue(fakeSnapshot('sharing'));

    const { result } = renderHook(() => useGuestContext());
    await act(async () => result.current.fetchGuestContext());

    const { where, limit } = await import('firebase/firestore');
    expect(where).toHaveBeenCalledWith('guestUserId', '==', 'guest-1');
    expect(limit).toHaveBeenCalledWith(1);
  });

  it('is memoized: a second fetch after resolving does not re-query', async () => {
    mockUserState.user = { uid: 'guest-1' };
    getDocsMock.mockResolvedValue(fakeSnapshot('sharing'));

    const { result } = renderHook(() => useGuestContext());
    await act(async () => result.current.fetchGuestContext());
    expect(getDocsMock).toHaveBeenCalledTimes(1);

    await act(async () => result.current.fetchGuestContext());
    expect(getDocsMock).toHaveBeenCalledTimes(1); // still 1 — memoized
  });
});
