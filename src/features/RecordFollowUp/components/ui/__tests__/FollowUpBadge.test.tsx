// @vitest-environment jsdom
//
// src/features/RecordFollowUp/components/ui/__tests__/FollowUpBadge.test.tsx
//
// Tier 4 — renders the real component. Covers the loading/empty null states, the singular vs
// plural label, and the onClick wiring.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { User } from 'lucide-react';
import { FollowUpBadge } from '../FollowUpBadge';
import type { FollowUpItem } from '../FollowUpItems';

function makeItem(overrides: Partial<FollowUpItem> = {}): FollowUpItem {
  return {
    id: 'subject',
    label: 'Tag a subject',
    icon: User,
    status: 'pending',
    ctaLabel: 'Send request',
    onAction: vi.fn(),
    ...overrides,
  };
}

describe('FollowUpBadge', () => {
  it('shows a loading indicator while isLoading is true, regardless of item count', () => {
    render(<FollowUpBadge followUpItems={[makeItem()]} isLoading={true} onClick={vi.fn()} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText(/Follow-Up/)).not.toBeInTheDocument();
  });

  it('renders nothing when there are no outstanding items and not loading', () => {
    const { container } = render(<FollowUpBadge followUpItems={[]} isLoading={false} onClick={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('uses singular phrasing for exactly one item', () => {
    render(<FollowUpBadge followUpItems={[makeItem()]} isLoading={false} onClick={vi.fn()} />);
    expect(screen.getByText('1 Follow-Up')).toBeInTheDocument();
  });

  it('uses plural phrasing for more than one item', () => {
    render(
      <FollowUpBadge
        followUpItems={[makeItem({ id: 'subject' }), makeItem({ id: 'verify' })]}
        isLoading={false}
        onClick={vi.fn()}
      />
    );
    expect(screen.getByText('2 Follow-Ups')).toBeInTheDocument();
  });

  it('calls onClick when the badge is clicked', async () => {
    const onClick = vi.fn();
    render(<FollowUpBadge followUpItems={[makeItem()]} isLoading={false} onClick={onClick} />);

    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
