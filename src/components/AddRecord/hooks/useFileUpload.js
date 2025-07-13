import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { DeduplicationService } from '../services/deduplicationService';
import { FileUploadService } from '@/components/AddRecord/services/fileUploadService';
import DocumentProcessorService from '@/components/AddRecord/services/documentProcessorService';

/**
 * Consolidated file management hook that handles:
 * - File upload and validation
 * - File processing (text extraction, medical detection)
 * - FHIR conversion coordination
 * - Firestore upload
 * - State management for the entire file lifecycle
 */
function useFileUpload() {
    // Core file state
    const [files, setFiles] = useState([]);
    const [firestoreData, setFirestoreData] = useState(new Map());
    const [savingToFirestore, setSavingToFirestore] = useState(new Set());
    
    // Services
    const deduplicationService = useRef(new DeduplicationService());
    const fileUploadService = useRef(new FileUploadService());
    const processingFiles = useRef(new Set());
    
    // Callback refs
    const onFHIRConvertedRef = useRef(null);
    const onResetProcessRef = useRef(null);

    //AbortController
    const activeOperations = useRef(new Map());

    // Methods to set the callbacks
    const setFHIRConversionCallback = useCallback((callback) => {
        onFHIRConvertedRef.current = callback;
    }, []);

    const setResetProcessCallback = useCallback((callback) => {
        onResetProcessRef.current = callback;
    }, []);

    // ==================== FILE UPLOAD & VALIDATION ====================

    /**
     * Add new files with validation and auto-processing
     */
    const addFiles = useCallback((fileList, options = {}) => {
        const {
            maxFiles = 5,
            maxSizeBytes = 10 * 1024 * 1024,
            autoProcess = true
        } = options;

        const selectedFiles = Array.from(fileList);
        
        if (files.length + selectedFiles.length > maxFiles) {
            throw new Error(`Maximum ${maxFiles} files allowed`);
        }

        const newFiles = selectedFiles.map(file => {
            const validation = DocumentProcessorService.validateFile(file);
            return {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                name: file.name,
                size: file.size,
                type: file.type,
                status: validation.valid ? 'ready' : 'error',
                error: validation.valid ? null : validation.error,
                addedAt: new Date().toISOString(),
                // Additional properties for compatibility
                extractedText: '',
                wordCount: 0,
                medicalDetection: null,
                processingMethod: null,
                processingTime: null,
                extractedAt: null
            };
        });

        setFiles(prev => [...prev, ...newFiles]);
        
        // Auto-process valid files
        if (autoProcess) {
            setTimeout(() => {
                newFiles.forEach(fileItem => {
                    if (fileItem.status === 'ready') {
                        processFile(fileItem.id);
                    }
                });
            }, 0);
        }

        console.log('🚀 Added files:', newFiles.map(f => ({ id: f.id, name: f.name })));
        return newFiles;
    }, [files.length]);

    // ==================== FILE PROCESSING ====================

    /**
     * Process a single file (extract text, detect medical content)
     */
    const processFile = useCallback(async (fileId) => {
        // Get the current file from state at the time of processing
        setFiles(currentFiles => {
            const fileItem = currentFiles.find(f => f.id === fileId);
            if (!fileItem) {
                console.error('❌ File not found for processing:', fileId);
                return currentFiles;
            }

            console.log('🔄 Processing file:', fileItem.name);
            
            // GUARD: Check if already processing
            const fileSignature = `${fileItem.name}-${fileItem.size}-${fileItem.file?.lastModified}`;
            if (processingFiles.current.has(fileSignature)) {
                console.log('⚠️ File already being processed:', fileItem.name);
                return currentFiles;
            }

            processingFiles.current.add(fileSignature);

            // Create abort controller for processing operation
            const abortController = new AbortController();
            activeOperations.current.set(fileId, abortController);

            // Start the async processing
            (async () => {
                try {
                    
                    // Check if cancelled beore each major step
                       if (abortController.signal.aborted) {
                        console.log('🚫 Processing cancelled for:', fileItem.name);
                        return;
                    }

                    // Update status to processing
                    updateFileStatus(fileId, 'processing');

                    // Use DocumentProcessorService for processing
                    const processingResult = await DocumentProcessorService.processDocument(fileItem.file, {
                        enableMedicalDetection: true,
                        enableVisionAI: true,
                        compressionThreshold: 2 * 1024 * 1024 // 2MB
                    });

                    // Check if cancelled after processing
                    if (abortController.signal.aborted) {
                        console.log('🚫 Processing cancelled after document processing:', fileItem.name);
                        return;
                    }

                    if (!processingResult.success) {
                        throw new Error(processingResult.error);
                    }

                    // Update file with processing results
                    updateFileWithProcessingResult(fileId, processingResult);

                    console.log('✅ File processing completed:', fileItem.name);

                    //Check if cancelled beforeFHIR conversion
                    if (abortController.signal.aborted) {
                    console.log('🚫 FHIR conversion cancelled for:', fileItem.name);
                    return;
                }

                    // Auto-convert to FHIR if medical content detected
                    if (processingResult.medicalDetection?.isMedical && 
                        processingResult.medicalDetection?.confidence >= 0.3) {
                        
                        console.log('🔄 Auto-converting to FHIR for medical file:', fileItem.name);
                        await convertToFHIR(
                            fileId, 
                            processingResult.extractedText, 
                            processingResult.medicalDetection.documentType,
                            abortController.signal
                        );
                    }

                } catch (error) {
                    if(!abortController.signal.aborted) {
                        console.error('❌ Error processing file:', error);
                        handleProcessingError(fileId, error);
                    }
                } finally {
                    processingFiles.current.delete(fileSignature);
                    activeOperations.current.delete(fileId);
                }
            })();

            return currentFiles;
        });
    }, []);

    /**
     * Update file with processing results
     */
    const updateFileWithProcessingResult = useCallback((fileId, processingResult) => {
        setFiles(prev => prev.map(f => {
            if (f.id === fileId) {
                const updatedFile = {
                    ...f,
                    status: processingResult.medicalDetection?.isMedical ? 'medical_detected' : 'non_medical_detected',
                    extractedText: processingResult.extractedText,
                    wordCount: processingResult.wordCount,
                    medicalDetection: processingResult.medicalDetection,
                    processingMethod: processingResult.processingMethod,
                    processingTime: processingResult.processingTime,
                    extractedAt: new Date().toISOString()
                };
                
                console.log('🔍 Updated file with processing result:', {
                    fileId,
                    name: updatedFile.name,
                    status: updatedFile.status,
                    hasText: !!updatedFile.extractedText,
                    wordCount: updatedFile.wordCount
                });
                
                return updatedFile;
            }
            return f;
        }));
    }, []);

    /**
     * Update file status and additional data
     */
    const updateFileStatus = useCallback((fileId, status, additionalData = {}) => {
        setFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status, ...additionalData } : f
        ));
    }, []);

    /**
     * Handle processing errors
     */
    const handleProcessingError = useCallback((fileId, error) => {
        const errorMessage = error.message || 'Unknown error occurred';
        
        let status = 'processing_error';
        if (errorMessage.includes('extract') || errorMessage.includes('text')) {
            status = 'extraction_error';
        } else if (errorMessage.includes('detect') || errorMessage.includes('medical')) {
            status = 'detection_error';
        }

        updateFileStatus(fileId, status, { error: errorMessage });
        toast.error(`Failed to process file: ${errorMessage}`);
    }, [updateFileStatus]);

    // ==================== FHIR CONVERSION ====================

    /**
     * Convert file to FHIR
     */
    const convertToFHIR = useCallback(async (fileId, extractedText, documentType, abortSignal) => {
        //Check if cancelled before starting
         if (abortSignal?.aborted) {
            console.log('🚫 FHIR conversion cancelled before starting for:', fileId);
            return;
        }

        updateFileStatus(fileId, 'converting');

        try {
            // Import here to avoid circular dependencies
            const { convertToFHIR: fhirConverter } = await import('@/components/AddRecord/services/fhirConversionService');
            const fhirData = await fhirConverter(extractedText, documentType || 'medical_record');

            //Check if cancelled after completing
            if (abortSignal?.aborted) {
                console.log('🚫 FHIR conversion cancelled after processing for:', fileId);
                return;
            }
            
            // Update file status to completed
            updateFileStatus(fileId, 'completed');

            // Pass the FHIR data to the parent component for further processing
            // This would typically go to useFHIRConversion hook
            console.log('🎯 FHIR conversion completed for file:', fileId);
            
            // We'll add a callback prop for this
            if (onFHIRConvertedRef.current && !abortSignal?.aborted) {
                onFHIRConvertedRef.current(fileId, fhirData);
            }

        } catch (fhirError) {
            if (!abortSignal?.aborted) { 
            console.error('❌ FHIR conversion failed:', fhirError);
            updateFileStatus(fileId, 'fhir_error', { error: fhirError.message });
            toast.error(`FHIR conversion failed: ${fhirError.message}`);
            }
        }
    }, [updateFileStatus]);

    // ==================== FILE MANAGEMENT ACTIONS ====================

    /**
     * Remove a file
     */
    const removeFile = useCallback((fileId) => {
        console.log('🗑️ Removing file:', fileId);

        const abortController = activeOperations.current.get(fileId);
        if (abortController) {
            console.log('🛑 Aborting active operation for file:', fileId);
            abortController.abort();
            activeOperations.current.delete(fileId);
        }

        setFiles(prev => prev.filter(f => f.id !== fileId));
        
        // Clean up related data
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
        
        // Release any processing locks
        const fileItem = files.find(f => f.id === fileId);
        if (fileItem) {
            const fileSignature = `${fileItem.name}-${fileItem.size}-${fileItem.file?.lastModified}`;
            processingFiles.current.delete(fileSignature);
        }

        // If this was the last file, do a full reset
        const remainingFiles = files.filter(f => f.id !== fileId);
        if (remainingFiles.length === 0 && onResetProcessRef.current) {
            console.log('🔄 Last file removed, triggering full reset');
            onResetProcessRef.current();
        }
    }, [files]);

    /**
     * Retry processing a file
     */
    const retryFile = useCallback((fileId) => {
        const fileItem = files.find(f => f.id === fileId);
        if (fileItem) {
            updateFileStatus(fileId, 'ready');
            processFile(fileId);
        }
    }, [files, processFile, updateFileStatus]);

    /**
     * Clear all files
     */
    const clearAll = useCallback(() => {
        console.log('🧹 Clearing all files');

        activeOperations.current.forEach((abortController, fileId) => {
            console.log('🚫 Cancelling operation for file:', fileId);
            abortController.abort();
        });
        activeOperations.current.clear();

        setFiles([]);
        setFirestoreData(new Map());
        setSavingToFirestore(new Set());
        processingFiles.current.clear();
        deduplicationService.current.clear();
    }, []);

    // ==================== FIRESTORE OPERATIONS ====================

    /**
     * Upload files to Firestore
     */
    const uploadFiles = useCallback(async (filesToUpload) => {
        if (!filesToUpload || filesToUpload.length === 0) {
            console.log('📤 No files to upload');
            return;
        }

        console.log('📤 Uploading files to Firestore:', filesToUpload.map(f => f.name));
        
        const uploadPromises = filesToUpload.map(fileObj => uploadFile(fileObj));
        const results = await Promise.allSettled(uploadPromises);
        
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const fileObj = filesToUpload[index];
                console.error(`Upload failed for ${fileObj.name}:`, result.reason);
                deduplicationService.current.releaseProcessingLock(fileObj.id, fileObj.fileHash);
            }
        });
    }, []);

    /**
     * Upload a single file to Firestore
     */
    const uploadFile = useCallback(async (fileObj) => {
        const fileId = fileObj.id;

        try {
            // Double check if already uploaded during concurrent operations
            if (firestoreData.has(fileId)) {
                deduplicationService.current.releaseProcessingLock(fileId, fileObj.fileHash);
                return;
            }

            setSavingToFirestore(prev => new Set([...prev, fileId]));

            const result = await fileUploadService.current.uploadWithRetry(
                fileObj,
                3, // maxRetries
                (status, data) => {
                    if (status === 'uploading') {
                        console.log(`Upload attempt ${data} for ${fileObj.name}`);
                    } else if (status === 'success') {
                        console.log(`Successfully uploaded ${fileObj.name}`);
                    }
                }
            );

            // Update Firestore data state
            setFirestoreData(prev => new Map([...prev, [fileId, result]]));
            deduplicationService.current.addFirestoreDocId(result.firestoreId);
            
            toast.success(`${fileObj.name} uploaded successfully!`);

        } catch (error) {
            toast.error(`Failed to upload ${fileObj.name}: ${error.message}`);
            deduplicationService.current.releaseProcessingLock(fileId, fileObj.fileHash);
            throw error;
        } finally {
            setSavingToFirestore(prev => {
                const newSet = new Set(prev);
                newSet.delete(fileId);
                return newSet;
            });
        }
    }, [firestoreData]);

    /**
     * Update Firestore record
     */
    const updateFirestoreRecord = useCallback((fileId, updates) => {
        setFirestoreData(prev => {
            const current = prev.get(fileId);
            if (current) {
                return new Map([...prev, [fileId, { ...current, ...updates }]]);
            }
            return prev;
        });
    }, []);

    // ==================== COMPUTED VALUES & STATS ====================

    /**
     * Get file statistics
     */
    const getStats = useCallback(() => {
        const totalFiles = files.length;
        const processedFiles = files.filter(f => 
            f.status === 'medical_detected' || f.status === 'non_medical_detected'
        ).length;
        const medicalFiles = files.filter(f => f.status === 'medical_detected').length;
        const errorFiles = files.filter(f => 
            f.status.includes('error') || f.status === 'processing_error'
        ).length;
        const processingFiles = files.filter(f => f.status === 'processing').length;

        return {
            totalFiles,
            processedFiles,
            medicalFiles,
            errorFiles,
            processingFiles,
            completionPercentage: totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0
        };
    }, [files]);

    // ==================== COMPATIBILITY LAYER ====================
    // These provide compatibility with existing code that expects the old interface

    /**
     * Get files in the format expected by other parts of the app
     */
    const processedFiles = files.filter(f => 
        f.status === 'medical_detected' || 
        f.status === 'non_medical_detected' ||
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
        removeFile,
        retryFile,
        clearAll,
        processFile,
        
        // FHIR integration
        setFHIRConversionCallback,
        setResetProcessCallback,
        
        // Status updates
        updateFileStatus,
        updateFileWithProcessingResult,
        
        // Firestore operations
        uploadFiles,
        updateFirestoreRecord,
        
        // Computed values
        getStats,
        savedToFirestoreCount: firestoreData.size,
        savingCount: savingToFirestore.size,
        
        // Services (for other hooks to use)
        deduplicationService: deduplicationService.current,
        
        // Reset function
        reset: clearAll
    };
}

export default useFileUpload;