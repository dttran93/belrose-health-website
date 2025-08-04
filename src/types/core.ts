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
  extractedText?: string | null;
  wordCount?: number;
  fileHash?: string;
  documentType?: string;
  lastModified?: number;
  isVirtual?: boolean;
  fhirData?: any;
  [key: string]: any;
}

export type FileStatus = 
  | 'ready'              // File uploaded, ready for processing
  | 'extracting'         // Extracting text from file  
  | 'analyzing_image'    // AI analyzing image content
  | 'processing'         // General processing state
  | 'detecting_medical'  // Checking if content is medical
  | 'medical_detected'   // Confirmed as medical content
  | 'non_medical_detected' // Confirmed as non-medical
  | 'converting'         // Converting to FHIR format
  | 'uploading'          // Uploading to Firestore
  | 'completed'          // Fully processed and uploaded
  | 'extraction_error'   // Failed during text extraction
  | 'detection_error'    // Failed during medical detection  
  | 'fhir_error'         // Failed during FHIR conversion
  | 'processing_error'   // General processing failure
  | 'error';             // Generic error state

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