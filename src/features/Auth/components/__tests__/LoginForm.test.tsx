// @vitest-environment jsdom
//
// src/features/Auth/components/__tests__/LoginForm.test.tsx
//
// Pins the fix for a confirmed bug: LoginForm used to access
// `userData.encryption.encryptedMasterKey` with no null-check on `userData.encryption`
// itself, throwing a raw TypeError (rather than reaching the intended "no encryption set
// up" warning path) for any account missing the `encryption` field entirely. These tests
// cover both "no encryption field at all" and "partial encryption object" without a crash,
// alongside the normal successful-unlock path.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '../LoginForm';

const { mockNavigate, mockGetDoc, signInMock, initializeSessionWithPasswordMock } = vi.hoisted(
  () => ({
    mockNavigate: vi.fn(),
    mockGetDoc: vi.fn(),
    signInMock: vi.fn(),
    initializeSessionWithPasswordMock: vi.fn(),
  })
);

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: {} }),
}));

vi.mock('@/features/Auth/services/authServices', () => ({
  authService: { signIn: signInMock },
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: mockGetDoc,
}));

vi.mock('@/features/Encryption/services/encryptionKeyManager', () => ({
  EncryptionKeyManager: {
    initializeSessionWithPassword: initializeSessionWithPasswordMock,
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderForm() {
  return render(
    <LoginForm onSwitchToRegister={() => {}} onForgotPassword={() => {}} onBack={() => {}} />
  );
}

async function submitLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('Enter your email'), 'user@example.com');
  await user.type(screen.getByPlaceholderText('Enter your password'), 'correct-password');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  signInMock.mockResolvedValue({ uid: 'uid-1' });
});

describe('LoginForm encryption-check branch', () => {
  it('does not crash and still logs in when the user doc has no encryption field at all', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ uid: 'uid-1' }) });
    const user = userEvent.setup();

    renderForm();
    await submitLogin(user);

    expect(mockNavigate).toHaveBeenCalledWith('/app', { replace: true });
    expect(initializeSessionWithPasswordMock).not.toHaveBeenCalled();
  });

  it('does not crash when encryption is a partial object missing a sub-field', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ uid: 'uid-1', encryption: { encryptedMasterKey: 'ek' } }), // missing IV/salt
    });
    const user = userEvent.setup();

    renderForm();
    await submitLogin(user);

    expect(mockNavigate).toHaveBeenCalledWith('/app', { replace: true });
    expect(initializeSessionWithPasswordMock).not.toHaveBeenCalled();
  });

  it('initializes the encryption session when a full encryption bundle is present', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        uid: 'uid-1',
        encryption: { encryptedMasterKey: 'ek', masterKeyIV: 'iv', masterKeySalt: 'salt' },
      }),
    });
    initializeSessionWithPasswordMock.mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderForm();
    await submitLogin(user);

    expect(initializeSessionWithPasswordMock).toHaveBeenCalledWith(
      'ek',
      'iv',
      'correct-password',
      'salt'
    );
    expect(mockNavigate).toHaveBeenCalledWith('/app', { replace: true });
  });

  it('shows an error and does not navigate when the user Firestore doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const user = userEvent.setup();

    renderForm();
    await submitLogin(user);

    expect(await screen.findByText('User data not found')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('LoginForm validation and error mapping', () => {
  it('requires email and password before calling signIn', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('maps auth/wrong-password to a friendly message', async () => {
    signInMock.mockRejectedValue(Object.assign(new Error('bad'), { code: 'auth/wrong-password' }));
    const user = userEvent.setup();

    renderForm();
    await submitLogin(user);

    expect(await screen.findByText('Incorrect password. Please try again.')).toBeInTheDocument();
  });
});
