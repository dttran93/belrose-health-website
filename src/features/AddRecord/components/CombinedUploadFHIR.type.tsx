import type { FHIRWithValidation } from '../services/fhirConversionService.type';

// ============================================================================
// SHARED FILE STATUS TYPE (must match both components)
// ============================================================================

export type FileStatus = 
  | 'ready' 
  | 'processing' 
  | 'medical_detected'
  | 'non_medical_detected'
  | 'converting'
  | 'completed' 
  | 'extraction_error'
  | 'detection_error'
  | 'fhir_error'
  | 'processing_error'
  | 'uploading'
  | 'error';

// ============================================================================
// MEDICAL DETECTION RESULT TYPE
// ============================================================================

export interface MedicalDetectionResult {
  isMedical: boolean;
  confidence: number;
  documentType?: string;  // Made optional to match usage
  reasoning?: string;     // Made optional to match usage
  detectedTerms?: string[];
}

// ============================================================================
// UNIFIED FILE ITEM TYPE (combining both versions)
// ============================================================================

export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  status: FileStatus;
  file?: File;            // Original file object (optional for virtual files)
  
  // Processing results
  extractedText?: string;
  wordCount?: number;
  processingTime?: number;
  processingMethod?: string;
  
  // Medical detection
  medicalDetection?: MedicalDetectionResult;
  
  // FHIR conversion - using your project's type
  fhirData?: FHIRWithValidation;
  
  // Upload tracking
  documentId?: string;
  uploadedAt?: string;
  documentType?: string;
  
  // Error handling
  error?: string;
  
  // File metadata
  fileHash?: string;
  lastModified?: number;
  
  // Allow additional properties for flexibility
  [key: string]: any;
}

// ============================================================================
// FHIR VALIDATION TYPES
// ============================================================================

export interface FHIRValidation {
  valid: boolean;
  error?: string;
  resourceType?: string;
  entryCount?: number;
  resourceTypes?: string[];
  isSingleResource?: boolean;
}

// ============================================================================
// FILE MANAGEMENT TYPES
// ============================================================================

export interface FileStats {
  totalFiles: number;
  processedFiles: number;
  processingFiles: number;
}

export interface UploadResult {
  success: boolean;
  documentId?: string;
  downloadURL?: string;
  error?: string;
  fileId?: string;
}

export interface AddFilesOptions {
  maxFiles?: number;
  maxSizeBytes?: number;
}

export interface VirtualFileOptions {
  id?: string;
  name?: string;
  documentType?: string;
  [key: string]: any;
}

export interface VirtualFileResult {
  fileId: string;
  virtualFile: FileItem;
}

// ============================================================================
// TAB TYPES
// ============================================================================

export type TabType = 'upload' | 'fhir';

// ============================================================================
// COMPONENT PROPS (FIXED FUNCTION SIGNATURES)
// ============================================================================

export interface CombinedUploadFHIRProps {
  // File management props - FIXED to match actual usage
  files: FileItem[];
  addFiles: (fileList: FileList, options?: AddFilesOptions) => void;
  removeFile: (fileId: string) => void;
  retryFile: (fileId: string) => void;  // ← This should be fileId: string based on your hook
  getStats: () => FileStats;
  
  // Direct upload functions
  addFhirAsVirtualFile: (
    fhirData: FHIRWithValidation, 
    options?: VirtualFileOptions
  ) => Promise<VirtualFileResult>;
  
  uploadFiles: (files: FileItem[]) => Promise<UploadResult[]>;
  
  // Configuration props
  acceptedTypes?: string[];
  maxFiles?: number;
  maxSizeBytes?: number;
  className?: string;
}

// ============================================================================
// FILE LIST ITEM PROPS (MATCHING YOUR TYPESCRIPT VERSION)
// ============================================================================

export interface FileListItemProps {
  fileItem: FileItem;
  fhirResult?: {
    success: boolean;
    fhirData?: FHIRWithValidation;
    error?: string;
  };
  onRemove: (fileId: string) => void;
  onRetry: (fileItem: FileItem) => void;          // ← FileListItem expects full object
  onForceConvert?: (fileItem: FileItem) => void;
  onComplete?: (fileItem: FileItem) => void;      // ← Can be async
  showFHIRResults?: boolean;
}

// ============================================================================
// FILE UPLOAD ZONE PROPS
// ============================================================================

export interface FileUploadZoneProps {
  onFilesSelected: (fileList: FileList) => void;
  acceptedTypes: string[];
  maxFiles: number;
  maxSizeBytes: number;
  title: string;
  subtitle: string;
  compact?: boolean;
}