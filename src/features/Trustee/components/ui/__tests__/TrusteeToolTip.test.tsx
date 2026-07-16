// @vitest-environment jsdom
//
// src/features/Trustee/components/ui/__tests__/TrusteeToolTip.test.tsx
//
// Tier 4 — TrusteeToolTip: a static Radix tooltip with no props/state. Confirms the trigger
// renders and that hovering/focusing reveals the explanatory content (real Radix, no mocking).

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrusteeToolTip } from '../TrusteeToolTip';

describe('TrusteeToolTip', () => {
  it('renders a trigger button', () => {
    render(<TrusteeToolTip />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('reveals the trust-level explanation when the trigger is focused/hovered', async () => {
    const user = userEvent.setup();
    render(<TrusteeToolTip />);

    await user.hover(screen.getByRole('button'));

    // Radix renders the tooltip content twice — once visible, once in a visually-hidden a11y
    // copy — so every query here must use the *AllBy* variant.
    expect((await screen.findAllByText(/three categories of trustees/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Observers have read-only access/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Custodians can manage your records/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Controllers have full access/i).length).toBeGreaterThan(0);
  });
});
