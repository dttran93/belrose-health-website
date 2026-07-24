// @vitest-environment jsdom
//
// src/features/Dependents/components/__tests__/RemoveDialog.test.tsx
//
// RemoveDialog is now revoke-only regardless of isDependent/handoffInitiatedAt — full account
// deletion for an unclaimed dependent is handled by SwitchAndDeleteDialog instead, which routes
// through the dependent's own session so on-chain trustee revocation can actually succeed (see
// SwitchAndDeleteDialog.test.tsx). DependentsSettingsPage's menu item still decides which of the
// two dialogs to open based on isDependent/handoffInitiatedAt (see DependentsSettingsPage.test.tsx).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RemoveDialog from '../RemoveDialog';
import type { DependentEntry } from '../DependentsSettingsPage';

const { resignAsTrusteeMock } = vi.hoisted(() => ({ resignAsTrusteeMock: vi.fn(async () => undefined) }));

vi.mock('@/features/Trustee/services/trusteeRelationshipService', () => ({
  TrusteeRelationshipService: { resignAsTrustee: resignAsTrusteeMock },
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

describe('RemoveDialog — always revoke-only, regardless of isDependent/handoffInitiatedAt', () => {
  it('shows revoke-access copy for an unclaimed dependent with no handoff sent', () => {
    render(
      <RemoveDialog
        dependent={fakeEntry({ isDependent: true, handoffInitiatedAt: undefined })}
        onClose={() => {}}
        onRemoved={() => {}}
      />
    );
    expect(screen.getByText('Remove Guardian Access')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Access' })).toBeInTheDocument();
  });

  it('shows revoke-access copy for a claimed dependent', () => {
    render(
      <RemoveDialog
        dependent={fakeEntry({ isDependent: false, handoffInitiatedAt: undefined })}
        onClose={() => {}}
        onRemoved={() => {}}
      />
    );
    expect(screen.getByText('Remove Guardian Access')).toBeInTheDocument();
  });
});

describe('RemoveDialog — confirm/cancel/failure', () => {
  it('confirms removal: calls the service with trustorId, shows the revoke-toast, and calls onRemoved/onClose', async () => {
    const onClose = vi.fn();
    const onRemoved = vi.fn();
    const user = userEvent.setup();
    render(
      <RemoveDialog dependent={fakeEntry()} onClose={onClose} onRemoved={onRemoved} />
    );

    await user.click(screen.getByRole('button', { name: 'Remove Access' }));

    expect(resignAsTrusteeMock).toHaveBeenCalledWith('dep-1');
    expect(toast.success).toHaveBeenCalledWith('Guardian access removed.');
    expect(onRemoved).toHaveBeenCalledWith('dep-1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast and re-enables the button on failure, without closing', async () => {
    resignAsTrusteeMock.mockRejectedValueOnce(new Error('server exploded'));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RemoveDialog dependent={fakeEntry()} onClose={onClose} onRemoved={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Remove Access' }));

    expect(toast.error).toHaveBeenCalledWith('server exploded');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remove Access' })).not.toBeDisabled();
  });

  it('cancel calls onClose without invoking the service', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RemoveDialog dependent={fakeEntry()} onClose={onClose} onRemoved={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(resignAsTrusteeMock).not.toHaveBeenCalled();
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
