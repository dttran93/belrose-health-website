export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface FileObject {
  id: string; //fileId. Generated in useFileManager via createFileObject() or addVirtualFile(). file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}
  file?: File; //actual file object from file input. Real life upload not virtual. Generated in createFileObject in useFileManager.ts
  name: string; //file name or custom name for virtual files. set by createFileObject() in useFileManager.ts
  size: number; //file size. Set in createFileObject in useFileManager.ts. file.size for real files
  type: string; //file type. Set in createFileObject in useFileManager.ts. file.type for real files or applicaion/fhir+json for virtual
  status: FileStatus; //Processing property. Initially set as pending. Then pending/processing... see below
  error?: string; //Failed processing
  extractedText?: string | null; //text extracted from image/pdf
  wordCount?: number; //calculated during text extraction
  fileHash?: string; 
  documentType?: string; //can be deleted probably
  lastModified?: number; //Filetracking for UI state management. Can probably be deleted
  isVirtual?: boolean; //for virtual files
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