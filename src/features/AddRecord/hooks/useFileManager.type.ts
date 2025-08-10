import { FileObject, FileStatus } from '@/types/core';
import { UploadResult } from '../services/shared.types';
import { VirtualFileResult } from '../components/CombinedUploadFHIR.type';

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
  autoUpload?: boolean;
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
  addFhirAsVirtualFile: (fhirData: any, options?: AddFhirAsVirtualFileOptions) => Promise<VirtualFileResult>;
  
  // Reset function
  reset: () => void;
}