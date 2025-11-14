import { Timestamp } from 'firebase/firestore';

export interface TextExtractionResult {
  text: string;
  method: string;
  confidence?: number;
  wordCount?: number;
  processingTime?: 'fast' | 'medium' | 'slow' | 'failed';
  fallbackReason?: string;
  source?:
    | 'ai_vision'
    | 'ocr_fallback'
    | 'pdf_parser'
    | 'word_parser'
    | 'plain_text'
    | 'hybrid'
    | 'failed'
    | 'error'
    | string;
  extractedText?: string;

  // For vision service compatibility
  success?: boolean;
  error?: string;
}

export interface ProcessingResult {
  fileName: string;
  fileType: string;
  fileSize: number;
  processingSteps: string[];
  extractedText: string | null;
  wordCount: number;
  processingMethod: string | null | undefined;
  success: boolean;
  error: string | null;
  processingTime: number;
  // Optional field from DocumentProcessingResult
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface ProcessingOptions {
  enableVisionAI?: boolean;
  compressionThreshold?: number;
  signal?: AbortSignal;
}

export interface UploadResult {
  // Success tracking (primary fields)
  success: boolean;
  error?: string;
  fileId?: string;

  // Firebase details
  documentId?: string;
  downloadURL?: string | null;
  filePath?: string | null;
  uploadedAt?: Timestamp;
  fileSize?: number;

  // Legacy compatibility fields (keep for backward compatibility)
  firestoreId?: string; // Legacy alias for documentId
  savedAt?: string; // Legacy timestamp format
  originalFileHash?: string; // Legacy field
}

/**
 * Upload progress tracking
 */
export interface UploadProgress {
  fileId: string;
  bytesTransferred: number;
  totalBytes: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
}
