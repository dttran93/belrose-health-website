import type { FHIRWithValidation } from '../services/fhirConversionService.type';
import { FileObject, FileStatus, MedicalDetectionResult } from '@/types/core';

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
// FILE MANAGEMENT TYPES - UPDATED TO MATCH HOOK
// ============================================================================

/**
 * File statistics interface matching useFileUpload hook exactly
 */
export interface FileStats {
  total: number;
  processing: number;
  completed: number;
  errors: number;
  medical: number;
  nonMedical: number;
  percentComplete: number;
}

/**
 * Simplified upload result - we rely on hook state instead of return values
 */
export interface UploadResult {
  documentId?: string;    // For new uploads
  firestoreId?: string;   // Legacy field name for compatibility
  downloadURL?: string | null;
  filePath?: string | null;
  uploadedAt?: Date;
  fileSize?: number;
  savedAt?: string;       // Legacy field for compatibility
  fileHash?: string;      // Legacy field for compatibility
  success: boolean;
  fileId?: string;
  error?: string;
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
  virtualFile: FileObject;
}

// ============================================================================
// TAB TYPES
// ============================================================================

export type TabType = 'upload' | 'text' | 'fhir';

// ============================================================================
// COMPONENT PROPS - UPDATED TO MATCH HOOK INTERFACE
// ============================================================================

export interface CombinedUploadFHIRProps {
  // File management props - UPDATED to match hook exactly
  files: FileObject[];
  addFiles: (fileList: FileList, options?: AddFilesOptions) => void;
  removeFile: (fileId: string) => void;
  
  // Updated: Hook provides Promise<void>, takes fileId: string
  retryFile: (fileId: string) => Promise<void>;
  
  // Updated: Hook provides the full FileStats interface
  getStats: () => FileStats;

  updateFileStatus: (fileId: string, status: FileStatus, additionalData?: Partial<FileObject>) => void;
  
  // Direct upload functions - UPDATED to match hook
  addFhirAsVirtualFile: (
    fhirData: FHIRWithValidation, 
    options?: VirtualFileOptions
  ) => Promise<VirtualFileResult>;
  
  // Updated: Hook takes fileIds array, returns Promise<void>
  // Component should extract IDs from files and rely on state updates
  uploadFiles: (fileIds?: string[]) => Promise<UploadResult[]>;
  
  // Configuration props
  acceptedTypes?: string[];
  maxFiles?: number;
  maxSizeBytes?: number;
  className?: string;
  
  convertTextToFHIR?: (text: string, patientName?: string) => Promise<FHIRWithValidation>;
}

// ============================================================================
// FILE LIST ITEM PROPS - UPDATED FOR CONSISTENCY
// ============================================================================

export interface FileListItemProps {
  fileItem: FileObject;
  fhirResult?: {
    success: boolean;
    fhirData?: FHIRWithValidation;
    error?: string;
  };
  onRemove: (fileId: string) => void;
  
  // Updated: FileListItem should pass FileItem, but retryFile expects fileId
  // We'll handle the conversion in the component
  onRetry: (fileItem: FileObject) => void;
  onForceConvert?: (fileItem: FileObject) => void;
  onComplete?: (fileItem: FileObject) => void;
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