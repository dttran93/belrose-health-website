// @vitest-environment jsdom
//
// src/features/ViewEditRecord/hooks/__tests__/useRecordDeletion.test.ts
//
// Tier 3 (RecordDeletionService/useAuthContext mocked) — drives the real
// idle->checking->options->confirming->deleting->success/error phase transitions, including
// both the full-delete and remove-just-me paths, the record-change reset effect, and the
// deferred onSuccess callback fired after a successful deletion.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { checkDeletionPermissionsMock, deleteRecordMock, removeUserFromRecordMock } = vi.hoisted(
  () => ({
    checkDeletionPermissionsMock: vi.fn(),
    deleteRecordMock: vi.fn(),
    removeUserFromRecordMock: vi.fn(),
  })
);

vi.mock('../../services/recordDeletionService', () => ({
  default: {
    checkDeletionPermissions: checkDeletionPermissionsMock,
    deleteRecord: deleteRecordMock,
    removeUserFromRecord: removeUserFromRecordMock,
  },
}));

vi.mock('@/features/Auth/AuthContext', () => ({
  useAuthContext: () => ({ user: { uid: 'user-1' } }),
}));

import { useRecordDeletion } from '../useRecordDeletion';
import type { FileObject } from '@/types/core';

function makeRecord(overrides: Partial<FileObject> = {}): FileObject {
  return { id: 'record-1', administrators: ['user-1'], ...overrides } as FileObject;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRecordDeletion — initiateDeletion', () => {
  it('moves idle -> checking -> options on success', async () => {
    checkDeletionPermissionsMock.mockResolvedValue({ canDelete: true, requiresConfirmation: true });

    const { result } = renderHook(() => useRecordDeletion(makeRecord()));
    expect(result.current.dialogProps.phase).toBe('idle');
    expect(result.current.isOpen).toBe(false);

    await act(async () => {
      await result.current.initiateDeletion();
    });

    expect(result.current.dialogProps.phase).toBe('options');
    expect(result.current.isOpen).toBe(true);
    expect(result.current.dialogProps.checkResult).toMatchObject({ canDelete: true });
  });

  it('moves to the error phase when the permission check throws', async () => {
    checkDeletionPermissionsMock.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useRecordDeletion(makeRecord()));

    await act(async () => {
      await result.current.initiateDeletion();
    });

    expect(result.current.dialogProps.phase).toBe('error');
    expect(result.current.dialogProps.error).toBe('network down');
  });
});

describe('useRecordDeletion — confirmDeletion', () => {
  it('moves options -> confirming -> deleting -> success, then calls onSuccess after the delay', async () => {
    vi.useFakeTimers();
    checkDeletionPermissionsMock.mockResolvedValue({ canDelete: true });
    deleteRecordMock.mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useRecordDeletion(makeRecord(), onSuccess));

    await act(async () => {
      await result.current.initiateDeletion();
    });
    act(() => result.current.dialogProps.startDeletion());
    expect(result.current.dialogProps.phase).toBe('confirming');

    await act(async () => {
      await result.current.dialogProps.confirmDeletion();
    });
    expect(result.current.dialogProps.phase).toBe('success');
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('moves to the error phase when deletion fails', async () => {
    checkDeletionPermissionsMock.mockResolvedValue({ canDelete: true });
    deleteRecordMock.mockRejectedValue(new Error('permission revoked'));

    const { result } = renderHook(() => useRecordDeletion(makeRecord()));

    await act(async () => {
      await result.current.initiateDeletion();
    });
    await act(async () => {
      await result.current.dialogProps.confirmDeletion();
    });

    expect(result.current.dialogProps.phase).toBe('error');
    expect(result.current.dialogProps.error).toBe('permission revoked');
  });
});

describe('useRecordDeletion — removeJustMe', () => {
  it('removes the user and reaches success without deleting the whole record', async () => {
    vi.useFakeTimers();
    removeUserFromRecordMock.mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useRecordDeletion(makeRecord(), onSuccess));

    await act(async () => {
      await result.current.dialogProps.removeJustMe();
    });

    expect(removeUserFromRecordMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'record-1' }), 'user-1');
    expect(deleteRecordMock).not.toHaveBeenCalled();
    expect(result.current.dialogProps.phase).toBe('success');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

describe('useRecordDeletion — isUserSubject / closeDialog / reset-on-record-change', () => {
  it('derives isUserSubject from whether the current user is in record.subjects', () => {
    const { result: withSubject } = renderHook(() =>
      useRecordDeletion(makeRecord({ subjects: ['user-1'] } as any))
    );
    expect(withSubject.current.dialogProps.isUserSubject).toBe(true);

    const { result: withoutSubject } = renderHook(() => useRecordDeletion(makeRecord()));
    expect(withoutSubject.current.dialogProps.isUserSubject).toBe(false);
  });

  it('closeDialog resets phase to idle and clears any error', async () => {
    checkDeletionPermissionsMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useRecordDeletion(makeRecord()));

    await act(async () => {
      await result.current.initiateDeletion();
    });
    expect(result.current.dialogProps.phase).toBe('error');

    act(() => result.current.dialogProps.closeDialog());

    expect(result.current.dialogProps.phase).toBe('idle');
    expect(result.current.dialogProps.error).toBeNull();
  });

  it('resets to idle when the record id changes', async () => {
    checkDeletionPermissionsMock.mockResolvedValue({ canDelete: true });
    const { result, rerender } = renderHook(({ record }) => useRecordDeletion(record), {
      initialProps: { record: makeRecord({ id: 'record-1' }) },
    });

    await act(async () => {
      await result.current.initiateDeletion();
    });
    expect(result.current.dialogProps.phase).toBe('options');

    rerender({ record: makeRecord({ id: 'record-2' }) });

    expect(result.current.dialogProps.phase).toBe('idle');
  });
});

afterEach(() => {
  vi.useRealTimers();
});
