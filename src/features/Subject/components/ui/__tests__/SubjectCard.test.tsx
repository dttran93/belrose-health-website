// @vitest-environment jsdom
//
// src/features/Subject/components/ui/__tests__/SubjectCard.test.tsx
//
// SubjectCard's own logic: which badges show (Escalated/Creator/Owner/Admin), the
// status-driven card color, and the delete/click wiring through the real UserCard/UserMenu.
// Same dual mobile/desktop rendering quirk as PermissionUserCard — UserCard renders both layouts
// in the DOM at once, so badge/menu queries need getAllByX()[0] or a length check.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SubjectCard } from '../SubjectCard';
import type { FileObject, BelroseUserProfile } from '@/types/core';
import type { SubjectConsentRequest } from '@belrose/shared';

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'record1',
    uploadedBy: 'uploader1',
    owners: [],
    administrators: [],
    ...overrides,
  } as unknown as FileObject;
}

function makeProfile(overrides: Partial<BelroseUserProfile> = {}): BelroseUserProfile {
  return { uid: 'user1', displayName: 'Test User', ...overrides } as BelroseUserProfile;
}

function renderCard(props: Partial<React.ComponentProps<typeof SubjectCard>> = {}) {
  const onDelete = vi.fn();
  const defaults: React.ComponentProps<typeof SubjectCard> = {
    userId: 'user1',
    userProfile: makeProfile(),
    record: makeRecord(),
    subjectRequest: null,
    onDelete,
  };
  const utils = render(
    <MemoryRouter>
      <SubjectCard {...defaults} {...props} />
    </MemoryRouter>
  );
  return { onDelete, ...utils };
}

describe('SubjectCard badges', () => {
  it('shows the Creator badge when the user uploaded the record', () => {
    renderCard({ userId: 'uploader1', record: makeRecord({ uploadedBy: 'uploader1' }) });
    expect(screen.getAllByText('Creator').length).toBeGreaterThan(0);
  });

  it('shows the Owner badge for an owner', () => {
    renderCard({ userId: 'owner1', record: makeRecord({ owners: ['owner1'] }) });
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0);
  });

  it('shows the Admin badge for an administrator who is not also an owner', () => {
    renderCard({ userId: 'admin1', record: makeRecord({ administrators: ['admin1'] }) });
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });

  it('does not show the Admin badge when the user is both owner and administrator', () => {
    renderCard({
      userId: 'user1',
      record: makeRecord({ owners: ['user1'], administrators: ['user1'] }),
    });
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Admin')).toHaveLength(0);
  });

  it('shows no role badges for a plain subject with no other relationship to the record', () => {
    renderCard();
    expect(screen.queryAllByText('Creator')).toHaveLength(0);
    expect(screen.queryAllByText('Owner')).toHaveLength(0);
    expect(screen.queryAllByText('Admin')).toHaveLength(0);
  });

  it('shows the Escalated badge when the rejection was escalated', () => {
    renderCard({
      subjectRequest: {
        rejection: { creatorResponse: { status: 'escalated' } },
      } as unknown as SubjectConsentRequest,
    });
    expect(screen.getAllByText('Escalated').length).toBeGreaterThan(0);
  });

  it('does not show the Escalated badge when there is no rejection at all', () => {
    renderCard({ subjectRequest: null });
    expect(screen.queryAllByText('Escalated')).toHaveLength(0);
  });
});

describe('SubjectCard status color', () => {
  it('defaults to the "confirmed subject" red border', () => {
    const { container } = renderCard({ isPending: false, isRejected: false });
    expect(container.querySelector('.border-red-200')).not.toBeNull();
  });

  it('uses the primary border while pending', () => {
    const { container } = renderCard({ isPending: true });
    expect(container.querySelector('.border-primary')).not.toBeNull();
  });

  it('uses the yellow/rejected border when rejected', () => {
    const { container } = renderCard({ isRejected: true });
    expect(container.querySelector('.border-complement-4')).not.toBeNull();
  });

  it('rejected takes precedence over pending when both are somehow true', () => {
    const { container } = renderCard({ isPending: true, isRejected: true });
    expect(container.querySelector('.border-complement-4')).not.toBeNull();
    expect(container.querySelector('.border-primary')).toBeNull();
  });
});

describe('SubjectCard interactions', () => {
  it('calls onDelete when "Remove User" is clicked', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderCard();

    await user.click(screen.getAllByRole('button', { name: 'More options' })[0]!);
    await user.click(screen.getAllByText('Remove User')[0]!);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when the card is clicked, if provided', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderCard({ onClick });

    // Desktop layout's outer content row is the clickable element; click the display name inside it.
    await user.click(screen.getAllByText('Test User')[0]!);

    expect(onClick).toHaveBeenCalled();
  });
});
