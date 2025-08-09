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
  | 'pending'      // File uploaded, waiting to process
  | 'processing'   // Currently being processed  
  | 'completed'    // Successfully processed
  | 'error';       // Failed with error

export interface ProcessingResult {
  fileName: string;
  fileType: string;
  fileSize: number;
  processingSteps: string[];
  extractedText: string | null;
  wordCount: number;
  processingMethod: string | null;
  success: boolean;
  error: string | null;
  processingTime: number;
}

export interface DuplicateInfo {
  existingFileId?: string;
  confidence: number;
  matchedOn: ('name' | 'size' | 'lastModified' | 'hash')[];
  canRetry: boolean;
  userMessage?: string;
}

export interface UploadResult {
  // Component needs (success/error tracking)
  success: boolean;
  error?: string;
  fileId?: string;
  
  // Firebase service provides (upload details)
  documentId?: string;
  firestoreId?: string;        // Legacy compatibility
  downloadURL?: string | null;
  filePath?: string | null;
  uploadedAt?: Date;
  fileSize?: number;
  
  // Legacy fields for backward compatibility
  savedAt?: string;
  fileHash?: string;
}