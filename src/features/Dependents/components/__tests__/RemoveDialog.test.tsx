// @vitest-environment jsdom
//
// src/features/Dependents/components/__tests__/RemoveDialog.test.tsx
//
// RemoveDialog's willDelete = isDependent && !handoffInitiatedAt condition is the one that
// DependentsSettingsPage's own remove-menu-item label was found to drift from (bug fix — see
// DependentsSettingsPage.test.tsx, which pins that the two now agree across all 4
// combinations). This file exercises willDelete's own 4 combinations directly against the
// dialog's title/description/button copy, plus the confirm/cancel/failure flows.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RemoveDialog from '../RemoveDialog';
import type { DependentEntry } from '../DependentsSettingsPage';

const { removeDependentMock } = vi.hoisted(() => ({ removeDependentMock: vi.fn(async () => undefined) }));

vi.mock('../../services/dependentManagementService', () => ({
  DependentManagementService: { removeDependent: removeDependentMock },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';

function fakeEntry(profileOverrides: Record<string, unknown> = {}): DependentEntry {
  return {
    relationship: { trustorId: 'dep-1', trusteeId: 'guardian-1' } as any,
    profile: { uid: 'dep-1', displayName: 'Jane Dependent', ...profileOverrides } as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RemoveDialog — willDelete across all 4 isDependent x handoffInitiatedAt combinations', () => {
  it('unclaimed + no handoff sent -> willDelete: shows delete copy', () => {
    render(
      <RemoveDialog
        dependent={fakeEntry({ isDependent: true, handoffInitiatedAt: undefined })}
        onClose={() => {}}
        onRemoved={() => {}}
      />
    );
    expect(screen.getByText('Delete Dependent Account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument();
  });

  it('unclaimed + handoff already sent -> not willDelete: shows revoke-access copy', () => {
    render(
      <RemoveDialog
        dependent={fakeEntry({ isDependent: true, handoffInitiatedAt: '2026-01-01T00:00:00Z' })}
        onClose={() => {}}
        onRemoved={() => {}}
      />
    );
    expect(screen.getByText('Remove Guardian Access')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Access' })).toBeInTheDocument();
  });

  it('claimed + no handoff sent -> not willDelete: shows revoke-access copy', () => {
    render(
      <RemoveDialog
        dependent={fakeEntry({ isDependent: false, handoffInitiatedAt: undefined })}
        onClose={() => {}}
        onRemoved={() => {}}
      />
    );
    expect(screen.getByText('Remove Guardian Access')).toBeInTheDocument();
  });

  it('claimed + handoff sent -> not willDelete: shows revoke-access copy', () => {
    render(
      <RemoveDialog
        dependent={fakeEntry({ isDependent: false, handoffInitiatedAt: '2026-01-01T00:00:00Z' })}
        onClose={() => {}}
        onRemoved={() => {}}
      />
    );
    expect(screen.getByText('Remove Guardian Access')).toBeInTheDocument();
  });
});

describe('RemoveDialog — confirm/cancel/failure', () => {
  it('confirms removal: calls the service with trustorId, shows the delete-toast, and calls onRemoved/onClose', async () => {
    const onClose = vi.fn();
    const onRemoved = vi.fn();
    const user = userEvent.setup();
    render(
      <RemoveDialog
        dependent={fakeEntry({ isDependent: true })}
        onClose={onClose}
        onRemoved={onRemoved}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    expect(removeDependentMock).toHaveBeenCalledWith('dep-1');
    expect(toast.success).toHaveBeenCalledWith("Jane Dependent's account has been deleted.");
    expect(onRemoved).toHaveBeenCalledWith('dep-1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the revoke-toast (not delete-toast) when willDelete is false', async () => {
    const user = userEvent.setup();
    render(
      <RemoveDialog dependent={fakeEntry({ isDependent: false })} onClose={() => {}} onRemoved={() => {}} />
    );

    await user.click(screen.getByRole('button', { name: 'Remove Access' }));

    expect(toast.success).toHaveBeenCalledWith('Guardian access removed.');
  });

  it('shows an error toast and re-enables the button on failure, without closing', async () => {
    removeDependentMock.mockRejectedValueOnce(new Error('server exploded'));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <RemoveDialog dependent={fakeEntry({ isDependent: true })} onClose={onClose} onRemoved={() => {}} />
    );

    await user.click(screen.getByRole('button', { name: 'Delete Account' }));

    expect(toast.error).toHaveBeenCalledWith('server exploded');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete Account' })).not.toBeDisabled();
  });

  it('cancel calls onClose without invoking the service', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <RemoveDialog dependent={fakeEntry({ isDependent: true })} onClose={onClose} onRemoved={() => {}} />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(removeDependentMock).not.toHaveBeenCalled();
  });

  it('falls back to "this account" when the profile has no displayName', () => {
    render(
      <RemoveDialog
        dependent={{ relationship: { trustorId: 'dep-1' } as any, profile: null }}
        onClose={() => {}}
        onRemoved={() => {}}
      />
    );
    expect(screen.getByText(/this account/)).toBeInTheDocument();
  });
});
