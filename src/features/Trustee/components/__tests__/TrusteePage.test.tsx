// @vitest-environment jsdom
//
// src/features/Trustee/components/__tests__/TrusteePage.test.tsx
//
// Tier 4 — TrusteePage: the tab container. MyTrusteesTab/MyTrustorsTab are mocked (each has its
// own dedicated test suite) — this is about TrusteePage's own tab-derivation-from-URL logic and
// the pending-invite-driven auto-navigate. firebase/auth and firebase/firestore are mocked for
// the pending-count fetch; react-router-dom's useSearchParams needs a real MemoryRouter.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { mockCurrentUser, getDocsMock } = vi.hoisted(() => ({
  mockCurrentUser: { uid: 'caller1' as string | null },
  getDocsMock: vi.fn(),
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

vi.mock('../MyTrusteesTab', () => ({
  default: () => <div data-testid="my-trustees-tab">MyTrusteesTab</div>,
}));

vi.mock('../MyTrustorsTab', () => ({
  default: () => <div data-testid="my-trustors-tab">MyTrustorsTab</div>,
}));

import { TrusteePage } from '../TrusteePage';

function setCaller(uid: string | null) {
  mockCurrentUser.uid = uid;
}

function renderPage(initialEntry = '/trustees') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <TrusteePage />
    </MemoryRouter>
  );
}

// Overrides the next Promise.all([trusteesSnap, trustorsSnap]) pair only — takes priority over
// the beforeEach's persistent { size: 0 } default without disturbing later calls.
function mockCounts(myTrusteesPending: number, myTrustorsPending: number) {
  getDocsMock
    .mockResolvedValueOnce({ size: myTrusteesPending })
    .mockResolvedValueOnce({ size: myTrustorsPending });
}

// Flushes pending microtasks for the "nothing to query, nothing to eventually become true"
// case, where waitFor's polling assertion doesn't apply.
async function flushMicrotasks() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.resetAllMocks();
  setCaller('caller1');
  getDocsMock.mockResolvedValue({ size: 0 });
});

describe('TrusteePage — default tab', () => {
  it('defaults to My Trustees when there is no tab param and no pending trustor invites', async () => {
    renderPage();
    await waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(2));

    expect(screen.getByTestId('my-trustees-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('my-trustors-tab')).not.toBeInTheDocument();
  });

  it('auto-navigates to My Trustors when there are pending trustor invites and no explicit tab param', async () => {
    mockCounts(0, 2);
    renderPage();

    expect(await screen.findByTestId('my-trustors-tab')).toBeInTheDocument();
  });

  it('respects an explicit ?tab=my-trustees param even when there are pending trustor invites', async () => {
    mockCounts(0, 2);
    renderPage('/trustees?tab=my-trustees');
    await waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(2));

    expect(screen.getByTestId('my-trustees-tab')).toBeInTheDocument();
  });

  it('respects an explicit ?tab=my-trustors param even with no pending invites', async () => {
    renderPage('/trustees?tab=my-trustors');
    await waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(2));

    expect(screen.getByTestId('my-trustors-tab')).toBeInTheDocument();
  });

  it('does not query Firestore when there is no authenticated user', async () => {
    setCaller(null);
    renderPage();
    await flushMicrotasks();

    expect(getDocsMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('my-trustees-tab')).toBeInTheDocument();
  });
});

describe('TrusteePage — tab switching and the pending-count badge', () => {
  it('switches tabs when clicking the tab buttons', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(2));

    await user.click(screen.getByText('My Trustors'));
    expect(screen.getByTestId('my-trustors-tab')).toBeInTheDocument();

    await user.click(screen.getByText('My Trustees'));
    expect(screen.getByTestId('my-trustees-tab')).toBeInTheDocument();
  });

  it('shows the pending count badge on My Trustors once loaded', async () => {
    mockCounts(0, 3);
    renderPage('/trustees?tab=my-trustees');

    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('shows no badge when there are no pending trustor invites', async () => {
    renderPage();
    await waitFor(() => expect(getDocsMock).toHaveBeenCalledTimes(2));

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
