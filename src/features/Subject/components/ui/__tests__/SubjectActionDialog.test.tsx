// @vitest-environment jsdom
//
// src/features/Subject/components/ui/__tests__/SubjectActionDialog.test.tsx
//
// SubjectActionDialog is the Subject feature's equivalent of PermissionActionDialog — same
// "renders what's given" testing approach, much larger surface: 9 phase-content sub-components
// dispatched by phase/operationType/subjectChoice/isControllerOfSelected. No service mocking
// needed (fully presentational, calls whatever callback prop it's given) — only useAuthContext
// (needs real user data) and the two search child components (UserSearch/RequesterSuggestions,
// which pull in their own search backends) are mocked.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SubjectActionDialog } from '../SubjectActionDialog';
import type { BelroseUserProfile } from '@/types/core';
import type { FileObject } from '@/types/core';

vi.mock('@/features/Auth/AuthContext', () => ({
  useAuthContext: () => ({ user: { uid: 'caller1', displayName: 'Caller' } }),
}));

vi.mock('@/features/Users/components/UserSearch', () => ({
  default: ({ onUserSelect }: { onUserSelect: (u: BelroseUserProfile) => void }) => (
    <button onClick={() => onUserSelect({ uid: 'target1', displayName: 'Target' } as BelroseUserProfile)}>
      mock-user-search-select
    </button>
  ),
}));

vi.mock('@/features/RequestRecord/components/ui/RequesterSuggestions', () => ({
  default: () => <div>mock-requester-suggestions</div>,
}));

type Props = React.ComponentProps<typeof SubjectActionDialog>;

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'rec1',
    fileName: 'lab-results.pdf',
    owners: [],
    administrators: [],
    sharers: [],
    subjects: [],
    ...overrides,
  } as unknown as FileObject;
}

function makeUser(overrides: Partial<BelroseUserProfile> = {}): BelroseUserProfile {
  return { uid: 'target1', displayName: 'Target', ...overrides } as BelroseUserProfile;
}

function renderDialog(overrides: Partial<Props> = {}) {
  const callbacks = {
    onClose: vi.fn(),
    onProceedFromSelection: vi.fn(),
    onSelectUser: vi.fn(),
    onGoBackToSelection: vi.fn(),
    onGoBackToSearching: vi.fn(),
    onConfirmSetSubjectAsSelf: vi.fn(),
    onConfirmRequestConsent: vi.fn(),
    onConfirmAnchorSubjectAsController: vi.fn(),
    onConfirmAcceptRequest: vi.fn(),
    onConfirmRejectRequest: vi.fn(),
    onConfirmRemoveSubjectStatus: vi.fn(),
    setSubjectChoice: vi.fn(),
    setSelectedRole: vi.fn(),
    setSelectedUser: vi.fn(),
    setRevokeAccess: vi.fn(),
  };

  const defaults: Props = {
    isOpen: true,
    phase: 'selecting',
    operationType: 'setSubjectAsSelf',
    subjectChoice: 'self',
    selectedRole: 'sharer',
    selectedUser: null,
    revokeAccess: true,
    record: makeRecord(),
    currentSubjects: [],
    isSubject: false,
    isControllerOfSelected: false,
    controllerTrustorIds: new Set(),
    submittedLabel: '',
    ...callbacks,
  };

  render(
    <MemoryRouter>
      <SubjectActionDialog {...defaults} {...overrides} />
    </MemoryRouter>
  );
  return callbacks;
}

describe('SubjectActionDialog phase dispatch', () => {
  it('renders nothing when isOpen is false', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByText('Set Record Subject')).not.toBeInTheDocument();
  });

  it('shows the error phase content, and Close calls onClose', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({ phase: 'error', error: 'Something broke' });

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the executing phase with an operation-specific message', () => {
    renderDialog({ phase: 'executing', operationType: 'rejectSubjectStatus' });
    expect(screen.getByText('Removing your subject status...')).toBeInTheDocument();
  });

  it('shows the submitted phase with the given label', () => {
    renderDialog({ phase: 'submitted', submittedLabel: 'Linking you to this record...' });
    expect(screen.getByText('Linking you to this record...')).toBeInTheDocument();
  });
});

describe('SelectingContent', () => {
  it('shows both subject-choice options and filters roles for self by the minimum allowed role', () => {
    renderDialog({ record: makeRecord({ administrators: ['caller1'] }), subjectChoice: 'self' });

    expect(screen.getByText('This record is about me')).toBeInTheDocument();
    expect(screen.getByText('This record is about someone else')).toBeInTheDocument();
    // caller is already administrator, so Sharer (a lower tier) should be filtered out for "self"
    expect(screen.queryByText('Sharer')).not.toBeInTheDocument();
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('disables the self option and the Continue button when already a subject', () => {
    renderDialog({ isSubject: true, subjectChoice: 'self' });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('labels the proceed button "Search Users" for the other-person choice', () => {
    renderDialog({ subjectChoice: 'other' });
    expect(screen.getByRole('button', { name: 'Search Users' })).toBeInTheDocument();
  });

  it('calls onProceed when continuing', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({ subjectChoice: 'self' });

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(callbacks.onProceedFromSelection).toHaveBeenCalledTimes(1);
  });
});

describe('SearchingContent', () => {
  it('renders the search children and wires user selection through to onSelectUser', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({ phase: 'searching' });

    expect(screen.getByText('mock-requester-suggestions')).toBeInTheDocument();
    await user.click(screen.getByText('mock-user-search-select'));

    expect(callbacks.onSelectUser).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'target1' })
    );
  });

  it('calls onGoBackToSelection when Back is clicked', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({ phase: 'searching' });

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(callbacks.onGoBackToSelection).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmSetSubjectAsSelfContent', () => {
  it('shows the record and role, and confirms', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({
      phase: 'confirming',
      operationType: 'setSubjectAsSelf',
      selectedRole: 'owner',
    });

    expect(screen.getByText('Confirm Subject Status')).toBeInTheDocument();
    expect(screen.getByText('lab-results.pdf')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(callbacks.onConfirmSetSubjectAsSelf).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmRequestConsentContent (non-controller path)', () => {
  it('shows the selected user and sends the request with the default verification level', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({
      phase: 'confirming',
      operationType: 'requestSubjectConsent',
      subjectChoice: 'other',
      selectedUser: makeUser(),
      isControllerOfSelected: false,
    });

    expect(screen.getByText('Send Subject Request')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send Request' }));
    expect(callbacks.onConfirmRequestConsent).toHaveBeenCalledWith(1);
  });

  it('sends undefined verification level when "No verification" is selected', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({
      phase: 'confirming',
      subjectChoice: 'other',
      selectedUser: makeUser(),
      isControllerOfSelected: false,
    });

    await user.selectOptions(screen.getByRole('combobox'), '0');
    await user.click(screen.getByRole('button', { name: 'Send Request' }));

    expect(callbacks.onConfirmRequestConsent).toHaveBeenCalledWith(undefined);
  });
});

describe('ConfirmAnchorSubjectContent (controller path)', () => {
  it('shows the Controller badge and anchors directly, no consent request', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({
      phase: 'confirming',
      subjectChoice: 'other',
      selectedUser: makeUser(),
      isControllerOfSelected: true,
    });

    expect(screen.getByText('Anchor Subject as Controller')).toBeInTheDocument();
    expect(screen.getAllByText('Controller').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Anchor Subject' }));
    expect(callbacks.onConfirmAnchorSubjectAsController).toHaveBeenCalledTimes(1);
  });

  it('goes back to searching', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({
      phase: 'confirming',
      subjectChoice: 'other',
      selectedUser: makeUser(),
      isControllerOfSelected: true,
    });

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(callbacks.onGoBackToSearching).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmAcceptRequestContent', () => {
  it('accepts the subject request', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({
      phase: 'confirming',
      operationType: 'acceptSubjectRequest',
      selectedUser: null,
    });

    expect(screen.getByText('Accept Subject Request')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(callbacks.onConfirmAcceptRequest).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmRejectRequestContent', () => {
  it('does not confirm until a reason is chosen', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({
      phase: 'confirming',
      operationType: 'rejectSubjectRequest',
      selectedUser: null,
    });

    await user.click(screen.getByRole('button', { name: 'Decline Request' }));
    expect(callbacks.onConfirmRejectRequest).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByRole('combobox'), 'privacy');
    await user.click(screen.getByRole('button', { name: 'Decline Request' }));
    expect(callbacks.onConfirmRejectRequest).toHaveBeenCalledWith('privacy');
  });
});

describe('ConfirmRemoveSubjectStatusContent', () => {
  it('toggles the revoke-access checkbox and requires a reason before confirming', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({
      phase: 'confirming',
      operationType: 'rejectSubjectStatus',
      selectedUser: null,
      revokeAccess: true,
    });

    expect(screen.getByText(/Your access to this record will be revoked/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    expect(callbacks.setRevokeAccess).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole('button', { name: 'Remove Status' }));
    expect(callbacks.onConfirmRemoveSubjectStatus).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByRole('combobox'), 'other');
    await user.click(screen.getByRole('button', { name: 'Remove Status' }));
    expect(callbacks.onConfirmRemoveSubjectStatus).toHaveBeenCalledWith('other');
  });

  it('does not show the revoke-access warning line when revokeAccess is off', () => {
    renderDialog({
      phase: 'confirming',
      operationType: 'rejectSubjectStatus',
      selectedUser: null,
      revokeAccess: false,
    });

    expect(screen.queryByText('Your access to this record will be revoked')).not.toBeInTheDocument();
  });
});
