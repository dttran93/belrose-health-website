import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { DeduplicationService } from '../services/deduplicationService';
import { FileUploadService } from '@/features/AddRecord/services/fileUploadService';
import DocumentProcessorService from '@/features/AddRecord/services/documentProcessorService';
import { FileObject, FileStatus, MedicalDetectionResult } from '@/types/core';

// Import service types
import { FileValidationResult, ProcessingOptions, DocumentProcessingResult } from '../services/documentProcessorService.types';
import { DeduplicationStats } from '../services/deduplicationService.types';
import { UploadResult } from '../services/fileUploadService.types';

// Type alias to use DocumentProcessingResult as ProcessingResult
type ProcessingResult = DocumentProcessingResult;

// ==================== TYPE DEFINITIONS ====================

interface AddFilesOptions {
  maxFiles?: number;
  maxSizeBytes?: number;
  autoProcess?: boolean;
}

interface VirtualFileData {
  id?: string;
  name?: string;  // ← Made optional to match usage
  size?: number;
  type?: string;
  extractedText?: string;
  wordCount?: number;
  medicalDetection?: MedicalDetectionResult;
  documentType?: string;
  fhirData?: any;
  isVirtual?: boolean;
  [key: string]: any; // Allow additional properties
}

interface AddFhirAsVirtualFileOptions extends VirtualFileData {
  name?: string;
  documentType?: string;
}

interface FileStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  errors: number;
  medical: number;
  nonMedical: number;
  percentComplete: number;
}

// Callback type definitions
type FHIRConversionCallback = (fileId: string, fhirData: any) => Promise<void> | void;
type ResetProcessCallback = () => void;

// Return type for the hook
interface UseFileUploadReturn {
  // Core state
  files: FileObject[];
  processedFiles: FileObject[];
  firestoreData: Map<string, any>;
  savingToFirestore: Set<string>;
  
  // File management actions
  addFiles: (fileList: FileList, options?: AddFilesOptions) => void;
  removeFile: (fileId: string) => void;
  retryFile: (fileId: string) => Promise<void>;
  clearAll: () => void;
  processFile: (fileId: string) => Promise<void>;
  
  // FHIR integration
  setFHIRConversionCallback: (callback: FHIRConversionCallback) => void;
  setResetProcessCallback: (callback: ResetProcessCallback) => void;
  
  // Status updates
  updateFileStatus: (fileId: string, status: FileStatus, additionalData?: Partial<FileObject>) => void;
  updateFileWithProcessingResult: (fileId: string, result: ProcessingResult) => void;
  
  // Firestore operations
  uploadFiles: (fileIds?: string[]) => Promise<UploadResult[]>;
  updateFirestoreRecord: (fileId: string, data: any) => Promise<void>;
  
  // Computed values
  getStats: () => FileStats;
  savedToFirestoreCount: number;
  savingCount: number;
  
  // Services
  deduplicationService: DeduplicationService;
  
  // Virtual file support
  addVirtualFile: (virtualFileData: VirtualFileData) => FileObject;
  addFhirAsVirtualFile: (fhirData: any, options?: AddFhirAsVirtualFileOptions) => Promise<{ fileId: string; virtualFile: FileObject }>;
  
  // Reset function
  reset: () => void;
}

// ==================== MAIN HOOK ====================

/**
 * Consolidated file management hook that handles:
 * - File upload and validation
 * - File processing (text extraction, medical detection)
 * - FHIR conversion coordination
 * - Firestore upload
 * - State management for the entire file lifecycle
 */
function useFileUpload(): UseFileUploadReturn {
    // Core file state
    const [files, setFiles] = useState<FileObject[]>([]);
    const [firestoreData, setFirestoreData] = useState<Map<string, any>>(new Map());
    const [savingToFirestore, setSavingToFirestore] = useState<Set<string>>(new Set());
    
    // Services
    const deduplicationService = useRef<DeduplicationService>(new DeduplicationService());
    const fileUploadService = useRef<FileUploadService>(new FileUploadService());
    const processingFiles = useRef<Set<string>>(new Set());
    
    // Callback refs
    const onFHIRConvertedRef = useRef<FHIRConversionCallback | null>(null);
    const onResetProcessRef = useRef<ResetProcessCallback | null>(null);

    // AbortController
    const activeOperations = useRef<Map<string, AbortController>>(new Map());

    // Methods to set the callbacks
    const setFHIRConversionCallback = useCallback((callback: FHIRConversionCallback): void => {
        onFHIRConvertedRef.current = callback;
    }, []);

    const setResetProcessCallback = useCallback((callback: ResetProcessCallback): void => {
        onResetProcessRef.current = callback;
    }, []);

    // ==================== FILE PROCESSING ====================

    /**
     * Update file status and additional data
     */
    const updateFileStatus = useCallback((fileId: string, status: FileStatus, additionalData: Partial<FileObject> = {}): void => {
        setFiles(prev => prev.map(file => 
            file.id === fileId 
                ? { ...file, status, ...additionalData }
                : file
        ));
    }, []);

    /**
     * Update file with processing result
     */
    const updateFileWithProcessingResult = useCallback((fileId: string, result: ProcessingResult): void => {
        const status: FileStatus = result.success 
            ? (result.medicalDetection?.isMedical ? 'medical_detected' : 'non_medical_detected')
            : 'error';

        updateFileStatus(fileId, status, {
            extractedText: result.extractedText || undefined,
            wordCount: result.wordCount,
            error: result.error || undefined,
            documentType: result.medicalDetection?.detectedTerms?.join(', ') || undefined
        });
    }, [updateFileStatus]);

/**
 * Process a single file through the document processing pipeline
 */
const processFile = useCallback(async (fileId: string): Promise<void> => {
    const fileItem = files.find(f => f.id === fileId);
    if (!fileItem || !fileItem.file) {
        console.error('❌ File not found for processing:', fileId);
        return;
    }

    // Check if we should process this file using deduplication service
    const processingDecision = deduplicationService.current.shouldProcessFile(fileId);
    if (!processingDecision.shouldProcess) {
        console.log(`⏭️ Skipping processing for ${fileItem.name}: ${processingDecision.reason}`);
        updateFileStatus(fileId, 'error', { 
            error: processingDecision.reason,
            canRetry: processingDecision.canRetry 
        });
        return;
    }

    // NEW: Increment attempt counter BEFORE processing
    const attempts = deduplicationService.current.incrementUploadAttempt(fileId);
    console.log(`🔄 Processing attempt ${attempts} for ${fileItem.name}`);

    // Create abort controller for this operation
    const abortController = new AbortController();
    activeOperations.current.set(fileId, abortController);

    try {
        updateFileStatus(fileId, 'processing');
        
        // NEW: Generate hash and mark as processing in deduplication service
        const fileHash = await deduplicationService.current.generateFileHash(fileItem.file);
        deduplicationService.current.markFileAsProcessing(fileHash, fileId);
        
        // NEW: Double-check if another instance processed this file while we were generating the hash
        if (deduplicationService.current.isFileAlreadyProcessed(fileHash, fileId, firestoreData)) {
            console.log('⏭️ File already processed by another instance, skipping');
            updateFileStatus(fileId, 'completed', { 
                error: 'File already processed by another upload',
                hash: fileHash 
            });
            return;
        }
        
        console.log('🔄 Processing file:', fileItem.name);
        
        // Continue with normal document processing
        const result: DocumentProcessingResult = await DocumentProcessorService.processDocument(fileItem.file, {
            enableMedicalDetection: true,
            signal: abortController.signal
        });

        if (!abortController.signal.aborted) {
            updateFileWithProcessingResult(fileId, result);
            
            // Continue with FHIR conversion if we have extracted text
            if (result.success && result.extractedText) {
                await handleFHIRConversion(fileId, abortController.signal);
            }
        }
        
    } catch (error: any) {
        if (!abortController.signal.aborted) {
            console.error('❌ File processing failed:', error);
            updateFileStatus(fileId, 'error', { error: error.message });
            toast.error(`Processing failed: ${error.message}`);
        }
    } finally {
        // NEW: Clean up deduplication service processing lock
        deduplicationService.current.releaseProcessingLock(fileId);
        activeOperations.current.delete(fileId);
    }
}, [files, firestoreData, updateFileStatus, updateFileWithProcessingResult]);

    /**
     * Handle FHIR conversion for a processed file
     */
    const handleFHIRConversion = useCallback(async (fileId: string, abortSignal?: AbortSignal): Promise<void> => {
        try {
            // This would typically go to useFHIRConversion hook
            console.log('🎯 FHIR conversion completed for file:', fileId);
            
            // We'll add a callback prop for this
            if (onFHIRConvertedRef.current && !abortSignal?.aborted) {
                await onFHIRConvertedRef.current(fileId, {});  // Empty object as placeholder
            }

        } catch (fhirError: any) {
            if (!abortSignal?.aborted) { 
                console.error('❌ FHIR conversion failed:', fhirError);
                updateFileStatus(fileId, 'error', { error: fhirError.message });
                toast.error(`FHIR conversion failed: ${fhirError.message}`);
            }
        }
    }, [updateFileStatus]);

    // ==================== FILE MANAGEMENT ACTIONS ====================

    /**
     * Remove a file
     */
    const removeFile = useCallback((fileId: string): void => {
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
        
        // Clean up deduplication service
        deduplicationService.current.removeFile(fileId);
        
        toast.success('File removed');
    }, [files]);

    /**
     * Retry processing a failed file
     */
    const retryFile = useCallback(async (fileId: string): Promise<void> => {
        console.log('🔄 Retrying file:', fileId);
        updateFileStatus(fileId, 'ready');
        await processFile(fileId);
    }, [updateFileStatus, processFile]);

    /**
     * Clear all files and reset state
     */
    const clearAll = useCallback((): void => {
        console.log('🧹 Clearing all files');
        
        // Abort all active operations
        activeOperations.current.forEach((controller) => {
            controller.abort();
        });
        activeOperations.current.clear();
        
        // Reset all state
        setFiles([]);
        setFirestoreData(new Map());
        setSavingToFirestore(new Set());
        processingFiles.current.clear();
        
        // Reset services
        deduplicationService.current = new DeduplicationService();
        
        // Call reset callback if available
        onResetProcessRef.current?.();
        
        toast.success('All files cleared');
    }, []);

    // ==================== FILE UPLOAD & VALIDATION ====================

    /**
     * Add new files with validation and auto-processing
     */
    const addFiles = useCallback((fileList: FileList, options: AddFilesOptions = {}): void => {
        const {
            maxFiles = 5,
            maxSizeBytes = 10 * 1024 * 1024,
            autoProcess = true
        } = options;

        const selectedFiles = Array.from(fileList);
        
        if (files.length + selectedFiles.length > maxFiles) {
            throw new Error(`Maximum ${maxFiles} files allowed`);
        }

        const newFiles: FileObject[] = selectedFiles.map(file => {
            const validation: FileValidationResult = DocumentProcessorService.validateFile(file);
            const fileId = crypto.randomUUID();

            const duplicateCheck = deduplicationService.current.checkForDuplicate(file, fileId);

            let initialStatus: FileStatus = 'ready';
            let initialError: string | undefined;

            if (!validation.valid) {
                initialStatus = 'error';
                initialError = validation.error;
            } else if (duplicateCheck.isDuplicate) {
                initialStatus = 'ready';
                initialError = duplicateCheck.userMessage;
            }

            deduplicationService.current.addFile(file,fileId);     
            
            return {
                id: fileId,
                file,
                name: file.name,
                size: file.size,
                type: file.type,
                status: initialStatus,
                error: initialError,
                validation,
                lastModified: file.lastModified,
                // NEW: Store duplicate info for UI
                duplicateInfo: duplicateCheck.isDuplicate ? {
                    existingFileId: duplicateCheck.existingFileId,
                    confidence: duplicateCheck.confidence,
                    matchedOn: duplicateCheck.matchedOn,
                    canRetry: duplicateCheck.canRetry,
                    userMessage: duplicateCheck.userMessage
                } : undefined
            };
        });

        setFiles(prev => [...prev, ...newFiles]);

        // Only auto-process files that should be processed
        if (autoProcess) {
            newFiles.forEach(fileObj => {
            const processingDecision = deduplicationService.current.shouldProcessFile(fileObj.id);
            if (processingDecision.shouldProcess) {
                processFile(fileObj.id);
            } else if (!processingDecision.shouldProcess) {
                console.log(`⏭️ Skipping processing for ${fileObj.name}: ${processingDecision.reason}`);
                updateFileStatus(fileObj.id, 'error', 
                    { 
                        error: processingDecision.reason,
                        canRetry: processingDecision.canRetry 
                    });
                }
            });
        }

        console.log(`📁 Added ${newFiles.length} files, total: ${files.length + newFiles.length}`);
    }, [files, processFile, updateFileStatus]);

    // ==================== FIRESTORE OPERATIONS ====================

    /**
     * Upload files to Firestore
     */
    const uploadFiles = useCallback(async (fileIds?: string[]): Promise<void> => {
        const filesToUpload = fileIds 
            ? files.filter(f => fileIds.includes(f.id))
            : files.filter(f => f.status === 'completed' || f.status === 'medical_detected' || f.status === 'non_medical_detected');

        console.log(`📤 Uploading ${filesToUpload.length} files to Firestore`);

        for (const fileObj of filesToUpload) {
            if (savingToFirestore.has(fileObj.id)) {
                console.log('⏭️ File already being saved, skipping:', fileObj.id);
                continue;
            }

            setSavingToFirestore(prev => new Set(prev).add(fileObj.id));

            try {
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
                
                setFirestoreData(prev => new Map(prev).set(fileObj.id, result));
                deduplicationService.current.addFirestoreDocId(result.firestoreId || result.documentId || '');
                toast.success(`${fileObj.name} uploaded successfully`);
            } catch (error: any) {
                console.error('❌ Upload failed:', error);
                toast.error(`Upload failed: ${error.message}`);
            } finally {
                setSavingToFirestore(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(fileObj.id);
                    return newSet;
                });
            }
        }
    }, [files, savingToFirestore]);

    /**
     * Update a Firestore record with new data
     */
    const updateFirestoreRecord = useCallback(async (fileId: string, data: any): Promise<void> => {
        try {
            await fileUploadService.current.updateRecord(fileId, data);
            
            setFirestoreData(prev => {
                const newMap = new Map(prev);
                const existing = newMap.get(fileId) || {};
                newMap.set(fileId, { ...existing, ...data });
                return newMap;
            });
        } catch (error: any) {
            console.error('❌ Failed to update Firestore record:', error);
            throw error;
        }
    }, []);

    // ==================== COMPUTED VALUES ====================

    /**
     * Get processing statistics
     */
    const getStats = useCallback((): FileStats => {
        const total = files.length;
        const pending = files.filter(f => f.status === 'ready').length;
        const processing = files.filter(f => f.status === 'processing' || f.status === 'converting').length;
        const completed = files.filter(f => f.status === 'completed' || f.status === 'medical_detected' || f.status === 'non_medical_detected').length;
        const errors = files.filter(f => f.status === 'error').length;
        const medical = files.filter(f => f.status === 'medical_detected').length;
        const nonMedical = files.filter(f => f.status === 'non_medical_detected').length;

        return {
            total,
            pending,
            processing,
            completed,
            errors,
            medical,
            nonMedical,
            percentComplete: total > 0 ? (completed / total) * 100 : 0
        };
    }, [files]);

    // ==================== VIRTUAL FILE SUPPORT ===================
    
    /**
     * Add a virtual file (for direct FHIR input, API imports, etc.)
     */
    const addVirtualFile = useCallback((virtualFileData: VirtualFileData): FileObject => {
        console.log('📄 Adding virtual file:', virtualFileData.name);
        
        // Ensure virtual file has all required properties
        const virtualFile: FileObject = {
            id: virtualFileData.id || crypto.randomUUID(),
            name: virtualFileData.name,
            size: virtualFileData.size || 0,
            type: virtualFileData.type || 'application/fhir+json',
            status: 'completed', // Virtual files skip processing
            extractedText: virtualFileData.extractedText || '',
            wordCount: virtualFileData.wordCount || 0,
            lastModified: Date.now(),
            // Cast the additional properties
            isVirtual: true,
            ...(virtualFileData as any)
        };

        setFiles(prev => [...prev, virtualFile]);
        
        console.log('✅ Virtual file added successfully');
        return virtualFile;
    }, []);

    /**
     * Create and add a virtual file from FHIR data
     */
    const addFhirAsVirtualFile = useCallback(async (fhirData: any, options: AddFhirAsVirtualFileOptions = {}): Promise<{ fileId: string; virtualFile: FileObject }> => {
        console.log('🎯 Creating virtual file from FHIR data');
        
        const fhirString = JSON.stringify(fhirData, null, 2);
        const fileId = options.id || crypto.randomUUID();
        
        const virtualFile = addVirtualFile({
            id: fileId,
            name: options.name || `FHIR Input - ${fhirData.resourceType}`,
            size: fhirString.length,
            type: 'application/fhir+json',
            extractedText: fhirString,
            wordCount: fhirString.split(/\s+/).length,
            medicalDetection: {
                isMedical: true,
                confidence: 1.0,
                detectedTerms: []
            },
            documentType: options.documentType || 'fhir_resource',
            fhirData: fhirData,
            ...options
        });

        // Immediately trigger FHIR conversion callback since we already have FHIR data
        if (onFHIRConvertedRef.current) {
            try {
                await onFHIRConvertedRef.current(fileId, fhirData);
                console.log('✅ Virtual FHIR file processed through conversion pipeline');
            } catch (error: any) {
                console.error('❌ Error processing virtual FHIR file:', error);
                // Remove the virtual file if processing fails
                removeFile(fileId);
                throw error;
            }
        }

        return { fileId, virtualFile };
    }, [addVirtualFile, removeFile]);

    // ==================== COMPATIBILITY LAYER ====================
    
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

        // VirtualFile Support
        addVirtualFile,
        addFhirAsVirtualFile,
        
        // Reset function
        reset: clearAll
    };
}

export default useFileUpload;