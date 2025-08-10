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
  | 'uploading'    // Currently uploading, use for making sure there aren't multiple uploads  
  | 'completed'    // Successfully processed
  | 'error';       // Failed with error

export interface DuplicateInfo {
  existingFileId?: string;
  confidence: number;
  matchedOn: ('name' | 'size' | 'lastModified' | 'hash')[];
  canRetry: boolean;
  userMessage?: string;
}