// @vitest-environment jsdom
//
// src/features/Dependents/components/__tests__/DependentsSettingsPage.test.tsx
//
// Pins the fix for a confirmed bug: this page's "remove" menu-item label used to key off only
// `entry.profile?.isDependent`, ignoring `handoffInitiatedAt` — so in the unclaimed+handoff-
// already-sent case it showed "Delete account" even though the actual action (and RemoveDialog's
// own copy, if opened) only revokes access. The fix mirrors RemoveDialog's exact willDelete
// condition. These tests cover the same 4 combinations RemoveDialog.test.tsx covers, proving the
// two now agree.
//
// UserCard is mocked to render its `additionalItems` labels directly as plain text — sidesteps
// needing to drive a real dropdown-menu open/close interaction just to read a label string.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { onSnapshotMock, getUserProfileMock } = vi.hoisted(() => ({
  onSnapshotMock: vi.fn(),
  getUserProfileMock: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(() => 'trusteeRelationships-collection'),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  onSnapshot: onSnapshotMock,
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: 'guardian-1' } })),
}));

vi.mock('@/features/Users/services/userProfileService', () => ({
  getUserProfile: getUserProfileMock,
}));

vi.mock('@/features/Dependents/services/accountSwitchService', () => ({
  AccountSwitchService: { switchToDependent: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

vi.mock('@/features/Users/components/ui/UserCard', () => ({
  UserCard: ({ additionalItems }: any) => (
    <div>
      {additionalItems
        .filter((item: any) => item.key === 'remove')
        .map((item: any) => (
          <span key={item.key}>{item.label}</span>
        ))}
    </div>
  ),
}));

vi.mock('../HandoffDialog', () => ({ default: () => null }));
vi.mock('../RemoveDialog', () => ({ default: () => null }));

import { DependentsSettingsPage } from '../DependentsSettingsPage';

function fakeSnapshot(profile: Record<string, unknown>) {
  return {
    docs: [{ data: () => ({ trustorId: 'dep-1', trusteeId: 'guardian-1' }) }],
  };
}

let capturedOnNext: ((snapshot: any) => void) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  capturedOnNext = null;
  onSnapshotMock.mockImplementation((_q: unknown, onNext: any) => {
    capturedOnNext = onNext;
    return vi.fn();
  });
});

async function renderWithProfile(profileOverrides: Record<string, unknown>) {
  getUserProfileMock.mockResolvedValue({ uid: 'dep-1', displayName: 'Jane', ...profileOverrides });
  render(
    <MemoryRouter>
      <DependentsSettingsPage />
    </MemoryRouter>
  );
  capturedOnNext!(fakeSnapshot(profileOverrides));
  await waitFor(() => expect(screen.queryByText('Loading dependents...')).not.toBeInTheDocument());
}

describe('DependentsSettingsPage remove-label — matches RemoveDialog.willDelete exactly', () => {
  it('unclaimed + no handoff sent -> "Delete account"', async () => {
    await renderWithProfile({ isDependent: true, handoffInitiatedAt: undefined });
    expect(await screen.findByText('Delete account')).toBeInTheDocument();
  });

  it('unclaimed + handoff already sent -> "Remove guardian access" (the fixed case)', async () => {
    await renderWithProfile({ isDependent: true, handoffInitiatedAt: '2026-01-01T00:00:00Z' });
    expect(await screen.findByText('Remove guardian access')).toBeInTheDocument();
    expect(screen.queryByText('Delete account')).not.toBeInTheDocument();
  });

  it('claimed + no handoff sent -> "Remove guardian access"', async () => {
    await renderWithProfile({ isDependent: false, handoffInitiatedAt: undefined });
    expect(await screen.findByText('Remove guardian access')).toBeInTheDocument();
  });

  it('claimed + handoff sent -> "Remove guardian access"', async () => {
    await renderWithProfile({ isDependent: false, handoffInitiatedAt: '2026-01-01T00:00:00Z' });
    expect(await screen.findByText('Remove guardian access')).toBeInTheDocument();
  });
});
