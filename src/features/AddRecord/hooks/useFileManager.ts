import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { FileUploadService } from '@/features/AddRecord/services/fileUploadService';
import DocumentProcessorService from '@/features/AddRecord/services/documentProcessorService';
import { FileObject, FileStatus, AIProcessingStatus } from '@/types/core';
import { convertToFHIR } from '@/features/AddRecord/services/fhirConversionService';
import { processRecordWithAI } from '@/features/AddRecord/services/aiRecordProcessingService';
import { BlockchainService } from '@/features/BlockchainVerification/service/blockchainService'

import {
  AddFilesOptions,
  VirtualFileData,
  FileStats,
  FHIRConversionCallback,
  ResetProcessCallback,
  UseFileManagerTypes,
} from './useFileManager.type';
import { VirtualFileResult } from '../components/CombinedUploadFHIR.type';
import { UploadResult } from '../services/shared.types';

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
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        status: 'pending' as FileStatus,
        uploadedAt: new Date().toISOString(),
        extractedText: '',
        wordCount: 0,
        documentType: 'File Upload',
        isVirtual: false,
        aiProcessingStatus: 'not_needed' as AIProcessingStatus,
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

    const updateFirestoreRecord = useCallback(async (fileId: string, data: any) => {
        try {
            await fileUploadService.current.updateRecord(fileId, data);
            setFirestoreData(prev => new Map([...prev, [fileId, { ...prev.get(fileId), ...data }]]));
        } catch (error: any) {
            console.error(`❌ Failed to update Firestore record for ${fileId}:`, error);
            throw error;
        }
    }, []);

    // ==================== STATUS UPDATES ====================
    
    const updateFileStatus = useCallback((fileId: string, status: FileStatus, additionalData: Partial<FileObject> = {}) => {
        setFiles(prev => prev.map(f => 
            f.id === fileId 
                ? { ...f, status, ...additionalData }
                : f
        ));
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

    const processWithAI = useCallback(async (fileObj: FileObject) => {
        console.log(`🤖 Starting AI processing for: ${fileObj.name}`);
        
        try {
            // Call AI service
            const aiResult = await processRecordWithAI(fileObj.fhirData, {
                fileName: fileObj.name,
                extractedText: fileObj.extractedText || undefined,
            });
            
            console.log(`✅ AI processing completed for: ${fileObj.name}`, aiResult);
            
            // 🔥 RETURN the result instead of updating status
            return {
                success: true,
                result: aiResult
            };
            
        } catch (error: any) {
            console.error(`❌ AI processing failed for ${fileObj.name}:`, error);
            
            // 🔥 RETURN the error instead of updating status
            return {
                success: false,
                error: error.message
            };
        }
    }, []);

    const processFile = useCallback(async (fileObj: FileObject): Promise<void> => {
        console.log(`📋 Starting complete processing pipeline for: ${fileObj.name}`);
        
        updateFileStatus(fileObj.id, 'processing', {
            processingStage: 'Starting processing...'
        });

        try {
            // Step 1: Extract text and process document
            console.log(`📝 Step 1: Extracting text from: ${fileObj.name}`);
            updateFileStatus(fileObj.id, 'processing', {
                processingStage: 'Extracting text...'
            });
            
            const result = await DocumentProcessorService.processDocument(fileObj.file!);
            console.log(`📄 Text extraction complete. Word count: ${result.wordCount}`);

            updateFileStatus(fileObj.id, 'processing', {
                extractedText: result.extractedText,
                wordCount: result.wordCount,
                processingStage: 'Text extraction completed'
            })
            
            // Step 2: Try FHIR conversion
            let fhirData = null;
            if (result.extractedText && result.extractedText.trim().length > 0) {
                console.log(`🩺 Step 2: Attempting FHIR conversion for: ${fileObj.name}`);
                updateFileStatus(fileObj.id, 'processing', {
                    processingStage: 'Converting to FHIR...'
                });
                
                try {
                    const fhirResult = await convertToFHIR(result.extractedText);
                    console.log('🔍 FHIR result received:', fhirResult);
                    
                    if (fhirResult && fhirResult.resourceType === 'Bundle') {
                        fhirData = fhirResult;
                        console.log(`✅ FHIR conversion successful for: ${fileObj.name}`);
                    
                        updateFileStatus(fileObj.id, 'processing',{
                            fhirData: fhirData,
                            processingStage: 'FHIR conversion complete',
                            aiProcessingStatus: 'pending'
                        })
                    
                    } else {
                        console.log(`ℹ️ FHIR conversion failed for: ${fileObj.name}, continuing without FHIR data`);
                    }
                } catch (fhirError: any) {
                    console.error(`💥 FHIR conversion error:`, fhirError);
                    console.warn(`⚠️ FHIR conversion failed for ${fileObj.name}:`, fhirError.message);
                }
            } else {
                console.log(`ℹ️ No text extracted from: ${fileObj.name}, skipping FHIR conversion`);
            }

            // Step 3: Update file with basic processing results (but don't set AI stage yet)
            if (!fhirData){
                updateFileStatus(fileObj.id, 'processing', {
                processingStage: 'Completing...',
                aiProcessingStatus: 'not_needed'
            });
            } 

            // Step 4: AI Processing (if FHIR data exists)
            let belroseFields = undefined;
            if (fhirData) {
                console.log(`🤖 Step 4: Starting AI processing for: ${fileObj.name}`);
                
                // Update to AI processing stage
                updateFileStatus(fileObj.id, 'processing', {
                    aiProcessingStatus: 'processing',
                    processingStage: 'AI analyzing content...'
                });
                
                try {
                    // Create updated file object with all the processed data
                    const updatedFileObj: FileObject = {
                        ...fileObj,
                        extractedText: result.extractedText,
                        wordCount: result.wordCount,
                        fhirData: fhirData,
                        status: 'processing',
                        aiProcessingStatus: 'processing'
                    };
                    
                    // 🔥 Call AI processing and wait for the result
                    const aiResult = await processRecordWithAI(updatedFileObj.fhirData, {
                        fileName: updatedFileObj.name,
                        extractedText: updatedFileObj.extractedText || undefined,
                    });
                    
                    belroseFields = {
                        visitType: aiResult.visitType,
                        title: aiResult.title,
                        summary: aiResult.summary,
                        completedDate: aiResult.completedDate,
                        provider: aiResult.provider,
                        patient: aiResult.patient,
                        institution: aiResult.institution,
                        aiProcessedAt: new Date().toISOString()
                    };
                    
                    console.log(`✅ AI processing completed for: ${fileObj.name}`, aiResult);
                    
                    // Show success toast
                    toast.success(`🤖 AI analysis completed for ${fileObj.name}`, {
                        description: `Classified as: ${aiResult.visitType}`,
                        duration: 3000
                    });
                    
                } catch (error: any) {
                    console.error(`❌ AI processing failed for ${fileObj.name}:`, error);
                    
                    belroseFields = {
                        aiFailureReason: error.message,
                        aiProcessedAt: new Date().toISOString()
                    };
                    
                    // Show error toast
                    toast.error(`AI analysis failed for ${fileObj.name}`, {
                        description: error.message,
                        duration: 5000
                    });
                }
            } else {
                // No AI processing needed - update the processing stage to indicate completion
                updateFileStatus(fileObj.id, 'processing', {
                    processingStage: 'Completing...'
                });
            }

        // STEP 5: Blockchain Verification
        let blockchainVerification = undefined;
        
        // Create the complete record object with all processed data
        const completeRecord: FileObject = {
            ...fileObj,
            extractedText: result.extractedText,
            wordCount: result.wordCount,
            fhirData: fhirData,
            belroseFields: belroseFields,
            status: 'processing' // Still processing until verification is done
        };
        
        // Check if blockchain verification is needed
        if (BlockchainService.needsBlockchainVerification(completeRecord)) {
            console.log(`🔗 Step 5: Generating blockchain verification for: ${fileObj.name}`);
            
            updateFileStatus(fileObj.id, 'processing', {
                processingStage: 'Generating blockchain verification...'
            });
            
            try {
                blockchainVerification = await BlockchainService.createBlockchainVerification(
                    completeRecord,
                    { 
                        // You might want to pass provider info here based on your app's auth
                        signerId: 'current-provider-id', // Replace with actual provider ID
                        network: 'ethereum-testnet',
                        providerSignature: 'provider-signature-if-available'
                    }
                );
                
                console.log(`✅ Blockchain verification generated for: ${fileObj.name}`, {
                    hash: blockchainVerification.recordHash,
                    txId: blockchainVerification.blockchainTxId
                });
                
                // Show success toast for blockchain verification
                toast.success(`🔗 Blockchain verification completed for ${fileObj.name}`, {
                    description: `Record hash: ${blockchainVerification.recordHash.substring(0, 12)}...`,
                    duration: 3000
                });
                
            } catch (error: any) {
                console.error(`❌ Blockchain verification failed for ${fileObj.name}:`, error);
                
                // Show warning toast but don't fail the entire process
                toast.warning(`Blockchain verification failed for ${fileObj.name}`, {
                    description: 'Record will be saved without blockchain verification',
                    duration: 4000
                });
                
                // Log the error but continue processing
                console.warn(`⚠️ Continuing without blockchain verification for ${fileObj.name}`);
            }
        } else {
            console.log(`ℹ️ Blockchain verification not required for: ${fileObj.name}`);
        }
            
            // 🎉 FINAL STEP: Mark as completed with ALL data including AI results
            console.log(`🎉 Marking file as completed: ${fileObj.name}`);
            updateFileStatus(fileObj.id, 'completed', {
                processingStage: undefined,
                processedAt: new Date().toISOString(),
                aiProcessingStatus: fhirData ? (belroseFields?.aiFailureReason ? 'failed' : 'completed') : 'not_needed',
                belroseFields: belroseFields,
                blockchainVerification: blockchainVerification
            });
            
            console.log(`🎉 Complete processing pipeline finished for: ${fileObj.name}`);
                
        } catch (error: any) {
            console.error(`💥 Processing failed for ${fileObj.name}:`, error);
            updateFileStatus(fileObj.id, 'error', { 
                error: error.message,
                processingStage: undefined,
                aiProcessingStatus: 'not_needed'
            });
        }
    }, [updateFileStatus]);

    // Also add this helper function to prevent auto-upload during processing
    const shouldAutoUpload = useCallback((file: FileObject): boolean => {
        const fileCompleted = file.status === 'completed';
        const aiStatus = file.aiProcessingStatus || 'not_needed';
        const needsAI = !!file.fhirData;
        
        if (!needsAI) {
            return fileCompleted && aiStatus === 'not_needed';
        }
        
        // 🔥 KEY: If FHIR data exists, require belroseFields
        const hasBelroseFields = !!file.belroseFields && Object.keys(file.belroseFields).length > 0;
        const aiCompleted = aiStatus === 'completed';
        
        return fileCompleted && aiCompleted && hasBelroseFields;
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

    // ==================== VIRTUAL FILE SUPPORT ====================
    
    const addVirtualFile = useCallback(async (virtualData: VirtualFileData): Promise<string> => {
        const fileId = virtualData.id || generateId();
        
        const virtualFile: FileObject = {
            id: fileId,
            fileName: virtualData.name || `Virtual File ${fileId}`,
            fileSize: virtualData.size || 0,
            fileType: virtualData.type || 'application/json',
            status: 'completed',
            uploadedAt: new Date().toISOString(),
            fhirJson: virtualData.fhirJson,
            originalText: virtualData.originalText,
            wordCount: virtualData.wordCount || 0,
            isVirtual: true,
            fhirData: virtualData.fhirData,
            file: undefined,
            belroseFields: virtualData.belroseFields,
            aiProcessingStatus: virtualData.aiProcessingStatus
        };
        
       // 🔗 ADD BLOCKCHAIN VERIFICATION for virtual files
    let blockchainVerification = undefined;
    if (BlockchainService.needsBlockchainVerification(virtualFile)) {
        try {
            console.log('🔗 Generating blockchain verification for virtual file:', virtualFile.fileName);
            
            blockchainVerification = await BlockchainService.createBlockchainVerification(
                virtualFile,
                { 
                    signerId: virtualData.signerId || 'virtual-file-creator',
                    network: virtualData.blockchainNetwork || 'ethereum-testnet',
                    providerSignature: virtualData.providerSignature
                }
            );
            
            // Add verification to the virtual file
            virtualFile.blockchainVerification = blockchainVerification;
            
            console.log(`✅ Blockchain verification generated for virtual file: ${virtualFile.fileName}`, {
                hash: blockchainVerification.recordHash.substring(0, 12) + '...'
            });
            
            // Optional: Show success toast for blockchain verification
            toast.success(`🔗 Virtual file verified: ${virtualFile.fileName}`, {
                description: `Hash: ${blockchainVerification.recordHash.substring(0, 12)}...`,
                duration: 3000
            });
            
        } catch (error: any) {
            console.error(`❌ Blockchain verification failed for virtual file ${virtualFile.fileName}:`, error);
            
            // Show warning but continue
            toast.warning(`Blockchain verification failed for ${virtualFile.fileName}`, {
                description: 'File will be saved without verification',
                duration: 3000
            });
        }
    } else {
        console.log(`ℹ️ Blockchain verification not required for virtual file: ${virtualFile.fileName}`);
    }
    
    // Add to state with blockchain verification included
    setFiles(prev => [...prev, virtualFile]);
    console.log(`✅ Added virtual file with blockchain verification: ${virtualFile.fileName}`);
    
    return fileId;
}, [setFiles]);

    const addFhirAsVirtualFile = useCallback(async (fhirData: any | undefined, options: VirtualFileData = {}): Promise<VirtualFileResult> => {
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
            documentType: options.documentType,
            fhirData,
            signerId: options.signerId,
            providerSignature: options.providerSignature,
            blockchainNetwork: options.blockchainNetwork,
            ...options
        };

        const generatedFileId = await addVirtualFile(virtualFileData);
        
        // Instead of trying to find it in the files array (which might not be updated yet),
        // construct the FileObject directly from the data we have
        const virtualFile: FileObject = {
            id: generatedFileId,
            fileName: fileName,
            fileSize: JSON.stringify(fhirData).length,
            fileType: 'application/fhir+json',
            status: 'completed',
            uploadedAt: new Date().toISOString(),
            fhirJson: JSON.stringify(fhirData, null, 2),
            originalText: virtualFileData.originalText,
            wordCount: JSON.stringify(fhirData).split(/\s+/).length,
            documentType: virtualFileData.documentType,
            isVirtual: true,
            fhirData,
            file: undefined,
            belroseFields: options.belroseFields,
            aiProcessingStatus: options.aiProcessingStatus || 'not_needed'
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

        //Helper function
        shouldAutoUpload,

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

export default useFileManager;