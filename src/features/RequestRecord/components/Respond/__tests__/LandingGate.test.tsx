// @vitest-environment jsdom
//
// src/features/RequestRecord/components/Respond/__tests__/LandingGate.test.tsx
//
// Tier 4 — primaryConfig is derived inline in the component (not exported), so this renders the
// real component and asserts on the rendered label/disabled-state/click-handler for each of the
// three states (already-logged-in / target-is-registered / new-provider), plus the
// signingIn/signingInGuest loading sub-states within the new-provider branch.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import LandingGate from '../LandingGate';
import type { RecordRequest } from '@belrose/shared';

function makeRequest(overrides: Partial<RecordRequest> = {}): RecordRequest {
  return {
    inviteCode: 'invite-1',
    requesterName: 'Jane Doe',
    createdAt: { seconds: 1700000000, nanoseconds: 0 },
    ...overrides,
  } as unknown as RecordRequest;
}

function renderGate(overrides: Partial<ComponentProps<typeof LandingGate>> = {}) {
  const props = {
    recordRequest: makeRequest(),
    isAlreadyLoggedIn: false,
    targetIsRegistered: false,
    signingIn: false,
    signingInGuest: false,
    onContinueWithAccount: vi.fn(),
    onContinueWithoutAccount: vi.fn(),
    onContinueAsExistingUser: vi.fn(),
    ...overrides,
  };
  render(<LandingGate {...props} />);
  return props;
}

describe('LandingGate — already logged in', () => {
  it('shows the existing-account CTA and hides the anonymous path', async () => {
    const props = renderGate({ isAlreadyLoggedIn: true });

    const button = screen.getByRole('button', { name: /Continue with your account/i });
    expect(button).toBeEnabled();
    expect(screen.queryByText(/Upload without an account/i)).not.toBeInTheDocument();

    await userEvent.click(button);
    expect(props.onContinueAsExistingUser).toHaveBeenCalledTimes(1);
  });
});

describe('LandingGate — target is registered but not signed in', () => {
  it('shows the sign-in CTA and hides the anonymous path', () => {
    renderGate({ isAlreadyLoggedIn: false, targetIsRegistered: true });

    expect(screen.getByRole('button', { name: /Sign in to your Belrose account/i })).toBeEnabled();
    expect(screen.queryByText(/Upload without an account/i)).not.toBeInTheDocument();
  });
});

describe('LandingGate — new provider', () => {
  it('shows the create-account CTA, the anonymous path, and the sign-in nudge', async () => {
    const props = renderGate();

    const createAccountButton = screen.getByRole('button', {
      name: /Create a free account & upload/i,
    });
    expect(createAccountButton).toBeEnabled();
    await userEvent.click(createAccountButton);
    expect(props.onContinueWithAccount).toHaveBeenCalledTimes(1);

    const anonymousButton = screen.getByRole('button', { name: /Upload without an account/i });
    expect(anonymousButton).toBeEnabled();
    await userEvent.click(anonymousButton);
    expect(props.onContinueWithoutAccount).toHaveBeenCalledTimes(1);

    expect(screen.getByText(/Already have a Belrose account\? Sign in/i)).toBeInTheDocument();
  });

  it('shows a spinner state and disables the primary button while signingIn', () => {
    renderGate({ signingIn: true });

    expect(screen.getByText('Setting up your account...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Setting up your account/i })).toBeDisabled();
  });

  it('shows a spinner state and disables the anonymous button while signingInGuest', () => {
    renderGate({ signingInGuest: true });

    expect(screen.getByText('Setting up session...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Setting up session/i })).toBeDisabled();
  });
});
