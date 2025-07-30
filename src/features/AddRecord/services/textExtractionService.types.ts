// src/features/AddRecord/services/textExtractionService.types.ts

// ==================== TEXT EXTRACTION TYPES ====================

export interface TextExtractionResult {
  text: string;
  method: string;
  wordCount?: number;
  confidence?: number;
}

export interface ExtractionOptions {
  preserveFormatting?: boolean;
  includeMetadata?: boolean;
  language?: string;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  createdDate?: Date;
  modifiedDate?: Date;
  pageCount?: number;
  fileSize: number;
}

export interface PDFExtractionResult extends TextExtractionResult {
  pageCount: number;
  metadata?: DocumentMetadata;
  pages?: PageText[];
}

export interface PageText {
  pageNumber: number;
  text: string;
  confidence?: number;
}

// ==================== PDF.JS SPECIFIC TYPES ====================

export interface PDFMetadataInfo {
  Title?: string;
  Author?: string;
  Subject?: string;
  Keywords?: string;
  Creator?: string;
  Producer?: string;
  CreationDate?: string;
  ModDate?: string;
  Trapped?: string;
}

export interface PDFMetadata {
  info?: PDFMetadataInfo;
  metadata?: any;
  contentDispositionFilename?: string;
  contentLength?: number;
}

export interface PDFTextItem {
  str: string;
  dir?: string;
  width?: number;
  height?: number;
  transform?: number[];
  fontName?: string;
}

export interface PDFTextContent {
  items: PDFTextItem[];
  styles?: any;
}

export interface PDFPageProxy {
  getTextContent(): Promise<PDFTextContent>;
  pageNumber: number;
}

export interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
  getMetadata(): Promise<PDFMetadata>;
}

// ==================== SERVICE INTERFACE ====================

export interface ITextExtractionService {
  extractText(file: File, options?: ExtractionOptions): Promise<string>;
  extractFromPDF(file: File, options?: ExtractionOptions): Promise<PDFExtractionResult>;
  extractFromWord(file: File, options?: ExtractionOptions): Promise<TextExtractionResult>;
  extractFromPlainText(file: File): Promise<string>;
  getEstimatedProcessingTime?(file: File): string;
}

// ==================== ERROR TYPES ====================

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
  | 'UNSUPPORTED_FORMAT'
  | 'CORRUPTED_FILE'
  | 'EMPTY_DOCUMENT'
  | 'PROCESSING_FAILED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'UNKNOWN_ERROR';