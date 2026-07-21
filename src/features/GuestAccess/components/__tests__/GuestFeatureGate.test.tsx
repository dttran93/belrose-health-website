// @vitest-environment jsdom
//
// src/features/GuestAccess/components/__tests__/GuestFeatureGate.test.tsx
//
// GuestClaimAccountModal is mocked here — it has its own dedicated, much larger test file
// (GuestClaimAccountModal.test.tsx). This file only checks GuestFeatureGate's own gating logic
// and that it wires isOpen/onClose to the modal correctly.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockUserState } = vi.hoisted(() => ({ mockUserState: { user: null as any } }));

vi.mock('@/features/Auth/AuthContext', () => ({
  useAuthContext: () => ({ user: mockUserState.user }),
}));

vi.mock('@/features/GuestAccess/components/GuestClaimAccountModal', () => ({
  GuestClaimAccountModal: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="claim-modal">{isOpen ? 'modal-open' : 'modal-closed'}</div>
  ),
}));

import { GuestFeatureGate } from '../GuestFeatureGate';

beforeEach(() => {
  mockUserState.user = null;
});

describe('GuestFeatureGate', () => {
  it('renders children directly when the user is not a guest', () => {
    mockUserState.user = { isGuest: false };
    render(
      <GuestFeatureGate featureName="adding records">
        <div>Protected Feature</div>
      </GuestFeatureGate>
    );

    expect(screen.getByText('Protected Feature')).toBeInTheDocument();
    expect(screen.queryByText('Create Free Account →')).not.toBeInTheDocument();
  });

  it('renders children directly when there is no user at all', () => {
    mockUserState.user = null;
    render(
      <GuestFeatureGate featureName="adding records">
        <div>Protected Feature</div>
      </GuestFeatureGate>
    );

    expect(screen.getByText('Protected Feature')).toBeInTheDocument();
  });

  it('shows the upsell gate (not children) for a guest, using the given featureName', () => {
    mockUserState.user = { isGuest: true };
    render(
      <GuestFeatureGate featureName="share records with guests">
        <div>Protected Feature</div>
      </GuestFeatureGate>
    );

    expect(screen.getByText('Create an account to share records with guests')).toBeInTheDocument();
    expect(screen.queryByText('Protected Feature')).not.toBeInTheDocument();
  });

  it('uses the default description when none is given', () => {
    mockUserState.user = { isGuest: true };
    render(<GuestFeatureGate featureName="adding records">{null}</GuestFeatureGate>);

    expect(
      screen.getByText(/This feature is available to registered Belrose users/)
    ).toBeInTheDocument();
  });

  it('uses a custom description when provided', () => {
    mockUserState.user = { isGuest: true };
    render(
      <GuestFeatureGate featureName="adding records" featureDescription="Custom explanation text">
        {null}
      </GuestFeatureGate>
    );

    expect(screen.getByText('Custom explanation text')).toBeInTheDocument();
  });

  it('opens the claim modal when "Create Free Account" is clicked', async () => {
    mockUserState.user = { isGuest: true };
    const user = userEvent.setup();
    render(<GuestFeatureGate featureName="adding records">{null}</GuestFeatureGate>);

    expect(screen.getByTestId('claim-modal')).toHaveTextContent('modal-closed');
    await user.click(screen.getByRole('button', { name: 'Create Free Account →' }));
    expect(screen.getByTestId('claim-modal')).toHaveTextContent('modal-open');
  });
});
