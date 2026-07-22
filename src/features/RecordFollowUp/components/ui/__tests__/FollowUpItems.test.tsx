// @vitest-environment jsdom
//
// src/features/RecordFollowUp/components/ui/__tests__/FollowUpItems.test.tsx
//
// Tier 4 — renders the real component. Covers the empty-list null render, pending-vs-done row
// styling/content swap (subtext vs doneSubtext, CTA button vs done-check), and the CTA click
// wiring.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { User } from 'lucide-react';
import { FollowUpItems, type FollowUpItem } from '../FollowUpItems';

function makeItem(overrides: Partial<FollowUpItem> = {}): FollowUpItem {
  return {
    id: 'subject',
    label: 'Tag a subject',
    subtext: 'A subject has not been set.',
    icon: User,
    status: 'pending',
    ctaLabel: 'Send request',
    onAction: vi.fn(),
    ...overrides,
  };
}

describe('FollowUpItems', () => {
  it('renders nothing when there are no items', () => {
    const { container } = render(<FollowUpItems items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a row with label, subtext, and a CTA button for a pending item', async () => {
    const onAction = vi.fn();
    render(<FollowUpItems items={[makeItem({ onAction })]} />);

    expect(screen.getByText('Tag a subject')).toBeInTheDocument();
    expect(screen.getByText('A subject has not been set.')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Send request' });
    await userEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('shows doneSubtext instead of subtext, and no CTA button, for a done item', () => {
    render(
      <FollowUpItems
        items={[
          makeItem({
            status: 'done',
            subtext: 'Not shown',
            doneSubtext: 'Jane Doe · request sent',
          }),
        ]}
      />
    );

    expect(screen.getByText('Jane Doe · request sent')).toBeInTheDocument();
    expect(screen.queryByText('Not shown')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows no subtext paragraph for a done item with no doneSubtext', () => {
    render(<FollowUpItems items={[makeItem({ status: 'done', subtext: 'Original subtext', doneSubtext: undefined })]} />);
    expect(screen.queryByText('Original subtext')).not.toBeInTheDocument();
  });

  it('renders one row per item, in order', () => {
    render(
      <FollowUpItems
        items={[
          makeItem({ id: 'subject', label: 'Tag a subject' }),
          makeItem({ id: 'verify', label: 'Verify this record' }),
        ]}
      />
    );

    const labels = screen.getAllByText(/Tag a subject|Verify this record/).map(el => el.textContent);
    expect(labels).toEqual(['Tag a subject', 'Verify this record']);
  });
});
