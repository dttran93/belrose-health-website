// @vitest-environment jsdom
//
// src/features/Subject/hooks/__tests__/useSubjectAlerts.test.tsx
//
// useSubjectAlerts is a thin fetch-on-mount wrapper around SubjectQueryService.getRecordAlerts —
// mocked here since that service already has its own dedicated orchestration test suite. This
// test is about the hook's own state wiring: the no-user/no-record short-circuit, mapping the
// alerts shape onto individual state fields, the derived hasPendingRejectionResponse flag, and
// that a rejected fetch doesn't throw or leave loading stuck.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSubjectAlerts } from '../useSubjectAlerts';

const { mockCurrentUser, queryServiceMocks } = vi.hoisted(() => ({
  mockCurrentUser: { uid: null as string | null },
  queryServiceMocks: { getRecordAlerts: vi.fn() },
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: mockCurrentUser.uid ? { uid: mockCurrentUser.uid } : null }),
}));

vi.mock('../../services/subjectQueryService', () => ({
  default: queryServiceMocks,
  SubjectQueryService: queryServiceMocks,
}));

const SubjectQueryService = queryServiceMocks;

function setUser(uid: string | null) {
  mockCurrentUser.uid = uid;
}

const EMPTY_ALERTS = {
  hasPendingRequest: false,
  hasRemovalRequest: false,
  removalRequest: null,
  pendingConsentRequests: [],
  pendingRemovalRequests: [],
  pendingRejectionResponses: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  setUser(null);
});

describe('useSubjectAlerts', () => {
  it('short-circuits to isLoading:false without querying when there is no authenticated user', async () => {
    setUser(null);
    const { result } = renderHook(() => useSubjectAlerts({ recordId: 'rec1' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(SubjectQueryService.getRecordAlerts).not.toHaveBeenCalled();
    expect(result.current.hasSubjectRequest).toBe(false);
  });

  it('short-circuits when there is no recordId, even if authenticated', async () => {
    setUser('user1');
    const { result } = renderHook(() => useSubjectAlerts({ recordId: '' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(SubjectQueryService.getRecordAlerts).not.toHaveBeenCalled();
  });

  it('populates every field from the alerts response', async () => {
    setUser('user1');
    vi.mocked(SubjectQueryService.getRecordAlerts).mockResolvedValue({
      ...EMPTY_ALERTS,
      hasPendingRequest: true,
      hasRemovalRequest: true,
      removalRequest: { id: 'rec1_user1', recordId: 'rec1' } as any,
      pendingConsentRequests: [{ subjectId: 'user1' } as any],
      pendingRemovalRequests: [{ subjectId: 'user1' } as any],
      pendingRejectionResponses: [{ subjectId: 'user1' } as any],
    });

    const { result } = renderHook(() => useSubjectAlerts({ recordId: 'rec1' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasSubjectRequest).toBe(true);
    expect(result.current.hasRemovalRequest).toBe(true);
    expect(result.current.removalRequest).toEqual({ id: 'rec1_user1', recordId: 'rec1' });
    expect(result.current.pendingConsentRequests).toHaveLength(1);
    expect(result.current.pendingRemovalRequests).toHaveLength(1);
    expect(result.current.hasPendingRejectionResponse).toBe(true);
    expect(result.current.pendingRejectionResponses).toHaveLength(1);
  });

  it('derives hasPendingRejectionResponse as false when the list is empty', async () => {
    setUser('user1');
    vi.mocked(SubjectQueryService.getRecordAlerts).mockResolvedValue(EMPTY_ALERTS as any);

    const { result } = renderHook(() => useSubjectAlerts({ recordId: 'rec1' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasPendingRejectionResponse).toBe(false);
  });

  it('does not throw and still resolves isLoading:false when the query rejects', async () => {
    setUser('user1');
    vi.mocked(SubjectQueryService.getRecordAlerts).mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useSubjectAlerts({ recordId: 'rec1' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasSubjectRequest).toBe(false);
  });

  it('refetch re-runs the query and updates state', async () => {
    setUser('user1');
    vi.mocked(SubjectQueryService.getRecordAlerts).mockResolvedValue(EMPTY_ALERTS as any);

    const { result } = renderHook(() => useSubjectAlerts({ recordId: 'rec1' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(SubjectQueryService.getRecordAlerts).mockResolvedValue({
      ...EMPTY_ALERTS,
      hasPendingRequest: true,
    } as any);

    await result.current.refetch();

    await waitFor(() => expect(result.current.hasSubjectRequest).toBe(true));
    expect(SubjectQueryService.getRecordAlerts).toHaveBeenCalledTimes(2);
  });
});
