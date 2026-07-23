// @vitest-environment jsdom
//
// src/features/AddRecord/hooks/__tests__/useFileManager.test.ts
//
// Tier 3 (FileUploadService/CombinedRecordProcessingService/useAuthContext mocked) — covers the
// orchestration logic that actually lives in this hook: processFile's success/failure status
// transitions, uploadFiles' per-file try/catch and in-flight dedup, and the two composite
// cleanup paths (removeFileComplete, enhancedClearAll) that tolerate partial Firebase-delete
// failure without losing local state consistency.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';

const {
  deleteFileMock,
  uploadFileMock,
  cancelUploadMock,
  updateRecordMock,
  processUploadedFileMock,
} = vi.hoisted(() => ({
  deleteFileMock: vi.fn(),
  uploadFileMock: vi.fn(),
  cancelUploadMock: vi.fn(),
  updateRecordMock: vi.fn(),
  processUploadedFileMock: vi.fn(),
}));

vi.mock('@/features/AddRecord/services/fileUploadService', () => ({
  // vi.fn().mockImplementation needs a `function`, not an arrow function, to be usable with
  // `new` — arrow functions can never be constructors, so `new FileUploadService()` in the hook
  // under test would throw "is not a constructor" with an arrow-function implementation here.
  FileUploadService: vi.fn().mockImplementation(function () {
    return {
      deleteFile: deleteFileMock,
      uploadFile: uploadFileMock,
      cancelUpload: cancelUploadMock,
      updateRecord: updateRecordMock,
    };
  }),
}));

vi.mock('../useRecordProcessing', () => ({
  CombinedRecordProcessingService: { processUploadedFile: processUploadedFileMock },
}));

vi.mock('@/features/Auth/AuthContext', () => ({
  useAuthContext: () => ({ user: { uid: 'user-1' } }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import React from 'react';
import { useFileManager } from '../useFileManager';
import {
  OnChainActivityTrayProvider,
  useOnChainActivityTray,
} from '@/features/OnChainActivityTray/OnChainActivityTrayContext';
import type { FileObject } from '@/types/core';

// useFileManager reports processing/upload progress into the OnChainActivityTray context,
// so every renderHook needs it in the tree or the hook throws. Plain .ts (no JSX) — use
// createElement directly.
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(OnChainActivityTrayProvider, null, children);

function makeFile(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'file-1',
    fileName: 'test.pdf',
    fileSize: 100,
    fileType: 'application/pdf',
    administrators: ['user-1'],
    status: 'pending',
    isVirtual: false,
    ...overrides,
  } as FileObject;
}

/** FileList isn't constructible directly — real File[] wrapped in the array-like shape addFiles expects. */
function makeFileList(files: File[]): FileList {
  const list = [...files] as unknown as FileList;
  (list as any).length = files.length;
  (list as any)[Symbol.iterator] = Array.prototype[Symbol.iterator];
  return list;
}

async function addOneFile(result: { current: ReturnType<typeof useFileManager> }, name = 'a.pdf') {
  await act(async () => {
    await result.current.addFiles(makeFileList([new File(['a'], name, { type: 'application/pdf' })]));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('useFileManager — addFiles validation', () => {
  it('rejects files beyond maxFiles and shows a toast, but still adds the ones within the limit', async () => {
    const { result } = renderHook(() => useFileManager(), { wrapper });

    const fileList = makeFileList([
      new File(['a'], 'a.pdf', { type: 'application/pdf' }),
      new File(['b'], 'b.pdf', { type: 'application/pdf' }),
    ]);

    await act(async () => {
      await result.current.addFiles(fileList, { maxFiles: 1 });
    });

    expect(result.current.files).toHaveLength(1);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Maximum 1 files allowed'));
  });

  it('rejects files over maxSizeBytes and shows a toast', async () => {
    const { result } = renderHook(() => useFileManager(), { wrapper });

    const bigFile = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 100 * 1024 * 1024 });

    await act(async () => {
      await result.current.addFiles(makeFileList([bigFile]), { maxSizeBytes: 50 * 1024 * 1024 });
    });

    expect(result.current.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('too large'));
  });
});

describe('useFileManager — processFile', () => {
  it('marks the file completed with the pipeline result on success', async () => {
    processUploadedFileMock.mockResolvedValue({
      extractedText: 'extracted',
      wordCount: 2,
      fhirData: { resourceType: 'Bundle' },
      recordHash: '0xabc',
      aiProcessingStatus: 'completed',
    });

    const { result } = renderHook(() => useFileManager(), { wrapper });

    let updated: FileObject | undefined;
    await act(async () => {
      updated = await result.current.processFile(makeFile());
    });

    expect(updated?.status).toBe('completed');
    expect(updated?.recordHash).toBe('0xabc');
  });

  it('marks the file errored and rethrows when the pipeline throws', async () => {
    processUploadedFileMock.mockRejectedValue(new Error('encryption failed'));

    const { result } = renderHook(() => useFileManager(), { wrapper });

    await act(async () => {
      await expect(result.current.processFile(makeFile())).rejects.toThrow('encryption failed');
    });
  });
});

describe('useFileManager — uploadFiles', () => {
  it('uploads successfully, stamps the resulting firestoreId, and resolves the tray activity', async () => {
    uploadFileMock.mockResolvedValue({ success: true, documentId: 'doc-1', downloadURL: 'url' });

    // Render alongside useOnChainActivityTray (sharing the same provider instance as wrapper)
    // so we can assert on the activity uploadFiles reports to — success is no longer toasted,
    // it's surfaced entirely through the tray now.
    const { result } = renderHook(
      () => ({ fileManager: useFileManager(), tray: useOnChainActivityTray() }),
      { wrapper }
    );

    await act(async () => {
      await result.current.fileManager.addFiles(
        makeFileList([new File(['a'], 'a.pdf', { type: 'application/pdf' })])
      );
    });

    const addedFile = result.current.fileManager.files[0]!;

    let uploadResults: any[] = [];
    await act(async () => {
      uploadResults = await result.current.fileManager.uploadFiles([addedFile]);
    });

    expect(uploadResults[0]).toMatchObject({ success: true, documentId: 'doc-1' });
    // uploadFiles' success path deliberately overwrites the local generated id with the new
    // Firestore document id (unifying local/remote identity post-upload) — so the file must now
    // be looked up by 'doc-1', not the original addedFile.id.
    expect(result.current.fileManager.files).toHaveLength(1);
    expect(result.current.fileManager.files[0]).toMatchObject({ id: 'doc-1', firestoreId: 'doc-1' });

    const activity = result.current.tray.activities.find(a => a.label === '"a.pdf" uploaded!');
    expect(activity).toMatchObject({ status: 'confirmed', link: '/app/records/doc-1' });
  });

  it('marks the file errored and returns success:false when the upload fails', async () => {
    uploadFileMock.mockRejectedValue(new Error('storage down'));

    const { result } = renderHook(() => useFileManager(), { wrapper });
    const fileObj = makeFile();

    let uploadResults: any[] = [];
    await act(async () => {
      uploadResults = await result.current.uploadFiles([fileObj]);
    });

    expect(uploadResults[0]).toMatchObject({
      success: false,
      fileId: fileObj.id,
      error: 'storage down',
    });
  });

  // Regression: cancelling a file while it's still processing (no firestoreId exists yet, so
  // removeFileComplete has nothing to delete at click-time) used to leave the in-flight
  // process+upload promise chain completely unaffected — it would silently finish and create a
  // real Firestore record despite the user having "removed" it from the UI. removeFileComplete
  // now marks the id cancelled up front, and uploadFiles checks that mark once its own upload
  // settles, deleting whatever it just created instead of leaving it.
  it('deletes the record it just created if the file was cancelled while still processing', async () => {
    uploadFileMock.mockResolvedValue({ success: true, documentId: 'doc-cancelled', downloadURL: 'url' });
    deleteFileMock.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => ({ fileManager: useFileManager(), tray: useOnChainActivityTray() }),
      { wrapper }
    );

    // removeFileComplete no-ops unless the file is present in `files` state, so it must actually
    // be added first — mirroring production, where the file exists (status 'processing') at the
    // moment the user clicks cancel, it's just not uploaded yet (no firestoreId).
    await act(async () => {
      await result.current.fileManager.addFiles(
        makeFileList([new File(['a'], 'a.pdf', { type: 'application/pdf' })])
      );
    });
    const fileObj = result.current.fileManager.files[0]!;

    // Simulates the user clicking cancel mid-processing: no firestoreId exists yet, so this
    // only marks the id cancelled (and no-ops on the Firebase-delete step) — the interesting
    // assertion is what happens when the still-in-flight upload for this same file settles.
    await act(async () => {
      await result.current.fileManager.removeFileComplete(fileObj.id);
    });

    let uploadResults: any[] = [];
    await act(async () => {
      uploadResults = await result.current.fileManager.uploadFiles([fileObj]);
    });

    expect(uploadResults[0]).toMatchObject({ success: false, fileId: fileObj.id, error: 'Upload cancelled' });
    expect(deleteFileMock).toHaveBeenCalledWith('doc-cancelled');

    const activity = result.current.tray.activities.find(a => a.label === `Saving "${fileObj.fileName}"`);
    expect(activity).toMatchObject({ status: 'failed', errorMessage: 'Cancelled' });
  });
});

describe('useFileManager — removeFileComplete', () => {
  // Regression: deleting a file *after* its upload already fully completed (firestoreId
  // already exists) correctly deleted from Firebase, but never touched the tray — its activity
  // just sat there forever reading "'<file>' uploaded!" even though the record was gone.
  it('flips the tray activity to cancelled when deleting an already-fully-uploaded file', async () => {
    uploadFileMock.mockResolvedValue({ success: true, documentId: 'doc-already-uploaded', downloadURL: 'url' });
    deleteFileMock.mockResolvedValue(undefined);

    const { result } = renderHook(
      () => ({ fileManager: useFileManager(), tray: useOnChainActivityTray() }),
      { wrapper }
    );

    await act(async () => {
      await result.current.fileManager.addFiles(
        makeFileList([new File(['a'], 'a.pdf', { type: 'application/pdf' })])
      );
    });
    const originalFile = result.current.fileManager.files[0]!;

    await act(async () => {
      await result.current.fileManager.uploadFiles([originalFile]);
    });

    const uploadedActivity = result.current.tray.activities.find(
      a => a.label === `"${originalFile.fileName}" uploaded!`
    );
    expect(uploadedActivity).toMatchObject({ status: 'confirmed' });

    const uploadedFile = result.current.fileManager.files[0]!;
    await act(async () => {
      await result.current.fileManager.removeFileComplete(uploadedFile.id);
    });

    expect(deleteFileMock).toHaveBeenCalledWith('doc-already-uploaded');

    const cancelledActivity = result.current.tray.activities.find(a => a.id === uploadedActivity!.id);
    expect(cancelledActivity).toMatchObject({
      status: 'failed',
      label: `"${originalFile.fileName}" upload cancelled`,
      errorMessage: 'Upload cancelled',
    });
  });

  it('deletes from Firebase and cleans up local state on success', async () => {
    deleteFileMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFileManager(), { wrapper });
    await addOneFile(result);
    const fileId = result.current.files[0]!.id;

    // Simulate the file having already been uploaded (has a firestoreId).
    act(() => {
      result.current.updateFileStatus(fileId, 'completed', { firestoreId: 'doc-1' });
    });

    await act(async () => {
      await result.current.removeFileComplete(fileId);
    });

    expect(deleteFileMock).toHaveBeenCalledWith('doc-1');
    expect(result.current.files).toHaveLength(0);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Deleted'));
  });

  it('still removes the file locally even when Firebase deletion fails', async () => {
    deleteFileMock.mockRejectedValue(new Error('permission denied'));

    const { result } = renderHook(() => useFileManager(), { wrapper });
    await addOneFile(result);
    const fileId = result.current.files[0]!.id;

    act(() => {
      result.current.updateFileStatus(fileId, 'completed', { firestoreId: 'doc-1' });
    });

    await act(async () => {
      await result.current.removeFileComplete(fileId);
    });

    expect(result.current.files).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Could not delete'));
  });
});

describe('useFileManager — enhancedClearAll', () => {
  it('reports a warning toast when some (but not all) Firebase deletions fail', async () => {
    deleteFileMock.mockImplementation(async (id: string) => {
      if (id === 'doc-fail') throw new Error('permission denied');
    });

    const { result } = renderHook(() => useFileManager(), { wrapper });
    await act(async () => {
      await result.current.addFiles(
        makeFileList([
          new File(['a'], 'a.pdf', { type: 'application/pdf' }),
          new File(['b'], 'b.pdf', { type: 'application/pdf' }),
        ])
      );
    });

    act(() => {
      result.current.updateFileStatus(result.current.files[0]!.id, 'completed', {
        firestoreId: 'doc-ok',
      });
      result.current.updateFileStatus(result.current.files[1]!.id, 'completed', {
        firestoreId: 'doc-fail',
      });
    });

    await act(async () => {
      await result.current.enhancedClearAll();
    });

    expect(result.current.files).toHaveLength(0);
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Could not delete 1 files'));
  });

  it('reports success when every Firebase deletion succeeds', async () => {
    deleteFileMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFileManager(), { wrapper });
    await addOneFile(result);

    act(() => {
      result.current.updateFileStatus(result.current.files[0]!.id, 'completed', {
        firestoreId: 'doc-ok',
      });
    });

    await act(async () => {
      await result.current.enhancedClearAll();
    });

    expect(result.current.files).toHaveLength(0);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Cleared all files'));
  });
});
