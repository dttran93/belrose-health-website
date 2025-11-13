import { AIProcessingStatus, FileObject, FileStatus, VirtualFileInput } from '@/types/core';
import { UploadResult } from '../services/shared.types';
import { VirtualFileResult } from '../components/CombinedUploadFHIR.type';
import { BlockchainVerification } from '@/types/core';

// ==================== INTERFACE DEFINITIONS ====================

export interface AddFilesOptions {
  maxFiles?: number;
  maxSizeBytes?: number;
  autoProcess?: boolean;
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

export interface UseFileManagerTypes {
  // Core state
  files: FileObject[];
  processedFiles: FileObject[];
  savingToFirestore: Set<string>;

  // File management actions
  addFiles: (fileList: FileList, options?: AddFilesOptions) => Promise<void>;
  removeFileFromLocal: (fileId: string) => void;
  deleteFileFromFirebase: (documentId: string) => Promise<void>;
  cancelFileUpload: (fileId: string) => void;
  removeFileComplete: (fileId: string) => Promise<void>;
  retryFile: (fileId: string) => Promise<void>;
  clearAll: () => void;
  enhancedClearAll: () => Promise<void>;
  processFile: (fileObj: FileObject) => Promise<FileObject>;

  // FHIR integration
  setFHIRConversionCallback: (callback: FHIRConversionCallback) => void;
  setResetProcessCallback: (callback: ResetProcessCallback) => void;

  // Status updates
  updateFileStatus: (
    fileId: string,
    status: FileStatus,
    additionalData?: Partial<FileObject>
  ) => void;

  // Firestore operations
  uploadFiles: (filesToUpload: FileObject[]) => Promise<UploadResult[]>;
  updateFirestoreRecord: (fileId: string, data: any) => Promise<void>;

  // Computed values
  getStats: () => FileStats;
  savedToFirestoreCount: number;
  savingCount: number;

  // Virtual file support
  addVirtualFile: (
    virtualData: VirtualFileInput
  ) => Promise<{ fileId: string; blockchainVerification?: BlockchainVerification }>;
  addFhirAsVirtualFile: (fhirData: any, options?: VirtualFileInput) => Promise<VirtualFileResult>;

  // Reset function
  reset: () => void;
}
