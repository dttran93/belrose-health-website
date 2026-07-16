// @vitest-environment jsdom
//
// src/features/Trustee/components/ui/__tests__/TrusteeActionDialog.test.tsx
//
// Tier 4 — TrusteeActionDialog, the Trustee feature's equivalent of SubjectActionDialog/
// PermissionActionDialog: fully presentational, phase/operationType-dispatched, "renders what
// it's given" testing approach. No service mocking needed — real UserCard, real TrustLevelBadge/
// TrustLevelSelector. Wrapped in MemoryRouter defensively (UserCard's menuType is always "none"
// here so UserMenu/useNavigate never actually mounts, but this matches the established pattern).

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TrusteeActionDialog } from '../TrusteeActionDialog';
import type { BelroseUserProfile } from '@/types/core';

type Props = React.ComponentProps<typeof TrusteeActionDialog>;

function makeUser(overrides: Partial<BelroseUserProfile> = {}): BelroseUserProfile {
  return { uid: 'target1', displayName: 'Target', ...overrides } as BelroseUserProfile;
}

function renderDialog(overrides: Partial<Props> = {}) {
  const callbacks = {
    onClose: vi.fn(),
    onConfirmInvite: vi.fn(),
    onConfirmAccept: vi.fn(),
    onConfirmDecline: vi.fn(),
    onConfirmRevoke: vi.fn(),
    onConfirmEditLevel: vi.fn(),
    onConfirmResign: vi.fn(),
    onConfirmStepDown: vi.fn(),
    setSelectedTrustLevel: vi.fn(),
  };

  const defaults: Props = {
    isOpen: true,
    phase: 'confirming',
    operationType: 'invite',
    error: null,
    targetUser: makeUser(),
    trustLevel: undefined,
    selectedTrustLevel: 'observer',
    submittedLabel: '',
    ...callbacks,
  };

  render(
    <MemoryRouter>
      <TrusteeActionDialog {...defaults} {...overrides} />
    </MemoryRouter>
  );
  return callbacks;
}

describe('TrusteeActionDialog phase dispatch', () => {
  it('renders nothing when isOpen is false', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByText('Invite Trustee')).not.toBeInTheDocument();
  });

  it('shows the preparing phase content', () => {
    renderDialog({ phase: 'preparing' });
    expect(screen.getByText('Preparing Distributed Network')).toBeInTheDocument();
  });

  it('shows the executing phase content for decline', () => {
    renderDialog({ phase: 'executing', operationType: 'decline' });
    expect(screen.getByText('Declining invite...')).toBeInTheDocument();
  });

  it('shows the error phase content, and Close calls onClose', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({ phase: 'error', error: 'Something broke' });

    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a generic error message when none is given', () => {
    renderDialog({ phase: 'error', error: null });
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
  });

  it('shows the submitted phase with the given label', () => {
    renderDialog({ phase: 'submitted', submittedLabel: 'Inviting Target as trustee' });
    expect(screen.getByText('Inviting Target as trustee')).toBeInTheDocument();
  });
});

describe('ConfirmInviteContent', () => {
  it('shows the target user and lets the caller pick a trust level, then confirms', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({ operationType: 'invite', selectedTrustLevel: 'observer' });

    expect(screen.getByText('Invite Trustee')).toBeInTheDocument();
    expect(screen.getAllByText('Target').length).toBeGreaterThan(0);
    expect(screen.getByText('Custodian')).toBeInTheDocument();
    expect(screen.getByText('Controller')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Controller/i }));
    expect(callbacks.setSelectedTrustLevel).toHaveBeenCalledWith('controller');

    await user.click(screen.getByRole('button', { name: 'Send Invite' }));
    expect(callbacks.onConfirmInvite).toHaveBeenCalledTimes(1);
  });

  it('closes via Cancel', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({ operationType: 'invite' });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    // Fires twice: once from the Button's own onClick, once from Radix AlertDialog.Cancel's
    // built-in close (open -> false) triggering the Root's onOpenChange, which also calls onClose
    // since canClose is true in the confirming phase.
    expect(callbacks.onClose).toHaveBeenCalledTimes(2);
  });
});

describe('ConfirmAcceptContent', () => {
  it('shows the trustor and offered level, then accepts', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({ operationType: 'accept', trustLevel: 'custodian' });

    expect(screen.getByText('Accept Trustee Invite')).toBeInTheDocument();
    expect(screen.getByText('Custodian')).toBeInTheDocument();
    expect(screen.getByText(/Can manage your records up to your own role level/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(callbacks.onConfirmAccept).toHaveBeenCalledTimes(1);
  });

  it('falls back to a generic Shield icon and shows no level panel when trustLevel is absent', () => {
    renderDialog({ operationType: 'accept', trustLevel: undefined });
    expect(screen.queryByText('Your trust level')).not.toBeInTheDocument();
  });
});

describe('ConfirmDeclineContent', () => {
  it('shows the offered level badge and declines', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({ operationType: 'decline', trustLevel: 'observer' });

    expect(screen.getByText('Decline Trustee Invite')).toBeInTheDocument();
    expect(screen.getByText('Observer')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Decline Invite' }));
    expect(callbacks.onConfirmDecline).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmRevokeContent (combined update/revoke dialog)', () => {
  it('disables "Change Level" when the selection matches the current level', () => {
    renderDialog({ operationType: 'revoke', trustLevel: 'custodian', selectedTrustLevel: 'custodian' });
    expect(screen.getByRole('button', { name: 'Change Level' })).toBeDisabled();
  });

  it('calls onConfirmEditLevel via "Change Level" once a different level is selected', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({
      operationType: 'revoke',
      trustLevel: 'custodian',
      selectedTrustLevel: 'controller',
    });

    await user.click(screen.getByRole('button', { name: 'Change Level' }));
    expect(callbacks.onConfirmEditLevel).toHaveBeenCalledTimes(1);
  });

  it('marks the current level as disabled/"Current" in the selector', () => {
    renderDialog({ operationType: 'revoke', trustLevel: 'custodian', selectedTrustLevel: 'custodian' });
    expect(screen.getByRole('radio', { name: /Custodian/i })).toBeDisabled();
  });

  it('calls onConfirmRevoke via "Fully Revoke Access"', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({ operationType: 'revoke', trustLevel: 'observer' });

    await user.click(screen.getByRole('button', { name: 'Fully Revoke Access' }));
    expect(callbacks.onConfirmRevoke).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmEditLevelContent', () => {
  it('disables "Update Level" when the selection matches the current level', () => {
    renderDialog({ operationType: 'editLevel', trustLevel: 'observer', selectedTrustLevel: 'observer' });
    expect(screen.getByRole('button', { name: 'Update Level' })).toBeDisabled();
  });

  it('calls onConfirmEditLevel via "Update Level" once a different level is selected', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({
      operationType: 'editLevel',
      trustLevel: 'observer',
      selectedTrustLevel: 'controller',
    });

    await user.click(screen.getByRole('button', { name: 'Update Level' }));
    expect(callbacks.onConfirmEditLevel).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmResignContent', () => {
  it('offers step-down (restricted to lower levels) plus a separate "Fully Resign" button when not at observer', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({
      operationType: 'resign',
      trustLevel: 'controller',
      selectedTrustLevel: 'custodian',
    });

    expect(screen.getByText('Step down to a lower level')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Observer/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Custodian/i })).toBeInTheDocument();
    // Controller is the current level — not offered as a step-down target.
    expect(screen.queryByRole('radio', { name: /Controller/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Step Down' }));
    expect(callbacks.onConfirmStepDown).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Fully Resign' }));
    expect(callbacks.onConfirmResign).toHaveBeenCalledTimes(1);
  });

  it('offers only a plain Resign button (no step-down option) when already at observer', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({ operationType: 'resign', trustLevel: 'observer' });

    expect(screen.queryByText('Step down to a lower level')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fully Resign' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resign' }));
    expect(callbacks.onConfirmResign).toHaveBeenCalledTimes(1);
  });

  it('Cancel from the observer-level (no-step-down) layout calls onClose', async () => {
    const user = userEvent.setup();
    const callbacks = renderDialog({ operationType: 'resign', trustLevel: 'observer' });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    // See the "closes via Cancel" test above for why this fires twice.
    expect(callbacks.onClose).toHaveBeenCalledTimes(2);
  });
});
