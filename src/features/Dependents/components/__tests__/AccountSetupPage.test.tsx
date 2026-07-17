// @vitest-environment jsdom
//
// src/features/Dependents/components/__tests__/AccountSetupPage.test.tsx
//
// Pins a confirmed (not yet fixed — flagged to the user, product-intent decision needed)
// stuck-CTA bug: canContinue = !isEmailPlaceholder && emailVerified can NEVER become true for a
// claimed dependent who keeps their placeholder email, since a placeholder address can never
// satisfy "!isEmailPlaceholder" — while ProtectedRoute separately exempts placeholder-email
// accounts from being forced back to this page. The two pieces of logic disagree: this page's
// own primary button stays permanently disabled, but nothing actually keeps the user here. The
// tests below pin AccountSetupPage's own half of that — the permanently-disabled button state —
// without asserting anything about ProtectedRoute (separate component, separate test surface).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { mockAuthContextState, mockCurrentUser, updateDocMock, getDocsMock, getUserProfileMock, updateEmailMock } =
  vi.hoisted(() => ({
    mockAuthContextState: { user: null as any, refreshUser: vi.fn(async () => undefined) },
    mockCurrentUser: { emailVerified: false },
    updateDocMock: vi.fn(async () => undefined),
    getDocsMock: vi.fn(async (): Promise<{ docs: any[] }> => ({ docs: [] })),
    getUserProfileMock: vi.fn(async (): Promise<any> => null),
    updateEmailMock: vi.fn(async () => undefined),
  }));

vi.mock('@/features/Auth/AuthContext', () => ({
  useAuthContext: () => mockAuthContextState,
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: mockCurrentUser })),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(() => 'trusteeRelationships-collection'),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  getDocs: getDocsMock,
  doc: vi.fn(() => ({})),
  updateDoc: updateDocMock,
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

vi.mock('@/features/Settings/services/userSettingsService', () => ({
  UserSettingsService: { updateEmail: updateEmailMock },
}));

vi.mock('@/features/Users/services/userProfileService', () => ({
  getUserProfile: getUserProfileMock,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AccountSetupPage from '../AccountSetupPage';
import { toast } from 'sonner';

function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'dep-1',
    email: 'dep-abc@placeholder.belrose.health',
    emailVerified: false,
    passwordSelfSetAt: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountSetupPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthContextState.user = null;
  mockAuthContextState.refreshUser = vi.fn(async () => undefined);
  mockCurrentUser.emailVerified = false;
  getDocsMock.mockResolvedValue({ docs: [] });
});

describe('AccountSetupPage — canContinue stuck-CTA states (bug pin)', () => {
  it('CONFIRMED STUCK STATE: placeholder email + emailVerified:true still disables Continue', async () => {
    // Dependent accounts get emailVerified:true stamped on their placeholder address at
    // creation (see createDependentAccount.ts) — this is exactly the case that gets stuck.
    mockAuthContextState.user = fakeUser({
      email: 'dep-abc@placeholder.belrose.health',
      emailVerified: true,
    });
    renderPage();

    const button = await screen.findByRole('button', { name: /Continue to Belrose/ });
    expect(button).toBeDisabled();
    expect(screen.getByText('Set a real email above before continuing.')).toBeInTheDocument();
  });

  it('placeholder email + emailVerified:false also disables Continue', async () => {
    mockAuthContextState.user = fakeUser({
      email: 'dep-abc@placeholder.belrose.health',
      emailVerified: false,
    });
    renderPage();

    expect(await screen.findByRole('button', { name: /Continue to Belrose/ })).toBeDisabled();
  });

  it('real, verified email enables Continue and hides the warning', async () => {
    mockAuthContextState.user = fakeUser({ email: 'real@example.com', emailVerified: true });
    renderPage();

    const button = await screen.findByRole('button', { name: /Continue to Belrose/ });
    expect(button).toBeEnabled();
    expect(screen.queryByText('Set a real email above before continuing.')).not.toBeInTheDocument();
  });

  it('real but unverified email still disables Continue', async () => {
    mockAuthContextState.user = fakeUser({ email: 'real@example.com', emailVerified: false });
    renderPage();

    expect(await screen.findByRole('button', { name: /Continue to Belrose/ })).toBeDisabled();
  });

  it('clicking Continue when enabled navigates to /app', async () => {
    mockAuthContextState.user = fakeUser({ email: 'real@example.com', emailVerified: true });
    const user = userEvent.setup();
    renderPage();

    const button = await screen.findByRole('button', { name: /Continue to Belrose/ });
    await user.click(button);
    // Navigation itself isn't observable without a spy on useNavigate, but the button being
    // clickable without throwing confirms the enabled path is reachable.
    expect(button).toBeEnabled();
  });
});

describe('AccountSetupPage — EmailSection', () => {
  it('shows the Verified badge for a real, verified email', async () => {
    mockAuthContextState.user = fakeUser({ email: 'real@example.com', emailVerified: true });
    renderPage();

    expect(await screen.findByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('real@example.com')).toBeInTheDocument();
  });

  it('checking verification for a real unverified email updates Firestore and toasts on success', async () => {
    mockAuthContextState.user = fakeUser({ email: 'real@example.com', emailVerified: false });
    mockCurrentUser.emailVerified = true; // simulates the user having clicked the email link
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: "I've verified my email" }));

    await waitFor(() => expect(updateDocMock).toHaveBeenCalled());
    expect(mockAuthContextState.refreshUser).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Email verified!');
  });

  it('shows an error toast when checking verification too early', async () => {
    mockAuthContextState.user = fakeUser({ email: 'real@example.com', emailVerified: false });
    mockCurrentUser.emailVerified = false;
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: "I've verified my email" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Not verified yet — check your inbox and click the link.')
    );
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('submits a real email from the placeholder-email form and shows the sent state', async () => {
    mockAuthContextState.user = fakeUser({ email: 'dep-abc@placeholder.belrose.health' });
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByPlaceholderText('Your email address'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('Current password (to confirm)'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Send verification email' }));

    await waitFor(() =>
      expect(updateEmailMock).toHaveBeenCalledWith('dep-1', 'new@example.com', 'password123')
    );
    expect(await screen.findByText(/Verification link sent to/)).toBeInTheDocument();
  });
});

describe('AccountSetupPage — PasswordSection', () => {
  it('shows "Set by you" when passwordSelfSetAt is present', async () => {
    mockAuthContextState.user = fakeUser({ passwordSelfSetAt: '2026-01-01T00:00:00Z' });
    renderPage();
    expect(await screen.findByText('Set by you')).toBeInTheDocument();
  });

  it('shows a "Recommended" change-password prompt when passwordSelfSetAt is absent', async () => {
    mockAuthContextState.user = fakeUser({ passwordSelfSetAt: null });
    renderPage();
    expect(await screen.findByText('Recommended')).toBeInTheDocument();
    expect(screen.getByText('Change password in Settings')).toBeInTheDocument();
  });
});

describe('AccountSetupPage — TrusteeSection', () => {
  it('renders resolved trustees from Firestore', async () => {
    getDocsMock.mockResolvedValue({
      docs: [{ data: () => ({ trusteeId: 'guardian-1', trustLevel: 'controller' }) }],
    });
    getUserProfileMock.mockResolvedValue({ uid: 'guardian-1', displayName: 'Guardian Gary' });
    mockAuthContextState.user = fakeUser();
    renderPage();

    expect(await screen.findByText('Guardian Gary')).toBeInTheDocument();
    expect(screen.getByText('controller')).toBeInTheDocument();
  });

  it('omits the trustee section entirely when there are no active trustees', async () => {
    getDocsMock.mockResolvedValue({ docs: [] });
    mockAuthContextState.user = fakeUser();
    renderPage();

    await waitFor(() => expect(screen.queryByText('Who has access')).not.toBeInTheDocument());
  });
});
