import { ProcessingResult } from './shared.types';

// ==================== VALIDATION TYPES ====================

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// ==================== PROCESSING OPTIONS ====================

export interface ProcessingOptions {
  enableVisionAI?: boolean;
  compressionThreshold?: number;
  signal?: AbortSignal; // For cancellation
}

// ==================== SERVICE INTERFACE ====================

// This describes what the DocumentProcessorService should look like
export interface IDocumentProcessorService {
  validateFile(file: File): FileValidationResult;
  processDocument(file: File, options?: ProcessingOptions): Promise<ProcessingResult>;
}

// ==================== UTILITY TYPES ====================

export type SupportedFileType = 
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/msword'
  | 'text/plain'
  | 'image/jpeg'
  | 'image/png'
  | 'image/jpg';

export type ProcessingStep = 
  | 'text_extraction_started'
  | 'text_extraction_completed'
  | 'ai_vision_analysis'
  | 'ai_vision_completed'
  | 'ai_vision_failed'
  | 'image_text_extraction'
  | 'image_compression'
  | 'image_text_completed'
  | 'document_text_extraction'
  | 'document_text_completed'
  | 'processing_completed'
  | 'processing_failed';

// ==================== TYPE GUARDS ====================

export function isValidFileType(type: string): type is SupportedFileType {
  const supportedTypes: SupportedFileType[] = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/jpg'
  ];
  return supportedTypes.includes(type as SupportedFileType);
}