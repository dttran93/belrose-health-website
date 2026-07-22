// src/features/AddRecord/hooks/__tests__/useRecordProcessing.test.ts
//
// Tier 3 — mocks only the network/Cloud-Function-calling collaborators (DocumentProcessorService,
// convertToFHIR, createBelroseFields); RecordHashService and EncryptionService/EncryptionKeyManager
// are real, so this proves the actual 5-step pipeline chains correctly end-to-end: a real record
// hash gets generated and the record actually gets encrypted with a real session key. The main
// thing under test is partial-failure tolerance — FHIR/AI failures degrade gracefully (hash and
// encryption still happen), while a missing encryption session is the one fatal failure. No
// Firestore/emulator involved (this class never touches Firestore), so this lives here rather
// than in test/orchestration/ despite chaining multiple real services together.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { processDocumentMock, convertToFHIRMock, createBelroseFieldsMock } = vi.hoisted(() => ({
  processDocumentMock: vi.fn(),
  convertToFHIRMock: vi.fn(),
  createBelroseFieldsMock: vi.fn(),
}));

vi.mock('../../services/documentProcessorService', () => ({
  default: { processDocument: processDocumentMock },
}));

vi.mock('../../services/fhirConversionService', () => ({
  convertToFHIR: convertToFHIRMock,
}));

vi.mock('../../services/belroseFieldsService', () => ({
  createBelroseFields: createBelroseFieldsMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

import { CombinedRecordProcessingService } from '../useRecordProcessing';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import type { FileObject } from '@/types/core';

// EncryptionKeyManager persists the session key to sessionStorage, which doesn't exist in this
// file's plain 'node' environment (no jsdom) — same fake used by test/orchestration's
// recordDecryptionService.test.ts.
function installFakeSessionStorage() {
  const store = new Map<string, string>();
  const fakeStorage: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal('sessionStorage', fakeStorage);
}

const VALID_BUNDLE = { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Condition' } }] };
const VALID_BELROSE_FIELDS = {
  visitType: 'Office Visit',
  title: 'Lab Results',
  summary: 'Routine labs',
  completedDate: '2024-01-01',
  provider: 'Dr. Smith',
  patient: 'Jane Doe',
  institution: 'General Hospital',
  detailedNarrative: 'Everything normal.',
};

function makeFile(overrides: Partial<FileObject> = {}): FileObject {
  return {
    id: 'file-1',
    fileName: 'labs.pdf',
    fileSize: 100,
    fileType: 'application/pdf',
    administrators: ['user-1'],
    status: 'processing',
    ...overrides,
  } as FileObject;
}

beforeEach(async () => {
  vi.clearAllMocks();
  installFakeSessionStorage();
  EncryptionKeyManager.clearSession();
  processDocumentMock.mockResolvedValue({
    fileName: 'labs.pdf',
    fileType: 'application/pdf',
    fileSize: 100,
    extractedText: 'patient presented with routine labs',
    wordCount: 5,
    success: true,
    error: null,
  });
  convertToFHIRMock.mockResolvedValue(VALID_BUNDLE);
  createBelroseFieldsMock.mockResolvedValue(VALID_BELROSE_FIELDS);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CombinedRecordProcessingService.processUploadedFile — happy path', () => {
  it('runs all 5 steps and produces a real hash + real encrypted payload', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(masterKey);

    const result = await CombinedRecordProcessingService.processUploadedFile(makeFile());

    expect(result.extractedText).toBe('patient presented with routine labs');
    expect(result.wordCount).toBe(5);
    expect(result.fhirData).toEqual(VALID_BUNDLE);
    expect(result.belroseFields).toMatchObject({ title: 'Lab Results', visitType: 'Office Visit' });
    expect(result.aiProcessingStatus).toBe('completed');
    expect(result.recordHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.encryptedData).toMatchObject({
      fileName: { encrypted: expect.any(String), iv: expect.any(String) },
      encryptedKey: expect.any(String),
    });
  });

  it('reports processing stages in order via onStageUpdate', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(masterKey);
    const stages: string[] = [];

    await CombinedRecordProcessingService.processUploadedFile(makeFile(), {
      onStageUpdate: stage => {
        if (stage) stages.push(stage);
      },
    });

    expect(stages).toEqual([
      'Extracting text...',
      'Text extraction completed',
      'Converting to FHIR...',
      'FHIR conversion completed',
      'AI analyzing content...',
      'Generating record hash...',
      'Encrypting record data...',
      'Record encrypted',
    ]);
  });
});

describe('CombinedRecordProcessingService.processUploadedFile — partial-failure tolerance', () => {
  it('continues to hash+encrypt when FHIR conversion fails', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(masterKey);
    convertToFHIRMock.mockRejectedValue(new Error('AI FHIR service down'));

    const result = await CombinedRecordProcessingService.processUploadedFile(makeFile());

    expect(result.fhirData).toBeUndefined();
    expect(createBelroseFieldsMock).not.toHaveBeenCalled();
    expect(result.aiProcessingStatus).toBe('not_needed');
    expect(result.recordHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.encryptedData).toBeDefined();
  });

  it('does not treat a non-Bundle FHIR response as valid FHIR data', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(masterKey);
    convertToFHIRMock.mockResolvedValue({ resourceType: 'Condition' });

    const result = await CombinedRecordProcessingService.processUploadedFile(makeFile());

    expect(result.fhirData).toBeUndefined();
    expect(result.aiProcessingStatus).toBe('not_needed');
  });

  it('continues to hash+encrypt when AI (belrose fields) processing fails', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(masterKey);
    createBelroseFieldsMock.mockRejectedValue(new Error('AI service quota exceeded'));

    const result = await CombinedRecordProcessingService.processUploadedFile(makeFile());

    expect(result.fhirData).toEqual(VALID_BUNDLE);
    expect(result.belroseFields).toBeUndefined();
    expect(result.aiProcessingStatus).toBe('failed');
    expect(result.recordHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.encryptedData).toBeDefined();
  });

  it('skips FHIR conversion and AI processing entirely when no text was extracted', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(masterKey);
    processDocumentMock.mockResolvedValue({
      fileName: 'blank.pdf',
      fileType: 'application/pdf',
      fileSize: 100,
      extractedText: '',
      wordCount: 0,
      success: true,
      error: null,
    });

    const result = await CombinedRecordProcessingService.processUploadedFile(makeFile());

    expect(convertToFHIRMock).not.toHaveBeenCalled();
    expect(createBelroseFieldsMock).not.toHaveBeenCalled();
    expect(result.aiProcessingStatus).toBe('not_needed');
    expect(result.encryptedData).toBeDefined();
  });

  it('throws (fatal) when there is no active encryption session, after successful extraction/FHIR/AI', async () => {
    // No EncryptionKeyManager.setSessionKey call — session is empty.
    await expect(CombinedRecordProcessingService.processUploadedFile(makeFile())).rejects.toThrow(
      'No encryption session active'
    );
  });

  it('invokes onError and rethrows when encryption is not possible', async () => {
    const onError = vi.fn();
    await expect(
      CombinedRecordProcessingService.processUploadedFile(makeFile(), { onError })
    ).rejects.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('CombinedRecordProcessingService.processVirtualFile', () => {
  it('runs AI processing when fhirData is provided without belroseFields, then hashes+encrypts', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(masterKey);

    const result = await CombinedRecordProcessingService.processVirtualFile(
      { fhirData: VALID_BUNDLE, originalText: 'typed note' },
      'note.txt'
    );

    expect(createBelroseFieldsMock).toHaveBeenCalledTimes(1);
    expect(result.belroseFields).toMatchObject({ title: 'Lab Results' });
    expect(result.aiProcessingStatus).toBe('completed');
    expect(result.recordHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.encryptedData).toBeDefined();
  });

  it('uses belroseFields as-is when already provided, skipping the AI call', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(masterKey);

    const result = await CombinedRecordProcessingService.processVirtualFile(
      { fhirData: VALID_BUNDLE, belroseFields: VALID_BELROSE_FIELDS as any },
      'note.txt'
    );

    expect(createBelroseFieldsMock).not.toHaveBeenCalled();
    expect(result.belroseFields).toEqual(VALID_BELROSE_FIELDS);
    expect(result.aiProcessingStatus).toBe('completed');
  });

  it('skips encryption entirely when there is neither fhirData nor originalText', async () => {
    const result = await CombinedRecordProcessingService.processVirtualFile({}, 'empty.txt');

    expect(result.aiProcessingStatus).toBe('not_needed');
    expect(result.encryptedData).toBeUndefined();
  });

  it('still encrypts based on originalText alone, even with no fhirData/AI', async () => {
    const masterKey = await EncryptionKeyManager.generateMasterKey();
    EncryptionKeyManager.setSessionKey(masterKey);

    const result = await CombinedRecordProcessingService.processVirtualFile(
      { originalText: 'just a typed note, no FHIR' },
      'note.txt'
    );

    expect(result.aiProcessingStatus).toBe('not_needed');
    expect(result.encryptedData).toBeDefined();
  });

  it('throws when encryption is needed but there is no active session', async () => {
    await expect(
      CombinedRecordProcessingService.processVirtualFile(
        { fhirData: VALID_BUNDLE },
        'note.txt'
      )
    ).rejects.toThrow('No encryption session active');
  });
});
