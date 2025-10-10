import { DocumentData } from 'firebase/firestore';
import { FileObject } from '@/types/core';

/**
 * Centralized function to map Firestore document data to FileObject
 */
const mapFirestoreToFileObject = (docId: string, data: DocumentData): FileObject => {
  return {
    id: docId,
    fileName: data.fileName || 'Unknown File',
    fileSize: data.fileSize || 0,
    fileType: data.fileType || 'application/octet-stream',
    status: 'completed', // Files in Firestore are assumed completed
    lastModified: data.createdAt?.toMillis?.() || data.uploadedAt?.toMillis?.() || Date.now(),

    // File storage properties
    downloadURL: data.downloadURL,

    // Processing properties
    extractedText: data.extractedText,
    wordCount: data.wordCount,
    sourceType: data.sourceType,
    isVirtual: data.isVirtual,

    originalText: data.originalText,

    // Verification properties
    originalFileHash: data.originalFileHash,
    recordHash: data.recordHash,
    previousRecordHash: data.previousRecordHash,

    // FHIR properties
    fhirData: data.fhirData,

    // AI enrichment properties
    belroseFields: data.belroseFields || undefined,
    aiProcessingStatus: data.aiProcessingStatus || undefined,

    // Timestamp properties
    createdAt: data.createdAt,
    uploadedAt: data.uploadedAt,

    // Edit tracking properties
    editedByUser: data.editedByUser || false,
    lastEditedAt: data.lastEditedAt,
    lastEditDescription: data.lastEditDescription,
    blockchainVerification: data.blockchainVerification || undefined,
  } as FileObject;
};

export default mapFirestoreToFileObject;
