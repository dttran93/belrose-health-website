import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { FileUploadService } from '@/features/AddRecord/services/fileUploadService';
import DocumentProcessorService from '@/features/AddRecord/services/documentProcessorService';
import { FileObject, FileStatus, UploadResult } from '@/types/core';

import {
  AddFilesOptions,
  VirtualFileData,
  AddFhirAsVirtualFileOptions,
  FileStats,
  FHIRConversionCallback,
  ResetProcessCallback,
  UseFileUploadReturn,
  ProcessingResult
} from './useFileUpload.type';

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

    const removeFile = useCallback((fileId: string) => {
        console.log(`🗑️  Removing file: ${fileId}`);
        console.trace('🔍 removeFile called from:'); // This will show you the call stack
        
        setFiles(prev => prev.filter(f => f.id !== fileId));
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
    
    const processFile = useCallback(async (fileObj: FileObject) => {
        if (!fileObj || !fileObj.file) {
            console.error(`❌ File not found or invalid: ${fileObj.id}`);
            return;
        }
        
        console.log(`🔄 Processing file: ${fileObj.name}`);
        updateFileStatus(fileObj.id, 'processing');
        
        try {          
            // Process with document processor
            const result = await DocumentProcessorService.processDocument(fileObj.file);
            console.log(`✅ Processing complete for: ${fileObj.name}`, result);
            
            const status: FileStatus = result.success ? 'completed' : 'error';
            updateFileStatus(fileObj.id, status, {
                extractedText: result.extractedText,
                wordCount: result.wordCount,
            });
            
        } catch (error: any) {
            console.error(`💥 Processing failed for ${fileObj.name}:`, error);
            updateFileStatus(fileObj.id, 'error', { error: error.message });
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
                
                // Trigger FHIR conversion if callback is set
                if (fhirConversionCallback.current) {
                    try {
                        await fhirConversionCallback.current(fileObj.id, result);
                    } catch (fhirError) {
                        console.error(`❌ FHIR conversion failed for ${fileObj.name}:`, fhirError);
                    }
                }
                
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
            extractedText: virtualData.extractedText || '',
            wordCount: virtualData.wordCount || 0,
            medicalDetection: virtualData.medicalDetection || { 
                isMedical: false, 
                confidence: 0, 
                detectedTerms: [],
                documentType: 'unknown', 
                reasoning: '', 
                suggestion: '' 
            },
            documentType: virtualData.documentType || 'virtual',
            isVirtual: true,
            fhirData: virtualData.fhirData,
            file: undefined
        };
        
        setFiles(prev => [...prev, virtualFile]);
        console.log(`✅ Added virtual file: ${virtualFile.name}`);
        
        return fileId;
    }, []);

    const addFhirAsVirtualFile = useCallback(async (fhirData: any, options: AddFhirAsVirtualFileOptions = {}): Promise<{ fileId: string; virtualFile: FileObject }> => {
        const fileId = options.id || generateId();
        const fileName = options.name || `FHIR Document ${fileId}`;
        
        const virtualFileData: VirtualFileData = {
            id: fileId,
            name: fileName,
            size: JSON.stringify(fhirData).length,
            type: 'application/fhir+json',
            extractedText: JSON.stringify(fhirData, null, 2),
            wordCount: JSON.stringify(fhirData).split(/\s+/).length,
            medicalDetection: {
                isMedical: true,
                confidence: 1.0,
                detectedTerms: [],
                documentType: options.documentType || 'fhir',
                reasoning: 'FHIR data is inherently medical',
                suggestion: 'Process as medical document'
            },
            documentType: options.documentType || 'fhir',
            fhirData,
            ...options
        };
        
        const generatedFileId = addVirtualFile(virtualFileData);
        const virtualFile = files.find(f => f.id === generatedFileId);
        
        if (!virtualFile) {
            throw new Error('Failed to create virtual file');
        }
        
        return { fileId: generatedFileId, virtualFile };
    }, [addVirtualFile, files]);

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
        removeFile,
        retryFile,
        clearAll,
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