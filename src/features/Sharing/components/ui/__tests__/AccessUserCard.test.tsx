// @vitest-environment jsdom
//
// src/features/Sharing/components/ui/__tests__/AccessUserCard.test.tsx
//
// AccessUserCard's own logic: which badges show (Subject/Guest/Creator/role/status) and the
// hasIssue-driven card color. UserCard/UserMenu render for real (no mocking needed) — UserMenu
// uses useNavigate() internally, so every render needs a Router context (MemoryRouter). UserCard
// unconditionally renders BOTH a mobile and a desktop layout in the DOM simultaneously (Tailwind's
// responsive classes are just CSS, jsdom never evaluates media queries) — same quirk found testing
// PermissionUserCard — so badge/menu queries need getAllByX()[0] or a length check, not getByX.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AccessUserCard from '../AccessUserCard';
import type { AccessEntry, WrappedKeyInfo } from '../../../services/accessEntries';
import type { FileObject, BelroseUserProfile } from '@/types/core';

function makeWrappedKey(overrides: Partial<WrappedKeyInfo> = {}): WrappedKeyInfo {
  return {
    userId: 'user1',
    recordId: 'record1',
    isActive: true,
    isCreator: false,
    isGuest: false,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeEntry(overrides: Partial<AccessEntry> = {}): AccessEntry {
  return {
    userId: 'user1',
    profile: { uid: 'user1', displayName: 'Test User' } as BelroseUserProfile,
    wrappedKey: makeWrappedKey(),
    role: 'viewer',
    status: 'synced',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'record1',
    owners: [],
    administrators: [],
    sharers: [],
    viewers: ['user1'],
    subjects: [],
    ...overrides,
  } as unknown as FileObject;
}

function renderCard(props: Partial<React.ComponentProps<typeof AccessUserCard>> = {}) {
  const defaults: React.ComponentProps<typeof AccessUserCard> = {
    entry: makeEntry(),
    record: makeRecord(),
  };
  return render(
    <MemoryRouter>
      <AccessUserCard {...defaults} {...props} />
    </MemoryRouter>
  );
}

describe('AccessUserCard — role badge', () => {
  it.each([
    ['owner', 'Owner'],
    ['administrator', 'Admin'],
    ['sharer', 'Sharer'],
    ['viewer', 'Viewer'],
    ['none', 'No Role'],
  ] as const)('shows "%s" role as "%s"', (role, expectedText) => {
    renderCard({ entry: makeEntry({ role }) });
    expect(screen.getAllByText(expectedText).length).toBeGreaterThan(0);
  });
});

describe('AccessUserCard — status badge', () => {
  it.each([
    ['synced', 'Synced'],
    ['missing-key', 'Missing Key'],
    ['missing-role', 'Orphaned Key'],
    ['inactive', 'Inactive'],
  ] as const)('shows "%s" status as "%s"', (status, expectedText) => {
    renderCard({ entry: makeEntry({ status }) });
    expect(screen.getAllByText(expectedText).length).toBeGreaterThan(0);
  });
});

describe('AccessUserCard — conditional badges', () => {
  it('shows the Subject badge only when the user is in the record\'s subjects array', () => {
    renderCard({ entry: makeEntry({ userId: 'user1' }), record: makeRecord({ subjects: ['user1'] }) });
    expect(screen.getAllByText('Subject').length).toBeGreaterThan(0);
  });

  it('does not show the Subject badge for a non-subject', () => {
    renderCard({ entry: makeEntry({ userId: 'user1' }), record: makeRecord({ subjects: [] }) });
    expect(screen.queryAllByText('Subject')).toHaveLength(0);
  });

  it('shows the Guest badge only when the wrappedKey is a guest key', () => {
    renderCard({ entry: makeEntry({ wrappedKey: makeWrappedKey({ isGuest: true }) }) });
    expect(screen.getAllByText('Guest').length).toBeGreaterThan(0);
  });

  it('does not show the Guest badge for a non-guest key', () => {
    renderCard({ entry: makeEntry({ wrappedKey: makeWrappedKey({ isGuest: false }) }) });
    expect(screen.queryAllByText('Guest')).toHaveLength(0);
  });

  it('shows the Creator badge only when the wrappedKey belongs to the creator', () => {
    renderCard({ entry: makeEntry({ wrappedKey: makeWrappedKey({ isCreator: true }) }) });
    expect(screen.getAllByText('Creator').length).toBeGreaterThan(0);
  });

  it('does not show the Creator badge, Guest badge, or Subject badge when there is no wrappedKey at all', () => {
    renderCard({ entry: makeEntry({ wrappedKey: null, status: 'missing-key' }) });
    expect(screen.queryAllByText('Creator')).toHaveLength(0);
    expect(screen.queryAllByText('Guest')).toHaveLength(0);
  });
});

describe('AccessUserCard — issue-driven card color', () => {
  it('renders with the red/issue border for a "missing-key" status', () => {
    const { container } = renderCard({ entry: makeEntry({ status: 'missing-key' }) });
    expect(container.querySelector('.border-red-200')).not.toBeNull();
  });

  it('renders with the red/issue border for a "missing-role" status', () => {
    const { container } = renderCard({ entry: makeEntry({ status: 'missing-role' }) });
    expect(container.querySelector('.border-red-200')).not.toBeNull();
  });

  it('renders with the default (non-issue) border for a "synced" status', () => {
    const { container } = renderCard({ entry: makeEntry({ status: 'synced' }) });
    expect(container.querySelector('.border-red-200')).toBeNull();
    expect(container.querySelector('.border-primary')).not.toBeNull();
  });

  it('renders with the default (non-issue) border for an "inactive" status', () => {
    const { container } = renderCard({ entry: makeEntry({ status: 'inactive' }) });
    expect(container.querySelector('.border-red-200')).toBeNull();
  });
});

describe('AccessUserCard — menu wiring', () => {
  it('calls onDelete when "Remove User" is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderCard({ onDelete });

    await user.click(screen.getAllByRole('button', { name: 'More options' })[0]!);
    await user.click(screen.getAllByText('Remove User')[0]!);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not show "Remove User" when onDelete is not provided', async () => {
    const user = userEvent.setup();
    renderCard({ onDelete: undefined });

    await user.click(screen.getAllByRole('button', { name: 'More options' })[0]!);

    expect(screen.queryAllByText('Remove User')).toHaveLength(0);
  });
});
