// @vitest-environment jsdom
//
// src/features/RecordFollowUp/components/__tests__/FollowUpActionsManager.test.tsx
//
// Tier 4 — mocks useAuthContext/useUserRecords and the RecordActionGroup child (which owns its
// own useRecordFollowUps call and is covered separately) and renders the real component. Covers
// the loading/error/empty/list states.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { useAuthContextMock, useUserRecordsMock } = vi.hoisted(() => ({
  useAuthContextMock: vi.fn(),
  useUserRecordsMock: vi.fn(),
}));

vi.mock('@/features/Auth/AuthContext', () => ({ useAuthContext: useAuthContextMock }));
vi.mock('@/features/ViewEditRecord/hooks/useUserRecords', () => ({ useUserRecords: useUserRecordsMock }));

vi.mock('../ui/RecordActionGroup', () => ({
  default: ({ record }: { record: { id: string } }) => (
    <div data-testid={`action-group-${record.id}`} />
  ),
}));

import FollowUpActionsManager from '../FollowUpActionsManager';
import type { FileObject } from '@/types/core';

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return { id: 'record-1', fileSize: 100, fileType: 'application/pdf', administrators: [], status: 'completed', ...overrides } as FileObject;
}

describe('FollowUpActionsManager', () => {
  it('shows a loading state while records are loading', () => {
    useAuthContextMock.mockReturnValue({ user: { uid: 'user-1' } });
    useUserRecordsMock.mockReturnValue({ records: [], loading: true, error: null });

    render(<FollowUpActionsManager />);
    expect(screen.getByText('Loading your records...')).toBeInTheDocument();
  });

  it('shows an error state when records fail to load', () => {
    useAuthContextMock.mockReturnValue({ user: { uid: 'user-1' } });
    useUserRecordsMock.mockReturnValue({ records: [], loading: false, error: new Error('boom') });

    render(<FollowUpActionsManager />);
    expect(screen.getByText('Failed to load records. Please try again.')).toBeInTheDocument();
  });

  it('shows an empty state when the user has no records', () => {
    useAuthContextMock.mockReturnValue({ user: { uid: 'user-1' } });
    useUserRecordsMock.mockReturnValue({ records: [], loading: false, error: null });

    render(<FollowUpActionsManager />);
    expect(screen.getByText('No records yet')).toBeInTheDocument();
  });

  it('renders one RecordActionGroup per record', () => {
    useAuthContextMock.mockReturnValue({ user: { uid: 'user-1' } });
    useUserRecordsMock.mockReturnValue({
      records: [makeRecord({ id: 'a' }), makeRecord({ id: 'b' })],
      loading: false,
      error: null,
    });

    render(<FollowUpActionsManager />);
    expect(screen.getByTestId('action-group-a')).toBeInTheDocument();
    expect(screen.getByTestId('action-group-b')).toBeInTheDocument();
  });
});
