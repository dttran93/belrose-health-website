import { useState, useCallback } from 'react';
import { useAuthContext } from '@/components/auth/AuthContext';
import { toast } from 'sonner';
import { FileObject } from '@/types/core';
import { convertToFHIR } from '@/features/AddRecord/services/fhirConversionService';
import { FileUploadService } from '../services/fileUploadService';

import type { ReviewedData, FHIRConversionHookReturn } from './useFHIRConversion.type';

import type { FHIRWithValidation, FHIRBundle } from '../services/fhirConversionService.type';

/**
 * Custom hook for managing FHIR conversion state and data processing
 */
export const useFHIRConversion = (
  processedFiles: FileObject[],
  updateFirestoreRecord?: (fileId: string, data: any) => void,
  uploadFiles?: () => Promise<any[]>, // Updated type signature
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
      console.log('Upload result received:', uploadResult);

      let targetFile = fileObj;
      if (!targetFile) {
        targetFile = processedFiles.find(f => f.id === fileId);
      }

      if (!targetFile || !targetFile.extractedText) {
        console.error('File not found or no extracted text:', fileId);
        console.log(
          'Available processed files:',
          processedFiles.map(f => ({ id: f.id, name: f.fileName }))
        );
        return;
      }

      try {
        console.log('Converting extracted text to FHIR...');
        console.log('Extracted text preview:', targetFile.extractedText.substring(0, 100) + '...');

        const fhirResult = await convertToFHIR(targetFile.extractedText);

        console.log('FHIR conversion successful:', fhirResult);

        // Store the converted FHIR data
        setFhirData(prev => {
          const updated = new Map(prev);
          updated.set(fileId, fhirResult);
          return updated;
        });

        if (user?.uid && uploadResult?.documentId) {
          try {
            await uploadService.updateWithFHIR(uploadResult.documentId, fhirResult);
            console.log('FHIR data saved via service!');

            toast.success(`FHIR data saved for ${targetFile.fileName}`, {
              description: 'Medical data saved to cloud storage',
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

        console.log('FHIR data stored in state for fileId:', fileId);

        toast.success(`FHIR conversion completed for ${targetFile.fileName}`, {
          description: 'Medical data has been converted to FHIR format',
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
   * Handle data confirmation from review - Updated to match original functionality
   */
  const handleDataConfirmed = useCallback(
    async (fileId: string, editedData: any): Promise<void> => {
      console.log('Data confirmed for file:', fileId, editedData);

      // Mark as reviewed
      setReviewedData(prev => {
        const updated = new Map(prev);
        updated.set(fileId, editedData);
        return updated;
      });

      // Get the original file info
      const originalFile = processedFiles.find(f => f.id === fileId);
      if (!originalFile) {
        console.error('Original file not found for fileId:', fileId);
        return;
      }

      console.log('originalFile found:', originalFile);

      let documentId: string | null = null;

      // Step 1: Upload the file to Firebase Storage and get documentId
      if (uploadFiles) {
        console.log('uploadFiles exists - attempting upload');
        console.log('Uploading file to Firebase storage...');
        try {
          console.log('Calling uploadFiles (no parameters)');
          const uploadResults = await uploadFiles(); // No parameters
          console.log('Upload completed successfully:', uploadResults);

          // Get the document ID from the first (and only) upload result
          if (uploadResults && uploadResults.length > 0 && uploadResults[0].success) {
            documentId = uploadResults[0].documentId;
            console.log('Document ID from upload:', documentId);
          } else {
            console.error('Upload succeeded but no documentId returned:', uploadResults);
            return;
          }
        } catch (error) {
          console.error('Error uploading file:', error);
          return; // Don't continue if file upload fails
        }
      } else {
        console.log('uploadFiles is not available');
        return;
      }

      // Step 2: Prepare FHIR data for storage
      const fhirDataToSave = editedData.fhirData; // This is your FHIR Bundle

      if (!fhirDataToSave) {
        console.error('No FHIR data found in editedData');
        return;
      }

      // Step 3: Save FHIR data directly to Firestore
      if (user?.uid && documentId) {
        try {
          console.log('Saving FHIR data to Firestore document:', documentId);

          // Import the updateFirestoreRecord function
          const { updateFirestoreRecord: saveToFirestore } = await import('@/firebase/uploadUtils');

          // Save the FHIR data directly
          await saveToFirestore(documentId, fhirDataToSave);

          console.log('FHIR data saved successfully to document:', documentId);

          // Update the firestoreData Map to reflect this save
          if (updateFirestoreRecord) {
            updateFirestoreRecord(fileId, {
              documentId,
              fhirData: fhirDataToSave,
              status: 'saved',
            });
          }
        } catch (error) {
          console.error('Error saving FHIR data to Firestore:', error);
          // You might want to show a user-friendly error message here
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
      console.log('Data rejected for file:', fileId);
      console.log('removeProcessedFile function exists:', !!removeProcessedFile);

      // Remove from FHIR data map
      setFhirData(prev => {
        const updated = new Map(prev);
        updated.delete(fileId);
        return updated;
      });

      // Remove from reviewed data map
      setReviewedData(prev => {
        const updated = new Map(prev);
        updated.delete(fileId);
        return updated;
      });

      // Remove the processed file if function is provided
      if (removeProcessedFile) {
        removeProcessedFile(fileId);
      }

      toast.info('Document processing cancelled', {
        description: 'The document has been rejected and removed from processing.',
        duration: 3000,
      });
    },
    [removeProcessedFile]
  );

  /**
   * Check if all files are converted AND reviewed
   */
  const isAllFilesConverted = useCallback((): boolean => {
    const eligibleFiles = processedFiles.filter(f => {
      const hasExtractedText = !!f.extractedText;
      const isProcessed = ['completed', 'medical_detected', 'non_medical_detected'].includes(
        f.status
      );

      console.log(
        `File ${f.fileName}: status=${f.status}, hasText=${hasExtractedText}, isProcessed=${isProcessed}`
      );

      return hasExtractedText && isProcessed;
    });

    // Debug logging
    console.log('FHIR Data Map contents:', Array.from(fhirData.keys()));
    console.log(
      'Eligible files:',
      eligibleFiles.map(f => ({ id: f.id, name: f.fileName }))
    );

    const result =
      eligibleFiles.length > 0 &&
      eligibleFiles.every(f => {
        const hasFhir = fhirData.has(f.id);
        console.log(`File ${f.fileName} (${f.id}) has FHIR: ${hasFhir}`);
        return hasFhir;
      });

    return result;
  }, [processedFiles, fhirData]);

  /**
   * Check if all files are reviewed and ready for completion
   */
  const isAllFilesReviewed = useCallback((): boolean => {
    const completedFiles = processedFiles.filter(f => f.status === 'completed' && f.extractedText);
    return completedFiles.length > 0 && completedFiles.every(f => reviewedData.has(f.id));
  }, [processedFiles, reviewedData]);

  /**
   * Get total FHIR resources count
   */
  const getFHIRStats = useCallback((): number => {
    let totalResources = 0;
    fhirData.forEach(fhir => {
      if (fhir.resourceType === 'Bundle' && (fhir as FHIRBundle).entry) {
        totalResources += (fhir as FHIRBundle).entry?.length || 0;
      } else {
        totalResources += 1; // Single resource
      }
    });
    return totalResources;
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
