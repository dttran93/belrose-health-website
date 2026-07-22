// @vitest-environment jsdom
//
// src/features/AddRecord/services/__tests__/textExtractionService.test.ts
//
// Tier 3 — mocks the format-specific backends (pdfjs-dist, mammoth, Tesseract) and drives the
// real routing (extractText) and per-format error taxonomy (TextExtractionError codes) in
// TextExtractionService. Plain-text extraction uses jsdom's real FileReader, no mocking needed.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getDocumentMock, mammothExtractRawTextMock, tesseractRecognizeMock } = vi.hoisted(() => ({
  getDocumentMock: vi.fn(),
  mammothExtractRawTextMock: vi.fn(),
  tesseractRecognizeMock: vi.fn(),
}));

vi.mock('pdfjs-dist', () => ({
  getDocument: getDocumentMock,
  GlobalWorkerOptions: { workerSrc: '' },
}));

vi.mock('pdfjs-dist/build/pdf.worker.mjs?url', () => ({ default: 'mock-worker-url' }));

vi.mock('mammoth', () => ({
  default: { extractRawText: mammothExtractRawTextMock },
}));

vi.mock('tesseract.js', () => ({
  default: { recognize: tesseractRecognizeMock },
}));

import textExtractionService from '../textExtractionService';
import { TextExtractionError } from '../textExtractionService';

function makePdfDoc(pages: string[]) {
  return {
    numPages: pages.length,
    getPage: vi.fn(async (i: number) => ({
      getTextContent: vi.fn(async () => ({ items: [{ str: pages[i - 1] }] })),
    })),
    getMetadata: vi.fn(async () => ({ info: {} })),
  };
}

function makeFile(name: string, type: string, content = 'hello world'): File {
  return new File([content], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('extractText — routing by MIME type', () => {
  it('routes application/pdf to extractFromPDF', async () => {
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(makePdfDoc(['page one text'])) });

    const text = await textExtractionService.extractText(makeFile('a.pdf', 'application/pdf'));
    expect(text).toBe('page one text');
  });

  it('routes .docx to extractFromWord', async () => {
    mammothExtractRawTextMock.mockResolvedValue({ value: 'word doc text', messages: [] });

    const text = await textExtractionService.extractText(
      makeFile('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    );
    expect(text).toBe('word doc text');
  });

  it('routes text/* to extractFromPlainText (real FileReader)', async () => {
    const text = await textExtractionService.extractText(makeFile('a.txt', 'text/plain', 'plain content'));
    expect(text).toBe('plain content');
  });

  it('routes image/* to extractFromImage (Tesseract)', async () => {
    tesseractRecognizeMock.mockResolvedValue({ data: { text: 'ocr text' } });

    const text = await textExtractionService.extractText(makeFile('a.png', 'image/png'));
    expect(text).toBe('ocr text');
  });

  it('throws UNSUPPORTED_FORMAT for an unrecognized MIME type', async () => {
    await expect(
      textExtractionService.extractText(makeFile('a.xyz', 'application/x-unknown'))
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_FORMAT' });
  });
});

describe('extractFromPDF', () => {
  it('joins text across multiple pages and reports the page count', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.resolve(makePdfDoc(['page one', 'page two'])),
    });

    const result = await textExtractionService.extractFromPDF(makeFile('a.pdf', 'application/pdf'));
    expect(result.text).toBe('page one page two');
    expect(result.pageCount).toBe(2);
    expect(result.method).toBe('pdf_extraction');
  });

  it('wraps pdf.js failures in a PROCESSING_FAILED TextExtractionError', async () => {
    getDocumentMock.mockReturnValue({ promise: Promise.reject(new Error('corrupt PDF')) });

    await expect(
      textExtractionService.extractFromPDF(makeFile('a.pdf', 'application/pdf'))
    ).rejects.toMatchObject({ code: 'PROCESSING_FAILED' });
  });
});

describe('extractFromWord', () => {
  it('extracts raw text via mammoth', async () => {
    mammothExtractRawTextMock.mockResolvedValue({ value: 'some contract text', messages: [] });

    const result = await textExtractionService.extractFromWord(makeFile('a.docx', 'application/msword'));
    expect(result.text).toBe('some contract text');
    expect(result.method).toBe('word_extraction');
  });

  it('throws EMPTY_DOCUMENT when mammoth returns no text', async () => {
    mammothExtractRawTextMock.mockResolvedValue({ value: '   ', messages: [] });

    await expect(
      textExtractionService.extractFromWord(makeFile('a.docx', 'application/msword'))
    ).rejects.toMatchObject({ code: 'EMPTY_DOCUMENT' });
  });

  it('wraps mammoth failures in a PROCESSING_FAILED TextExtractionError', async () => {
    mammothExtractRawTextMock.mockRejectedValue(new Error('bad docx structure'));

    await expect(
      textExtractionService.extractFromWord(makeFile('a.docx', 'application/msword'))
    ).rejects.toMatchObject({ code: 'PROCESSING_FAILED' });
  });
});

describe('extractFromPlainText', () => {
  it('resolves the file contents as a string', async () => {
    const text = await textExtractionService.extractFromPlainText(
      makeFile('a.txt', 'text/plain', 'line one\nline two')
    );
    expect(text).toBe('line one\nline two');
  });

  it('rejects with EMPTY_DOCUMENT for a whitespace-only file', async () => {
    await expect(
      textExtractionService.extractFromPlainText(makeFile('a.txt', 'text/plain', '   '))
    ).rejects.toMatchObject({ code: 'EMPTY_DOCUMENT' });
  });
});

describe('extractFromImage', () => {
  it('returns OCR text from Tesseract', async () => {
    tesseractRecognizeMock.mockResolvedValue({ data: { text: 'scanned receipt text' } });

    const text = await textExtractionService.extractFromImage(makeFile('a.png', 'image/png'));
    expect(text).toBe('scanned receipt text');
  });

  it('throws UNSUPPORTED_FORMAT for a non-image file', async () => {
    await expect(
      textExtractionService.extractFromImage(makeFile('a.txt', 'text/plain'))
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_FORMAT' });
  });

  it('throws MEMORY_LIMIT_EXCEEDED for images over 50MB', async () => {
    const bigFile = makeFile('big.png', 'image/png');
    Object.defineProperty(bigFile, 'size', { value: 51 * 1024 * 1024 });

    await expect(textExtractionService.extractFromImage(bigFile)).rejects.toMatchObject({
      code: 'MEMORY_LIMIT_EXCEEDED',
    });
  });

  it('throws EMPTY_DOCUMENT when Tesseract finds no text', async () => {
    tesseractRecognizeMock.mockResolvedValue({ data: { text: '' } });

    await expect(
      textExtractionService.extractFromImage(makeFile('a.png', 'image/png'))
    ).rejects.toMatchObject({ code: 'EMPTY_DOCUMENT' });
  });
});

describe('TextExtractionError', () => {
  it('carries code and fileName', () => {
    const error = new TextExtractionError('boom', 'PROCESSING_FAILED', 'a.pdf');
    expect(error.code).toBe('PROCESSING_FAILED');
    expect(error.fileName).toBe('a.pdf');
    expect(error.name).toBe('TextExtractionError');
  });
});
