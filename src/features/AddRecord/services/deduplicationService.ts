import { 
  DeduplicationStats, 
  FileSignature, 
  DuplicateCheckResult, 
  IDeduplicationService,
  DeduplicationConfig,
  ProcessingDecision,
} from './deduplicationService.types';

/**
 * Service for tracking and preventing duplicate file processing
 * Maintains internal state of processed files to avoid reprocessing
 */
export class DeduplicationService implements IDeduplicationService {
  // Internal tracking collections
  private processedFileHashes: Set<string>;
  private firestoreDocIds: Set<string>;
  private uploadAttempts: Map<string, number>;
  private processingLocks: Set<string>;
  
  // File tracking for removeFile functionality
  private fileHashMapping: Map<string, string>; // fileId -> fileHash
  private fileIdMapping: Map<string, FileSignature>; // fileId -> file signature

  constructor(private config: Partial<DeduplicationConfig> = {}) {
    this.processedFileHashes = new Set<string>();
    this.firestoreDocIds = new Set<string>();
    this.uploadAttempts = new Map<string, number>();
    this.processingLocks = new Set<string>();
    this.fileHashMapping = new Map<string, string>();
    this.fileIdMapping = new Map<string, FileSignature>();
    
    // Default config
    this.config = {
      checkFileName: true,
      checkFileSize: true,
      checkLastModified: true,
      checkHash: true,
      confidenceThreshold: 0.8,
      ...config
    };
  }

  /**
   * Generate a hash for a file based on its properties
   */
  async generateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashData = `${file.name}-${file.size}-${file.lastModified}-${buffer.byteLength}`;
    
    let hash = 0;
    for (let i = 0; i < hashData.length; i++) {
      const char = hashData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Check if a file is already being processed or has been processed
   */
  isFileAlreadyProcessed(fileHash: string, fileId: string, firestoreData: Map<string, any>): boolean {
    return this.processedFileHashes.has(fileHash) || 
           firestoreData.has(fileId) || 
           this.processingLocks.has(fileId);
  }

  /**
   * Enhanced duplicate checking with configurable criteria
   */
  checkForDuplicate(file: File, fileId: string): DuplicateCheckResult {
    const fileSignature: FileSignature = {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified
    };

    // Check against existing files
    for (const [existingId, existingSignature] of this.fileIdMapping.entries()) {
      if (existingId === fileId) continue; // Don't compare with self

      const matchedOn: ('name' | 'size' | 'lastModified' | 'hash')[] = [];
      let matchScore = 0;
      let totalChecks = 0;

      // Check name match
      if (this.config.checkFileName) {
        totalChecks++;
        if (existingSignature.name === fileSignature.name) {
          matchedOn.push('name');
          matchScore++;
        }
      }

      // Check size match
      if (this.config.checkFileSize) {
        totalChecks++;
        if (existingSignature.size === fileSignature.size) {
          matchedOn.push('size');
          matchScore++;
        }
      }

      // Check last modified
      if (this.config.checkLastModified) {
        totalChecks++;
        if (existingSignature.lastModified === fileSignature.lastModified) {
          matchedOn.push('lastModified');
          matchScore++;
        }
      }

      // Check hash if available
      if (this.config.checkHash && existingSignature.hash && fileSignature.hash) {
        totalChecks++;
        if (existingSignature.hash === fileSignature.hash) {
          matchedOn.push('hash');
          matchScore++;
        }
      }

      const confidence = totalChecks > 0 ? matchScore / totalChecks : 0;

      if (confidence >= (this.config.confidenceThreshold || 0.8)) {
        return {
          isDuplicate: true,
          existingFileId: existingId,
          confidence,
          matchedOn,
          shouldShowInUI: true,
          canRetry: true,
          userMessage: `Similar to "${existingSignature.name}" (${Math.round(confidence * 100)}% match)`,
        };
      }
    }

    return {
      isDuplicate: false,
      confidence: 0,
      matchedOn: [],
      shouldShowInUI: true,
      canRetry: true
    };
  }

  /**
   * Add a file to tracking and mark as processing
   */
  addFile(file: File, fileId: string): void {
    // Store file signature for duplicate checking
    const fileSignature: FileSignature = {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified
    };
    
    this.fileIdMapping.set(fileId, fileSignature);
    
    // Generate hash asynchronously and store when ready
    this.generateFileHash(file).then(hash => {
      fileSignature.hash = hash;
      this.fileHashMapping.set(fileId, hash);
      this.processedFileHashes.add(hash);
    }).catch(error => {
      console.warn('Failed to generate hash for file:', file.name, error);
    });
  }

  /**
   * Mark file as currently being processed
   */
  markFileAsProcessing(fileHash: string, fileId: string): void {
    this.processedFileHashes.add(fileHash);
    this.processingLocks.add(fileId);
    
    // Store the mapping for later removal
    this.fileHashMapping.set(fileId, fileHash);
  }

  /**
   * Release processing lock for a file
   */
  releaseProcessingLock(fileId: string, fileHash?: string): void {
    this.processingLocks.delete(fileId);
    
    if (fileHash) {
      this.processedFileHashes.delete(fileHash);
    } else {
      // If no hash provided, look it up
      const storedHash = this.fileHashMapping.get(fileId);
      if (storedHash) {
        this.processedFileHashes.delete(storedHash);
      }
    }
  }

  /**
   * NEW: Remove a file from all tracking
   * This is the method that was missing!
   */
  removeFile(fileId: string): void {
    console.log('🗑️ Removing file from deduplication tracking:', fileId);
    
    // Remove from processing locks
    this.processingLocks.delete(fileId);
    
    // Remove from upload attempts
    this.uploadAttempts.delete(fileId);
    
    // Remove file hash if we have it
    const fileHash = this.fileHashMapping.get(fileId);
    if (fileHash) {
      this.processedFileHashes.delete(fileHash);
      this.fileHashMapping.delete(fileId);
    }
    
    // Remove file signature
    this.fileIdMapping.delete(fileId);
    
    console.log('✅ File removed from deduplication tracking');
  }

  /**
   * Track upload attempts for retry logic
   */
  incrementUploadAttempt(fileId: string): number {
    const currentAttempts = this.uploadAttempts.get(fileId) || 0;
    const newAttempts = currentAttempts + 1;
    this.uploadAttempts.set(fileId, newAttempts);
    return newAttempts;
  }

  /**
   * Track Firestore document IDs
   */
  addFirestoreDocId(docId: string): void {
    this.firestoreDocIds.add(docId);
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.processedFileHashes.clear();
    this.firestoreDocIds.clear();
    this.uploadAttempts.clear();
    this.processingLocks.clear();
    this.fileHashMapping.clear();
    this.fileIdMapping.clear();
    
    console.log('🧹 Deduplication service cleared');
  }

  /**
   * Get statistics about tracked data
   */
  getStats(): DeduplicationStats {
    const uploadRetries = Array.from(this.uploadAttempts.entries());
    const totalRetries = uploadRetries.reduce((sum, [, attempts]) => sum + attempts, 0);
    
    return {
      totalFilesProcessed: this.fileIdMapping.size,
      duplicatesDetected: 0, // Could be enhanced to track this
      duplicatesBlocked: 0,  // Could be enhanced to track this
      uniqueFiles: this.fileIdMapping.size,
      duplicateRate: 0,      // Could be calculated if we track duplicates
      
      // Legacy stats for compatibility
      totalHashesTracked: this.processedFileHashes.size,
      firestoreDocsTracked: this.firestoreDocIds.size,
      uploadRetries: uploadRetries,
      currentlyProcessing: this.processingLocks.size,
      totalRetryAttempts: totalRetries
    };
  }

  /**
   * Get detailed information about a specific file
   */
  getFileInfo(fileId: string): { signature?: FileSignature; hash?: string; isProcessing: boolean } {
    return {
      signature: this.fileIdMapping.get(fileId),
      hash: this.fileHashMapping.get(fileId),
      isProcessing: this.processingLocks.has(fileId)
    };
  }

  /**
   * Check if a file is currently being processed
   */
  isProcessing(fileId: string): boolean {
    return this.processingLocks.has(fileId);
  }

  /**
   * Get all files currently being processed
   */
  getCurrentlyProcessingFiles(): string[] {
    return Array.from(this.processingLocks);
  }

  shouldProcessFile(fileId: string): ProcessingDecision {
  // Check if already processing
  if (this.isProcessing(fileId)) {
    return {
      shouldProcess: false,
      reason: 'File is currently being processed',
      canRetry: false,
      blockedBy: 'currently_processing'
    };
  }
  
  // Check upload attempts
  const attempts = this.uploadAttempts.get(fileId) || 0;
  if (attempts >= 3) {
    return {
      shouldProcess: false,
      reason: 'Maximum retry attempts reached (3/3)',
      canRetry: false,
      blockedBy: 'max_attempts'
    };
  }
  
  // Check if hash already processed
  const fileHash = this.fileHashMapping.get(fileId);
  if (fileHash && this.processedFileHashes.has(fileHash)) {
    return {
      shouldProcess: false,
      reason: 'File with identical content already processed',
      canRetry: true, // User can force retry if they want
      blockedBy: 'duplicate'
    };
  }
  
  return {
    shouldProcess: true,
    reason: 'Ready to process',
    canRetry: true
  };
}

}