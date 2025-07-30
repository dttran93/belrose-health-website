import { MedicalDetectionResult } from '@/types/core';

// ==================== VALIDATION TYPES ====================

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// ==================== PROCESSING OPTIONS ====================

export interface ProcessingOptions {
  enableMedicalDetection?: boolean;
  enableVisionAI?: boolean;
  compressionThreshold?: number;
  signal?: AbortSignal; // For cancellation
}

// ==================== PROCESSING RESULT ====================

export interface DocumentProcessingResult {
  fileName: string;
  fileType: string;
  fileSize: number;
  processingSteps: string[];
  extractedText: string | null;
  wordCount: number;
  medicalDetection: MedicalDetectionResult | null;
  processingMethod: string | null;
  success: boolean;
  error: string | null;
  processingTime: number;
}

// ==================== SERVICE INTERFACE ====================

// This describes what the DocumentProcessorService should look like
export interface IDocumentProcessorService {
  validateFile(file: File): FileValidationResult;
  processDocument(file: File, options?: ProcessingOptions): Promise<DocumentProcessingResult>;
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
  | 'medical_detection_started' 
  | 'medical_detection_completed'
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