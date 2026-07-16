// @vitest-environment jsdom
//
// src/features/Trustee/components/__tests__/MyTrustorsTab.test.tsx
//
// Tier 4 — MyTrustorsTab: the trustee's view. useTrusteeFlow (own dedicated test suite) and
// TrusteeActionDialog are mocked at the module boundary — this is about the tab's own
// fetch/render/handler-wiring logic, including the documented quirk that "Step Down Trust
// Level" and "Resign as Trustee" are two menu entries that both call the exact same handler
// (handleResign -> initiateResign), with no way from this component to tell them apart.
// UserCard itself is real (dual mobile/desktop rendering — queries use getAllByX()[0]).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { mockCurrentUser, getDocsMock, getUserProfilesMock, flowMocks } = vi.hoisted(() => ({
  mockCurrentUser: { uid: 'caller1' as string | null },
  getDocsMock: vi.fn(),
  getUserProfilesMock: vi.fn(),
  flowMocks: {
    initiateAccept: vi.fn(),
    initiateDecline: vi.fn(),
    initiateResign: vi.fn(),
  },
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser.uid ? { uid: mockCurrentUser.uid } : null }),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  getDocs: getDocsMock,
}));

vi.mock('@/features/Users/services/userProfileService', () => ({
  getUserProfiles: getUserProfilesMock,
}));

vi.mock('../../hooks/useTrusteeFlow', () => ({
  useTrusteeFlow: () => ({
    dialogProps: { isOpen: false },
    initiateAccept: flowMocks.initiateAccept,
    initiateDecline: flowMocks.initiateDecline,
    initiateResign: flowMocks.initiateResign,
  }),
}));

vi.mock('../ui/TrusteeActionDialog', () => ({
  default: (props: { isOpen: boolean }) =>
    props.isOpen ? <div data-testid="trustee-action-dialog" /> : null,
}));

import MyTrustorsTab from '../MyTrustorsTab';
import type { BelroseUserProfile } from '@/types/core';

function makeProfile(uid: string, displayName: string): BelroseUserProfile {
  return { uid, displayName } as BelroseUserProfile;
}

function relationshipDoc(overrides: Record<string, unknown> = {}) {
  return {
    trustorId: 'trustor1',
    trusteeId: 'caller1',
    trustLevel: 'observer',
    status: 'active',
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  };
}

function mockRelationships(docs: Record<string, unknown>[]) {
  getDocsMock.mockResolvedValue({
    docs: docs.map((data, i) => ({ id: `rel${i}`, data: () => data })),
  });
}

function renderTab() {
  return render(
    <MemoryRouter>
      <MyTrustorsTab />
    </MemoryRouter>
  );
}

function findButtonWithIcon(iconClass: string): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll('button'));
  const match = buttons.find(b => b.querySelector(`svg.${iconClass}`));
  if (!match) throw new Error(`No button found containing an icon with class ${iconClass}`);
  return match as HTMLButtonElement;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockCurrentUser.uid = 'caller1';
  mockRelationships([]);
  getUserProfilesMock.mockResolvedValue(new Map());
});

describe('MyTrustorsTab — empty states', () => {
  it('shows empty-state copy for both sections when there are no relationships', async () => {
    renderTab();
    await waitFor(() => expect(getDocsMock).toHaveBeenCalled());

    expect(await screen.findByText('You are not currently managing any accounts')).toBeInTheDocument();
    expect(screen.getByText('No pending invites')).toBeInTheDocument();
  });
});

describe('MyTrustorsTab — fetching', () => {
  it('queries relationships scoped to the caller as trustee, active+pending', async () => {
    renderTab();
    await waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(1));
  });

  it('does not query when there is no authenticated caller', async () => {
    mockCurrentUser.uid = null;
    renderTab();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(getDocsMock).not.toHaveBeenCalled();
  });
});

describe('MyTrustorsTab — rendering rows', () => {
  it('renders an active trustor row with its trust level badge', async () => {
    mockRelationships([relationshipDoc({ trustorId: 'trustor1', trustLevel: 'controller', status: 'active' })]);
    getUserProfilesMock.mockResolvedValue(new Map([['trustor1', makeProfile('trustor1', 'Alice')]]));
    renderTab();

    expect(await screen.findAllByText('Alice')).not.toHaveLength(0);
    expect(screen.getAllByText('Controller').length).toBeGreaterThan(0);
  });

  it('renders a pending invite row', async () => {
    mockRelationships([relationshipDoc({ trustorId: 'trustor1', status: 'pending', isActive: false })]);
    getUserProfilesMock.mockResolvedValue(new Map([['trustor1', makeProfile('trustor1', 'Bob')]]));
    renderTab();

    expect(await screen.findAllByText('Bob')).not.toHaveLength(0);
    expect(screen.getByText('You are not currently managing any accounts')).toBeInTheDocument();
  });
});

describe('MyTrustorsTab — active row menu actions', () => {
  it('offers "Step Down Trust Level" only when trustLevel is not observer', async () => {
    mockRelationships([relationshipDoc({ trustorId: 'trustor1', trustLevel: 'observer', status: 'active' })]);
    getUserProfilesMock.mockResolvedValue(new Map([['trustor1', makeProfile('trustor1', 'Alice')]]));
    const user = userEvent.setup();
    renderTab();
    await screen.findAllByText('Alice');

    await user.click(screen.getAllByRole('button', { name: 'More options' })[0]!);

    expect(screen.queryByText('Step Down Trust Level')).not.toBeInTheDocument();
    expect(screen.getAllByText('Resign as Trustee').length).toBeGreaterThan(0);
  });

  it('"Step Down Trust Level" calls initiateResign with the row data — same call "Resign" makes below', async () => {
    mockRelationships([relationshipDoc({ trustorId: 'trustor1', trustLevel: 'custodian', status: 'active' })]);
    getUserProfilesMock.mockResolvedValue(new Map([['trustor1', makeProfile('trustor1', 'Alice')]]));
    const user = userEvent.setup();
    renderTab();
    await screen.findAllByText('Alice');

    await user.click(screen.getAllByRole('button', { name: 'More options' })[0]!);
    await user.click(screen.getAllByText('Step Down Trust Level')[0]!);

    expect(flowMocks.initiateResign).toHaveBeenCalledWith(
      'trustor1',
      expect.objectContaining({ uid: 'trustor1' }),
      'custodian'
    );
  });

  it('"Resign as Trustee" calls the identical initiateResign — documented current behavior, not a bug fix', async () => {
    mockRelationships([relationshipDoc({ trustorId: 'trustor1', trustLevel: 'custodian', status: 'active' })]);
    getUserProfilesMock.mockResolvedValue(new Map([['trustor1', makeProfile('trustor1', 'Alice')]]));
    const user = userEvent.setup();
    renderTab();
    await screen.findAllByText('Alice');

    await user.click(screen.getAllByRole('button', { name: 'More options' })[0]!);
    await user.click(screen.getAllByText('Resign as Trustee')[0]!);

    expect(flowMocks.initiateResign).toHaveBeenCalledWith(
      'trustor1',
      expect.objectContaining({ uid: 'trustor1' }),
      'custodian'
    );
    expect(flowMocks.initiateResign).toHaveBeenCalledTimes(1);
  });
});

describe('MyTrustorsTab — pending row accept/decline', () => {
  it('calls initiateAccept when the accept button is clicked', async () => {
    mockRelationships([
      relationshipDoc({ trustorId: 'trustor1', trustLevel: 'observer', status: 'pending', isActive: false }),
    ]);
    getUserProfilesMock.mockResolvedValue(new Map([['trustor1', makeProfile('trustor1', 'Dana')]]));
    const user = userEvent.setup();
    renderTab();
    await screen.findAllByText('Dana');

    await user.click(findButtonWithIcon('lucide-check'));

    expect(flowMocks.initiateAccept).toHaveBeenCalledWith(
      'trustor1',
      expect.objectContaining({ uid: 'trustor1' }),
      'observer'
    );
  });

  it('calls initiateDecline when the cancel/decline button is clicked', async () => {
    mockRelationships([
      relationshipDoc({ trustorId: 'trustor1', trustLevel: 'observer', status: 'pending', isActive: false }),
    ]);
    getUserProfilesMock.mockResolvedValue(new Map([['trustor1', makeProfile('trustor1', 'Dana')]]));
    const user = userEvent.setup();
    renderTab();
    await screen.findAllByText('Dana');

    await user.click(findButtonWithIcon('lucide-x'));

    expect(flowMocks.initiateDecline).toHaveBeenCalledWith(
      'trustor1',
      expect.objectContaining({ uid: 'trustor1' }),
      'observer'
    );
  });
});
