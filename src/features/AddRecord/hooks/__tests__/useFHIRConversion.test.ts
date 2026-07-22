// @vitest-environment jsdom
//
// src/features/AddRecord/hooks/__tests__/useFHIRConversion.test.ts
//
// Tier 3 (convertToFHIR/FileUploadService/useAuthContext/@/firebase/uploadUtils mocked) — covers
// the conversion + review state machine: handleFHIRConverted's context-merging and
// conversion-succeeded-but-save-failed branch, handleDataConfirmed's upload-then-save chain and
// its several early-return guard clauses, handleDataRejected's cleanup, and the
// isAllFilesConverted/isAllFilesReviewed/getFHIRStats derived-state helpers.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';

const { convertToFHIRMock, updateWithFHIRMock, updateFirestoreRecordMock } = vi.hoisted(() => ({
  convertToFHIRMock: vi.fn(),
  updateWithFHIRMock: vi.fn(),
  updateFirestoreRecordMock: vi.fn(),
}));

vi.mock('@/features/Auth/AuthContext', () => ({
  useAuthContext: () => ({ user: { uid: 'user-1' } }),
}));

vi.mock('@/features/AddRecord/services/fhirConversionService', () => ({
  convertToFHIR: convertToFHIRMock,
}));

vi.mock('../../services/fileUploadService', () => ({
  FileUploadService: vi.fn().mockImplementation(function () {
    return { updateWithFHIR: updateWithFHIRMock };
  }),
}));

vi.mock('@/firebase/uploadUtils', () => ({
  updateFirestoreRecord: updateFirestoreRecordMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { useFHIRConversion } from '../useFHIRConversion';
import type { FileObject } from '@/types/core';

function makeFile(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'file-1',
    fileName: 'test.pdf',
    fileSize: 100,
    fileType: 'application/pdf',
    administrators: ['user-1'],
    status: 'completed',
    extractedText: 'raw document text',
    ...overrides,
  } as FileObject;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useFHIRConversion — handleFHIRConverted', () => {
  it('converts the extracted text and saves the result when a documentId is present', async () => {
    convertToFHIRMock.mockResolvedValue({ resourceType: 'Bundle', _validation: { isValid: true } });
    updateWithFHIRMock.mockResolvedValue(undefined);

    const file = makeFile();
    const { result } = renderHook(() => useFHIRConversion([file]));

    await act(async () => {
      await result.current.handleFHIRConverted('file-1', { documentId: 'doc-1' });
    });

    expect(convertToFHIRMock).toHaveBeenCalledWith('raw document text');
    expect(updateWithFHIRMock).toHaveBeenCalledWith(
      'doc-1',
      expect.objectContaining({ resourceType: 'Bundle' })
    );
    expect(result.current.fhirData.get('file-1')).toMatchObject({ resourceType: 'Bundle' });
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('FHIR conversion completed'),
      expect.anything()
    );
  });

  it('prepends user-provided context to the extracted text before conversion', async () => {
    convertToFHIRMock.mockResolvedValue({ resourceType: 'Bundle' });

    const file = makeFile({ contextText: 'This is from my cardiologist' });
    const { result } = renderHook(() => useFHIRConversion([file]));

    await act(async () => {
      await result.current.handleFHIRConverted('file-1', {});
    });

    expect(convertToFHIRMock).toHaveBeenCalledWith(
      expect.stringContaining('USER PROVIDED CONTEXT:\nThis is from my cardiologist')
    );
    expect(convertToFHIRMock).toHaveBeenCalledWith(expect.stringContaining('raw document text'));
  });

  it('does nothing when the target file has no extractedText', async () => {
    const file = makeFile({ extractedText: '' });
    const { result } = renderHook(() => useFHIRConversion([file]));

    await act(async () => {
      await result.current.handleFHIRConverted('file-1', {});
    });

    expect(convertToFHIRMock).not.toHaveBeenCalled();
  });

  it('shows an error toast and leaves fhirData empty when conversion fails', async () => {
    convertToFHIRMock.mockRejectedValue(new Error('AI service unavailable'));

    const file = makeFile();
    const { result } = renderHook(() => useFHIRConversion([file]));

    await act(async () => {
      await result.current.handleFHIRConverted('file-1', {});
    });

    expect(result.current.fhirData.has('file-1')).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('FHIR conversion failed'),
      expect.anything()
    );
  });

  it('still records the conversion but surfaces a save-failed toast when updateWithFHIR throws', async () => {
    convertToFHIRMock.mockResolvedValue({ resourceType: 'Bundle' });
    updateWithFHIRMock.mockRejectedValue(new Error('network down'));

    const file = makeFile();
    const { result } = renderHook(() => useFHIRConversion([file]));

    await act(async () => {
      await result.current.handleFHIRConverted('file-1', { documentId: 'doc-1' });
    });

    expect(result.current.fhirData.get('file-1')).toMatchObject({ resourceType: 'Bundle' });
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save FHIR data'),
      expect.anything()
    );
  });
});

describe('useFHIRConversion — handleDataConfirmed', () => {
  it('uploads the file, then saves the confirmed FHIR data to Firestore', async () => {
    const uploadFiles = vi.fn().mockResolvedValue([{ success: true, documentId: 'doc-1' }]);
    const updateFirestoreRecordProp = vi.fn();
    updateFirestoreRecordMock.mockResolvedValue(undefined);

    const file = makeFile();
    const { result } = renderHook(() =>
      useFHIRConversion([file], updateFirestoreRecordProp, uploadFiles)
    );

    await act(async () => {
      await result.current.handleDataConfirmed('file-1', { fhirData: { resourceType: 'Bundle' } });
    });

    expect(uploadFiles).toHaveBeenCalledWith([file]);
    expect(updateFirestoreRecordMock).toHaveBeenCalledWith('doc-1', { resourceType: 'Bundle' });
    expect(updateFirestoreRecordProp).toHaveBeenCalledWith('file-1', {
      documentId: 'doc-1',
      fhirData: { resourceType: 'Bundle' },
      status: 'saved',
    });
  });

  it('does nothing when uploadFiles is not provided', async () => {
    const file = makeFile();
    const { result } = renderHook(() => useFHIRConversion([file]));

    await act(async () => {
      await result.current.handleDataConfirmed('file-1', { fhirData: {} });
    });

    expect(updateFirestoreRecordMock).not.toHaveBeenCalled();
  });

  it('does not save when the upload result reports failure', async () => {
    const uploadFiles = vi.fn().mockResolvedValue([{ success: false }]);
    const file = makeFile();
    const { result } = renderHook(() => useFHIRConversion([file], undefined, uploadFiles));

    await act(async () => {
      await result.current.handleDataConfirmed('file-1', { fhirData: {} });
    });

    expect(updateFirestoreRecordMock).not.toHaveBeenCalled();
  });

  it('does not save when editedData has no fhirData', async () => {
    const uploadFiles = vi.fn().mockResolvedValue([{ success: true, documentId: 'doc-1' }]);
    const file = makeFile();
    const { result } = renderHook(() => useFHIRConversion([file], undefined, uploadFiles));

    await act(async () => {
      await result.current.handleDataConfirmed('file-1', {});
    });

    expect(updateFirestoreRecordMock).not.toHaveBeenCalled();
  });

  it('bails out gracefully when the original file cannot be found', async () => {
    const uploadFiles = vi.fn();
    const { result } = renderHook(() => useFHIRConversion([], undefined, uploadFiles));

    await act(async () => {
      await result.current.handleDataConfirmed('missing-file', { fhirData: {} });
    });

    expect(uploadFiles).not.toHaveBeenCalled();
  });
});

describe('useFHIRConversion — handleDataRejected', () => {
  it('clears fhirData/reviewedData for the file and calls removeProcessedFile', async () => {
    convertToFHIRMock.mockResolvedValue({ resourceType: 'Bundle' });
    const removeProcessedFile = vi.fn();
    const file = makeFile();
    const { result } = renderHook(() => useFHIRConversion([file], undefined, undefined, removeProcessedFile));

    await act(async () => {
      await result.current.handleFHIRConverted('file-1', {});
    });
    expect(result.current.fhirData.has('file-1')).toBe(true);

    act(() => {
      result.current.handleDataRejected('file-1');
    });

    expect(result.current.fhirData.has('file-1')).toBe(false);
    expect(removeProcessedFile).toHaveBeenCalledWith('file-1');
    expect(toast.info).toHaveBeenCalled();
  });
});

describe('useFHIRConversion — derived state helpers', () => {
  it('isAllFilesConverted is false until every eligible file has FHIR data', async () => {
    convertToFHIRMock.mockResolvedValue({ resourceType: 'Bundle' });
    const fileA = makeFile({ id: 'a' });
    const fileB = makeFile({ id: 'b' });
    const { result } = renderHook(() => useFHIRConversion([fileA, fileB]));

    expect(result.current.isAllFilesConverted()).toBe(false);

    await act(async () => {
      await result.current.handleFHIRConverted('a', {});
    });
    expect(result.current.isAllFilesConverted()).toBe(false);

    await act(async () => {
      await result.current.handleFHIRConverted('b', {});
    });
    expect(result.current.isAllFilesConverted()).toBe(true);
  });

  it('getFHIRStats counts Bundle entries, or 1 per non-Bundle resource', async () => {
    convertToFHIRMock
      .mockResolvedValueOnce({
        resourceType: 'Bundle',
        entry: [{ resource: { resourceType: 'Condition' } }, { resource: { resourceType: 'Observation' } }],
      })
      .mockResolvedValueOnce({ resourceType: 'Condition' });

    const fileA = makeFile({ id: 'a' });
    const fileB = makeFile({ id: 'b' });
    const { result } = renderHook(() => useFHIRConversion([fileA, fileB]));

    await act(async () => {
      await result.current.handleFHIRConverted('a', {});
      await result.current.handleFHIRConverted('b', {});
    });

    expect(result.current.getFHIRStats()).toBe(3);
  });

  it('reset clears both fhirData and reviewedData', async () => {
    convertToFHIRMock.mockResolvedValue({ resourceType: 'Bundle' });
    const file = makeFile();
    const { result } = renderHook(() => useFHIRConversion([file]));

    await act(async () => {
      await result.current.handleFHIRConverted('file-1', {});
    });
    expect(result.current.fhirData.size).toBe(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.fhirData.size).toBe(0);
    expect(result.current.reviewedData.size).toBe(0);
  });
});
