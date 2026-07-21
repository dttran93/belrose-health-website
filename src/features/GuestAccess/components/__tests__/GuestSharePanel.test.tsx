// @vitest-environment jsdom
//
// src/features/GuestAccess/components/__tests__/GuestSharePanel.test.tsx
//
// PermissionActionDialog/RecordPicker/GuestFeatureGate are mocked to minimal stand-ins — each
// has its own dedicated test coverage elsewhere; this file isolates GuestSharePanel's own
// logic: the createGuestInvite CF call and the best-effort post-invite encryption-grant step.
// The partial-failure test (CF succeeds, the grant step throws) pins documented behavior: the
// grant step is wrapped in its own try/catch specifically so a failure there doesn't surface as
// an "invite failed" error, since the guest account and email were already sent in step 1.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const {
  httpsCallableMock,
  createGuestInviteMock,
  getShareableRecordsMock,
  decryptRecordsMock,
  grantEncryptionAccessMock,
  updateDocMock,
} = vi.hoisted(() => ({
  httpsCallableMock: vi.fn(),
  createGuestInviteMock: vi.fn(),
  getShareableRecordsMock: vi.fn(async (): Promise<any[]> => []),
  decryptRecordsMock: vi.fn(async (records: any[]) => records),
  grantEncryptionAccessMock: vi.fn(async () => undefined),
  updateDocMock: vi.fn(async () => undefined),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: httpsCallableMock,
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: 'patient-1' } })),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  updateDoc: updateDocMock,
  arrayUnion: vi.fn((...vals: unknown[]) => ({ arrayUnion: vals })),
}));

vi.mock('@/features/Sharing/services/sharingService', () => ({
  SharingService: { grantEncryptionAccess: grantEncryptionAccessMock },
}));

vi.mock('../../services/guestShareableRecords', () => ({
  getShareableRecords: getShareableRecordsMock,
}));

vi.mock('@/features/Encryption/services/recordDecryptionService', () => ({
  RecordDecryptionService: { decryptRecords: decryptRecordsMock },
}));

vi.mock('../GuestFeatureGate', () => ({
  GuestFeatureGate: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/features/Ai/components/ui/RecordPicker', () => ({ RecordPicker: () => null }));

vi.mock('@/features/Permissions/components/ui/PermissionActionDialog', () => ({
  PermissionActionDialog: ({ isOpen, phase, error, onConfirmGuestInvite, guestInviteProps }: any) =>
    isOpen ? (
      <div>
        <span data-testid="phase">{phase}</span>
        {error && <span data-testid="error">{error}</span>}
        <input
          aria-label="guest-email"
          value={guestInviteProps.email}
          onChange={(e: any) => guestInviteProps.setEmail(e.target.value)}
        />
        <button onClick={onConfirmGuestInvite}>Confirm Invite</button>
      </div>
    ) : null,
}));

import { GuestSharePanel } from '../GuestSharePanel';

const RECORD = { id: 'rec-1', title: 'A Record' } as any;

beforeEach(() => {
  vi.clearAllMocks();
  httpsCallableMock.mockReturnValue(createGuestInviteMock);
  createGuestInviteMock.mockResolvedValue({ data: { guestUid: 'guest-1' } });
  getShareableRecordsMock.mockResolvedValue([RECORD]);
  decryptRecordsMock.mockImplementation(async (records: any[]) => records);
  grantEncryptionAccessMock.mockResolvedValue(undefined);
  updateDocMock.mockResolvedValue(undefined);
});

async function openAndFillEmail(user: ReturnType<typeof userEvent.setup>, email = 'doc@example.com') {
  await user.click(screen.getByRole('button', { name: /Share via Email/ }));
  await screen.findByLabelText('guest-email');
  await user.type(screen.getByLabelText('guest-email'), email);
}

describe('GuestSharePanel — opening', () => {
  it('fetches and decrypts shareable records when opened', async () => {
    const user = userEvent.setup();
    render(<GuestSharePanel record={RECORD} patientName="Jane Patient" />);

    await user.click(screen.getByRole('button', { name: /Share via Email/ }));

    expect(getShareableRecordsMock).toHaveBeenCalledWith('patient-1');
    expect(decryptRecordsMock).toHaveBeenCalled();
  });
});

describe('GuestSharePanel — confirm invite', () => {
  it('calls createGuestInvite with the selected record ids and duration', async () => {
    const user = userEvent.setup();
    render(<GuestSharePanel record={RECORD} patientName="Jane Patient" />);
    await openAndFillEmail(user);

    await user.click(screen.getByRole('button', { name: 'Confirm Invite' }));

    expect(createGuestInviteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        guestEmail: 'doc@example.com',
        recordIds: ['rec-1'],
        patientName: 'Jane Patient',
        durationSeconds: 604800, // 7 days default
      })
    );
  });

  it('grants encryption access and adds the guest as a viewer after a successful invite', async () => {
    const user = userEvent.setup();
    render(<GuestSharePanel record={RECORD} patientName="Jane Patient" />);
    await openAndFillEmail(user);
    await user.click(screen.getByRole('button', { name: 'Confirm Invite' }));

    expect(grantEncryptionAccessMock).toHaveBeenCalledWith(
      'rec-1',
      'guest-1',
      'patient-1',
      expect.objectContaining({ isGuest: true })
    );
    expect(updateDocMock).toHaveBeenCalled();
  });

  it('closes the dialog and calls onSuccess after a successful invite', async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<GuestSharePanel record={RECORD} patientName="Jane Patient" onSuccess={onSuccess} />);
    await openAndFillEmail(user);
    await user.click(screen.getByRole('button', { name: 'Confirm Invite' }));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('phase')).not.toBeInTheDocument(); // dialog closed
  });

  it('PARTIAL FAILURE: still succeeds (closes + onSuccess) when the post-invite grant step throws', async () => {
    grantEncryptionAccessMock.mockRejectedValue(new Error('grant failed'));
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<GuestSharePanel record={RECORD} patientName="Jane Patient" onSuccess={onSuccess} />);
    await openAndFillEmail(user);
    await user.click(screen.getByRole('button', { name: 'Confirm Invite' }));

    // The guest invite itself succeeded (CF call went through) — the grant failure is swallowed.
    expect(createGuestInviteMock).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('shows an error and does not call onSuccess when the CF call itself fails', async () => {
    createGuestInviteMock.mockRejectedValue(new Error('invite failed'));
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<GuestSharePanel record={RECORD} patientName="Jane Patient" onSuccess={onSuccess} />);
    await openAndFillEmail(user);
    await user.click(screen.getByRole('button', { name: 'Confirm Invite' }));

    expect(await screen.findByTestId('error')).toHaveTextContent('invite failed');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(grantEncryptionAccessMock).not.toHaveBeenCalled();
  });

  it('does not call createGuestInvite when no email is entered', async () => {
    const user = userEvent.setup();
    render(<GuestSharePanel record={RECORD} patientName="Jane Patient" />);
    await user.click(screen.getByRole('button', { name: /Share via Email/ }));
    await screen.findByLabelText('guest-email');

    await user.click(screen.getByRole('button', { name: 'Confirm Invite' }));

    expect(createGuestInviteMock).not.toHaveBeenCalled();
  });
});
