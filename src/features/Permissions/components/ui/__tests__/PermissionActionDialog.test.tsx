// @vitest-environment jsdom
//
// src/features/Permissions/components/ui/__tests__/PermissionActionDialog.test.tsx
//
// Tests what actually RENDERS given a phase/operationType/role/eligibility combination —
// complementary to usePermissionFlow.test.tsx, which tests the state transitions that
// *produce* these props in the first place. ConfirmRevokeContent gets the most attention
// here since its per-role button visibility is the exact UI surface the owner-self-demote
// bug (this session's original incident) lived behind. No services here at all — this
// component and its sub-content are fully presentational — so nothing needs vi.mock.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PermissionActionDialog } from '../PermissionActionDialog';
import type { BelroseUserProfile } from '@/types/core';
import type { RoleEligibility } from '../RoleSelector';
import type { Role } from '@/features/Permissions/services/permissionsService';

type Props = React.ComponentProps<typeof PermissionActionDialog>;

function makeUser(overrides: Partial<BelroseUserProfile> = {}): BelroseUserProfile {
  return { uid: 'target1', displayName: 'Target User', ...overrides } as BelroseUserProfile;
}

function renderDialog(overrides: Partial<Props> = {}) {
  const onClose = vi.fn();
  const onConfirmGrant = vi.fn();
  const onConfirmRevoke = vi.fn();
  const onConfirmModify = vi.fn();

  const defaults: Props = {
    isOpen: true,
    phase: 'confirming',
    operationType: 'grant',
    role: 'viewer',
    user: makeUser(),
    onClose,
    onConfirmGrant,
    onConfirmRevoke,
    onConfirmModify,
    submittedLabel: '',
  };

  render(
    <MemoryRouter>
      <PermissionActionDialog {...defaults} {...overrides} />
    </MemoryRouter>
  );
  return { onClose, onConfirmGrant, onConfirmRevoke, onConfirmModify };
}

describe('PermissionActionDialog phase dispatch', () => {
  it('renders nothing when isOpen is false', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows ErrorContent on phase "error", and Close calls onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({ phase: 'error', error: 'Transaction reverted' });

    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    expect(screen.getByText('Transaction reverted')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows ConfirmGrantContent for grant + confirm variant', () => {
    renderDialog({ phase: 'confirming', operationType: 'grant', grantVariant: 'confirm' });
    expect(screen.getByText('Confirm Access Grant')).toBeInTheDocument();
  });

  it('shows SelectRoleGrantContent for grant + select-role variant', () => {
    renderDialog({ phase: 'confirming', operationType: 'grant', grantVariant: 'select-role' });
    expect(screen.getByText('Grant Encrypted Access')).toBeInTheDocument();
  });

  it('shows ConfirmRevokeContent for revoke', () => {
    renderDialog({ phase: 'confirming', operationType: 'revoke' });
    expect(screen.getByText('Revoke Access?')).toBeInTheDocument();
  });

  it('shows ModifyAccessContent for modify (when onConfirmModify is provided)', () => {
    renderDialog({ phase: 'confirming', operationType: 'modify' });
    expect(screen.getByText('Modify Access')).toBeInTheDocument();
  });

  it('shows the submitted content with the given label on phase "submitted"', () => {
    renderDialog({ phase: 'submitted', submittedLabel: 'Granting Viewer access' });
    expect(screen.getByText('Granting Viewer access')).toBeInTheDocument();
  });
});

describe('ConfirmGrantContent', () => {
  it('confirms with the given role and cancels via onClose', async () => {
    const user = userEvent.setup();
    const { onConfirmGrant, onClose } = renderDialog({
      phase: 'confirming',
      operationType: 'grant',
      grantVariant: 'confirm',
      role: 'sharer',
    });

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirmGrant).toHaveBeenCalledWith('sharer');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmRevokeContent — per-role button visibility', () => {
  it('owner: shows all three demote options plus full revocation, and the self-removal note', () => {
    renderDialog({ phase: 'confirming', operationType: 'revoke', role: 'owner' });

    expect(screen.getByText('Owners can only be removed by themselves.', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Demote to Administrator')).toBeInTheDocument();
    expect(screen.getByText('Demote to Sharer')).toBeInTheDocument();
    expect(screen.getByText('Demote to Viewer')).toBeInTheDocument();
    expect(screen.getByText('Full Revocation')).toBeInTheDocument();
  });

  it('administrator: shows demote-to-sharer/viewer and full revocation, but not demote-to-administrator', () => {
    renderDialog({ phase: 'confirming', operationType: 'revoke', role: 'administrator' });

    expect(screen.queryByText('Demote to Administrator')).not.toBeInTheDocument();
    expect(screen.getByText('Demote to Sharer')).toBeInTheDocument();
    expect(screen.getByText('Demote to Viewer')).toBeInTheDocument();
    expect(screen.getByText('Full Revocation')).toBeInTheDocument();
  });

  it('sharer: shows only demote-to-viewer and full revocation', () => {
    renderDialog({ phase: 'confirming', operationType: 'revoke', role: 'sharer' });

    expect(screen.queryByText('Demote to Administrator')).not.toBeInTheDocument();
    expect(screen.queryByText('Demote to Sharer')).not.toBeInTheDocument();
    expect(screen.getByText('Demote to Viewer')).toBeInTheDocument();
    expect(screen.getByText('Full Revocation')).toBeInTheDocument();
  });

  it('viewer: shows only full revocation — no demote options, since viewer is the floor', () => {
    renderDialog({ phase: 'confirming', operationType: 'revoke', role: 'viewer' });

    expect(screen.queryByText('Demote to Administrator')).not.toBeInTheDocument();
    expect(screen.queryByText('Demote to Sharer')).not.toBeInTheDocument();
    expect(screen.queryByText('Demote to Viewer')).not.toBeInTheDocument();
    expect(screen.getByText('Full Revocation')).toBeInTheDocument();
  });

  it('calls onConfirmRevoke("demote-admin") when an owner is demoted — the exact action behind this session\'s original bug', async () => {
    const user = userEvent.setup();
    const { onConfirmRevoke } = renderDialog({
      phase: 'confirming',
      operationType: 'revoke',
      role: 'owner',
    });

    await user.click(screen.getByText('Demote to Administrator'));

    expect(onConfirmRevoke).toHaveBeenCalledWith('demote-admin');
  });

  it('disables an option the caller is not eligible for, and blocks the click', async () => {
    const user = userEvent.setup();
    const eligibility: Record<Role, RoleEligibility> = {
      viewer: { enabled: false, reason: 'Only the record owner can remove another administrator' },
      sharer: { enabled: true },
      administrator: { enabled: true },
      owner: { enabled: true },
    };
    const { onConfirmRevoke } = renderDialog({
      phase: 'confirming',
      operationType: 'revoke',
      role: 'administrator',
      eligibility,
    });

    const demoteToViewerButton = screen.getByText('Demote to Viewer').closest('button')!;
    expect(demoteToViewerButton).toHaveAttribute('aria-disabled', 'true');

    await user.click(demoteToViewerButton);
    expect(onConfirmRevoke).not.toHaveBeenCalled();
  });

  it('shows a warning banner when every available option is disabled', () => {
    const disabledEligibility: RoleEligibility = { enabled: false, reason: 'no permission' };
    renderDialog({
      phase: 'confirming',
      operationType: 'revoke',
      role: 'sharer',
      canFullyRevoke: disabledEligibility,
      eligibility: {
        viewer: disabledEligibility,
        sharer: disabledEligibility,
        administrator: disabledEligibility,
        owner: disabledEligibility,
      },
    });

    expect(
      screen.getByText(/You don't have permission to change this user's access/)
    ).toBeInTheDocument();
  });
});

describe('ModifyAccessContent', () => {
  it('disables Continue when the selected role equals the current role', () => {
    renderDialog({ phase: 'confirming', operationType: 'modify', role: 'sharer' });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('advances to the confirm step and back, then confirms with the new role', async () => {
    const user = userEvent.setup();
    const { onConfirmModify } = renderDialog({
      phase: 'confirming',
      operationType: 'modify',
      role: 'sharer',
    });

    await user.click(screen.getByRole('radio', { name: /Viewer/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Confirm Access Change')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Modify Access')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Viewer/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirmModify).toHaveBeenCalledWith('viewer');
  });

  it('disables Continue when the selected role is ineligible', async () => {
    const user = userEvent.setup();
    renderDialog({
      phase: 'confirming',
      operationType: 'modify',
      role: 'sharer',
      eligibility: {
        viewer: { enabled: true },
        sharer: { enabled: true },
        administrator: { enabled: false, reason: 'not eligible' },
        owner: { enabled: false },
      },
    });

    await user.click(screen.getByRole('radio', { name: /Administrator/ }));

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
