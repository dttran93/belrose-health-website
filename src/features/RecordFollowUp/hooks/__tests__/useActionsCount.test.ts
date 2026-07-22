// @vitest-environment jsdom
//
// src/features/RecordFollowUp/hooks/__tests__/useActionsCount.test.ts
//
// Tier 3 — mocks useAuthContext/useUserRecords/useInboundRequests/SubjectQueryService and drives
// the real synchronous per-record "needs attention" logic (subject missing / no verification
// proxy via credibility score / any pending inbound request flags every record) plus the async
// rejection-count aggregation, including that a single rejection-fetch failure zeroes the whole
// rejection count rather than partially counting.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { useAuthContextMock, useUserRecordsMock, useInboundRequestsMock, getPendingRejectionResponsesMock } =
  vi.hoisted(() => ({
    useAuthContextMock: vi.fn(),
    useUserRecordsMock: vi.fn(),
    useInboundRequestsMock: vi.fn(),
    getPendingRejectionResponsesMock: vi.fn(),
  }));

vi.mock('@/features/Auth/AuthContext', () => ({
  useAuthContext: useAuthContextMock,
}));

vi.mock('@/features/ViewEditRecord/hooks/useUserRecords', () => ({
  useUserRecords: useUserRecordsMock,
}));

vi.mock('@/features/RequestRecord/hooks/useInboundRequests', () => ({
  useInboundRequests: useInboundRequestsMock,
}));

vi.mock('@/features/Subject/services/subjectQueryService', () => ({
  default: { getPendingRejectionResponses: getPendingRejectionResponsesMock },
}));

import { useActionsCount } from '../useActionsCount';
import type { FileObject } from '@/types/core';

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'record-1',
    fileSize: 100,
    fileType: 'application/pdf',
    administrators: [],
    status: 'completed',
    subjects: [],
    ...overrides,
  } as FileObject;
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthContextMock.mockReturnValue({ user: { uid: 'user-1' } });
  useInboundRequestsMock.mockReturnValue({ requests: [], loading: false });
  getPendingRejectionResponsesMock.mockResolvedValue([]);
});

describe('useActionsCount — loading', () => {
  it('reports isLoading while records or requests are still loading, with count 0', () => {
    useUserRecordsMock.mockReturnValue({ records: [], loading: true });
    const { result } = renderHook(() => useActionsCount());
    expect(result.current).toEqual({ count: 0, isLoading: true });
  });
});

describe('useActionsCount — synchronous per-record checks', () => {
  it('counts a record with no subject as needing attention', async () => {
    useUserRecordsMock.mockReturnValue({
      records: [makeRecord({ subjects: [], credibility: { score: 900 } as any })],
      loading: false,
    });
    const { result } = renderHook(() => useActionsCount());
    await waitFor(() => expect(result.current.count).toBe(1));
  });

  it('counts a record with no verification (credibility score 0/absent), unless the user is its subject', async () => {
    useUserRecordsMock.mockReturnValue({
      records: [makeRecord({ subjects: ['someone-else'], credibility: undefined })],
      loading: false,
    });
    const { result } = renderHook(() => useActionsCount());
    await waitFor(() => expect(result.current.count).toBe(1));
  });

  it('does not count a fully-verified record the user has no other issues with', async () => {
    useUserRecordsMock.mockReturnValue({
      records: [makeRecord({ subjects: ['someone-else'], credibility: { score: 900 } as any })],
      loading: false,
    });
    const { result } = renderHook(() => useActionsCount());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.count).toBe(0);
  });

  it('skips the verification check when the current user is the record subject', async () => {
    useUserRecordsMock.mockReturnValue({
      records: [makeRecord({ subjects: ['user-1'], credibility: undefined })],
      loading: false,
    });
    const { result } = renderHook(() => useActionsCount());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // subjects is non-empty so "subject missing" doesn't fire, and being the subject exempts
    // the record from the verification check too — nothing else flags it.
    expect(result.current.count).toBe(0);
  });

  it('flags every record when there is any pending inbound request', async () => {
    useInboundRequestsMock.mockReturnValue({ requests: [{ status: 'pending' }], loading: false });
    useUserRecordsMock.mockReturnValue({
      records: [
        makeRecord({ id: 'a', subjects: ['someone-else'], credibility: { score: 900 } as any }),
        makeRecord({ id: 'b', subjects: ['someone-else'], credibility: { score: 900 } as any }),
      ],
      loading: false,
    });
    const { result } = renderHook(() => useActionsCount());
    // Both records are otherwise "complete" but get flagged solely due to the pending request.
    await waitFor(() => expect(result.current.count).toBe(2));
  });
});

describe('useActionsCount — rejection-response aggregation', () => {
  it('only checks rejection responses for records the user owns or uploaded', async () => {
    useUserRecordsMock.mockReturnValue({
      records: [
        makeRecord({ id: 'mine', uploadedBy: 'user-1', subjects: ['x'], credibility: { score: 900 } as any }),
        makeRecord({ id: 'not-mine', uploadedBy: 'other', subjects: ['x'], credibility: { score: 900 } as any }),
      ],
      loading: false,
    });
    getPendingRejectionResponsesMock.mockResolvedValue([]);

    const { result } = renderHook(() => useActionsCount());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getPendingRejectionResponsesMock).toHaveBeenCalledTimes(1);
    expect(getPendingRejectionResponsesMock).toHaveBeenCalledWith('mine');
  });

  it('adds rejection counts on top of the synchronous per-record count', async () => {
    useUserRecordsMock.mockReturnValue({
      records: [makeRecord({ id: 'mine', owners: ['user-1'], subjects: ['x'], credibility: { score: 900 } as any })],
      loading: false,
    });
    getPendingRejectionResponsesMock.mockResolvedValue([{ id: 'rejection-1' }]);

    const { result } = renderHook(() => useActionsCount());
    // The record itself is otherwise "complete" (0 from the sync pass), but 1 pending
    // rejection response is added on top.
    await waitFor(() => expect(result.current.count).toBe(1));
  });

  it('zeroes the whole rejection count if any single lookup fails', async () => {
    useUserRecordsMock.mockReturnValue({
      records: [
        makeRecord({ id: 'a', owners: ['user-1'], subjects: ['x'], credibility: { score: 900 } as any }),
        makeRecord({ id: 'b', owners: ['user-1'], subjects: ['x'], credibility: { score: 900 } as any }),
      ],
      loading: false,
    });
    getPendingRejectionResponsesMock
      .mockResolvedValueOnce([{ id: 'rejection-1' }])
      .mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useActionsCount());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.count).toBe(0);
  });
});
