// @vitest-environment jsdom
//
// src/features/GuestAccess/components/__tests__/GuestClaimAccountModal.test.tsx
//
// The big one. Covers, per the header comment's own documented write strategy:
//   (a) the atomic batch (profile update + backfill) succeeds/fails as a unit — a batch.commit()
//       failure must stop the flow before wallet registration ever runs.
//   (b) best-effort Step 1c degrades gracefully with skippedRecordCount surfaced via toast,
//       rather than throwing, when the throwaway session key is gone.
//   (c) the stale-session-keys guard fires in BOTH places it exists: handleCredentialsSubmit
//       (blocks before generating any crypto) and handleClaim itself (the real "tab was
//       refreshed between submitting credentials and clicking Complete Registration" case,
//       since guest file keys live only in memory).
//   (d) call-order: guestPasswordUpdate resolves -> signInWithCustomToken -> refreshUser,
//       asserted via invocationCallOrder, not just "was called".

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const FAKE_MASTER_KEY = { fake: 'master-key' } as any;

const {
  mockAuthContextState,
  mockCurrentUser,
  hasGuestFileKeysMock,
  getGuestFileKeysMock,
  getGuestRsaPrivateKeyMock,
  getSessionKeyMock,
  setSessionKeyMock,
  setGuestFileKeysMock,
  generateEncryptionBundleMock,
  registerWalletOnChainMock,
  deactivateWalletMock,
  signInWithCustomTokenMock,
  updateProfileMock,
  updateDocMock,
  getDocMock,
  getDocsMock,
  batchUpdateMock,
  batchCommitMock,
  httpsCallableMock,
  guestPasswordUpdateMock,
} = vi.hoisted(() => ({
  mockAuthContextState: { user: null as any, refreshUser: vi.fn(async () => undefined) },
  mockCurrentUser: { getIdToken: vi.fn(async () => 'id-token') },
  hasGuestFileKeysMock: vi.fn(() => true),
  getGuestFileKeysMock: vi.fn(
    (): Map<string, { fake: string }> | null => new Map([['rec-1', { fake: 'file-key' }]])
  ),
  getGuestRsaPrivateKeyMock: vi.fn(() => null),
  getSessionKeyMock: vi.fn(async () => null),
  setSessionKeyMock: vi.fn(),
  setGuestFileKeysMock: vi.fn(),
  generateEncryptionBundleMock: vi.fn(),
  registerWalletOnChainMock: vi.fn(),
  deactivateWalletMock: vi.fn(async () => undefined),
  signInWithCustomTokenMock: vi.fn(async () => undefined),
  updateProfileMock: vi.fn(async () => undefined),
  updateDocMock: vi.fn(async () => undefined),
  getDocMock: vi.fn(async () => ({ exists: () => false })),
  getDocsMock: vi.fn(async () => ({ docs: [] })),
  batchUpdateMock: vi.fn(),
  batchCommitMock: vi.fn(async () => undefined),
  httpsCallableMock: vi.fn(),
  guestPasswordUpdateMock: vi.fn(async () => ({ data: { customToken: 'custom-token' } })),
}));

vi.mock('@/features/Auth/AuthContext', () => ({
  useAuthContext: () => mockAuthContextState,
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: mockCurrentUser })),
  signInWithCustomToken: signInWithCustomTokenMock,
  updateProfile: updateProfileMock,
}));

vi.mock('@/features/Encryption/services/encryptionKeyManager', () => ({
  EncryptionKeyManager: {
    hasGuestFileKeys: hasGuestFileKeysMock,
    getGuestFileKeys: getGuestFileKeysMock,
    getGuestRsaPrivateKey: getGuestRsaPrivateKeyMock,
    getSessionKey: getSessionKeyMock,
    setSessionKey: setSessionKeyMock,
    setGuestFileKeys: setGuestFileKeysMock,
  },
}));

vi.mock('@/features/Encryption/services/encryptionService', () => ({
  EncryptionService: {
    decryptKeyWithMasterKey: vi.fn(async () => new ArrayBuffer(8)),
    importKey: vi.fn(async () => ({ fake: 'imported-key' })),
    encryptKeyWithMasterKey: vi.fn(async () => new ArrayBuffer(8)),
  },
}));

vi.mock('@/features/Sharing/services/sharingKeyManagementService', () => ({
  SharingKeyManagementService: {
    importPublicKey: vi.fn(async () => ({ fake: 'rsa-public' })),
    importPrivateKey: vi.fn(async () => ({ fake: 'rsa-private' })),
    wrapKey: vi.fn(async () => 'wrapped-key'),
    unwrapKey: vi.fn(async () => ({ fake: 'unwrapped-key' })),
  },
}));

vi.mock('@/features/Auth/services/accountEncryptionService', () => ({
  AccountEncryptionService: {
    generateEncryptionBundle: generateEncryptionBundleMock,
    registerWalletOnChain: registerWalletOnChainMock,
  },
}));

vi.mock('@/features/Auth/services/memberRegistryBlockchain', () => ({
  MemberRegistryBlockchain: { deactivateWallet: deactivateWalletMock },
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(() => 'collection'),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  doc: vi.fn((...args: unknown[]) => ({ path: args.filter(a => typeof a === 'string').join('/') })),
  deleteField: vi.fn(() => 'DELETE_FIELD'),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  updateDoc: updateDocMock,
  getDoc: getDocMock,
  getDocs: getDocsMock,
  writeBatch: vi.fn(() => ({ update: batchUpdateMock, commit: batchCommitMock })),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: httpsCallableMock,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import { GuestClaimAccountModal } from '../GuestClaimAccountModal';
import { toast } from 'sonner';

function fakeBundle() {
  return {
    masterKey: FAKE_MASTER_KEY,
    encryptedMasterKey: 'enc-master-key',
    masterKeyIV: 'master-iv',
    masterKeySalt: 'master-salt',
    recoveryKey: 'word1 word2 ... word24',
    recoveryKeyHash: 'recovery-hash',
    publicKey: 'public-key',
    encryptedPrivateKey: 'enc-private-key',
    encryptedPrivateKeyIV: 'private-iv',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthContextState.user = { uid: 'guest-1', email: 'guest@example.com' };
  mockAuthContextState.refreshUser = vi.fn(async () => undefined);
  hasGuestFileKeysMock.mockReturnValue(true);
  getGuestFileKeysMock.mockReturnValue(new Map([['rec-1', { fake: 'file-key' }]]));
  getGuestRsaPrivateKeyMock.mockReturnValue(null);
  getSessionKeyMock.mockResolvedValue(null);
  generateEncryptionBundleMock.mockResolvedValue(fakeBundle());
  registerWalletOnChainMock.mockResolvedValue({
    masterKeyHex: 'hex',
    walletAddress: '0xabc',
    smartAccountAddress: '0xdef',
  });
  batchCommitMock.mockResolvedValue(undefined);
  getDocMock.mockResolvedValue({ exists: () => false });
  getDocsMock.mockResolvedValue({ docs: [] });
  httpsCallableMock.mockReturnValue(guestPasswordUpdateMock);
  guestPasswordUpdateMock.mockResolvedValue({ data: { customToken: 'custom-token' } });
});

async function fillCredentialsAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('Jane'), 'Jane');
  await user.type(screen.getByPlaceholderText('Smith'), 'Doe');
  await user.type(screen.getByPlaceholderText('At least 8 characters'), 'password123');
  await user.type(screen.getByPlaceholderText('Repeat your password'), 'password123');
  await user.click(screen.getByRole('button', { name: /Continue/ }));
}

async function completeClaim(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('Save Your Recovery Key');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Complete Registration' }));
}

describe('GuestClaimAccountModal — stale session keys (bug scenario)', () => {
  it('blocks at credentials-submit time when sharing-context guest file keys are gone', async () => {
    hasGuestFileKeysMock.mockReturnValue(false);
    const user = userEvent.setup();
    render(<GuestClaimAccountModal isOpen onClose={() => {}} guestContext="sharing" />);

    await fillCredentialsAndSubmit(user);

    expect(await screen.findByText(/session has expired/)).toBeInTheDocument();
    expect(generateEncryptionBundleMock).not.toHaveBeenCalled();
  });

  it('does NOT block a record_request guest even with no guest file keys', async () => {
    hasGuestFileKeysMock.mockReturnValue(false);
    const user = userEvent.setup();
    render(<GuestClaimAccountModal isOpen onClose={() => {}} guestContext="record_request" />);

    await fillCredentialsAndSubmit(user);

    expect(await screen.findByText('Save Your Recovery Key')).toBeInTheDocument();
  });

  it('TAB-REFRESH SCENARIO: blocks at claim time when keys vanish AFTER credentials were already submitted', async () => {
    // Credentials submit succeeds (keys present then)...
    const user = userEvent.setup();
    render(<GuestClaimAccountModal isOpen onClose={() => {}} guestContext="sharing" />);
    await fillCredentialsAndSubmit(user);
    await screen.findByText('Save Your Recovery Key');

    // ...but by the time they click Complete Registration, the in-memory keys are gone
    // (simulating a tab refresh wiping session state mid-flow).
    getGuestFileKeysMock.mockReturnValue(null);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Complete Registration' }));

    expect(await screen.findByText(/session has expired/)).toBeInTheDocument();
    expect(batchCommitMock).not.toHaveBeenCalled();
  });
});

describe('GuestClaimAccountModal — atomic batch (profile update)', () => {
  it('commits the profile-update batch and proceeds to wallet registration on success', async () => {
    const user = userEvent.setup();
    render(<GuestClaimAccountModal isOpen onClose={() => {}} guestContext="sharing" />);
    await fillCredentialsAndSubmit(user);
    await completeClaim(user);

    // Two separate writeBatch() calls happen in the real success path (the main profile batch
    // here, plus a later invite-acceptance batch in Step 5) — both share this mock's commit spy,
    // so this only asserts the main batch committed, not an exact total count.
    await waitFor(() => expect(batchCommitMock).toHaveBeenCalled());
    expect(batchUpdateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        isGuest: false,
        encryption: expect.objectContaining({ enabled: true, encryptedMasterKey: 'enc-master-key' }),
      })
    );
    await waitFor(() => expect(registerWalletOnChainMock).toHaveBeenCalledWith(FAKE_MASTER_KEY));
  });

  it('ATOMICITY: a batch.commit() failure stops the flow before wallet registration ever runs', async () => {
    batchCommitMock.mockRejectedValue(new Error('commit failed'));
    const user = userEvent.setup();
    render(<GuestClaimAccountModal isOpen onClose={() => {}} guestContext="sharing" />);
    await fillCredentialsAndSubmit(user);
    await completeClaim(user);

    expect(await screen.findByText('commit failed')).toBeInTheDocument();
    expect(registerWalletOnChainMock).not.toHaveBeenCalled();
  });
});

describe('GuestClaimAccountModal — Step 1c best-effort degrades gracefully', () => {
  it('surfaces a skipped-record warning toast instead of throwing when the throwaway key is gone', async () => {
    getSessionKeyMock.mockResolvedValue(null); // throwaway key already GC'd from memory
    const user = userEvent.setup();
    render(
      <GuestClaimAccountModal
        isOpen
        onClose={() => {}}
        guestContext="record_request"
        pendingRecordIds={['rec-uploaded-1']}
      />
    );
    await fillCredentialsAndSubmit(user);
    await completeClaim(user);

    await waitFor(() => expect(batchCommitMock).toHaveBeenCalled());
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("1 uploaded record couldn't be secured"),
      expect.anything()
    );
  });
});

describe('GuestClaimAccountModal — call order: password update -> sign in -> refresh', () => {
  it('signs in with the custom token before refreshing the user, in that order', async () => {
    const user = userEvent.setup();
    render(<GuestClaimAccountModal isOpen onClose={() => {}} guestContext="sharing" />);
    await fillCredentialsAndSubmit(user);
    await completeClaim(user);

    await waitFor(() => expect(mockAuthContextState.refreshUser).toHaveBeenCalled());

    const passwordUpdateOrder = guestPasswordUpdateMock.mock.invocationCallOrder[0]!;
    const signInOrder = signInWithCustomTokenMock.mock.invocationCallOrder[0]!;
    const refreshOrder = (mockAuthContextState.refreshUser as any).mock.invocationCallOrder[0]!;

    expect(passwordUpdateOrder).toBeLessThan(signInOrder);
    expect(signInOrder).toBeLessThan(refreshOrder);
  });

  it('reaches the done step and clears in-memory guest keys on full success', async () => {
    const user = userEvent.setup();
    render(<GuestClaimAccountModal isOpen onClose={() => {}} guestContext="sharing" />);
    await fillCredentialsAndSubmit(user);
    await completeClaim(user);

    expect(await screen.findByText('Welcome to Belrose!')).toBeInTheDocument();
    expect(setGuestFileKeysMock).toHaveBeenCalledWith(new Map());
  });
});
