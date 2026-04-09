// src/features/AddRecord/services/textExtractionService

/**
 * Service for extracting text from various document formats
 * Supports PDF, Word documents, plain text
 * Images use aiImageService.ts and bypass this. Keeping extractFromImage
 * in case we want a fallback in the future
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import Tesseract from 'tesseract.js';
import mammoth from 'mammoth';
import { TextExtractionResult } from './shared.types';

// ==================== TEXT EXTRACTION OPTIONS ====================

/**
 * Options for customizing text extraction behavior
 * Preserve linebreaks, metadata (author dates etc) and language code
 */
export interface ExtractionOptions {
  preserveFormatting?: boolean;
  includeMetadata?: boolean;
  language?: string;
}

//Metadata extracted from documents
export interface DocumentMetadata {
  title?: string;
  author?: string;
  createdDate?: Date;
  modifiedDate?: Date;
  pageCount?: number;
  fileSize: number;
}
//Text from a single page (for multi-page documents)
export interface PageText {
  pageNumber: number;
  text: string;
  confidence?: number; // 0-1, how confident we are in the extraction
}

//Extended result for PDF extraction with additional PDF-specific data
export interface PDFExtractionResult extends TextExtractionResult {
  pageCount: number;
  metadata?: DocumentMetadata;
  pages?: PageText[]; // Individual page texts (only if includeMetadata is true)
}

// ==================== PDF.JS TYPE HELPERS ====================

/**
 * Simplified PDF metadata structure
 * Full type available from pdfjs-dist library
 */
export interface PDFMetadata {
  info?: {
    Title?: string;
    Author?: string;
    CreationDate?: string;
    ModDate?: string;
  };
  metadata?: any;
}

// ==================== ERROR HANDLING ====================
export class TextExtractionError extends Error {
  constructor(
    message: string,
    public code: TextExtractionErrorCode,
    public fileName?: string
  ) {
    super(message);
    this.name = 'TextExtractionError';
  }
}

export type TextExtractionErrorCode =
  | 'UNSUPPORTED_FORMAT' // File type not supported
  | 'CORRUPTED_FILE' // File appears to be corrupted
  | 'EMPTY_DOCUMENT' // No text content found
  | 'PROCESSING_FAILED' // Generic processing error
  | 'MEMORY_LIMIT_EXCEEDED' // File too large to process
  | 'UNKNOWN_ERROR'; // Unexpected error

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

class TextExtractionService {
  /**
   * Main text extraction method that routes to appropriate extraction function
   */
  async extractText(file: File, options: ExtractionOptions = {}): Promise<string> {
    try {
      console.log(`Extracting text from ${file.name} (${file.type})`);

      switch (true) {
        case file.type === 'application/pdf':
          const pdfResult = await this.extractFromPDF(file, options);
          return pdfResult.text;

        case file.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case file.type === 'application/msword':
          const wordResult = await this.extractFromWord(file, options);
          return wordResult.text;

        case file.type.startsWith('text/'):
          return await this.extractFromPlainText(file);

        case file.type.startsWith('image/'):
          return await this.extractFromImage(file, options);

        default:
          throw new TextExtractionError(
            `Unsupported file type: ${file.type}`,
            'UNSUPPORTED_FORMAT',
            file.name
          );
      }
    } catch (error: any) {
      console.error(`Error extracting text from ${file.name}:`, error);

      if (error instanceof TextExtractionError) {
        throw error; // Re-throw our custom errors as-is
      }

      // Wrap other errors in our custom error type
      throw new TextExtractionError(
        `Text extraction failed: ${error.message}`,
        'PROCESSING_FAILED',
        file.name
      );
    }
  }

  /**
   * Extract text from PDF files using PDF.js
   */
  async extractFromPDF(file: File, options: ExtractionOptions = {}): Promise<PDFExtractionResult> {
    try {
      console.log(`Extracting PDF text from ${file.name}`);

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      const pages: PageText[] = [];

      // Extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(options.preserveFormatting ? '\n' : ' ');

        pages.push({
          pageNumber: i,
          text: pageText,
          confidence: 1.0, // PDF text extraction has high confidence
        });

        fullText += pageText + (options.preserveFormatting ? '\n\n' : ' ');
      }

      // Extract metadata if requested
      let metadata: DocumentMetadata | undefined;
      if (options.includeMetadata) {
        const pdfMetadata = (await pdf.getMetadata()) as PDFMetadata;
        metadata = {
          title: pdfMetadata.info?.Title,
          author: pdfMetadata.info?.Author,
          createdDate: pdfMetadata.info?.CreationDate
            ? new Date(pdfMetadata.info.CreationDate)
            : undefined,
          modifiedDate: pdfMetadata.info?.ModDate ? new Date(pdfMetadata.info.ModDate) : undefined,
          pageCount: pdf.numPages,
          fileSize: file.size,
        };
      }

      return {
        text: fullText.trim(),
        method: 'pdf_extraction',
        wordCount: fullText.trim().split(/\s+/).length,
        confidence: 1.0,
        pageCount: pdf.numPages,
        metadata,
        pages: options.includeMetadata ? pages : undefined,
      };
    } catch (error: any) {
      console.error('PDF text extraction failed:', error);
      throw new TextExtractionError(
        `Failed to extract text from PDF: ${error.message}`,
        'PROCESSING_FAILED',
        file.name
      );
    }
  }

  /**
   * Extract text from Word documents using mammoth
   */
  async extractFromWord(
    file: File,
    options: ExtractionOptions = {}
  ): Promise<TextExtractionResult> {
    try {
      console.log(`Extracting Word document text from ${file.name}`);

      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });

      if (!result.value || result.value.trim().length === 0) {
        throw new TextExtractionError(
          'No text content found in Word document',
          'EMPTY_DOCUMENT',
          file.name
        );
      }

      // Log any warnings from mammoth
      if (result.messages && result.messages.length > 0) {
        console.warn('Mammoth extraction warnings:', result.messages);
      }

      return {
        text: result.value,
        method: 'word_extraction',
        wordCount: result.value.split(/\s+/).length,
        confidence: 0.95, // Word extraction is very reliable
      };
    } catch (error: any) {
      console.error('Word document text extraction failed:', error);

      if (error instanceof TextExtractionError) {
        throw error;
      }

      throw new TextExtractionError(
        `Failed to extract text from Word document: ${error.message}`,
        'PROCESSING_FAILED',
        file.name
      );
    }
  }

  /**
   * Extract text from plain text files
   */
  async extractFromPlainText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = e => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          if (result.trim().length === 0) {
            reject(
              new TextExtractionError('Text file appears to be empty', 'EMPTY_DOCUMENT', file.name)
            );
          } else {
            resolve(result);
          }
        } else {
          reject(
            new TextExtractionError(
              'Failed to read text file as string',
              'PROCESSING_FAILED',
              file.name
            )
          );
        }
      };

      reader.onerror = error => {
        console.error('Plain text extraction failed:', error);
        reject(
          new TextExtractionError(
            `Failed to read text file: ${error}`,
            'PROCESSING_FAILED',
            file.name
          )
        );
      };

      reader.readAsText(file);
    });
  }

  /**
   * OCR text extraction using Tesseract (for images)
   */
  async extractFromImage(file: File, options: ExtractionOptions = {}): Promise<string> {
    try {
      console.log(`Using Tesseract OCR for image text extraction: ${file.name}`);

      // Validate image file
      if (!file.type.startsWith('image/')) {
        throw new TextExtractionError('File is not an image', 'UNSUPPORTED_FORMAT', file.name);
      }

      // Check file size (OCR can be memory intensive)
      const maxSize = 50 * 1024 * 1024; // 50MB limit for OCR
      if (file.size > maxSize) {
        throw new TextExtractionError(
          `Image file too large for OCR processing (${Math.round(
            file.size / 1024 / 1024
          )}MB > 50MB)`,
          'MEMORY_LIMIT_EXCEEDED',
          file.name
        );
      }

      const tesseractResult = await Tesseract.recognize(file, options.language || 'eng', {
        logger: (m: any) => console.log('Tesseract:', m),
      });

      const extractedText = tesseractResult.data.text;

      if (!extractedText || extractedText.trim().length === 0) {
        throw new TextExtractionError('No text detected in image', 'EMPTY_DOCUMENT', file.name);
      }

      return extractedText;
    } catch (error: any) {
      console.error('Tesseract OCR failed:', error);

      if (error instanceof TextExtractionError) {
        throw error;
      }

      throw new TextExtractionError(
        `OCR text extraction failed: ${error.message}`,
        'PROCESSING_FAILED',
        file.name
      );
    }
  }
}

// ==================== EXPORT PATTERNS ====================

// Create a singleton instance for backward compatibility
const textExtractionService = new TextExtractionService();

// Export the instance as default (matches original pattern)
export default textExtractionService;

// Export the class for advanced usage
export { TextExtractionService };

// Export individual methods for backward compatibility
export const {
  extractText,
  extractFromPDF: extractPdfText,
  extractFromWord: extractWordText,
  extractFromPlainText: extractPlainText,
} = textExtractionService;
