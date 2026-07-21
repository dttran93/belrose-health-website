// @vitest-environment jsdom
//
// src/features/Dependents/hooks/__tests__/useSwitchableAccounts.test.ts
//
// Tier 3 (Firestore/AccountSwitchService mocked) unit tests for useSwitchableAccounts. Covers
// the two branches that behave very differently: a dependent's guardian is fetched ONCE and
// never updates (fixed at account creation — no live listener at all), while a guardian's
// dependent list is a real-time onSnapshot listener that reacts to relationships flipping
// isDependentRelationship (e.g. after a claim removes a dependent from the live results).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const {
  mockUserState,
  onSnapshotMock,
  whereMock,
  getUserProfileMock,
  switchToDependentMock,
  switchToGuardianMock,
} = vi.hoisted(() => ({
  mockUserState: { user: null as any },
  onSnapshotMock: vi.fn(),
  whereMock: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  getUserProfileMock: vi.fn(),
  switchToDependentMock: vi.fn(async () => undefined),
  switchToGuardianMock: vi.fn(async () => undefined),
}));

vi.mock('@/features/Auth/AuthContext', () => ({
  useAuthContext: () => ({ user: mockUserState.user }),
}));

vi.mock('@/features/Users/services/userProfileService', () => ({
  getUserProfile: getUserProfileMock,
}));

vi.mock('../../services/accountSwitchService', () => ({
  AccountSwitchService: {
    switchToDependent: switchToDependentMock,
    switchToGuardian: switchToGuardianMock,
  },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(() => 'trusteeRelationships-collection'),
  query: vi.fn((...args: unknown[]) => args),
  where: whereMock,
  onSnapshot: onSnapshotMock,
}));

import { useSwitchableAccounts } from '../useSwitchableAccounts';
import { toast } from 'sonner';

let capturedOnNext: ((snapshot: any) => void) | null = null;
let capturedOnError: ((err: any) => void) | null = null;
const unsubscribeMock = vi.fn();

function fakeSnapshot(docs: Array<{ trustorId: string }>) {
  return { docs: docs.map(d => ({ data: () => d })) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUserState.user = null;
  capturedOnNext = null;
  capturedOnError = null;
  onSnapshotMock.mockImplementation((_q: unknown, onNext: any, onError: any) => {
    capturedOnNext = onNext;
    capturedOnError = onError;
    return unsubscribeMock;
  });
  getUserProfileMock.mockImplementation(async (uid: string) => ({ uid, displayName: `Profile ${uid}` }));
});

describe('useSwitchableAccounts — dependent view (guardian fixed at creation)', () => {
  it('fetches the guardian once via a plain getUserProfile call, not a live listener', async () => {
    mockUserState.user = { uid: 'dep-1', isDependent: true, dependentCreatedBy: 'guardian-1' };
    const { result } = renderHook(() => useSwitchableAccounts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getUserProfileMock).toHaveBeenCalledWith('guardian-1');
    expect(onSnapshotMock).not.toHaveBeenCalled();
    expect(result.current.guardian).toEqual({
      uid: 'guardian-1',
      profile: { uid: 'guardian-1', displayName: 'Profile guardian-1' },
    });
    expect(result.current.dependents).toEqual([]);
    expect(result.current.hasMultipleAccounts).toBe(true);
  });

  it('still sets a (profile-less) guardian entry, and hasMultipleAccounts stays true, when the profile fetch resolves null', async () => {
    // setGuardian({ uid, profile }) runs unconditionally once the promise resolves — profile
    // being null doesn't stop the guardian *entry* itself from being set, so
    // hasMultipleAccounts (!!guardian) is still true here even though there's no profile data
    // to render.
    mockUserState.user = { uid: 'dep-1', isDependent: true, dependentCreatedBy: 'guardian-1' };
    getUserProfileMock.mockResolvedValue(null);
    const { result } = renderHook(() => useSwitchableAccounts());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.guardian).toEqual({ uid: 'guardian-1', profile: null });
    expect(result.current.hasMultipleAccounts).toBe(true);
  });
});

describe('useSwitchableAccounts — guardian view (live listener)', () => {
  it('queries trusteeRelationships filtered by trusteeId/isDependentRelationship/isActive', async () => {
    mockUserState.user = { uid: 'guardian-1', isDependent: false };
    renderHook(() => useSwitchableAccounts());

    expect(whereMock).toHaveBeenCalledWith('trusteeId', '==', 'guardian-1');
    expect(whereMock).toHaveBeenCalledWith('isDependentRelationship', '==', true);
    expect(whereMock).toHaveBeenCalledWith('isActive', '==', true);
  });

  it('populates dependents with resolved profiles from the snapshot', async () => {
    mockUserState.user = { uid: 'guardian-1', isDependent: false };
    const { result } = renderHook(() => useSwitchableAccounts());

    await act(async () => {
      capturedOnNext!(fakeSnapshot([{ trustorId: 'dep-1' }, { trustorId: 'dep-2' }]));
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.dependents).toEqual([
      { uid: 'dep-1', profile: { uid: 'dep-1', displayName: 'Profile dep-1' } },
      { uid: 'dep-2', profile: { uid: 'dep-2', displayName: 'Profile dep-2' } },
    ]);
    expect(result.current.guardian).toBeNull();
    expect(result.current.hasMultipleAccounts).toBe(true);
  });

  it('reacts live: a dependent dropping out of a later snapshot removes it from the list', async () => {
    mockUserState.user = { uid: 'guardian-1', isDependent: false };
    const { result } = renderHook(() => useSwitchableAccounts());

    await act(async () => {
      capturedOnNext!(fakeSnapshot([{ trustorId: 'dep-1' }, { trustorId: 'dep-2' }]));
    });
    await waitFor(() => expect(result.current.dependents).toHaveLength(2));

    // Simulates dep-1's relationship flipping isDependentRelationship -> false (e.g. after
    // claim) — Firestore's real query would stop matching it, delivering a new snapshot with
    // just dep-2.
    await act(async () => {
      capturedOnNext!(fakeSnapshot([{ trustorId: 'dep-2' }]));
    });

    await waitFor(() => expect(result.current.dependents).toHaveLength(1));
    expect(result.current.dependents[0]!.uid).toBe('dep-2');
  });

  it('stops loading and logs on a listener error', async () => {
    mockUserState.user = { uid: 'guardian-1', isDependent: false };
    const { result } = renderHook(() => useSwitchableAccounts());

    await act(async () => {
      capturedOnError!(new Error('permission denied'));
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('unsubscribes the listener on unmount', () => {
    mockUserState.user = { uid: 'guardian-1', isDependent: false };
    const { unmount } = renderHook(() => useSwitchableAccounts());
    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});

describe('useSwitchableAccounts — switching', () => {
  it('switchToDependent calls AccountSwitchService and leaves isSwitching true on success', async () => {
    mockUserState.user = { uid: 'guardian-1', isDependent: false };
    const { result } = renderHook(() => useSwitchableAccounts());

    await act(async () => result.current.switchToDependent('dep-1'));

    expect(switchToDependentMock).toHaveBeenCalledWith('dep-1');
    // No manual reset on success — the app is expected to unmount/remount via
    // onAuthStateChanged, per the service's own header comment.
    expect(result.current.isSwitching).toBe(true);
  });

  it('switchToDependent shows a toast and resets isSwitching on failure', async () => {
    mockUserState.user = { uid: 'guardian-1', isDependent: false };
    switchToDependentMock.mockRejectedValueOnce(new Error('switch failed'));
    const { result } = renderHook(() => useSwitchableAccounts());

    await act(async () => result.current.switchToDependent('dep-1'));

    expect(toast.error).toHaveBeenCalledWith('Failed to switch account. Please try again.');
    expect(result.current.isSwitching).toBe(false);
  });

  it('switchToGuardian no-ops when the current user has no dependentCreatedBy', async () => {
    mockUserState.user = { uid: 'dep-1', isDependent: true, dependentCreatedBy: undefined };
    const { result } = renderHook(() => useSwitchableAccounts());

    await act(async () => result.current.switchToGuardian());

    expect(switchToGuardianMock).not.toHaveBeenCalled();
  });

  it('switchToGuardian calls AccountSwitchService with the guardian uid', async () => {
    mockUserState.user = { uid: 'dep-1', isDependent: true, dependentCreatedBy: 'guardian-1' };
    const { result } = renderHook(() => useSwitchableAccounts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.switchToGuardian());

    expect(switchToGuardianMock).toHaveBeenCalledWith('guardian-1');
  });
});
