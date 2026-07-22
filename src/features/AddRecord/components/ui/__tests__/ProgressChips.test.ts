// src/features/AddRecord/components/ui/__tests__/ProgressChips.test.ts
//
// Tier 1 — createFileProcessingSteps is a pure FileObject -> ProcessingStep[] mapper with no
// side effects. Covers upload-type step-list selection (file/text/json), the hasError branch
// (which step gets marked 'error' depends on how far the pipeline got before failing), and the
// non-error active/completed/pending derivation per step.

import { describe, it, expect } from 'vitest';
import { createFileProcessingSteps } from '../ProgressChips';
import type { FileObject } from '@/types/core';

function makeFile(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'file-1',
    fileSize: 100,
    fileType: 'application/pdf',
    administrators: ['user-1'],
    status: 'pending',
    ...overrides,
  } as FileObject;
}

function statusOf(steps: ReturnType<typeof createFileProcessingSteps>, id: string) {
  return steps.find(s => s.id === id)?.status;
}

describe('createFileProcessingSteps — upload type / step list selection', () => {
  it('uses the file-upload step list (received/extract/fhir/ai/save) by default', () => {
    const steps = createFileProcessingSteps(makeFile());
    expect(steps.map(s => s.id)).toEqual(['received', 'extract', 'fhir', 'ai', 'save']);
  });

  it('uses the text-upload step list with "Text Received"/"Process Text" labels', () => {
    const steps = createFileProcessingSteps(makeFile({ sourceType: 'Plain Text Submission' }));
    expect(steps.map(s => s.id)).toEqual(['received', 'extract', 'fhir', 'ai', 'save']);
    expect(steps.find(s => s.id === 'received')?.label).toBe('Text Received');
    expect(steps.find(s => s.id === 'extract')?.label).toBe('Process Text');
  });

  it('uses the FHIR-JSON step list (received/validate/ai/save) for manual FHIR submissions', () => {
    const steps = createFileProcessingSteps(makeFile({ sourceType: 'Manual FHIR JSON Submission' }));
    expect(steps.map(s => s.id)).toEqual(['received', 'validate', 'ai', 'save']);
  });
});

describe('createFileProcessingSteps — non-error status derivation (file/text path)', () => {
  it('marks received completed and everything else pending for a brand-new file', () => {
    const steps = createFileProcessingSteps(makeFile());
    expect(statusOf(steps, 'received')).toBe('completed');
    expect(statusOf(steps, 'extract')).toBe('pending');
    expect(statusOf(steps, 'fhir')).toBe('pending');
    expect(statusOf(steps, 'ai')).toBe('pending');
    expect(statusOf(steps, 'save')).toBe('pending');
  });

  it('marks extract active while processingStage is Starting/Extracting', () => {
    const steps = createFileProcessingSteps(
      makeFile({ status: 'processing', processingStage: 'Extracting text...' })
    );
    expect(statusOf(steps, 'extract')).toBe('active');
  });

  it('marks extract completed once extractedText is present, and fhir active while converting', () => {
    const steps = createFileProcessingSteps(
      makeFile({
        status: 'processing',
        processingStage: 'Converting to FHIR...',
        extractedText: 'some text',
      })
    );
    expect(statusOf(steps, 'extract')).toBe('completed');
    expect(statusOf(steps, 'fhir')).toBe('active');
  });

  it('marks fhir completed once fhirData is present', () => {
    const steps = createFileProcessingSteps(makeFile({ extractedText: 'text', fhirData: {} }));
    expect(statusOf(steps, 'fhir')).toBe('completed');
  });

  it('marks ai active during AI processing stages', () => {
    const steps = createFileProcessingSteps(
      makeFile({
        extractedText: 'text',
        fhirData: {},
        status: 'processing',
        processingStage: 'AI analyzing content...',
      })
    );
    expect(statusOf(steps, 'ai')).toBe('active');
  });

  it('marks ai completed when aiProcessingStatus is completed', () => {
    const steps = createFileProcessingSteps(
      makeFile({ extractedText: 'text', fhirData: {}, aiProcessingStatus: 'completed' })
    );
    expect(statusOf(steps, 'ai')).toBe('completed');
  });

  it('marks ai completed when belroseFields are present even if aiProcessingStatus is stale', () => {
    const steps = createFileProcessingSteps(
      makeFile({
        extractedText: 'text',
        fhirData: {},
        aiProcessingStatus: 'not_needed',
        belroseFields: { some: 'field' } as any,
      })
    );
    expect(statusOf(steps, 'ai')).toBe('completed');
  });

  it('marks ai error when aiProcessingStatus is failed, independent of file status', () => {
    const steps = createFileProcessingSteps(
      makeFile({ extractedText: 'text', fhirData: {}, aiProcessingStatus: 'failed' })
    );
    expect(statusOf(steps, 'ai')).toBe('error');
  });

  it('marks save active while uploading, completed once file status is completed', () => {
    const uploading = createFileProcessingSteps(makeFile({ status: 'uploading' }));
    expect(statusOf(uploading, 'save')).toBe('active');

    const completed = createFileProcessingSteps(makeFile({ status: 'completed', id: 'doc-1' }));
    expect(statusOf(completed, 'save')).toBe('completed');
  });
});

describe('createFileProcessingSteps — error branch (file/text path)', () => {
  it('flags extract as the failure point when there is no extracted text yet', () => {
    const steps = createFileProcessingSteps(makeFile({ status: 'error' }));
    expect(statusOf(steps, 'received')).toBe('completed');
    expect(statusOf(steps, 'extract')).toBe('error');
    expect(statusOf(steps, 'fhir')).toBe('pending');
    expect(statusOf(steps, 'ai')).toBe('pending');
    expect(statusOf(steps, 'save')).toBe('pending');
  });

  it('flags fhir as the failure point when text was extracted but conversion never produced fhirData', () => {
    const steps = createFileProcessingSteps(makeFile({ status: 'error', extractedText: 'text' }));
    expect(statusOf(steps, 'extract')).toBe('pending');
    expect(statusOf(steps, 'fhir')).toBe('error');
  });

  it('flags ai as the failure point when fhirData exists but AI processing failed', () => {
    const steps = createFileProcessingSteps(
      makeFile({
        status: 'error',
        extractedText: 'text',
        fhirData: {},
        aiProcessingStatus: 'failed',
      })
    );
    expect(statusOf(steps, 'fhir')).toBe('pending');
    expect(statusOf(steps, 'ai')).toBe('error');
  });

  it('flags save as the failure point when everything upstream succeeded but there is no document id', () => {
    const steps = createFileProcessingSteps(
      makeFile({
        status: 'error',
        extractedText: 'text',
        fhirData: {},
        aiProcessingStatus: 'completed',
        id: '',
      })
    );
    expect(statusOf(steps, 'ai')).toBe('pending');
    expect(statusOf(steps, 'save')).toBe('error');
  });
});

describe('createFileProcessingSteps — error branch (FHIR-JSON path)', () => {
  it('flags validate as the failure point when there is no fhirData', () => {
    const steps = createFileProcessingSteps(
      makeFile({ status: 'error', sourceType: 'Manual FHIR JSON Submission' })
    );
    expect(statusOf(steps, 'received')).toBe('completed');
    expect(statusOf(steps, 'validate')).toBe('error');
    expect(statusOf(steps, 'ai')).toBe('pending');
    expect(statusOf(steps, 'save')).toBe('pending');
  });

  it('flags ai as the failure point when fhirData exists but AI processing failed', () => {
    const steps = createFileProcessingSteps(
      makeFile({
        status: 'error',
        sourceType: 'Manual FHIR JSON Submission',
        fhirData: {},
        aiProcessingStatus: 'failed',
      })
    );
    expect(statusOf(steps, 'validate')).toBe('pending');
    expect(statusOf(steps, 'ai')).toBe('error');
  });

  it('flags save as the failure point once fhirData/AI succeeded but there is no document id', () => {
    const steps = createFileProcessingSteps(
      makeFile({
        status: 'error',
        sourceType: 'Manual FHIR JSON Submission',
        fhirData: {},
        aiProcessingStatus: 'completed',
        id: '',
      })
    );
    expect(statusOf(steps, 'save')).toBe('error');
  });
});
