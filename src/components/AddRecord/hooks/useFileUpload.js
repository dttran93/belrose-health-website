import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { DeduplicationService } from '../services/deduplicationService';
import { FileUploadService } from '@/components/AddRecord/services/fileUploadService';

export const useFileUpload = () => {
    const [processedFiles, setProcessedFiles] = useState([]);
    const [firestoreData, setFirestoreData] = useState(new Map());
    const [savingToFirestore, setSavingToFirestore] = useState(new Set());
    const [originalUploadCount, setOriginalUploadCount] = useState(0);
    
    const deduplicationService = useRef(new DeduplicationService());
    const fileUploadService = useRef(new FileUploadService());
    const processingFiles = useRef(new Set());

    const handleFilesProcessed = useCallback(async (incomingFiles) => {
        if (!incomingFiles || incomingFiles.length === 0) {
            return;
        }

        // GUARD: Check if these exact files are already being processed
        const fileSignatures = incomingFiles.map(f => `${f.name}-${f.size}-${f.lastModified}`);
        const alreadyProcessing = fileSignatures.some(sig => processingFiles.current.has(sig));
        
        if (alreadyProcessing) {
            return;
        }

        // TRACK ORIGINAL UPLOAD COUNT: If this is the first batch of files, set the original count
        if (processedFiles.length === 0) {
            console.log('Setting original upload count:', incomingFiles.length);
            setOriginalUploadCount(incomingFiles.length);
        }

        // Mark files as processing
        fileSignatures.forEach(sig => processingFiles.current.add(sig));

        try {
            const newFiles = [];
            const duplicateFiles = [];

            // Process each file for deduplication
            for (const fileObj of incomingFiles) {
                try {
                    const fileHash = await deduplicationService.current.generateFileHash(fileObj.file);
                    
                    if (deduplicationService.current.isFileAlreadyProcessed(fileHash, fileObj.id, firestoreData)) {
                        duplicateFiles.push(fileObj);
                        continue;
                    }
                    
                    deduplicationService.current.markFileAsProcessing(fileHash, fileObj.id);
                    newFiles.push({ ...fileObj, fileHash });
                    
                } catch (error) {
                    console.error('Error hashing file:', error);
                    toast.error(`Error processing ${fileObj.name}: ${error.message}`);
                }
            }

            // Report duplicates
            if (duplicateFiles.length > 0) {
                toast.warning(`Skipped ${duplicateFiles.length} duplicate file(s)`);
            }

            // Update processed files state
            setProcessedFiles(prev => {
                const existingIds = new Set(prev.map(f => f.id));
                const uniqueNewFiles = newFiles.filter(f => !existingIds.has(f.id));
                return [...prev, ...uniqueNewFiles];
            });

        } catch (error) {
            console.error('Error processing files:', error);
        } finally {
            // Remove from processing set when done
            setTimeout(() => {
                fileSignatures.forEach(sig => processingFiles.current.delete(sig));
            }, 1000);
        }
    }, [processedFiles.length, firestoreData]);

    const uploadFiles = useCallback(async (filesToUpload) => {
        const uploadPromises = filesToUpload.map(fileObj => uploadFile(fileObj));
        const results = await Promise.allSettled(uploadPromises);
        
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const fileObj = filesToUpload[index];
                console.error(`Upload failed for ${fileObj.name}:`, result.reason);
                deduplicationService.current.releaseProcessingLock(fileObj.id, fileObj.fileHash);
            }
        });
    }, [firestoreData]);

    const uploadFile = async (fileObj) => {
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
    };

    const updateFirestoreRecord = useCallback((fileId, updates) => {
        setFirestoreData(prev => {
            const current = prev.get(fileId);
            if (current) {
                return new Map([...prev, [fileId, { ...current, ...updates }]]);
            }
            return prev;
        });
    }, []);

    const reset = () => {
        setProcessedFiles([]);
        setFirestoreData(new Map());
        setSavingToFirestore(new Set());
        setOriginalUploadCount(0); // FIXED: Reset originalUploadCount
        processingFiles.current.clear();
        deduplicationService.current.clear();
    };

    return {
        // State
        processedFiles,
        firestoreData,
        savingToFirestore,
        originalUploadCount,
        
        // Actions
        uploadFiles,
        handleFilesProcessed,
        updateFirestoreRecord,
        reset,
        
        // Computed values
        savedToFirestoreCount: firestoreData.size,
        savingCount: savingToFirestore.size,
        
        // Services (for other hooks to use)
        deduplicationService: deduplicationService.current
    };
};