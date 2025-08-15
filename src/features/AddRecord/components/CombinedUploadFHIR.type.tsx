import type { FHIRWithValidation } from '../services/fhirConversionService.type';
import { FileObject, FileStatus } from '@/types/core';
import { UploadResult } from '../services/shared.types';

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
  percentComplete: number;
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
  uploadResult?: any;
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
  removeFile: (fileId: string) => Promise<void>;
  removeFileFromLocal: (fileId: string) => void;
  
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
  shouldAutoUpload: (file:FileObject) => boolean;
  savingToFirestore: Set<string>;
  firestoreData: Map<string, any>;
  
  // 🔥 ADD FHIR PROPS
  fhirData?: Map<string, FHIRWithValidation>
  onFHIRConverted?: (fileId: string, uploadResult: any, fileObj?: FileObject) => Promise<void>;
  
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
  onConfirm: (fileId: string) => void;
  
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