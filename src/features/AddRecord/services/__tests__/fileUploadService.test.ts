// src/features/AddRecord/services/__tests__/fileUploadService.test.ts
//
// Tier 3 — mocks the firebase/uploadUtils boundary (createFirestoreRecord/uploadFileComplete)
// and drives the real retry/backoff + error-classification logic in FileUploadService directly,
// using fake timers to avoid real 1s/2s/4s waits.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { createFirestoreRecordMock, uploadFileCompleteMock, deleteRecordCompleteMock } = vi.hoisted(
  () => ({
    createFirestoreRecordMock: vi.fn(),
    uploadFileCompleteMock: vi.fn(),
    deleteRecordCompleteMock: vi.fn(),
  })
);

vi.mock('@/firebase/uploadUtils', () => ({
  createFirestoreRecord: createFirestoreRecordMock,
  uploadFileComplete: uploadFileCompleteMock,
  deleteRecordComplete: deleteRecordCompleteMock,
}));

import { FileUploadService, FileUploadError } from '../fileUploadService';
import type { FileObject } from '@/types/core';

function makeFile(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'file-1',
    fileName: 'test.pdf',
    fileSize: 100,
    fileType: 'application/pdf',
    administrators: ['user-1'],
    status: 'pending',
    isVirtual: false,
    file: new File(['content'], 'test.pdf', { type: 'application/pdf' }),
    ...overrides,
  } as FileObject;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FileUploadService — regular vs virtual routing', () => {
  it('uploads a regular file via uploadFileComplete', async () => {
    uploadFileCompleteMock.mockResolvedValue({
      documentId: 'doc-1',
      downloadURL: 'https://example.com/file',
      filePath: 'path/to/file',
    });

    const service = new FileUploadService();
    const result = await service.uploadFile(makeFile());

    expect(uploadFileCompleteMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      success: true,
      documentId: 'doc-1',
      downloadURL: 'https://example.com/file',
    });
  });

  it('uploads a virtual file via createFirestoreRecord, with no storage path/URL', async () => {
    createFirestoreRecordMock.mockResolvedValue('doc-virtual-1');

    const service = new FileUploadService();
    const result = await service.uploadFile(makeFile({ isVirtual: true, file: undefined }));

    expect(createFirestoreRecordMock).toHaveBeenCalledTimes(1);
    expect(uploadFileCompleteMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      documentId: 'doc-virtual-1',
      downloadURL: '',
      filePath: '',
    });
  });

  it('throws INVALID_FILE_TYPE when a non-virtual fileObj has no file attached', async () => {
    const service = new FileUploadService();

    // Call uploadSingleFile directly (not uploadFile/uploadWithRetry) — this is a permanent
    // validation failure, not a transient one, so it shouldn't be wrapped in real retry delays.
    await expect(service.uploadSingleFile(makeFile({ file: undefined }))).rejects.toMatchObject({
      code: 'INVALID_FILE_TYPE',
    });
  });
});

describe('FileUploadService — retry/backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries with exponential backoff (1s, 2s) and succeeds on the 3rd attempt', async () => {
    const service = new FileUploadService();
    const uploadSingleFileSpy = vi
      .spyOn(service, 'uploadSingleFile')
      .mockRejectedValueOnce(new Error('transient failure 1'))
      .mockRejectedValueOnce(new Error('transient failure 2'))
      .mockResolvedValueOnce({ success: true, documentId: 'doc-1' });

    const resultPromise = service.uploadWithRetry(makeFile(), 3);

    await vi.advanceTimersByTimeAsync(1000); // delay after attempt 1
    await vi.advanceTimersByTimeAsync(2000); // delay after attempt 2

    const result = await resultPromise;

    expect(uploadSingleFileSpy).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ success: true, documentId: 'doc-1' });
  });

  it('gives up after maxRetries+1 attempts and throws a FileUploadError', async () => {
    const service = new FileUploadService();
    vi.spyOn(service, 'uploadSingleFile').mockRejectedValue(new Error('persistent failure'));

    const resultPromise = service.uploadWithRetry(makeFile(), 2).catch(e => e);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    const error = await resultPromise;
    expect(error).toBeInstanceOf(FileUploadError);
    expect(error.message).toContain('after 3 attempts');
  });

  it('stops retrying once cancelUpload has been called mid-attempt', async () => {
    const service = new FileUploadService();
    const fileObj = makeFile();
    vi.spyOn(service, 'uploadSingleFile').mockImplementation(async () => {
      service.cancelUpload(fileObj.id);
      throw new Error('attempt fails after cancellation requested');
    });

    const resultPromise = service.uploadWithRetry(fileObj, 3).catch(e => e);
    await vi.advanceTimersByTimeAsync(1000);

    const error = await resultPromise;
    expect(error).toBeInstanceOf(FileUploadError);
    expect(error.code).toBe('UPLOAD_CANCELLED');
  });
});

describe('FileUploadService — error classification', () => {
  const cases: Array<[any, string]> = [
    [{ code: 'storage/quota-exceeded' }, 'STORAGE_QUOTA_EXCEEDED'],
    [{ code: 'storage/unauthorized' }, 'PERMISSION_DENIED'],
    [{ code: 'storage/network-error' }, 'NETWORK_ERROR'],
    [{ code: 'storage/something-else' }, 'UNKNOWN_ERROR'],
    [{ message: 'File too large to upload' }, 'FILE_TOO_LARGE'],
    [{ message: 'Invalid file type provided' }, 'INVALID_FILE_TYPE'],
    [{ message: 'A network error occurred' }, 'NETWORK_ERROR'],
    [{ message: 'Something completely unexpected' }, 'UNKNOWN_ERROR'],
    [{}, 'UNKNOWN_ERROR'],
  ];

  it.each(cases)('classifies %j as %s', async (rawError, expectedCode) => {
    const service = new FileUploadService();
    vi.spyOn(service, 'uploadSingleFile').mockRejectedValue(rawError);

    // maxRetries = 0 -> single attempt, throws immediately with no backoff delay
    const error: any = await service.uploadWithRetry(makeFile(), 0).catch(e => e);

    expect(error).toBeInstanceOf(FileUploadError);
    expect(error.code).toBe(expectedCode);
  });
});
