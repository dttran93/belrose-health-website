// @vitest-environment jsdom
//
// src/features/Permissions/components/ui/__tests__/PermissionUserCard.test.tsx
//
// PermissionUserCard's own logic: which badges show (Creator/Subject/Trustee), the
// trustee-access-missing expand toggle, and wiring an extra "Modify Access" menu item
// through to the real UserCard/UserMenu. Nothing here calls a service, so nothing needs
// vi.mock — UserCard/UserMenu are rendered for real. UserMenu uses useNavigate() internally,
// so every render needs a Router context (MemoryRouter), not just this component's own tree.
//
// Quirk worth knowing for every test in this feature going forward: UserCard unconditionally
// renders BOTH a mobile layout (`sm:hidden`) and a desktop layout (`hidden sm:flex`) in the
// DOM at the same time — Tailwind's responsive classes are just CSS, and jsdom never
// evaluates media queries, so both copies of every badge/button/menu-item genuinely exist in
// the tree together. Anything rendered inside UserCard's `content`/menu slot needs
// getAllByX()[0] (or a length check), not getByX — getByX correctly throws on 2 matches.
// The trustee expand panel itself is a sibling of <UserCard>, not part of it, so text inside
// it (once expanded) is a single, ordinary match.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PermissionUserCard } from '../PermissionUserCard';
import type { FileObject, BelroseUserProfile } from '@/types/core';
import type { TrusteeEntry } from '@/features/Trustee/hooks/useRecordTrustees';

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'rec1',
    uploadedBy: 'uploader1',
    owners: ['owner1'],
    administrators: [],
    sharers: [],
    viewers: [],
    subjects: [],
    ...overrides,
  } as unknown as FileObject;
}

function makeProfile(overrides: Partial<BelroseUserProfile> = {}): BelroseUserProfile {
  return { uid: 'user1', displayName: 'Test User', ...overrides } as BelroseUserProfile;
}

function makeTrusteeEntry(overrides: Partial<TrusteeEntry> = {}): TrusteeEntry {
  return {
    trusteeId: 'trustee1',
    trustorId: 'user1',
    trustLevel: 'observer',
    trusteeProfile: makeProfile({ uid: 'trustee1', displayName: 'Trustee One' }),
    trustorProfile: null,
    ...overrides,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof PermissionUserCard>> = {}) {
  const defaults: React.ComponentProps<typeof PermissionUserCard> = {
    userId: 'user1',
    userProfile: makeProfile(),
    record: makeRecord(),
    color: 'blue',
  };
  return render(
    <MemoryRouter>
      <PermissionUserCard {...defaults} {...props} />
    </MemoryRouter>
  );
}

describe('PermissionUserCard badges', () => {
  it('shows the Creator badge only when the user is the record uploader', () => {
    renderCard({ userId: 'uploader1', record: makeRecord({ uploadedBy: 'uploader1' }) });
    expect(screen.getAllByText('Creator').length).toBeGreaterThan(0);
  });

  it('does not show the Creator badge for a non-uploader', () => {
    renderCard({ userId: 'user1', record: makeRecord({ uploadedBy: 'uploader1' }) });
    expect(screen.queryAllByText('Creator')).toHaveLength(0);
  });

  it('shows the Subject badge only when the user is a subject of the record', () => {
    renderCard({ userId: 'user1', record: makeRecord({ subjects: ['user1'] }) });
    expect(screen.getAllByText('Subject').length).toBeGreaterThan(0);
  });

  it('does not show the Subject badge for a non-subject', () => {
    renderCard({ userId: 'user1', record: makeRecord({ subjects: [] }) });
    expect(screen.queryAllByText('Subject')).toHaveLength(0);
  });

  it('shows the Trustee badge only when a trusteeEntry is provided', () => {
    renderCard({ trusteeEntry: makeTrusteeEntry() });
    expect(screen.getAllByText('Trustee').length).toBeGreaterThan(0);
  });

  it('does not show the Trustee badge without a trusteeEntry', () => {
    renderCard();
    expect(screen.queryAllByText('Trustee')).toHaveLength(0);
  });
});

describe('PermissionUserCard trustee expand toggle', () => {
  it('does not render the toggle when trusteeList is empty', () => {
    renderCard({ trusteeList: [] });
    expect(screen.queryAllByText(/Trustees?$/)).toHaveLength(0);
  });

  it('reveals and hides trustee mini-cards when the toggle is clicked', async () => {
    const user = userEvent.setup();
    renderCard({ trusteeList: [makeTrusteeEntry()] });

    expect(screen.queryByText('Trustee One')).not.toBeInTheDocument();

    await user.click(screen.getAllByText('1 Trustee')[0]!);
    expect(screen.getByText('Trustee One')).toBeInTheDocument();

    await user.click(screen.getAllByText('1 Trustee')[0]!);
    expect(screen.queryByText('Trustee One')).not.toBeInTheDocument();
  });

  it('shows "Access Missing" for a trustee with no actual record access', async () => {
    const user = userEvent.setup();
    renderCard({
      record: makeRecord({ owners: ['owner1'], administrators: [], viewers: [] }),
      trusteeList: [makeTrusteeEntry({ trusteeId: 'trustee1' })],
    });

    await user.click(screen.getAllByText('1 Trustee')[0]!);

    expect(screen.getByText('Access Missing')).toBeInTheDocument();
  });

  it('does not show "Access Missing" for a trustee who already has record access', async () => {
    const user = userEvent.setup();
    renderCard({
      record: makeRecord({ owners: ['owner1'], viewers: ['trustee1'] }),
      trusteeList: [makeTrusteeEntry({ trusteeId: 'trustee1' })],
    });

    await user.click(screen.getAllByText('1 Trustee')[0]!);

    expect(screen.queryByText('Access Missing')).not.toBeInTheDocument();
  });
});

describe('PermissionUserCard menu wiring', () => {
  it('does not show "Modify Access" when onModify is not provided', async () => {
    const user = userEvent.setup();
    renderCard({ onModify: undefined });

    await user.click(screen.getAllByRole('button', { name: 'More options' })[0]!);

    expect(screen.queryAllByText('Modify Access')).toHaveLength(0);
  });

  it('shows "Modify Access" and calls onModify when clicked', async () => {
    const user = userEvent.setup();
    const onModify = vi.fn();
    renderCard({ onModify });

    await user.click(screen.getAllByRole('button', { name: 'More options' })[0]!);
    await user.click(screen.getAllByText('Modify Access')[0]!);

    expect(onModify).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when "Remove User" is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderCard({ onDelete });

    await user.click(screen.getAllByRole('button', { name: 'More options' })[0]!);
    await user.click(screen.getAllByText('Remove User')[0]!);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
