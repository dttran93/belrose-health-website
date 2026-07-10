// @vitest-environment jsdom
//
// src/features/Encryption/components/__tests__/EncryptionGate.test.tsx
//
// EncryptionGate is the app-wide password-unlock screen — the very first thing a returning user
// with an expired/missing encryption session sees. Everything it talks to (auth, Firestore,
// EncryptionKeyManager, sonner) is mocked; this test is about the component's own branching:
// no-user vs. active-session vs. needs-unlock, the empty-password guard, wrong-password vs. other
// error messaging, and the sign-out fallback.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EncryptionGate } from '../EncryptionGate';

const { mockCurrentUser, mockGetDoc } = vi.hoisted(() => ({
  mockCurrentUser: { uid: null as string | null, displayName: null as string | null },
  mockGetDoc: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({
    currentUser: mockCurrentUser.uid
      ? { uid: mockCurrentUser.uid, displayName: mockCurrentUser.displayName }
      : null,
  }),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  getDoc: mockGetDoc,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/features/Encryption/services/encryptionKeyManager', () => ({
  EncryptionKeyManager: {
    hasActiveSession: vi.fn(),
    initializeSessionWithPassword: vi.fn(),
    clearSession: vi.fn(),
  },
}));

import { signOut } from 'firebase/auth';
import { toast } from 'sonner';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';

function setUser(uid: string | null, displayName: string | null = null) {
  mockCurrentUser.uid = uid;
  mockCurrentUser.displayName = displayName;
}

function renderGate() {
  return render(
    <EncryptionGate>
      <div>Protected Content</div>
    </EncryptionGate>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  setUser(null);
});

describe('EncryptionGate', () => {
  it('renders children directly when there is no authenticated user', async () => {
    setUser(null);
    renderGate();
    expect(await screen.findByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children directly when the user already has an active encryption session', async () => {
    setUser('user1', 'Alice');
    vi.mocked(EncryptionKeyManager.hasActiveSession).mockResolvedValue(true);

    renderGate();

    expect(await screen.findByText('Protected Content')).toBeInTheDocument();
  });

  it('shows the unlock screen with the user\'s display name when there is no active session', async () => {
    setUser('user1', 'Alice');
    vi.mocked(EncryptionKeyManager.hasActiveSession).mockResolvedValue(false);

    renderGate();

    expect(await screen.findByText('Unlock Account')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('falls back to "your account" when the user has no display name', async () => {
    setUser('user1', null);
    vi.mocked(EncryptionKeyManager.hasActiveSession).mockResolvedValue(false);

    renderGate();

    expect(await screen.findByText('your account')).toBeInTheDocument();
  });

  it('requires a password before submitting, and never calls initializeSessionWithPassword', async () => {
    setUser('user1');
    vi.mocked(EncryptionKeyManager.hasActiveSession).mockResolvedValue(false);
    const user = userEvent.setup();

    renderGate();
    await screen.findByText('Unlock Account');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(EncryptionKeyManager.initializeSessionWithPassword).not.toHaveBeenCalled();
  });

  it('unlocks successfully with the correct password and reveals the protected content', async () => {
    setUser('user1');
    vi.mocked(EncryptionKeyManager.hasActiveSession).mockResolvedValue(false);
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        encryption: { encryptedMasterKey: 'ek', masterKeyIV: 'iv', masterKeySalt: 'salt' },
      }),
    });
    vi.mocked(EncryptionKeyManager.initializeSessionWithPassword).mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderGate();
    await screen.findByText('Unlock Account');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByText('Protected Content')).toBeInTheDocument();
    expect(EncryptionKeyManager.initializeSessionWithPassword).toHaveBeenCalledWith(
      'ek',
      'iv',
      'correct-password',
      'salt'
    );
    expect(toast.success).toHaveBeenCalledWith('Account unlocked');
  });

  it('shows "Incorrect password" when unwrapping rejects with a DOMException', async () => {
    setUser('user1');
    vi.mocked(EncryptionKeyManager.hasActiveSession).mockResolvedValue(false);
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        encryption: { encryptedMasterKey: 'ek', masterKeyIV: 'iv', masterKeySalt: 'salt' },
      }),
    });
    vi.mocked(EncryptionKeyManager.initializeSessionWithPassword).mockRejectedValue(
      new DOMException('bad decrypt', 'OperationError')
    );
    const user = userEvent.setup();

    renderGate();
    await screen.findByText('Unlock Account');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByText('Incorrect password, please try again')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows a generic failure message for non-decryption errors (e.g. missing user data)', async () => {
    setUser('user1');
    vi.mocked(EncryptionKeyManager.hasActiveSession).mockResolvedValue(false);
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const user = userEvent.setup();

    renderGate();
    await screen.findByText('Unlock Account');
    await user.type(screen.getByLabelText('Password'), 'whatever');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByText('Failed to unlock. Please try again.')).toBeInTheDocument();
  });

  it('toggles password visibility between hidden and visible', async () => {
    setUser('user1');
    vi.mocked(EncryptionKeyManager.hasActiveSession).mockResolvedValue(false);
    const user = userEvent.setup();

    renderGate();
    await screen.findByText('Unlock Account');
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');

    const toggle = screen.getAllByRole('button').find(b => b.getAttribute('tabindex') === '-1')!;
    await user.click(toggle);
    expect(input.type).toBe('text');

    await user.click(toggle);
    expect(input.type).toBe('password');
  });

  it('clears the session and signs out when "Sign out instead" is clicked', async () => {
    setUser('user1');
    vi.mocked(EncryptionKeyManager.hasActiveSession).mockResolvedValue(false);
    const user = userEvent.setup();

    renderGate();
    await screen.findByText('Unlock Account');
    await user.click(screen.getByText('Sign out instead'));

    expect(EncryptionKeyManager.clearSession).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
