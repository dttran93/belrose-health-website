import { DocumentData } from 'firebase/firestore';
import { FileObject } from '@/types/core';

/**
 * Centralized function to map Firestore document data to FileObject
 */
const mapFirestoreToFileObject = (docId: string, data: DocumentData): FileObject => {
  return {
    id: docId,
    fileName: data.fileName || (data.encryptedFileName ? '[ENCRYPTED]' : 'Unknown File'),
    fileSize: data.fileSize || 0,
    fileType: data.fileType || 'application/octet-stream',
    status: 'completed', // Files in Firestore are assumed completed
    lastModified: data.lastModified || Date.now(),

    // File storage properties
    downloadURL: data.downloadURL,

    // ✨ ENCRYPTION FLAGS - Must be preserved!
    isEncrypted: data.isEncrypted || false,
    encryptedFileIV: data.encryptedFileIV,

    // ✨ ENCRYPTED FIELDS - Pass through for decryption service
    encryptedFileName: data.encryptedFileName,
    encryptedExtractedText: data.encryptedExtractedText,
    encryptedOriginalText: data.encryptedOriginalText,
    encryptedContextText: data.encryptedContextText,
    encryptedFhirData: data.encryptedFhirData,
    encryptedBelroseFields: data.encryptedBelroseFields,

    // Processing properties (plaintext for unencrypted, will be populated by decryption)
    extractedText: data.extractedText,
    wordCount: data.wordCount,
    sourceType: data.sourceType,
    isVirtual: data.isVirtual,
    originalText: data.originalText,

    // Verification properties
    originalFileHash: data.originalFileHash,
    recordHash: data.recordHash,
    previousRecordHash: data.previousRecordHash,

    // FHIR properties (plaintext for unencrypted, will be populated by decryption)
    fhirData: data.fhirData,

    // AI enrichment properties (plaintext for unencrypted, will be populated by decryption)
    belroseFields: data.belroseFields || undefined,
    aiProcessingStatus: data.aiProcessingStatus || undefined,

    // Timestamp properties
    createdAt: data.createdAt,
    uploadedAt: data.uploadedAt,

    // Edit tracking properties
    editedByUser: data.editedByUser || false,
    blockchainVerification: data.blockchainVerification || undefined,

    // Ownership Fields
    uploadedBy: data.uploadedBy,
    owners: data.owners || [],
    administrators: data.administrators,
    viewers: data.viewers || [],
    subjects: data.subjects || [],
    pendingSubjectRequests: data.pendingSubjectRequests,

    //Blockchain Verification
    blockchainRoleInitialization: data.blockchainRoleInitialization,
  } as FileObject;
};

export default mapFirestoreToFileObject;
