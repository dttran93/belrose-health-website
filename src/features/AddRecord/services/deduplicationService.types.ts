// src/features/AddRecord/services/deduplicationService.types.ts

// ==================== DEDUPLICATION TYPES ====================

export interface DeduplicationStats {
  totalFilesProcessed: number;
  duplicatesDetected: number;
  duplicatesBlocked: number;
  uniqueFiles: number;
  duplicateRate: number; // percentage
  
  // Legacy compatibility fields
  totalHashesTracked?: number;
  firestoreDocsTracked?: number;
  uploadRetries?: [string, number][];
  currentlyProcessing?: number;
  totalRetryAttempts?: number;
}

export interface FileSignature {
  name: string;
  size: number;
  lastModified: number;
  hash?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingFileId?: string;
  confidence: number;
  matchedOn: ('name' | 'size' | 'lastModified' | 'hash')[];
}

// ==================== SERVICE INTERFACE ====================

export interface IDeduplicationService {
  // Core duplicate checking
  checkForDuplicate(file: File, fileId: string): DuplicateCheckResult;
  addFile(file: File, fileId: string): void;
  removeFile(fileId: string): void;
  
  // Processing state management
  markFileAsProcessing(fileHash: string, fileId: string): void;
  releaseProcessingLock(fileId: string, fileHash?: string): void;
  isProcessing(fileId: string): boolean;
  
  // Upload tracking
  incrementUploadAttempt(fileId: string): number;
  addFirestoreDocId(docId: string): void;
  
  // Utilities
  generateFileHash(file: File): Promise<string>;
  getStats(): DeduplicationStats;
  clear(): void;
  
  // Enhanced methods
  getFileInfo(fileId: string): { signature?: FileSignature; hash?: string; isProcessing: boolean };
  getCurrentlyProcessingFiles(): string[];
  isFileAlreadyProcessed(fileHash: string, fileId: string, firestoreData: Map<string, any>): boolean;
}

// ==================== CONFIGURATION ====================

export interface DeduplicationConfig {
  checkFileName: boolean;
  checkFileSize: boolean;
  checkLastModified: boolean;
  checkHash: boolean;
  confidenceThreshold: number; // 0-1, how similar files need to be
}