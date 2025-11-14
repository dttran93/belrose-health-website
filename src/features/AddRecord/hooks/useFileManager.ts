import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { FileUploadService } from '@/features/AddRecord/services/fileUploadService';
import { FileObject, FileStatus, AIProcessingStatus, VirtualFileInput } from '@/types/core';

import {
  AddFilesOptions,
  FileStats,
  FHIRConversionCallback,
  ResetProcessCallback,
  UseFileManagerTypes,
} from './useFileManager.type';
import { VirtualFileResult } from '../components/CombinedUploadFHIR.type';
import { UploadResult } from '../services/shared.types';
import { CombinedRecordProcessingService } from '../services/combinedRecordProcessingService';
import { useAuthContext } from '@/components/auth/AuthContext';
import { Timestamp } from 'firebase/firestore';

/**
 * A comprehensive file upload hook that handles:
 * - File selection and validation
 * - Document processing and text extraction
 * - Medical content detection
 * - Firestore uploads
 * - FHIR data integration
 * - Virtual file support
 */
export function useFileManager(): UseFileManagerTypes {
  // ==================== STATE MANAGEMENT ====================

  const { user } = useAuthContext(); // user.uid is usually the unique ID
  const [files, setFiles] = useState<FileObject[]>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const saved = sessionStorage.getItem('fileUpload_files');
        if (saved) {
          const parsed = JSON.parse(saved);
          console.log('🔄 Restored files from sessionStorage:', parsed.length);
          return parsed; // restored as-is
        }
      } catch (error) {
        console.warn('Failed to restore files from sessionStorage:', error);
      }
    }
    return [];
  });

  // Save to sessionStorage whenever files change
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem('fileUpload_files', JSON.stringify(files));
      } catch (error) {
        console.warn('Failed to save files to sessionStorage:', error);
      }
    }
  }, [files]);

  console.log(
    '📁 Current files in hook:',
    files.length,
    files.map(f => f.fileName)
  );
  const [savingToFirestore, setSavingToFirestore] = useState<Set<string>>(new Set());

  // ==================== REFS & SERVICES ====================

  const fileUploadService = useRef(new FileUploadService());
  const fhirConversionCallback = useRef<FHIRConversionCallback | null>(null);
  const resetProcessCallback = useRef<ResetProcessCallback | null>(null);

  // ==================== UTILITY/FACTORY FUNCTIONS ====================

  const generateId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const createFileObject = useCallback(
    async (file: File, id?: string): Promise<FileObject> => {
      console.log(`📁 Creating file object for: ${file.name}`);

      if (!user) {
        throw new Error('User must be authenticated to create file object');
      }

      // Hash the original file immediately
      let originalFileHash: string | null = null;
      try {
        originalFileHash = await hashOriginalFile(file);
      } catch (error) {
        console.warn(`⚠️ Could not hash file ${file.name}:`, error);
        // Continue without hash rather than failing entirely
        originalFileHash = null;
      }

      return {
        id: id || generateId(),
        file,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        status: 'pending' as FileStatus,
        uploadedAt: Timestamp.now(),
        extractedText: '',
        wordCount: 0,
        sourceType: 'File Upload',
        isVirtual: false,
        aiProcessingStatus: 'not_needed' as AIProcessingStatus,
        originalFileHash,
        administrators: [user.uid],
      };
    },
    [user]
  );

  const hashOriginalFile = async (file: File): Promise<string> => {
    try {
      console.log(`🔍 Hashing original file: ${file.name} (${file.size} bytes)`);
      const arrayBuffer = await file.arrayBuffer();

      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);

      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');

      console.log(`✅ Original hash generated: ${hashHex.substring(0, 12)}...`);
      return hashHex;
    } catch (error) {
      console.error('❌ Failed to hash original file:', error);
      throw new Error('File hashing failed');
    }
  };

  // ==================== CORE FILE MANAGEMENT ====================

  const retryFile = useCallback(
    async (fileId: string) => {
      const file = files.find(f => f.id === fileId);
      if (!file) {
        console.error(`❌ File not found for retry: ${fileId}`);
        return;
      }

      console.log(`🔄 Retrying file: ${file.fileName}`);
      updateFileStatus(fileId, 'processing');
      await processFile(file);
    },
    [files]
  );

  const clearAll = useCallback(() => {
    console.log('🧹 Clearing all files and data');
    setFiles([]);
    setSavingToFirestore(new Set());

    // Call reset callback if provided
    if (resetProcessCallback.current) {
      resetProcessCallback.current();
    }
  }, []);

  const updateFirestoreRecord = useCallback(async (fileId: string, data: any) => {
    try {
      await fileUploadService.current.updateRecord(fileId, data);
    } catch (error: any) {
      console.error(`❌ Failed to update Firestore record for ${fileId}:`, error);
      throw error;
    }
  }, []);

  // ==================== STATUS UPDATES ====================

  const updateFileStatus = useCallback(
    (fileId: string, status: FileStatus, additionalData: Partial<FileObject> = {}) => {
      setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, status, ...additionalData } : f)));
    },
    []
  );

  // ==================== FILE PROCESSING ====================

  const processFile = useCallback(
    async (fileObj: FileObject) => {
      console.log(`📋 Starting complete processing pipeline for: ${fileObj.fileName}`);

      updateFileStatus(fileObj.id, 'processing', {
        processingStage: 'Starting processing...',
      });

      try {
        // Use the service to process the file
        const result = await CombinedRecordProcessingService.processUploadedFile(fileObj, {
          onStageUpdate: (stage, data) => {
            updateFileStatus(fileObj.id, 'processing', {
              processingStage: stage,
              ...data,
            });
          },
          onError: error => {
            console.error(`Processing error for ${fileObj.fileName}:`, error);
          },
        });

        // Mark as completed with all processed data
        console.log(`🎉 Marking file as completed: ${fileObj.fileName}`);
        updateFileStatus(fileObj.id, 'completed', {
          processingStage: undefined,
          extractedText: result.extractedText,
          wordCount: result.wordCount,
          fhirData: result.fhirData,
          belroseFields: result.belroseFields,
          recordHash: result.recordHash,
          encryptedData: result.encryptedData,
          aiProcessingStatus: result.aiProcessingStatus,
          contextText: result.contextText,
        });

        // Create the updated file object
        const updatedFile: FileObject = {
          ...fileObj,
          status: 'completed',
          processingStage: undefined,
          extractedText: result.extractedText,
          wordCount: result.wordCount,
          fhirData: result.fhirData,
          belroseFields: result.belroseFields,
          recordHash: result.recordHash,
          encryptedData: result.encryptedData,
          aiProcessingStatus: result.aiProcessingStatus,
          contextText: result.contextText,
        };

        console.log(`🎉 Complete processing pipeline finished for: ${fileObj.fileName}`);

        return updatedFile;
      } catch (error: any) {
        console.error(`💥 Processing failed for ${fileObj.fileName}:`, error);
        updateFileStatus(fileObj.id, 'error', {
          error: error.message,
          processingStage: undefined,
          aiProcessingStatus: 'not_needed',
        });

        throw error;
      }
    },
    [updateFileStatus]
  );

  // ==================== ADD FILES ====================

  const addFiles = useCallback(
    async (fileList: FileList, options: AddFilesOptions = {}) => {
      const { maxFiles = 10, maxSizeBytes = 50 * 1024 * 1024, autoProcess = true } = options;

      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem('fileUpload_files');
      }

      console.log(`📂 Adding ${fileList.length} files...`);

      const newFiles: FileObject[] = [];
      const errors: string[] = [];

      // Convert FileList to array and validate
      for (const file of Array.from(fileList)) {
        // Check file count limit
        if (newFiles.length >= maxFiles) {
          errors.push(`Maximum ${maxFiles} files allowed`);
          continue;
        }

        // Check file size
        if (file.size > maxSizeBytes) {
          errors.push(`${file.name} is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
          continue;
        }

        try {
          const fileObj = await createFileObject(file);
          newFiles.push(fileObj);

          console.log(`✅ File processed: ${file.name}`, {
            id: fileObj.id,
            hasHash: !!fileObj.originalFileHash,
            hashPreview: fileObj.originalFileHash?.substring(0, 12) + '...',
          });
        } catch (error) {
          console.error(`❌ Failed to process file ${file.name}:`, error);
          errors.push(`Failed to process ${file.name}`);
        }
      }

      // Show errors if any
      if (errors.length > 0) {
        toast.error(errors.join(', '));
      }

      if (newFiles.length === 0) {
        console.log('❌ No valid files to add');
        return;
      }

      setFiles(prev => {
        const combined = [...prev, ...newFiles];
        console.log(`✅ Added ${newFiles.length} files. Total: ${combined.length}`);
        return combined;
      });
    },
    [setFiles]
  );

  // ================ FILE DELETION =========================

  /**
   * Remove file from local state only
   * Pure local state cleanup - no Firebase operations
   */
  const removeFileFromLocal = useCallback((fileId: string) => {
    console.log(`🧹 Removing file from local state: ${fileId}`);

    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== fileId);
      console.log(`📊 Files before removal: ${prev.length}, after: ${filtered.length}`);
      return filtered;
    });

    setSavingToFirestore(prev => {
      const newSet = new Set(prev);
      newSet.delete(fileId);
      return newSet;
    });

    console.log('✅ File removed from local state:', fileId);
  }, []);

  /**
   * Delete file from Firebase
   * Pure Firebase operation wrapper - delegates to service
   */
  const deleteFileFromFirebase = useCallback(async (documentId: string): Promise<void> => {
    console.log(`🔥 Deleting file from Firebase: ${documentId}`);

    try {
      await fileUploadService.current.deleteFile(documentId);
      console.log('✅ File deleted from Firebase:', documentId);
    } catch (error: any) {
      console.error('❌ Firebase deletion failed:', error);
      throw error; // Let caller handle the error
    }
  }, []);

  /**
   * Cancel upload operations for a file
   * Service operation wrapper
   */
  const cancelFileUpload = useCallback((fileId: string) => {
    console.log(`🛑 Cancelling upload operations for: ${fileId}`);

    try {
      fileUploadService.current.cancelUpload(fileId);
      console.log('✅ Upload operations cancelled for:', fileId);
    } catch (error: any) {
      console.warn('⚠️ Error cancelling upload:', error);
      // Non-fatal - don't throw
    }
  }, []);

  /**
   * WRAPPER: Complete file removal for FileListItem
   * Combines local cleanup + Firebase deletion + upload cancellation
   */
  const removeFileComplete = useCallback(
    async (fileId: string): Promise<void> => {
      console.log(`🗑️ Starting complete file removal: ${fileId}`);

      const fileToRemove = files.find(f => f.id === fileId);

      if (!fileToRemove) {
        console.warn(`⚠️ File not found in local state: ${fileId}`);
        return;
      }

      console.log(`📁 File info:`, {
        name: fileToRemove.fileName,
        status: fileToRemove.status,
        hasDocumentId: !!fileToRemove.id,
        documentId: fileToRemove.id,
        isVirtual: fileToRemove.isVirtual,
      });

      // Step 1: Cancel any active uploads first
      cancelFileUpload(fileId);

      // Step 2: Delete from Firebase if it was uploaded
      if (fileToRemove.firestoreId) {
        try {
          await deleteFileFromFirebase(fileToRemove.firestoreId);
          toast.success(`Deleted "${fileToRemove.fileName}" from cloud storage`);
        } catch (error: any) {
          console.error('❌ Firebase deletion failed, but continuing with local cleanup:', error);
          toast.error(
            `Could not delete "${fileToRemove.fileName}" from cloud storage: ${error.message}`
          );
          // Continue with local cleanup even if Firebase deletion fails
        }
      }

      // Step 3: Always clean up local state
      removeFileFromLocal(fileId);

      console.log('✅ Complete file removal finished:', fileId);
    },
    [files, removeFileFromLocal, deleteFileFromFirebase, cancelFileUpload]
  );

  // Also enhance your existing clearAll function
  const enhancedClearAll = useCallback(async () => {
    console.log('🧹 Starting enhanced clearAll - will clean up Firebase files too');

    // Get all uploaded files that need Firebase cleanup
    const uploadedFiles = files
      .filter(f => f.firestoreId)
      .map(f => ({ id: f.firestoreId!, fileName: f.fileName }));

    if (uploadedFiles.length > 0) {
      console.log(`🔥 Found ${uploadedFiles.length} uploaded files to delete from Firebase`);

      try {
        // Delete files one by one with error handling
        const deletePromises = uploadedFiles.map(async file => {
          try {
            await deleteFileFromFirebase(file.id);
            return { success: true, fileId: file.id, name: file.fileName };
          } catch (error: any) {
            console.error(`❌ Failed to delete ${file.fileName}:`, error);
            return { success: false, fileId: file.id, name: file.fileName, error: error.message };
          }
        });

        const results = await Promise.all(deletePromises);
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        if (successful.length > 0) {
          console.log(`✅ Successfully deleted ${successful.length} files from Firebase`);
        }

        if (failed.length > 0) {
          console.warn(`❌ Failed to delete ${failed.length} files from Firebase:`, failed);
          toast.warning(`Warning: Could not delete ${failed.length} files from cloud storage`);
        } else {
          toast.success(`Cleared all files including ${successful.length} from cloud storage`);
        }
      } catch (error: any) {
        console.error('❌ Bulk deletion error:', error);
        toast.error('Failed to clear some files from cloud storage');
      }
    } else {
      console.log('📱 No uploaded files found - just clearing local state');
    }

    // Clear local state (same as original clearAll)
    console.log('🧹 Clearing local state');
    setFiles([]);
    setSavingToFirestore(new Set());

    // Call reset callback if provided
    if (resetProcessCallback.current) {
      resetProcessCallback.current();
    }

    console.log('✅ Enhanced clearAll completed');
  }, [files, deleteFileFromFirebase]);

  // ==================== FIRESTORE OPERATIONS ====================

  const uploadFiles = useCallback(
    async (filesToUpload: FileObject[]): Promise<UploadResult[]> => {
      if (filesToUpload.length === 0) {
        console.log('📤 No files ready for upload');
        return [];
      }

      console.log(`📤 Uploading ${filesToUpload.length} files to Firestore...`);

      const uploadPromises = filesToUpload.map(async (fileObj): Promise<UploadResult> => {
        if (savingToFirestore.has(fileObj.id)) {
          console.log(`⏳ File ${fileObj.id} already uploading, skipping...`);
          return {
            success: false,
            fileId: fileObj.id,
            error: 'File already uploading',
          };
        }

        setSavingToFirestore(prev => new Set([...prev, fileObj.id]));

        try {
          const result = await fileUploadService.current.uploadFile(fileObj);
          console.log(`✅ Upload successful for ${fileObj.fileName}:`, result);

          updateFileStatus(fileObj.id, 'completed', {
            firestoreId: result.documentId,
            uploadedAt: result.uploadedAt || Timestamp.now(),
            owners: [fileObj.uploadedBy!],
          });

          // 🔄 Sync sessionStorage right after updating status
          if (typeof window !== 'undefined' && window.sessionStorage) {
            try {
              const updatedFiles = files.map(f =>
                f.id === fileObj.id
                  ? {
                      ...f,
                      firestoreId: result.documentId,
                      uploadedAt: result.uploadedAt || Timestamp.now(),
                    }
                  : f
              );
              sessionStorage.setItem('fileUpload_files', JSON.stringify(updatedFiles));
            } catch (err) {
              console.warn('Failed to update sessionStorage after upload:', err);
            }
          }

          // 🎉 SUCCESS TOAST HERE
          toast.success(`📁 ${fileObj.fileName} uploaded successfully!`, {
            description: 'Your file has been saved to cloud storage',
            duration: 4000,
          });

          return {
            success: true,
            documentId: result.documentId,
            downloadURL: result.downloadURL,
            fileId: fileObj.id,
          };
        } catch (error: any) {
          console.error(`💥 Upload failed for ${fileObj.fileName}:`, error);
          updateFileStatus(fileObj.id, 'error', { error: error.message });

          return {
            success: false,
            fileId: fileObj.id,
            error: error.message,
          };
        } finally {
          setSavingToFirestore(prev => {
            const newSet = new Set(prev);
            newSet.delete(fileObj.id);
            return newSet;
          });
        }
      });

      const results = await Promise.all(uploadPromises);
      return results;
    },
    [savingToFirestore, updateFileStatus]
  );

  // ==================== VIRTUAL FILE SUPPORT ====================

  const addVirtualFile = useCallback(
    async (
      virtualData: VirtualFileInput
    ): Promise<{
      fileId: string;
      recordHash?: string;
      virtualFile: FileObject; // ← Add this
    }> => {
      // Guard clause for user
      if (!user) {
        throw new Error('User must be authenticated to add virtual file');
      }
      const fileId = virtualData.id || generateId();
      const fileName = virtualData.fileName || `Virtual File ${fileId}`;

      // Process the virtual file through the pipeline
      const result = await CombinedRecordProcessingService.processVirtualFile(
        virtualData,
        fileName
      );

      // Create virtual file with processed data
      const virtualFile: FileObject = {
        id: fileId,
        fileName: fileName,
        fileSize: virtualData.fileSize || 0,
        fileType: virtualData.fileType || 'application/json',
        status: 'completed',
        uploadedAt: Timestamp.now(),
        uploadedBy: user?.uid,
        originalText: virtualData.originalText,
        wordCount: virtualData.wordCount || 0,
        sourceType: virtualData.sourceType,
        isVirtual: true,
        fhirData: virtualData.fhirData,
        file: undefined,
        belroseFields: result.belroseFields,
        aiProcessingStatus: result.aiProcessingStatus,
        recordHash: result.recordHash,
        encryptedData: result.encryptedData,
        administrators: virtualData.administrators || [user.uid],
      };

      // Add to state
      setFiles(prev => [...prev, virtualFile]);
      console.log(`✅ Added virtual file: ${virtualFile.fileName}`);

      return { fileId, recordHash: result.recordHash, virtualFile };
    },
    [setFiles, user]
  );

  const addFhirAsVirtualFile = useCallback(
    async (
      fhirData: any | undefined,
      options: VirtualFileInput & { autoUpload?: boolean } = {}
    ): Promise<VirtualFileResult> => {
      const fileId = options.id || generateId();
      const fileName = options.fileName || `FHIR Document ${fileId}`;

      const virtualFileInput: VirtualFileInput = {
        id: fileId,
        fileName: fileName,
        fileSize: JSON.stringify(fhirData).length,
        fileType: 'application/fhir+json',
        originalText: options.originalText,
        wordCount: JSON.stringify(fhirData).split(/\s+/).length,
        sourceType: options.sourceType,
        fhirData,
        ...options,
      };

      // Get the processed virtual file directly from the return value
      const {
        fileId: generatedFileId,
        recordHash,
        virtualFile,
      } = await addVirtualFile(virtualFileInput);

      console.log('🧩 virtualFile AFTER addVirtualFile:', {
        hasEncryptedData: !!virtualFile.encryptedData,
        encryptedDataKeys: virtualFile.encryptedData
          ? Object.keys(virtualFile.encryptedData)
          : Object.keys(virtualFile || {}),
      });

      // 🔥 AUTO-UPLOAD if requested
      if (options.autoUpload) {
        console.log('🚀 Auto-uploading virtual file:', virtualFile.fileName);

        try {
          if (savingToFirestore.has(generatedFileId)) {
            throw new Error('File already uploading');
          }

          setSavingToFirestore(prev => new Set([...prev, generatedFileId]));

          const uploadResult = await fileUploadService.current.uploadFile(virtualFile);
          console.log(`✅ Auto-upload successful for ${virtualFile.fileName}:`, uploadResult);

          updateFileStatus(generatedFileId, 'completed', {
            firestoreId: uploadResult.documentId,
            uploadedAt: uploadResult.uploadedAt || Timestamp.now(),
            owners: [virtualFile.uploadedBy || 'unknown_user'],
          });

          toast.success(`📁 ${virtualFile.fileName} uploaded successfully!`, {
            description: 'Your file has been saved to cloud storage',
            duration: 4000,
          });

          return {
            fileId: generatedFileId,
            virtualFile,
            uploadResult: {
              success: true,
              documentId: uploadResult.documentId,
              fileId: generatedFileId,
              uploadedAt: uploadResult.uploadedAt,
              filePath: uploadResult.filePath,
              downloadURL: uploadResult.downloadURL,
            },
          };
        } catch (error) {
          console.error(`❌ Auto-upload failed for ${virtualFile.fileName}:`, error);
          updateFileStatus(generatedFileId, 'error', {
            error: error instanceof Error ? error.message : 'Upload failed',
          });
          throw error;
        } finally {
          setSavingToFirestore(prev => {
            const newSet = new Set(prev);
            newSet.delete(generatedFileId);
            return newSet;
          });
        }
      }

      return { fileId: generatedFileId, virtualFile };
    },
    [addVirtualFile, fileUploadService, savingToFirestore, updateFileStatus]
  );

  // ==================== FHIR INTEGRATION ====================

  const setFHIRConversionCallback = useCallback((callback: FHIRConversionCallback) => {
    fhirConversionCallback.current = callback;
  }, []);

  const setResetProcessCallback = useCallback((callback: ResetProcessCallback) => {
    resetProcessCallback.current = callback;
  }, []);

  // ==================== COMPUTED VALUES ====================

  const getStats = useCallback((): FileStats => {
    const total = files.length;
    const processing = files.filter(f => f.status === 'processing').length;
    const completed = files.filter(f => f.status === 'completed').length;
    const errors = files.filter(f => f.status === 'error').length;
    const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      processing,
      completed,
      errors,
      percentComplete,
    };
  }, [files]);

  /**
   * Get files in the format expected by other parts of the app
   */
  const processedFiles = files.filter(f => f.status === 'completed');

  // ==================== RETURN INTERFACE ====================

  return {
    // Core state (for compatibility)
    files,
    processedFiles,
    savingToFirestore,

    // File management actions
    addFiles,
    removeFileFromLocal,
    deleteFileFromFirebase,
    cancelFileUpload,
    removeFileComplete,
    retryFile,
    clearAll,
    enhancedClearAll,
    processFile,

    // FHIR integration
    setFHIRConversionCallback,
    setResetProcessCallback,

    // Status updates
    updateFileStatus,

    // Firestore operations
    uploadFiles,
    updateFirestoreRecord,

    // Computed values
    getStats,
    savedToFirestoreCount: files.filter(f => f.firestoreId).length,
    savingCount: savingToFirestore.size,

    // VirtualFile Support
    addVirtualFile,
    addFhirAsVirtualFile,

    // Reset function
    reset: clearAll,
  };
}

export default useFileManager;
