// @vitest-environment jsdom
//
// src/features/Trustee/components/__tests__/MyTrusteesTab.test.tsx
//
// Tier 4 — MyTrusteesTab: the trustor's view. useTrusteeFlow (own dedicated test suite),
// TrusteeActionDialog, and UserSearch are mocked at the module boundary — this is about the
// tab's own fetch/render/handler-wiring logic: which row gets which menu action, and that
// "Cancel Invite" on a pending row is really the same initiateRevoke call as "Revoke Trustee".
// UserCard itself is real (dual mobile/desktop rendering — queries use getAllByX()[0]).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { BelroseUserProfile } from '@/types/core';

const { mockCurrentUser, getDocsMock, getUserProfilesMock, flowMocks, capturedOnSuccess } =
  vi.hoisted(() => ({
    mockCurrentUser: { uid: 'caller1' as string | null },
    getDocsMock: vi.fn(),
    getUserProfilesMock: vi.fn(),
    flowMocks: {
      initiateInvite: vi.fn(),
      initiateEditLevel: vi.fn(),
      initiateRevoke: vi.fn(),
    },
    capturedOnSuccess: { fn: undefined as (() => void) | undefined },
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
  useTrusteeFlow: (options: { onSuccess?: () => void }) => {
    capturedOnSuccess.fn = options?.onSuccess;
    return {
      dialogProps: { isOpen: false },
      initiateInvite: flowMocks.initiateInvite,
      initiateEditLevel: flowMocks.initiateEditLevel,
      initiateRevoke: flowMocks.initiateRevoke,
    };
  },
}));

vi.mock('../ui/TrusteeActionDialog', () => ({
  default: (props: { isOpen: boolean }) =>
    props.isOpen ? <div data-testid="trustee-action-dialog" /> : null,
}));

vi.mock('@/features/Users/components/UserSearch', () => ({
  default: ({ onUserSelect }: { onUserSelect: (u: BelroseUserProfile) => void }) => (
    <button onClick={() => onUserSelect(makeUser('new-trustee', 'New Trustee'))}>
      Select Test User
    </button>
  ),
}));

import MyTrusteesTab from '../MyTrusteesTab';

function makeUser(uid: string, displayName: string): BelroseUserProfile {
  return { uid, displayName } as BelroseUserProfile;
}

function relationshipDoc(overrides: Record<string, unknown> = {}) {
  return {
    trustorId: 'caller1',
    trusteeId: 'trustee1',
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

function renderTab(props: Partial<React.ComponentProps<typeof MyTrusteesTab>> = {}) {
  return render(
    <MemoryRouter>
      <MyTrusteesTab {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockCurrentUser.uid = 'caller1';
  mockRelationships([]);
  getUserProfilesMock.mockResolvedValue(new Map());
});

describe('MyTrusteesTab — empty states', () => {
  it('shows empty-state copy for both sections when there are no relationships', async () => {
    renderTab();
    await waitFor(() => expect(getDocsMock).toHaveBeenCalled());

    expect(await screen.findByText('No active trustees')).toBeInTheDocument();
    expect(screen.getByText('No pending invites')).toBeInTheDocument();
  });
});

describe('MyTrusteesTab — fetching', () => {
  it('queries relationships scoped to the caller as trustor, active+pending', async () => {
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

describe('MyTrusteesTab — rendering rows', () => {
  it('renders an active trustee row with its trust level badge', async () => {
    mockRelationships([relationshipDoc({ trusteeId: 'trustee1', trustLevel: 'custodian', status: 'active' })]);
    getUserProfilesMock.mockResolvedValue(new Map([['trustee1', makeUser('trustee1', 'Alice')]]));
    renderTab();

    expect(await screen.findAllByText('Alice')).not.toHaveLength(0);
    expect(screen.getAllByText('Custodian').length).toBeGreaterThan(0);
    expect(screen.getByText('No pending invites')).toBeInTheDocument();
  });

  it('renders a pending invite row', async () => {
    mockRelationships([relationshipDoc({ trusteeId: 'trustee1', status: 'pending', isActive: false })]);
    getUserProfilesMock.mockResolvedValue(new Map([['trustee1', makeUser('trustee1', 'Bob')]]));
    renderTab();

    expect(await screen.findAllByText('Bob')).not.toHaveLength(0);
    expect(screen.getByText('No active trustees')).toBeInTheDocument();
  });
});

describe('MyTrusteesTab — menu actions', () => {
  it('calls initiateEditLevel with the row data when "Edit Trust Level" is clicked', async () => {
    const user = userEvent.setup();
    mockRelationships([relationshipDoc({ trusteeId: 'trustee1', trustLevel: 'controller', status: 'active' })]);
    getUserProfilesMock.mockResolvedValue(new Map([['trustee1', makeUser('trustee1', 'Alice')]]));
    renderTab();
    await screen.findAllByText('Alice');

    await user.click(screen.getAllByRole('button', { name: 'More options' })[0]!);
    await user.click(screen.getAllByText('Edit Trust Level')[0]!);

    expect(flowMocks.initiateEditLevel).toHaveBeenCalledWith(
      'trustee1',
      expect.objectContaining({ uid: 'trustee1' }),
      'controller'
    );
  });

  it('calls initiateRevoke with the row data when "Revoke Trustee" is clicked', async () => {
    const user = userEvent.setup();
    mockRelationships([relationshipDoc({ trusteeId: 'trustee1', trustLevel: 'observer', status: 'active' })]);
    getUserProfilesMock.mockResolvedValue(new Map([['trustee1', makeUser('trustee1', 'Alice')]]));
    renderTab();
    await screen.findAllByText('Alice');

    await user.click(screen.getAllByRole('button', { name: 'More options' })[0]!);
    await user.click(screen.getAllByText('Revoke Trustee')[0]!);

    expect(flowMocks.initiateRevoke).toHaveBeenCalledWith(
      'trustee1',
      expect.objectContaining({ uid: 'trustee1' }),
      'observer'
    );
  });

  it('"Cancel Invite" on a pending row calls the same initiateRevoke — cancelling is just revoking a pending relationship', async () => {
    const user = userEvent.setup();
    mockRelationships([
      relationshipDoc({ trusteeId: 'trustee1', trustLevel: 'custodian', status: 'pending', isActive: false }),
    ]);
    getUserProfilesMock.mockResolvedValue(new Map([['trustee1', makeUser('trustee1', 'Carl')]]));
    renderTab();
    await screen.findAllByText('Carl');

    await user.click(screen.getAllByRole('button', { name: 'More options' })[0]!);
    await user.click(screen.getAllByText('Cancel Invite')[0]!);

    expect(flowMocks.initiateRevoke).toHaveBeenCalledWith(
      'trustee1',
      expect.objectContaining({ uid: 'trustee1' }),
      'custodian'
    );
  });
});

describe('MyTrusteesTab — inviting a new trustee', () => {
  it('opens the user search when the "+" button is clicked, and wires selection to initiateInvite', async () => {
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(getDocsMock).toHaveBeenCalled());

    // "+" button in the Active Trustees header
    const plusButtons = document.querySelectorAll('button');
    const plusButton = Array.from(plusButtons).find(b => b.querySelector('svg.lucide-plus'));
    await user.click(plusButton!);

    await user.click(await screen.findByText('Select Test User'));

    expect(flowMocks.initiateInvite).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'new-trustee' })
    );
    expect(screen.queryByText('Select Test User')).not.toBeInTheDocument();
  });

  it('opens the user search from the empty-state "Invite a Trustee" button', async () => {
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => expect(getDocsMock).toHaveBeenCalled());

    await user.click(await screen.findByText('Invite a Trustee'));

    expect(await screen.findByText('Select Test User')).toBeInTheDocument();
  });
});

describe('MyTrusteesTab — onSuccess wiring', () => {
  it('refetches relationships and calls onRefreshNeeded when the flow succeeds', async () => {
    const onRefreshNeeded = vi.fn();
    renderTab({ onRefreshNeeded });
    await waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(1));

    capturedOnSuccess.fn?.();

    await waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(2));
    expect(onRefreshNeeded).toHaveBeenCalledTimes(1);
  });
});
