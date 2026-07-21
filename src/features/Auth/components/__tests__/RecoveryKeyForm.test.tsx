// @vitest-environment jsdom
//
// src/features/Auth/components/__tests__/RecoveryKeyForm.test.tsx
//
// RecoveryKeyForm used to duplicate its own inline password validator (min 8 chars +
// "at least 3 of 4 character classes") instead of reusing the shared
// PasswordStrength.validatePassword — a real drift, since a 12-char lowercase+digit-only
// password passed the shared validator (length bonus) but was rejected here. The fix
// replaces the inline check with the shared import; this test pins the corrected,
// now-consistent behavior via the exact password that used to expose the drift.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecoveryKeyForm } from '../RecoveryKeyForm';

const { mockGetDoc, mockUpdateDoc, ekm } = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockUpdateDoc: vi.fn(async () => undefined),
  ekm: {
    validateRecoveryKey: vi.fn(() => true),
    hashRecoveryKey: vi.fn(async () => 'matching-hash'),
    initializeSessionWithRecoveryKey: vi.fn(async () => undefined),
    getSessionKey: vi.fn(async () => 'master-key'),
    wrapMasterKeyWithPassword: vi.fn(async () => ({
      encryptedKey: 'ek',
      iv: 'iv',
      salt: 'salt',
    })),
  },
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'uid-1' } }),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(() => ({})),
  getDoc: mockGetDoc,
  updateDoc: mockUpdateDoc,
}));

vi.mock('@/features/Encryption/services/encryptionKeyManager', () => ({
  EncryptionKeyManager: ekm,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

async function reachSetPasswordStep(user: ReturnType<typeof userEvent.setup>) {
  mockGetDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({ encryption: { recoveryKeyHash: 'matching-hash' } }),
  });

  render(<RecoveryKeyForm onBackToLogin={() => {}} />);
  await user.type(
    screen.getByPlaceholderText('word1 word2 word3 ... word24'),
    'a '.repeat(23) + 'a'
  );
  await user.click(screen.getByRole('button', { name: 'Verify Recovery Key' }));
  await screen.findByPlaceholderText('Enter new password');
}

beforeEach(() => {
  vi.clearAllMocks();
  ekm.validateRecoveryKey.mockReturnValue(true);
  ekm.hashRecoveryKey.mockResolvedValue('matching-hash');
  ekm.initializeSessionWithRecoveryKey.mockResolvedValue(undefined);
  ekm.getSessionKey.mockResolvedValue('master-key');
  ekm.wrapMasterKeyWithPassword.mockResolvedValue({ encryptedKey: 'ek', iv: 'iv', salt: 'salt' });
});

describe('RecoveryKeyForm password validation (delegates to shared PasswordStrength)', () => {
  it('rejects a password shorter than 8 characters', async () => {
    const user = userEvent.setup();
    await reachSetPasswordStep(user);

    await user.type(screen.getByPlaceholderText('Enter new password'), 'short1');
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'short1');
    await user.click(screen.getByRole('button', { name: 'Set New Password' }));

    expect(
      await screen.findByText('Password must be at least 8 characters')
    ).toBeInTheDocument();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('accepts a 12-char lowercase+digit-only password that the old inline validator used to reject', async () => {
    const user = userEvent.setup();
    await reachSetPasswordStep(user);

    await user.type(screen.getByPlaceholderText('Enter new password'), 'passwordabc1');
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'passwordabc1');
    await user.click(screen.getByRole('button', { name: 'Set New Password' }));

    expect(await screen.findByText('Recovery Complete!')).toBeInTheDocument();
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'encryption.encryptedMasterKey': 'ek',
        'encryption.masterKeyIV': 'iv',
        'encryption.masterKeySalt': 'salt',
      })
    );
  });

  it('rejects mismatched password confirmation', async () => {
    const user = userEvent.setup();
    await reachSetPasswordStep(user);

    await user.type(screen.getByPlaceholderText('Enter new password'), 'passwordabc1');
    await user.type(screen.getByPlaceholderText('Confirm new password'), 'different1');
    await user.click(screen.getByRole('button', { name: 'Set New Password' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
