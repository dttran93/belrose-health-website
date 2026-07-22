// @vitest-environment jsdom
//
// src/features/AddRecord/services/__tests__/documentProcessorService.test.ts
//
// Tier 3 — mocks aiImageService/TextExtractionService/Tesseract/pdfjs-dist (the extraction
// backends) and drives the real routing + fallback logic in processDocument/extractScannedPDF:
// image AI-vision -> Tesseract OCR fallback, and scanned-PDF (little/no embedded text) ->
// page-render vision-OCR fallback. jsdom is used only so `document.createElement('canvas')`
// exists for extractScannedPDF — its `getContext('2d')` resolves to null under plain jsdom
// (no 'canvas' package installed), which is fine here since these tests only need to prove the
// fallback path is *invoked*, not exercise real canvas rendering.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { extractTextFromImageMock, extractTextMock, tesseractRecognizeMock, getDocumentMock } =
  vi.hoisted(() => ({
    extractTextFromImageMock: vi.fn(),
    extractTextMock: vi.fn(),
    tesseractRecognizeMock: vi.fn(),
    getDocumentMock: vi.fn(),
  }));

vi.mock('../aiImageService', () => ({
  aiImageService: { extractTextFromImage: extractTextFromImageMock },
}));

vi.mock('../textExtractionService', () => ({
  default: { extractText: extractTextMock },
}));

vi.mock('tesseract.js', () => ({
  default: { recognize: tesseractRecognizeMock },
}));

vi.mock('pdfjs-dist', () => ({
  getDocument: getDocumentMock,
}));

import { processDocument } from '../documentProcessorService';

function makeFile(name: string, type: string, content = 'x'.repeat(10)): File {
  return new File([content], name, { type });
}

function mockPdfDocument(numPages = 1) {
  getDocumentMock.mockReturnValue({
    promise: Promise.resolve({
      numPages,
      getPage: vi.fn(async () => ({
        getViewport: vi.fn(() => ({ width: 100, height: 100 })),
        render: vi.fn(() => ({ promise: Promise.resolve() })),
      })),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processDocument — images: AI vision with Tesseract fallback', () => {
  it('uses the AI vision result directly when it succeeds', async () => {
    extractTextFromImageMock.mockResolvedValue({ success: true, text: 'vision extracted text' });

    const result = await processDocument(makeFile('scan.png', 'image/png'));

    expect(result.success).toBe(true);
    expect(result.extractedText).toBe('vision extracted text');
    expect(tesseractRecognizeMock).not.toHaveBeenCalled();
  });

  it('falls back to Tesseract when AI vision resolves without text', async () => {
    extractTextFromImageMock.mockResolvedValue({ success: false, error: 'no text found' });
    tesseractRecognizeMock.mockResolvedValue({ data: { text: 'tesseract fallback text' } });

    const result = await processDocument(makeFile('scan.png', 'image/png'));

    expect(result.success).toBe(true);
    expect(result.extractedText).toBe('tesseract fallback text');
    expect(tesseractRecognizeMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to Tesseract when AI vision throws', async () => {
    extractTextFromImageMock.mockRejectedValue(new Error('vision API down'));
    tesseractRecognizeMock.mockResolvedValue({ data: { text: 'tesseract fallback text' } });

    const result = await processDocument(makeFile('scan.png', 'image/png'));

    expect(result.success).toBe(true);
    expect(result.extractedText).toBe('tesseract fallback text');
  });
});

describe('processDocument — non-image documents', () => {
  it('routes plain documents through TextExtractionService only, with no OCR fallback', async () => {
    extractTextMock.mockResolvedValue('word '.repeat(60).trim());

    const result = await processDocument(makeFile('notes.txt', 'text/plain'));

    expect(extractTextMock).toHaveBeenCalledTimes(1);
    expect(getDocumentMock).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});

describe('processDocument — PDFs: scanned-PDF vision-OCR fallback', () => {
  it('keeps pdf.js text as-is when there is plenty of it (>= 50 words)', async () => {
    extractTextMock.mockResolvedValue('word '.repeat(60).trim());

    const result = await processDocument(makeFile('doc.pdf', 'application/pdf'));

    expect(result.success).toBe(true);
    expect(result.wordCount).toBe(60);
    expect(getDocumentMock).not.toHaveBeenCalled();
  });

  it('attempts the scanned-PDF vision-OCR fallback when pdf.js finds little/no text', async () => {
    extractTextMock.mockResolvedValue('scanned'); // 1 word, well under the 50-word threshold
    mockPdfDocument(1);

    const result = await processDocument(makeFile('scanned.pdf', 'application/pdf'));

    expect(getDocumentMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    // jsdom's canvas has no real 2D context, so every page is skipped and the OCR fallback
    // resolves to an empty string, which overwrites pdf.js's original (too-short) text.
    expect(result.extractedText).toBe('');
  });

  it('keeps the original pdf.js text when the scanned-PDF fallback itself throws', async () => {
    extractTextMock.mockResolvedValue('scanned');
    getDocumentMock.mockReturnValue({
      promise: Promise.reject(new Error('corrupt PDF structure')),
    });

    const result = await processDocument(makeFile('scanned.pdf', 'application/pdf'));

    expect(result.success).toBe(true);
    expect(result.extractedText).toBe('scanned');
  });
});

describe('processDocument — top-level failure', () => {
  it('returns a failed ProcessingResult when extraction throws unexpectedly', async () => {
    extractTextMock.mockRejectedValue(new Error('unsupported format'));

    const result = await processDocument(makeFile('weird.docx', 'application/msword'));

    expect(result.success).toBe(false);
    expect(result.error).toBe('unsupported format');
    expect(result.extractedText).toBeNull();
  });
});
