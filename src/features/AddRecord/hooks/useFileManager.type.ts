// src/features/AddRecord/hooks/useFileUpload.types.ts

import { FileObject, FileStatus, UploadResult } from '@/types/core';

// Import service types
import { FileValidationResult, ProcessingOptions, DocumentProcessingResult } from '../services/documentProcessorService.types';

// ==================== TYPE ALIASES ====================

// Type alias to use DocumentProcessingResult as ProcessingResult
export type ProcessingResult = DocumentProcessingResult;

// ==================== INTERFACE DEFINITIONS ====================

export interface AddFilesOptions {
  maxFiles?: number;
  maxSizeBytes?: number;
  autoProcess?: boolean;
}

export interface VirtualFileData {
  id?: string;
  name?: string;  // Made optional to match usage
  size?: number;
  type?: string;
  extractedText?: string;
  wordCount?: number;
  documentType?: string;
  fhirData?: any;
  [key: string]: any; // Allow additional properties
}

export interface AddFhirAsVirtualFileOptions extends VirtualFileData {
  name?: string;
  documentType?: string;
}

export interface FileStats {
  total: number;
  processing: number;
  completed: number;
  errors: number;
  percentComplete: number;
}

// ==================== CALLBACK TYPE DEFINITIONS ====================

export type FHIRConversionCallback = (fileId: string, fhirData: any) => Promise<void> | void;
export type ResetProcessCallback = () => void;

// ==================== HOOK RETURN TYPE ====================

export interface UseFileUploadReturn {
  // Core state
  files: FileObject[];
  processedFiles: FileObject[];
  firestoreData: Map<string, any>;
  savingToFirestore: Set<string>;
  
  // File management actions
  addFiles: (fileList: FileList, options?: AddFilesOptions) => void;
  removeFile: (fileId: string) => void;
  removeFileFromLocal: (fileId: string) => void;
  deleteFileFromFirebase: (documentId: string) => Promise<void>;
  cancelFileUpload: (fileId: string) => void;
  removeFileComplete: (fileId: string) => Promise<void>;
  retryFile: (fileId: string) => Promise<void>;
  clearAll: () => void;
  enhancedClearAll: () => Promise<void>;   
  processFile: (fileObj: FileObject) => Promise<void>;
  
  // FHIR integration
  setFHIRConversionCallback: (callback: FHIRConversionCallback) => void;
  setResetProcessCallback: (callback: ResetProcessCallback) => void;
  
  // Status updates
  updateFileStatus: (fileId: string, status: FileStatus, additionalData?: Partial<FileObject>) => void;
  
  // Firestore operations
  uploadFiles: (fileIds?: string[]) => Promise<UploadResult[]>;
  updateFirestoreRecord: (fileId: string, data: any) => Promise<void>;
  
  // Computed values
  getStats: () => FileStats;
  savedToFirestoreCount: number;
  savingCount: number;
  
  // Virtual file support
  addVirtualFile: (virtualData: VirtualFileData) => string;
  addFhirAsVirtualFile: (fhirData: any, options?: AddFhirAsVirtualFileOptions) => Promise<{ fileId: string; virtualFile: FileObject }>;
  
  // Reset function
  reset: () => void;
}