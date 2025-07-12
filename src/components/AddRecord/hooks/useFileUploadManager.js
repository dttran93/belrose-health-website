import { useState, useCallback } from 'react';
import DocumentProcessorService from '@/components/AddRecord/services/documentProcessorService';

/**
 * Custom hook for managing file upload state and processing
 */
export function useFileUploadManager({
    maxFiles = 5,
    maxSizeBytes = 10 * 1024 * 1024,
    onFilesProcessed,
    onFHIRResult
}) {
    const [files, setFiles] = useState([]);
    const [fhirResults, setFhirResults] = useState(new Map());

    /**
     * Add new files to the list with validation
     */
    const addFiles = useCallback((fileList) => {
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
                addedAt: new Date().toISOString()
            };
        });

        setFiles(prev => [...prev, ...newFiles]);
        
        // Auto-process valid files
        setTimeout(() => {
            newFiles.forEach(fileItem => {
                if (fileItem.status === 'ready') {
                    processFile(fileItem);
                }
            });
        }, 0);

        return newFiles;
    }, [files.length, maxFiles]);

    /**
     * Process a single file
     */
    const processFile = useCallback(async (fileItem) => {
        console.log('Processing file:', fileItem.name);
        
        try {
            // Update status to processing
            updateFileStatus(fileItem.id, 'processing');

            // Use DocumentProcessorService for processing
            const processingResult = await DocumentProcessorService.processDocument(fileItem.file, {
                enableMedicalDetection: true,
                enableVisionAI: true,
                compressionThreshold: 2 * 1024 * 1024 // 2MB
            });

            if (!processingResult.success) {
                throw new Error(processingResult.error);
            }

            // Update file with processing results
            const updatedFile = updateFileWithProcessingResult(fileItem.id, processingResult);

            // Notify parent about processed file
            if (onFilesProcessed && updatedFile) {
                onFilesProcessed([updatedFile]);
            }

            // Auto-convert to FHIR if medical content detected
            if (processingResult.medicalDetection?.isMedical && 
                processingResult.medicalDetection?.confidence >= 0.3) {
                
                await convertToFHIR(
                    fileItem.id, 
                    processingResult.extractedText, 
                    processingResult.medicalDetection.documentType
                );
            }

        } catch (error) {
            console.error('Error processing file:', error);
            handleProcessingError(fileItem.id, error);
        }
    }, [onFilesProcessed]);

    /**
     * Update file status
     */
    const updateFileStatus = useCallback((fileId, status, additionalData = {}) => {
        setFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status, ...additionalData } : f
        ));
    }, []);

    /**
     * Update file with processing results
     */
    const updateFileWithProcessingResult = useCallback((fileId, processingResult) => {
        let updatedFileData = null;
        setFiles(prev => prev.map(f => {
            if (f.id === fileId) {
                updatedFileData = {
                    ...f,
                    status: processingResult.medicalDetection?.isMedical ? 'medical_detected' : 'non_medical_detected',
                    extractedText: processingResult.extractedText,
                    wordCount: processingResult.wordCount,
                    medicalDetection: processingResult.medicalDetection,
                    processingMethod: processingResult.processingMethod,
                    processingTime: processingResult.processingTime,
                    extractedAt: new Date().toISOString()
                };
                return updatedFileData;
            }
            return f;
        }));
        return updatedFileData;
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
    }, [updateFileStatus]);

    /**
     * Convert file to FHIR
     */
    const convertToFHIR = useCallback(async (fileId, extractedText, documentType) => {
        updateFileStatus(fileId, 'converting');

        try {
            // Import here to avoid circular dependencies
            const { convertToFHIR: fhirConverter } = await import('@/components/AddRecord/services/fhirConversionService');
            const fhirData = await fhirConverter(extractedText, documentType || 'medical_record');
            
            const fhirResult = {
                success: true,
                fhirData,
                convertedAt: new Date().toISOString()
            };

            // Store FHIR results
            setFhirResults(prev => new Map([...prev, [fileId, fhirResult]]));
            
            // Update file status to completed
            updateFileStatus(fileId, 'completed');

            // Notify parent component
            if (onFHIRResult) {
                onFHIRResult(fileId, fhirData);
            }

        } catch (fhirError) {
            const fhirResult = {
                success: false,
                error: fhirError.message,
                convertedAt: new Date().toISOString()
            };
            
            setFhirResults(prev => new Map([...prev, [fileId, fhirResult]]));
            updateFileStatus(fileId, 'fhir_error', { error: fhirError.message });
        }
    }, [updateFileStatus, onFHIRResult]);

    /**
     * Force convert non-medical file
     */
    const forceConvertFile = useCallback(async (fileItem) => {
        if (!fileItem.extractedText) {
            console.error('No extracted text available for force conversion');
            return;
        }

        console.log('Force converting non-medical file:', fileItem.name);
        await convertToFHIR(fileItem.id, fileItem.extractedText, 'medical_record');
    }, [convertToFHIR]);

    /**
     * Remove a file
     */
    const removeFile = useCallback((fileId) => {
        setFiles(prev => prev.filter(f => f.id !== fileId));
        setFhirResults(prev => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            return newMap;
        });
    }, []);

    /**
     * Retry processing a file
     */
    const retryFile = useCallback((fileItem) => {
        processFile(fileItem);
    }, [processFile]);

    /**
     * Get processing statistics
     */
    const getStats = useCallback(() => {
        const total = files.length;
        const completed = files.filter(f => f.status === 'completed').length;
        const processing = files.filter(f => f.status === 'processing' || f.status === 'converting').length;
        const errors = files.filter(f => f.status.includes('error')).length;
        const nonMedical = files.filter(f => f.status === 'non_medical_detected').length;
        
        return {
            total,
            completed,
            processing,
            errors,
            nonMedical,
            completionRate: total > 0 ? (completed / total) * 100 : 0
        };
    }, [files]);

    /**
     * Clear all files
     */
    const clearAll = useCallback(() => {
        setFiles([]);
        setFhirResults(new Map());
    }, []);

    return {
        files,
        fhirResults,
        addFiles,
        removeFile,
        retryFile,
        forceConvertFile,
        processFile,
        convertToFHIR,
        getStats,
        clearAll
    };
}