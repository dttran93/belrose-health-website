// @vitest-environment jsdom
//
// src/features/Auth/hooks/__tests__/useAuth.test.ts
//
// Tier 3 (authService/UserService/UserSettingsService mocked) unit tests for useAuth — the
// hook that merges Firebase Auth's User with the Firestore users/{uid} profile into a
// BelroseUserProfile. Covers the merge itself, the email-drift auto-heal side effect, the
// profile-fetch-failure -> null-user path, and signInProvider/isPlatformAdmin propagation from
// custom claims (the field ProtectedRoute uses to detect a dependent's own password login vs.
// a guardian's custom-token switch).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const {
  onAuthStateChangedMock,
  getCurrentUserMock,
  signOutMock,
  getUserProfileMock,
  syncEmailMock,
} = vi.hoisted(() => ({
  onAuthStateChangedMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  signOutMock: vi.fn(async () => undefined),
  getUserProfileMock: vi.fn(),
  syncEmailMock: vi.fn(async () => undefined),
}));

vi.mock('@/features/Auth/services/authServices', () => ({
  authService: {
    onAuthStateChanged: onAuthStateChangedMock,
    getCurrentUser: getCurrentUserMock,
    signOut: signOutMock,
  },
}));

vi.mock('@/features/Auth/services/userService', () => ({
  UserService: { getUserProfile: getUserProfileMock },
}));

vi.mock('@/features/Settings/services/userSettingsService', () => ({
  UserSettingsService: { syncEmailToFirestore: syncEmailMock },
}));

import { useAuth } from '../useAuth';

let authStateCallback: ((user: any) => void) | null = null;

function fakeFirebaseUser(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'uid-1',
    email: 'user@example.com',
    emailVerified: true,
    displayName: 'Jane Doe',
    photoURL: null,
    reload: vi.fn(async () => undefined),
    getIdTokenResult: vi.fn(async () => ({ claims: {}, signInProvider: 'password' })),
    ...overrides,
  };
}

function fakeProfile(overrides: Record<string, unknown> = {}) {
  return {
    displayName: 'Jane Doe',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'user@example.com',
    encryption: undefined,
    createdAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authStateCallback = null;
  onAuthStateChangedMock.mockImplementation((cb: (user: any) => void) => {
    authStateCallback = cb;
    return () => {
      authStateCallback = null;
    };
  });
});

describe('useAuth — merge logic', () => {
  it('merges the Firebase user and Firestore profile into a BelroseUserProfile', async () => {
    getUserProfileMock.mockResolvedValue(fakeProfile());
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      authStateCallback!(fakeFirebaseUser());
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toMatchObject({
      uid: 'uid-1',
      email: 'user@example.com',
      displayName: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      emailVerified: true,
    });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('sets user to null and loading false when there is no Firebase user', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      authStateCallback!(null);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('sets user to null when the profile fetch throws', async () => {
    getUserProfileMock.mockRejectedValue(new Error('firestore down'));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      authStateCallback!(fakeFirebaseUser());
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('propagates isPlatformAdmin and signInProvider from ID token claims', async () => {
    getUserProfileMock.mockResolvedValue(fakeProfile());
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      authStateCallback!(
        fakeFirebaseUser({
          getIdTokenResult: vi.fn(async () => ({
            claims: { platformAdmin: true },
            signInProvider: 'custom',
          })),
        })
      );
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.isPlatformAdmin).toBe(true);
    expect(result.current.user?.signInProvider).toBe('custom');
  });

  it('defaults isPlatformAdmin to false when the claim is absent', async () => {
    getUserProfileMock.mockResolvedValue(fakeProfile());
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      authStateCallback!(fakeFirebaseUser());
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.isPlatformAdmin).toBe(false);
  });
});

describe('useAuth — email-drift auto-heal', () => {
  it('syncs the Firestore email to match Firebase Auth when they differ', async () => {
    getUserProfileMock.mockResolvedValue(fakeProfile({ email: 'old@example.com' }));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      authStateCallback!(fakeFirebaseUser({ email: 'new@example.com', emailVerified: true }));
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(syncEmailMock).toHaveBeenCalledWith('uid-1', 'new@example.com', true);
  });

  it('does not sync when the emails already match', async () => {
    getUserProfileMock.mockResolvedValue(fakeProfile({ email: 'user@example.com' }));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      authStateCallback!(fakeFirebaseUser({ email: 'user@example.com' }));
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(syncEmailMock).not.toHaveBeenCalled();
  });
});

describe('useAuth — refreshUser', () => {
  it('reloads the current user and re-merges the profile', async () => {
    getUserProfileMock.mockResolvedValue(fakeProfile());
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      authStateCallback!(fakeFirebaseUser());
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const reloadedUser = fakeFirebaseUser({ displayName: 'Updated Name' });
    getCurrentUserMock.mockReturnValue(reloadedUser);
    getUserProfileMock.mockResolvedValue(fakeProfile({ displayName: 'Updated Name' }));

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(reloadedUser.reload).toHaveBeenCalledTimes(1);
    expect(result.current.user?.displayName).toBe('Updated Name');
  });

  it('does nothing when there is no current user', async () => {
    getCurrentUserMock.mockReturnValue(null);
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(getUserProfileMock).not.toHaveBeenCalled();
  });
});

describe('useAuth — signOut', () => {
  it('calls authService.signOut', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signOut();
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('rethrows and resets loading on failure', async () => {
    signOutMock.mockRejectedValueOnce(new Error('sign out failed'));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await expect(result.current.signOut()).rejects.toThrow('sign out failed');
    });

    expect(result.current.loading).toBe(false);
  });
});
