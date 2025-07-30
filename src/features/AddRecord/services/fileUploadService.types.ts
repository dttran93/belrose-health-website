// src/features/AddRecord/services/fileUploadService.types.ts

import { FileObject } from '@/types/core';

// ==================== UPLOAD TYPES ====================

export interface UploadResult {
  documentId?: string;    // For new uploads
  firestoreId?: string;   // Legacy field name for compatibility
  downloadURL: string | null;
  filePath: string | null;
  uploadedAt: Date;
  fileSize: number;
  savedAt?: string;       // Legacy field for compatibility
  fileHash?: string;      // Legacy field for compatibility
}

export interface UploadProgress {
  fileId: string;
  bytesTransferred: number;
  totalBytes: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
}

export interface UploadOptions {
  compressionEnabled?: boolean;
  compressionQuality?: number; // 0-1 for images
  generateThumbnail?: boolean;
  customMetadata?: Record<string, any>;
}

// ==================== FIRESTORE TYPES ====================

export interface FirestoreFileMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  downloadURL: string;
  storagePath: string;
  uploadedBy: string;
  uploadedAt: Date;
  
  // Optional processed data
  extractedText?: string;
  wordCount?: number;
  documentType?: string;
  extractedAt?: string;
  processingStatus?: string;
  fileHash?: string;
  
  // Virtual file support
  isVirtual?: boolean;
  virtualFileType?: string;
  fhirData?: any;
}

export interface FHIRUpdateData {
  fhirData: any;
  fhirConvertedAt: string;
  processingStatus: 'fhir_converted';
}

// ==================== SERVICE INTERFACE ====================

export interface IFileUploadService {
  uploadFile(fileObj: FileObject, options?: UploadOptions): Promise<UploadResult>;
  updateRecord(fileId: string, data: Partial<FirestoreFileMetadata>): Promise<void>;
  deleteFile(fileId: string): Promise<void>;
  getUploadProgress(fileId: string): UploadProgress | null;
  
  // FHIR specific methods
  updateWithFHIR(documentId: string, fhirData: any): Promise<void>;
}

// ==================== ERROR TYPES ====================

export class FileUploadError extends Error {
  constructor(
    message: string,
    public code: UploadErrorCode,
    public fileId?: string
  ) {
    super(message);
    this.name = 'FileUploadError';
  }
}

export type UploadErrorCode = 
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'NETWORK_ERROR'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'PERMISSION_DENIED'
  | 'UPLOAD_CANCELLED'
  | 'UPDATE_FAILED'
  | 'DELETE_FAILED'
  | 'UNKNOWN_ERROR';