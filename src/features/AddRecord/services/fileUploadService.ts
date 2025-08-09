import { saveFileMetadataToFirestore, uploadUserFile } from '@/firebase/uploadUtils';
import { FileObject } from '@/types/core';
import { 
  UploadResult, 
  UploadProgress, 
  UploadOptions, 
  FirestoreFileMetadata,
  FHIRUpdateData,
  IFileUploadService,
  FileUploadError,
  UploadErrorCode
} from './fileUploadService.types';

/**
 * Service for handling file uploads to Firebase Storage and Firestore
 * Supports both regular file uploads and virtual file handling
 */
export class FileUploadService implements IFileUploadService {
  // Track upload progress for multiple files
  private uploadProgressMap: Map<string, UploadProgress> = new Map();
  
  // Track active upload operations for cancellation
  private activeUploads: Map<string, AbortController> = new Map();

  /**
   * Upload a single file to Firebase Storage and save metadata to Firestore
   */
  async uploadSingleFile(fileObj: FileObject, options: UploadOptions = {}): Promise<UploadResult> {
    console.log('📤 Starting single file upload:', fileObj.name);
    
    try {
      // Handle virtual files differently
      if (fileObj.isVirtual) {
        return await this.handleVirtualFileUpload(fileObj, options);
      }

      // Regular file upload
      return await this.handleRegularFileUpload(fileObj, options);
      
    } catch (error: any) {
      console.error(`❌ Upload failed for ${fileObj.name}:`, error);
      
      // Convert to our custom error type
      const uploadError = this.createUploadError(error, fileObj.id);
      throw uploadError;
    }
  }

  /**
   * Handle virtual file upload (no actual file to upload to storage)
   */
  private async handleVirtualFileUpload(fileObj: FileObject, options: UploadOptions): Promise<UploadResult> {
    console.log('🎯 Processing virtual file upload:', fileObj.name);
    
    // For virtual files, we only save metadata to Firestore
    const firestoreDoc = await saveFileMetadataToFirestore({
      downloadURL: null, // No file in storage
      filePath: null,    // No storage path
      fileObj: fileObj
    });

    return {
      documentId: firestoreDoc,
      firestoreId: firestoreDoc,  // Legacy compatibility
      downloadURL: '', // Empty for virtual files
      filePath: '',    // Empty for virtual files
      uploadedAt: new Date(),
      savedAt: new Date().toISOString(), // Legacy compatibility
      fileSize: fileObj.size,
      fileHash: fileObj.fileHash, // Legacy compatibility
      success: true
    };
  }

  /**
   * Handle regular file upload to Firebase Storage
   */
  private async handleRegularFileUpload(fileObj: FileObject, options: UploadOptions): Promise<UploadResult> {
    if (!fileObj.file) {
      throw new FileUploadError(
        'No file found in fileObj for regular upload',
        'INVALID_FILE_TYPE',
        fileObj.id
      );
    }

    console.log('📁 Processing regular file upload:', fileObj.name);
    
    // Upload file to Firebase Storage
    const { downloadURL, filePath } = await uploadUserFile(fileObj);
    
    // Save metadata to Firestore
    const firestoreDoc = await saveFileMetadataToFirestore({
      downloadURL,
      filePath,
      fileObj: fileObj
    });

    return {
      documentId: firestoreDoc,
      firestoreId: firestoreDoc,  // Legacy compatibility
      downloadURL,
      filePath,
      uploadedAt: new Date(),
      savedAt: new Date().toISOString(), // Legacy compatibility
      fileSize: fileObj.size,
      fileHash: fileObj.fileHash, // Legacy compatibility
      success: true
    };
  }

  /**
   * Upload file with retry logic and progress tracking
   */
  async uploadWithRetry(
    fileObj: FileObject, 
    maxRetries: number = 3, 
    onProgress?: (status: 'uploading' | 'success' | 'error', data: any) => void
  ): Promise<UploadResult> {
    const fileId = fileObj.id;
    
    // Setup abort controller for cancellation
    const abortController = new AbortController();
    this.activeUploads.set(fileId, abortController);

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Check if operation was cancelled
        if (abortController.signal.aborted) {
          throw new FileUploadError('Upload cancelled', 'UPLOAD_CANCELLED', fileId);
        }

        try {
          // Update progress
          this.updateProgress(fileId, {
            fileId,
            bytesTransferred: 0,
            totalBytes: fileObj.size,
            percentComplete: 0
          });

          onProgress?.('uploading', attempt + 1);
          
          const result = await this.uploadSingleFile(fileObj);
          
          // Update final progress
          this.updateProgress(fileId, {
            fileId,
            bytesTransferred: fileObj.size,
            totalBytes: fileObj.size,
            percentComplete: 100
          });

          onProgress?.('success', result);
          
          console.log(`✅ Upload successful for ${fileObj.name} after ${attempt + 1} attempts`);
          return result;
          
        } catch (error: any) {
          console.error(`💥 Upload attempt ${attempt + 1} failed for ${fileObj.name}:`, error);
          
          // If this was the last attempt, give up
          if (attempt === maxRetries) {
            onProgress?.('error', error);
            throw new FileUploadError(
              `Failed to upload ${fileObj.name} after ${maxRetries + 1} attempts: ${error.message}`,
              this.getErrorCode(error),
              fileId
            );
          }
          
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Retrying upload in ${delay}ms...`);
          await this.delay(delay);
        }
      }
      
      // This should never be reached, but TypeScript requires it
      throw new FileUploadError('Unexpected error in retry loop', 'UNKNOWN_ERROR', fileId);
      
    } finally {
      // Cleanup
      this.activeUploads.delete(fileId);
      this.uploadProgressMap.delete(fileId);
    }
  }

  /**
   * Main upload method - this is what useFileUpload calls
   * (This is the missing method that was causing the error!)
   */
  async uploadFile(fileObj: FileObject, options: UploadOptions = {}): Promise<UploadResult> {
    return await this.uploadWithRetry(fileObj, 3, (status, data) => {
      console.log(`📊 Upload ${status} for ${fileObj.name}:`, data);
    });
  }

  /**
   * Update a Firestore record with new data
   */
  async updateRecord(fileId: string, data: Partial<FirestoreFileMetadata>): Promise<void> {
  try {
    console.log('📝 Updating Firestore record:', fileId, data);
    console.log('📋 data.fhirData exists:', !!data.fhirData);
    console.log('📋 data.fhirData type:', typeof data.fhirData);
    
    // 🔥 ADD MORE DETAILED LOGGING
    const { updateFirestoreWithFHIR } = await import('@/firebase/uploadUtils');
    console.log('✅ Successfully imported updateFirestoreWithFHIR');
    
    if (data.fhirData) {
      console.log('🎯 About to call updateFirestoreWithFHIR with:');
      console.log('  - documentId:', fileId);
      console.log('  - fhirData preview:', JSON.stringify(data.fhirData).substring(0, 200) + '...');
      
      await updateFirestoreWithFHIR(fileId, data.fhirData);
      
      console.log('✅ updateFirestoreWithFHIR completed successfully!');
    } else {
      console.log('📝 Non-FHIR update - implement if needed');
    }
    
  } catch (error: any) {
    console.error('❌ DETAILED ERROR in updateRecord:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      fileId: fileId
    });
    
    throw new FileUploadError(
      `Failed to update record: ${error.message}`,
      'UPDATE_FAILED',
      fileId
    );
  }
}

  /**
   * Update Firestore record with FHIR data
   */
  async updateWithFHIR(documentId: string, fhirData: any): Promise<void> {
    const updateData: FHIRUpdateData = {
      fhirData: fhirData,
      fhirConvertedAt: new Date().toISOString(),
      processingStatus: 'fhir_converted'
    };

    await this.updateRecord(documentId, updateData);
  }

  /**
   * Delete a file from storage and Firestore
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      // Cancel any active upload
      const activeUpload = this.activeUploads.get(fileId);
      if (activeUpload) {
        activeUpload.abort();
        this.activeUploads.delete(fileId);
      }

      // TODO: Implement actual file deletion
      // await deleteFromStorage(filePath);
      // await deleteFromFirestore(documentId);
      
      console.log('🗑️ File deleted:', fileId);
      
    } catch (error: any) {
      throw new FileUploadError(
        `Failed to delete file: ${error.message}`,
        'DELETE_FAILED',
        fileId
      );
    }
  }

  /**
   * Get upload progress for a specific file
   */
  getUploadProgress(fileId: string): UploadProgress | null {
    return this.uploadProgressMap.get(fileId) || null;
  }

  /**
   * Cancel an active upload
   */
  cancelUpload(fileId: string): void {
    const activeUpload = this.activeUploads.get(fileId);
    if (activeUpload) {
      activeUpload.abort();
      this.activeUploads.delete(fileId);
      this.uploadProgressMap.delete(fileId);
      console.log('🛑 Upload cancelled for:', fileId);
    }
  }

  /**
   * Get all currently active uploads
   */
  getActiveUploads(): string[] {
    return Array.from(this.activeUploads.keys());
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Update upload progress for a file
   */
  private updateProgress(fileId: string, progress: UploadProgress): void {
    this.uploadProgressMap.set(fileId, progress);
  }

  /**
   * Create a standardized upload error
   */
  private createUploadError(error: any, fileId?: string): FileUploadError {
    const code = this.getErrorCode(error);
    const message = error.message || 'Unknown upload error';
    
    return new FileUploadError(message, code, fileId);
  }

  /**
   * Map error types to our error codes
   */
  private getErrorCode(error: any): UploadErrorCode {
    if (error.code) {
      switch (error.code) {
        case 'storage/quota-exceeded':
          return 'STORAGE_QUOTA_EXCEEDED';
        case 'storage/unauthorized':
          return 'PERMISSION_DENIED';
        case 'storage/network-error':
          return 'NETWORK_ERROR';
        default:
          return 'UNKNOWN_ERROR';
      }
    }

    if (error.message) {
      const message = error.message.toLowerCase();
      if (message.includes('file too large')) return 'FILE_TOO_LARGE';
      if (message.includes('invalid file type')) return 'INVALID_FILE_TYPE';
      if (message.includes('network')) return 'NETWORK_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Promise-based delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Cancel all active uploads
    this.activeUploads.forEach((controller) => {
      controller.abort();
    });
    
    // Clear all tracking
    this.activeUploads.clear();
    this.uploadProgressMap.clear();
    
    console.log('🧹 FileUploadService cleaned up');
  }
}