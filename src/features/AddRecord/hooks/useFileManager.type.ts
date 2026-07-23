import { AIProcessingStatus, FileObject, FileStatus, VirtualFileInput } from '@/types/core';
import { UploadResult } from '../services/shared.types';
import { VirtualFileResult } from '../components/CombinedUploadFHIR.type';

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

// Lets a caller that owns the full processing→upload lifecycle for a file (e.g. UploadTab's
// "Process & Upload" flow) pass in an activity id up front so both steps report progress onto
// the same OnChainActivityTray card instead of each minting (and resolving) their own.
export interface ProcessFileOptions {
  activityId?: string;
}

// Maps a file's id to the activityId a prior processFile call already reported progress to,
// so uploadFiles can finish that same card instead of starting a new one. Files not present in
// the map (or when the option is omitted entirely) get their own self-contained activity.
export interface UploadFilesOptions {
  activityIds?: Record<string, string>;
}

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
  processFile: (fileObj: FileObject, options?: ProcessFileOptions) => Promise<FileObject>;

  // Status updates
  updateFileStatus: (
    fileId: string,
    status: FileStatus,
    additionalData?: Partial<FileObject>
  ) => void;

  // Firestore operations
  uploadFiles: (filesToUpload: FileObject[], options?: UploadFilesOptions) => Promise<UploadResult[]>;
  updateFirestoreRecord: (fileId: string, data: any) => Promise<void>;

  // Computed values
  getStats: () => FileStats;
  savedToFirestoreCount: number;
  savingCount: number;

  // Virtual file support
  processVirtualFileData: (virtualData: VirtualFileInput) => Promise<{ fileId: string }>;
  processVirtualRecord: (fhirData: any, options?: VirtualFileInput) => Promise<VirtualFileResult>;

  // Reset function
  reset: () => void;
}
