//src/features/AddRecord/hooks/useFHIRConversion.ts

/**
 * This hook manages the FHIR conversion lifecycle for a batch of uploaded files.
 *
 * Conversion: triggers AI conversion for a file's extracted text, attaches
 * optional user context, and persists the result to Firestore.
 *
 * Review: tracks whether the user has confirmed or rejected each converted
 * file — confirmed files are uploaded to Firebase Storage and saved;
 * rejected files are removed from processing.
 *
 * State queries: exposes helpers for parent components to check whether all
 * files have been converted and reviewed, and to get a total resource count.
 */

import { useState, useCallback } from 'react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { toast } from 'sonner';
import { FileObject } from '@/types/core';
import { convertToFHIR } from '@/features/AddRecord/services/fhirConversionService';
import { FileUploadService } from '../services/fileUploadService';
import type { FHIRWithValidation } from '../services/fhirConversionService.type';
import type { FHIRBundle } from '@/types/fhir';

// ============================================================================
// TYPES
// ============================================================================

export interface ReviewedData {
  subject: string;
  provider?: string | null;
  institution?: string | null;
  address?: string | null;
  notes: string;
  sourceType: string;
  confirmedAt: string;
}

export interface HealthRecordData {
  id: string;
  subject: string;
  provider: string;
  institutionName: string;
  institutionAddress: string;
  date: string | undefined;
  clinicNotes: string;
  attachments: Array<{
    name: string;
    size: string;
    url: string;
  }>;
  isBlockchainVerified: boolean;
  createdAt: string;
  lastModified: string;
  originalFhirData: FHIRWithValidation;
}

export interface FHIRConversionHookReturn {
  fhirData: Map<string, FHIRWithValidation>;
  reviewedData: Map<string, ReviewedData>;
  handleFHIRConverted: (
    fileId: string,
    fhirData: FHIRWithValidation,
    fileObj?: FileObject
  ) => Promise<void>;
  handleDataConfirmed: (fileId: string, editedData: any) => Promise<void>;
  handleDataRejected: (fileId: string) => void;
  isAllFilesConverted: () => boolean;
  isAllFilesReviewed: () => boolean;
  getFHIRStats: () => number;
  reset: () => void;
}

export interface FHIRConversionHookParams {
  processedFiles: FileObject[];
  firestoreData?: Map<string, any>;
  updateFirestoreRecord?: (fileId: string, data: any) => void;
  uploadFiles?: () => Promise<any[]>;
  removeProcessedFile?: (fileId: string) => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook for managing FHIR conversion state and data processing
 */
export const useFHIRConversion = (
  processedFiles: FileObject[],
  updateFirestoreRecord?: (fileId: string, data: any) => void,
  uploadFiles?: (filesToUpload: FileObject[]) => Promise<any[]>,
  removeProcessedFile?: (fileId: string) => void
): FHIRConversionHookReturn => {
  const [fhirData, setFhirData] = useState<Map<string, FHIRWithValidation>>(new Map());
  const [reviewedData, setReviewedData] = useState<Map<string, ReviewedData>>(new Map());
  const { user } = useAuthContext();
  const uploadService = new FileUploadService();

  /**
   * Handle successful FHIR conversion
   */
  const handleFHIRConverted = useCallback(
    async (fileId: string, uploadResult: any, fileObj?: FileObject): Promise<void> => {
      console.log('Starting FHIR conversion for file:', fileId);

      let targetFile = fileObj ?? processedFiles.find(f => f.id === fileId);

      if (!targetFile || !targetFile.extractedText) {
        console.error('File not found or no extracted text:', fileId);
        return;
      }

      try {
        let contentForConversion = targetFile.extractedText;

        if (targetFile.contextText?.trim()) {
          console.log('Including user context in FHIR conversion');
          contentForConversion = `USER PROVIDED CONTEXT:\n${targetFile.contextText.trim()}\n\nDOCUMENT CONTENT:\n${targetFile.extractedText}`;
        }

        const fhirResult = await convertToFHIR(contentForConversion);

        setFhirData(prev => new Map(prev).set(fileId, fhirResult));

        if (user?.uid && uploadResult?.documentId) {
          try {
            await uploadService.updateWithFHIR(uploadResult.documentId, fhirResult);
            toast.success(`FHIR data saved for ${targetFile.fileName}`, {
              description: 'FHIR data saved to cloud storage',
              duration: 4000,
            });
          } catch (error) {
            console.error('Error saving FHIR via service:', error);
            toast.error(`Failed to save FHIR data for ${targetFile.fileName}`, {
              description: 'Conversion succeeded but saving failed',
              duration: 6000,
            });
          }
        }

        toast.success(`FHIR conversion completed for ${targetFile.fileName}`, {
          description: targetFile.contextText
            ? 'Medical data with your context converted to FHIR format'
            : 'Medical data has been converted to FHIR format',
          duration: 4000,
        });
      } catch (error) {
        console.error('FHIR conversion failed:', error);
        toast.error(`FHIR conversion failed for ${targetFile.fileName}`, {
          description: error instanceof Error ? error.message : 'Unknown error',
          duration: 6000,
        });
      }
    },
    [processedFiles, user, uploadService]
  );

  /**
   * Handle data confirmation from review
   */
  const handleDataConfirmed = useCallback(
    async (fileId: string, editedData: any): Promise<void> => {
      console.log('Data confirmed for file:', fileId);

      setReviewedData(prev => new Map(prev).set(fileId, editedData));

      const originalFile = processedFiles.find(f => f.id === fileId);
      if (!originalFile) {
        console.error('Original file not found for fileId:', fileId);
        return;
      }

      if (!uploadFiles) {
        console.error('uploadFiles is not available');
        return;
      }

      let documentId: string | null = null;

      try {
        const uploadResults = await uploadFiles([originalFile]);
        if (uploadResults?.[0]?.success) {
          documentId = uploadResults[0].documentId;
        } else {
          console.error('Upload succeeded but no documentId returned:', uploadResults);
          return;
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        return;
      }

      const fhirDataToSave = editedData.fhirData;
      if (!fhirDataToSave) {
        console.error('No FHIR data found in editedData');
        return;
      }

      if (user?.uid && documentId) {
        try {
          const { updateFirestoreRecord: saveToFirestore } = await import('@/firebase/uploadUtils');
          await saveToFirestore(documentId, fhirDataToSave);

          updateFirestoreRecord?.(fileId, {
            documentId,
            fhirData: fhirDataToSave,
            status: 'saved',
          });
        } catch (error) {
          console.error('Error saving FHIR data to Firestore:', error);
        }
      } else {
        console.error('Cannot save FHIR data: missing user or documentId', {
          hasUser: !!user?.uid,
          documentId,
        });
      }
    },
    [processedFiles, uploadFiles, user?.uid, updateFirestoreRecord]
  );

  /**
   * Handle data rejection
   */
  const handleDataRejected = useCallback(
    (fileId: string): void => {
      setFhirData(prev => {
        const updated = new Map(prev);
        updated.delete(fileId);
        return updated;
      });
      setReviewedData(prev => {
        const updated = new Map(prev);
        updated.delete(fileId);
        return updated;
      });

      removeProcessedFile?.(fileId);

      toast.info('Document processing cancelled', {
        description: 'The document has been rejected and removed from processing.',
        duration: 3000,
      });
    },
    [removeProcessedFile]
  );

  /**
   * Check if all eligible files have been converted to FHIR
   */
  const isAllFilesConverted = useCallback((): boolean => {
    const eligibleFiles = processedFiles.filter(
      f =>
        !!f.extractedText &&
        ['completed', 'medical_detected', 'non_medical_detected'].includes(f.status)
    );
    return eligibleFiles.length > 0 && eligibleFiles.every(f => fhirData.has(f.id));
  }, [processedFiles, fhirData]);

  /**
   * Check if all completed files have been reviewed
   */
  const isAllFilesReviewed = useCallback((): boolean => {
    const completedFiles = processedFiles.filter(f => f.status === 'completed' && f.extractedText);
    return completedFiles.length > 0 && completedFiles.every(f => reviewedData.has(f.id));
  }, [processedFiles, reviewedData]);

  /**
   * Get total FHIR resource count across all converted files
   */
  const getFHIRStats = useCallback((): number => {
    let total = 0;
    fhirData.forEach(fhir => {
      if (fhir.resourceType === 'Bundle') {
        total += (fhir as unknown as FHIRBundle).entry?.length ?? 0;
      } else {
        total += 1;
      }
    });
    return total;
  }, [fhirData]);

  /**
   * Reset all state
   */
  const reset = useCallback((): void => {
    setFhirData(new Map());
    setReviewedData(new Map());
  }, []);

  return {
    fhirData,
    reviewedData,
    handleFHIRConverted,
    handleDataConfirmed,
    handleDataRejected,
    isAllFilesConverted,
    isAllFilesReviewed,
    getFHIRStats,
    reset,
  };
};
