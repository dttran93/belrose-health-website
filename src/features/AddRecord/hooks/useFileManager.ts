import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { FileUploadService } from '@/features/AddRecord/services/fileUploadService';
import DocumentProcessorService from '@/features/AddRecord/services/documentProcessorService';
import { FileObject, FileStatus, UploadResult } from '@/types/core';
import { convertToFHIR } from '@/features/AddRecord/services/fhirConversionService';

import {
  AddFilesOptions,
  VirtualFileData,
  AddFhirAsVirtualFileOptions,
  FileStats,
  FHIRConversionCallback,
  ResetProcessCallback,
  UseFileUploadReturn,
} from './useFileManager.type';
import { VirtualFileResult } from '../components/CombinedUploadFHIR.type';

/**
 * A comprehensive file upload hook that handles:
 * - File selection and validation
 * - Document processing and text extraction
 * - Medical content detection
 * - Firestore uploads
 * - FHIR data integration
 * - Virtual file support
 */
export function useFileUpload(): UseFileUploadReturn {
    
    // ==================== STATE MANAGEMENT ====================    
    const [files, setFiles] = useState<FileObject[]>(() => {
        // Try to restore from sessionStorage on mount
        if (typeof window !== 'undefined' && window.sessionStorage) {
            try {
                const saved = sessionStorage.getItem('fileUpload_files');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    console.log('🔄 Restored files from sessionStorage:', parsed.length);
                    return parsed;
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

    console.log('📁 Current files in hook:', files.length, files.map(f => f.name));
    const [firestoreData, setFirestoreData] = useState<Map<string, any>>(new Map());
    const [savingToFirestore, setSavingToFirestore] = useState<Set<string>>(new Set());

    // ==================== REFS & SERVICES ====================
    
    const fileUploadService = useRef(new FileUploadService());
    const fhirConversionCallback = useRef<FHIRConversionCallback | null>(null);
    const resetProcessCallback = useRef<ResetProcessCallback | null>(null);

    // ==================== UTILITY/FACTORY FUNCTIONS ====================
    
    const generateId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const createFileObject = (file: File, id?: string): FileObject => ({
        id: id || generateId(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending' as FileStatus,
        uploadedAt: new Date().toISOString(),
        extractedText: '',
        wordCount: 0,
        medicalDetection: { isMedical: false, confidence: 0, documentType: 'unknown', reasoning: '', suggestion: '' },
        documentType: 'unknown',
        isVirtual: false
    });

    // ==================== CORE FILE MANAGEMENT ====================
    
    const addFiles = useCallback((fileList: FileList, options: AddFilesOptions = {}) => {
        const { maxFiles = 10, maxSizeBytes = 50 * 1024 * 1024, autoProcess = true } = options;
        
        if (typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.removeItem('fileUpload_files');
        }
    
        console.log(`📂 Adding ${fileList.length} files...`);
        
        const newFiles: FileObject[] = [];
        const errors: string[] = [];
        
        // Convert FileList to array and validate
        Array.from(fileList).forEach((file) => {
            // Check file count limit
            if (newFiles.length >= maxFiles) {
                errors.push(`Maximum ${maxFiles} files allowed`);
                return;
            }
            
            // Check file size
            if (file.size > maxSizeBytes) {
                errors.push(`${file.name} is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
                return;
            }
            
            const fileObj = createFileObject(file);
            newFiles.push(fileObj);
        });
        
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
        
        // Auto-process if enabled
        if (autoProcess) {
            newFiles.forEach(fileObj => {
                processFile(fileObj);
            });
        }
    }, []);

    const retryFile = useCallback(async (fileId: string) => {
        const file = files.find(f => f.id === fileId);
        if (!file) {
            console.error(`❌ File not found for retry: ${fileId}`);
            return;
        }
        
        console.log(`🔄 Retrying file: ${file.name}`);
        updateFileStatus(fileId, 'processing');
        await processFile(file);
    }, [files]);

    const clearAll = useCallback(() => {
        console.log('🧹 Clearing all files and data');
        setFiles([]);
        setFirestoreData(new Map());
        setSavingToFirestore(new Set());
        
        // Call reset callback if provided
        if (resetProcessCallback.current) {
            resetProcessCallback.current();
        }
    }, []);

    // ==================== FILE PROCESSING ====================
    
    const convertTextToFHIR = async (extractedText: string, fileName: string) => {
        try {
            return await convertToFHIR(extractedText, 'medical_record');
        } catch (error) {
            console.error('FHIR conversion failed:', error);
            throw error; // Re-throw so the caller can handle it
        }
    };

    const processFile = useCallback(async (fileObj: FileObject) => {
        if (!fileObj || !fileObj.file) {
            console.error(`❌ File not found or invalid: ${fileObj.id}`);
            return;
        }
        
        console.log(`🔄 Processing file: ${fileObj.name}`);
        updateFileStatus(fileObj.id, 'processing');
        
        try {          
            // STEP 1: Process with document processor (extract text)
            console.log(`📄 Starting text extraction for: ${fileObj.name}`);
            const result = await DocumentProcessorService.processDocument(fileObj.file);
            console.log(`✅ Text extraction complete for: ${fileObj.name}`, result);
            
            if (!result.success) {
                console.log(`❌ Text extraction failed for: ${fileObj.name}`, result.error);
                updateFileStatus(fileObj.id, 'error', {
                    error: result.error || 'Document processing failed'
                });
                return;
            }

            // STEP 2: Update with extraction results and start FHIR conversion
            console.log(`📋 Updating file status with extracted text for: ${fileObj.name}`);
            updateFileStatus(fileObj.id, 'processing', {
                extractedText: result.extractedText,
                wordCount: result.wordCount,
                processingStage: 'converting_fhir' // Show FHIR conversion step
            });
            
            // STEP 3: FHIR Conversion - DEBUG VERSION
            console.log(`🔍 About to start FHIR conversion for: ${fileObj.name}`);
            console.log(`🔍 Extracted text exists: ${!!result.extractedText}`);
            console.log(`🔍 Extracted text length: ${result.extractedText?.length || 0}`);
            
            let fhirData = null;
            if (result.extractedText) {
                try {
                    console.log(`🏥 Starting FHIR conversion for: ${fileObj.name}`);
                    
                    // Call the FHIR conversion service
                    fhirData = await convertTextToFHIR(result.extractedText, fileObj.name);
                    
                    console.log(`✅ FHIR conversion complete for: ${fileObj.name}`, fhirData);
                    
                } catch (fhirError) {
                    console.warn(`⚠️ FHIR conversion failed for ${fileObj.name}:`, fhirError);
                    // Don't fail the whole process - FHIR conversion is optional
                }
            } else {
                console.log(`⚠️ No extracted text available for FHIR conversion: ${fileObj.name}`);
            }
            
            // STEP 4: Mark as completed with ALL data ready
            console.log(`🎯 Marking file as completed. FHIR data exists: ${!!fhirData}`);
            updateFileStatus(fileObj.id, 'completed', {
                extractedText: result.extractedText,
                wordCount: result.wordCount,
                fhirData: fhirData, // Include FHIR data if available
                processingStage: undefined, // Clear the processing stage
                processedAt: new Date().toISOString()
            });
            
            console.log(`🎉 Complete processing pipeline finished for: ${fileObj.name}. Final FHIR data: ${!!fhirData}`);
                
        } catch (error: any) {
            console.error(`💥 Processing failed for ${fileObj.name}:`, error);
            updateFileStatus(fileObj.id, 'error', { 
                error: error.message,
                processingStage: undefined // Clear any processing stage on error
            });
        }
    }, []);

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
        
        setFirestoreData(prev => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            return newMap;
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
    const removeFileComplete = useCallback(async (fileId: string): Promise<void> => {
        console.log(`🗑️ Starting complete file removal: ${fileId}`);
        
        const fileToRemove = files.find(f => f.id === fileId);
        
        if (!fileToRemove) {
            console.warn(`⚠️ File not found in local state: ${fileId}`);
            return;
        }
        
        console.log(`📁 File info:`, {
            name: fileToRemove.name,
            status: fileToRemove.status,
            hasDocumentId: !!fileToRemove.documentId,
            documentId: fileToRemove.documentId,
            isVirtual: fileToRemove.isVirtual
        });
        
        // Step 1: Cancel any active uploads first
        cancelFileUpload(fileId);
        
        // Step 2: Delete from Firebase if it was uploaded
        if (fileToRemove.documentId) {
            try {
                await deleteFileFromFirebase(fileToRemove.documentId);
                toast.success(`Deleted "${fileToRemove.name}" from cloud storage`);
            } catch (error: any) {
                console.error('❌ Firebase deletion failed, but continuing with local cleanup:', error);
                toast.error(`Could not delete "${fileToRemove.name}" from cloud storage: ${error.message}`);
                // Continue with local cleanup even if Firebase deletion fails
            }
        }
        
        // Step 3: Always clean up local state
        removeFileFromLocal(fileId);
        
        console.log('✅ Complete file removal finished:', fileId);
    }, [files, removeFileFromLocal, deleteFileFromFirebase, cancelFileUpload]);

    // Also enhance your existing clearAll function
    const enhancedClearAll = useCallback(async () => {
        console.log('🧹 Starting enhanced clearAll - will clean up Firebase files too');
        
        // Get all uploaded files that need Firebase cleanup
        const uploadedFiles = files
            .filter(f => f.documentId)
            .map(f => ({ id: f.documentId!, name: f.name }));
        
        if (uploadedFiles.length > 0) {
            console.log(`🔥 Found ${uploadedFiles.length} uploaded files to delete from Firebase`);
            
            try {
                // Delete files one by one with error handling
                const deletePromises = uploadedFiles.map(async (file) => {
                    try {
                        await deleteFileFromFirebase(file.id);
                        return { success: true, fileId: file.id, name: file.name };
                    } catch (error: any) {
                        console.error(`❌ Failed to delete ${file.name}:`, error);
                        return { success: false, fileId: file.id, name: file.name, error: error.message };
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
        setFirestoreData(new Map());
        setSavingToFirestore(new Set());
        
        // Call reset callback if provided
        if (resetProcessCallback.current) {
            resetProcessCallback.current();
        }
        
        console.log('✅ Enhanced clearAll completed');
    }, [files, deleteFileFromFirebase]);


    // ==================== STATUS UPDATES ====================
    
    const updateFileStatus = useCallback((fileId: string, status: FileStatus, additionalData: Partial<FileObject> = {}) => {
        setFiles(prev => prev.map(f => 
            f.id === fileId 
                ? { ...f, status, ...additionalData }
                : f
        ));
    }, []);

    // ==================== FIRESTORE OPERATIONS ====================
    
    const uploadFiles = useCallback(async (fileIds?: string[]): Promise<UploadResult[]> => {
        const filesToUpload = fileIds 
            ? files.filter(f => fileIds.includes(f.id))
            : files.filter(f => f.status === 'completed');
        
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
                    error: 'File already uploading'
                };
            }
            
            setSavingToFirestore(prev => new Set([...prev, fileObj.id]));
            
            try {
                const result = await fileUploadService.current.uploadFile(fileObj);
                console.log(`✅ Upload successful for ${fileObj.name}:`, result);
                
                setFirestoreData(prev => new Map([...prev, [fileObj.id, result]]));
                updateFileStatus(fileObj.id, 'completed', { uploadResult: result });

                // 🎉 SUCCESS TOAST HERE
                toast.success(`📁 ${fileObj.name} uploaded successfully!`, {
                    description: 'Your file has been saved to cloud storage',
                    duration: 4000,
                });
                
                return {
                    success: true,
                    documentId: result.documentId,
                    downloadURL: result.downloadURL,
                    fileId: fileObj.id
                };
                
            } catch (error: any) {
                console.error(`💥 Upload failed for ${fileObj.name}:`, error);
                updateFileStatus(fileObj.id, 'error', { error: error.message });
               
                return {
                    success: false,
                    fileId: fileObj.id,
                    error: error.message
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
    }, [files, savingToFirestore, updateFileStatus]);

    const updateFirestoreRecord = useCallback(async (fileId: string, data: any) => {
        try {
            await fileUploadService.current.updateRecord(fileId, data);
            setFirestoreData(prev => new Map([...prev, [fileId, { ...prev.get(fileId), ...data }]]));
        } catch (error: any) {
            console.error(`❌ Failed to update Firestore record for ${fileId}:`, error);
            throw error;
        }
    }, []);

    // ==================== VIRTUAL FILE SUPPORT ====================
    
    const addVirtualFile = useCallback((virtualData: VirtualFileData): string => {
        const fileId = virtualData.id || generateId();
        
        const virtualFile: FileObject = {
            id: fileId,
            name: virtualData.name || `Virtual File ${fileId}`,
            size: virtualData.size || 0,
            type: virtualData.type || 'application/json',
            status: 'completed',
            uploadedAt: new Date().toISOString(),
            fhirJson: virtualData.fhirJson,
            originalText: virtualData.originalText,
            wordCount: virtualData.wordCount || 0,
            documentType: virtualData.documentType || 'virtual',
            isVirtual: true,
            fhirData: virtualData.fhirData,
            file: undefined
        };
        
        setFiles(prev => [...prev, virtualFile]);
        console.log(`✅ Added virtual file: ${virtualFile.name}`);
        
        return fileId;
    }, []);

    const addFhirAsVirtualFile = useCallback(async (fhirData: any | undefined, options: AddFhirAsVirtualFileOptions = {}): Promise<VirtualFileResult> => {
        const fileId = options.id || generateId();
        const fileName = options.name || `FHIR Document ${fileId}`;
        
        const virtualFileData: VirtualFileData = {
            id: fileId,
            name: fileName,
            size: JSON.stringify(fhirData).length,
            type: 'application/fhir+json',
            fhirJson: JSON.stringify(fhirData, null, 2),
            originalText: options.originalText,
            wordCount: JSON.stringify(fhirData).split(/\s+/).length,
            documentType: options.documentType || 'fhir',
            fhirData,
            ...options
        };
        
        const generatedFileId = addVirtualFile(virtualFileData);
        
        // Instead of trying to find it in the files array (which might not be updated yet),
        // construct the FileObject directly from the data we have
        const virtualFile: FileObject = {
            id: generatedFileId,
            name: fileName,
            size: JSON.stringify(fhirData).length,
            type: 'application/fhir+json',
            status: 'completed',
            uploadedAt: new Date().toISOString(),
            fhirJson: JSON.stringify(fhirData, null, 2),
            originalText: virtualFileData.originalText,
            wordCount: JSON.stringify(fhirData).split(/\s+/).length,
            documentType: options.documentType || 'fhir',
            isVirtual: true,
            fhirData,
            file: undefined
        };
        
        // 🔥 AUTO-UPLOAD if requested
        if (options.autoUpload) {
            console.log('🚀 Auto-uploading virtual file:', virtualFile.name);
            
            try {
                // Prevent duplicate uploads
                if (savingToFirestore.has(fileId)) {
                    throw new Error('File already uploading');
                }
                
                setSavingToFirestore(prev => new Set([...prev, fileId]));
                
                const uploadResult = await fileUploadService.current.uploadFile(virtualFile);
                console.log(`✅ Auto-upload successful for ${virtualFile.name}:`, uploadResult);
                
                // Update state with upload result
                setFirestoreData(prev => new Map([...prev, [fileId, uploadResult]]));
                updateFileStatus(fileId, 'completed', { 
                    uploadResult,
                    documentId: uploadResult.documentId,
                    uploadedAt: uploadResult.uploadedAt 
                });

                // Show success toast
                toast.success(`📁 ${virtualFile.name} uploaded successfully!`, {
                    description: 'Your file has been saved to cloud storage',
                    duration: 4000,
                });
                
                return { 
                    fileId: generatedFileId, 
                    virtualFile, 
                    uploadResult: {
                        success: true,
                        documentId: uploadResult.documentId,
                        fileId: fileId,
                        uploadedAt: uploadResult.uploadedAt,
                        filePath: uploadResult.filePath,
                        downloadURL: uploadResult.downloadURL
                    }
                };
                
            } catch (error) {
                console.error(`❌ Auto-upload failed for ${virtualFile.name}:`, error);
                updateFileStatus(fileId, 'error', { 
                    uploadError: error instanceof Error ? error.message : 'Upload failed' 
                });
                throw error; // Re-throw so caller can handle it
                
            } finally {
                setSavingToFirestore(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(fileId);
                    return newSet;
                });
            }
        }
        
        // Return without upload result if not auto-uploading
        return { fileId: generatedFileId, virtualFile };
    }, [addVirtualFile, fileUploadService, savingToFirestore, setFirestoreData, updateFileStatus]);

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
            percentComplete
        };
    }, [files]);

    /**
     * Get files in the format expected by other parts of the app
     */
    const processedFiles = files.filter(f => 
        f.status === 'completed'
    );

    // ==================== RETURN INTERFACE ====================

    return {
        // Core state (for compatibility)
        files,
        processedFiles,
        firestoreData,
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
        savedToFirestoreCount: firestoreData.size,
        savingCount: savingToFirestore.size,

        // VirtualFile Support
        addVirtualFile,
        addFhirAsVirtualFile,
        
        // Reset function
        reset: clearAll
    };
}

export default useFileUpload;