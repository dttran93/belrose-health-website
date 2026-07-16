// @vitest-environment jsdom
//
// src/features/Trustee/components/ui/__tests__/TrusteeLevelBadge.test.tsx
//
// Tier 4 — TrustLevelBadge (the shared, exported badge in TrusteeLevelBadge.tsx). Trivial
// presentational component: renders the right label/icon per TrustLevel, no state, no mocking.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrustLevelBadge } from '../TrusteeLevelBadge';

describe('TrustLevelBadge', () => {
  it('renders the Observer label', () => {
    render(<TrustLevelBadge level="observer" />);
    expect(screen.getByText('Observer')).toBeInTheDocument();
  });

  it('renders the Custodian label', () => {
    render(<TrustLevelBadge level="custodian" />);
    expect(screen.getByText('Custodian')).toBeInTheDocument();
  });

  it('renders the Controller label', () => {
    render(<TrustLevelBadge level="controller" />);
    expect(screen.getByText('Controller')).toBeInTheDocument();
  });

  it('renders a distinct label per level within the same document', () => {
    const { rerender } = render(<TrustLevelBadge level="observer" />);
    expect(screen.queryByText('Controller')).not.toBeInTheDocument();

    rerender(<TrustLevelBadge level="controller" />);
    expect(screen.queryByText('Observer')).not.toBeInTheDocument();
    expect(screen.getByText('Controller')).toBeInTheDocument();
  });
});
