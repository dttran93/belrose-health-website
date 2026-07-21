// @vitest-environment jsdom
//
// src/features/Auth/__tests__/ProtectedRoute.test.tsx
//
// ProtectedRoute had zero test coverage before this file. Covers the existing branches
// (loading, no-user, dependent-direct-login-to-claim, email-verification gate) plus the new
// branch added to fix a confirmed bug: a dependent who has CLAIMED their account
// (isDependent flipped false) but still hasn't replaced their placeholder email used to be
// completely unguarded here — the old email-verification gate's `!isPlaceholderEmail` check
// exempted them right along with still-active (unclaimed) dependents, even though those are two
// very different states. They're now forced back to /account-setup, matching that page's own
// canContinue requirement (see AccountSetupPage.test.tsx's "CONFIRMED STUCK STATE" tests, which
// pin the page-level half of this bug that motivated the fix).
//
// Routing setup note: each redirect target (/auth, /claim-account, /account-setup,
// /verification) gets its own plain <Route> OUTSIDE ProtectedRoute, exactly like the real app's
// router (ProtectedRoute only wraps the actual protected subtree — /auth itself is a public
// route). Rendering ProtectedRoute as a route-agnostic persistent sibling instead (an earlier,
// wrong version of this file did that) means it never unmounts after redirecting, and the
// no-guard "if (!user) -> /auth" branch keeps re-firing Navigate with a fresh `state` object
// every render forever, hanging the test — that's a test-harness artifact, not a real bug: in
// the actual app /auth isn't wrapped in ProtectedRoute, so it unmounts on navigation and this
// never happens.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: { user: null as any, loading: false },
}));

vi.mock('../AuthContext', () => ({
  useAuthContext: () => mockAuthState,
}));

import ProtectedRoute from '../ProtectedRoute';

// Only /auth is genuinely public. /claim-account, /account-setup, and /verification are each
// wrapped in their own ProtectedRoute too (they need `user` to render at all) — that's exactly
// why ProtectedRoute's own guards check `location.pathname !== '/claim-account'` etc.: it's
// re-evaluated on those pages, not skipped, so it needs its own "already there, stop" logic.
function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/auth" element={<div>Auth Page</div>} />
        <Route
          path="/claim-account"
          element={
            <ProtectedRoute>
              <div>Claim Account Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account-setup"
          element={
            <ProtectedRoute>
              <div>Account Setup Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/verification"
          element={
            <ProtectedRoute>
              <div>Verification Page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'uid-1',
    email: 'user@example.com',
    emailVerified: true,
    isDependent: false,
    signInProvider: 'password',
    ...overrides,
  };
}

beforeEach(() => {
  mockAuthState.user = null;
  mockAuthState.loading = false;
});

describe('ProtectedRoute — loading and unauthenticated', () => {
  it('shows a loading spinner while auth state is resolving', () => {
    mockAuthState.loading = true;
    renderAt('/app');
    expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to /auth when there is no user', async () => {
    mockAuthState.user = null;
    renderAt('/app');
    expect(await screen.findByText('Auth Page')).toBeInTheDocument();
  });
});

describe('ProtectedRoute — unclaimed dependent logging in directly', () => {
  it('redirects to /claim-account when a still-dependent user signs in with their own password', async () => {
    mockAuthState.user = fakeUser({ isDependent: true, signInProvider: 'password' });
    renderAt('/app');
    expect(await screen.findByText('Claim Account Page')).toBeInTheDocument();
  });

  it('does not loop when already on /claim-account', async () => {
    mockAuthState.user = fakeUser({ isDependent: true, signInProvider: 'password' });
    renderAt('/claim-account');
    expect(await screen.findByText('Claim Account Page')).toBeInTheDocument();
  });

  it('does not redirect a still-dependent user who arrived via a guardian custom-token switch', async () => {
    mockAuthState.user = fakeUser({
      isDependent: true,
      signInProvider: 'custom',
      email: 'dep-abc@placeholder.belrose.health',
    });
    renderAt('/app');
    expect(await screen.findByText('Protected Content')).toBeInTheDocument();
  });
});

describe('ProtectedRoute — claimed dependent stuck on a placeholder email (the fix)', () => {
  it('redirects to /account-setup when isDependent is false but the email is still a placeholder', async () => {
    mockAuthState.user = fakeUser({
      isDependent: false,
      email: 'dep-abc@placeholder.belrose.health',
      emailVerified: true, // dependents get emailVerified:true stamped on their placeholder at creation
    });
    renderAt('/app/dashboard');
    expect(await screen.findByText('Account Setup Page')).toBeInTheDocument();
  });

  it('does not loop when already on /account-setup', async () => {
    mockAuthState.user = fakeUser({
      isDependent: false,
      email: 'dep-abc@placeholder.belrose.health',
      emailVerified: true,
    });
    renderAt('/account-setup');
    expect(await screen.findByText('Account Setup Page')).toBeInTheDocument();
  });

  it('stops redirecting once a real email is set, falling through to the normal verification gate', async () => {
    mockAuthState.user = fakeUser({
      isDependent: false,
      email: 'real@example.com',
      emailVerified: false,
    });
    renderAt('/app/dashboard');
    // Real (non-placeholder) + unverified now hits the pre-existing verification gate instead.
    expect(await screen.findByText('Verification Page')).toBeInTheDocument();
  });
});

describe('ProtectedRoute — normal email-verification gate', () => {
  it('redirects to /verification for a real, unverified, non-dependent email', async () => {
    mockAuthState.user = fakeUser({ email: 'real@example.com', emailVerified: false, isDependent: false });
    renderAt('/app/dashboard');
    expect(await screen.findByText('Verification Page')).toBeInTheDocument();
  });

  it('does not loop when already on /verification', async () => {
    mockAuthState.user = fakeUser({ email: 'real@example.com', emailVerified: false, isDependent: false });
    renderAt('/verification');
    expect(await screen.findByText('Verification Page')).toBeInTheDocument();
  });

  it('renders children for a fully verified, non-placeholder, non-dependent user', async () => {
    mockAuthState.user = fakeUser({ email: 'real@example.com', emailVerified: true, isDependent: false });
    renderAt('/app/dashboard');
    expect(await screen.findByText('Protected Content')).toBeInTheDocument();
  });
});
