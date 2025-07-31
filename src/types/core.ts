export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface FileObject {
  id: string;
  file?: File;
  name: string;
  size: number;
  type: string;
  status: FileStatus;
  error?: string;
  extractedText?: string;
  wordCount?: number;
  fileHash?: string;
  documentType?: string;
  lastModified?: number;
  isVirtual?: boolean;
  fhirData?: any;
  [key: string]: any;
}

export type FileStatus = 
  | 'ready' 
  | 'processing' 
  | 'completed' 
  | 'error'
  | 'medical_detected'
  | 'non_medical_detected'
  | 'extraction_error'
  | 'detection_error'
  | 'converting'
  | 'uploading';

export interface ProcessingResult {
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

export interface MedicalDetectionResult {
  isMedical: boolean;
  confidence: number;
  detectedTerms: string[];
  reasoning?: string;
  documentType?: string;
  suggestion?: string;
  source?: 'ai_vision' | 'text_analysis' | 'hybrid';
  medicalSpecialty?: string;
}

export interface DuplicateInfo {
  existingFileId?: string;
  confidence: number;
  matchedOn: ('name' | 'size' | 'lastModified' | 'hash')[];
  canRetry: boolean;
  userMessage?: string;
}