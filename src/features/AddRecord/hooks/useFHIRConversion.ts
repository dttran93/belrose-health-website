import { useState, useCallback } from 'react';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { useAuthContext } from '@/components/auth/AuthContext';
import { toast } from 'sonner';
import { FileObject } from '@/types/core';
import { convertToFHIR } from '@/features/AddRecord/services/fhirConversionService'
import { FileUploadService } from '../services/fileUploadService';

import type {
  ReviewedData,
  PatientResource,
  ObservationResource,
  FHIRConversionHookReturn,
  DocumentType,
  PatientAddress,
  HealthRecordData,
} from './useFHIRConversion.type';

import type { 
  FHIRWithValidation, 
  FHIRBundle, 
  FHIRBundleEntry 
} from '../services/fhirConversionService.type';

import { 
  DOCUMENT_TYPE_KEYWORDS, 
  DEFAULT_DOCUMENT_TYPES 
} from './useFHIRConversion.type';

const db = getFirestore();

/**
 * Custom hook for managing FHIR conversion state and data processing
 */
export const useFHIRConversion = (
  processedFiles: FileObject[],
  firestoreData?: Map<string, any>,
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
    const handleFHIRConverted = useCallback(async (fileId: string, uploadResult: any, fileObj?: FileObject): Promise<void> => {
            console.log('🎯 Starting FHIR conversion for file:', fileId);
            console.log('🎯 Upload result received:', uploadResult);
        
        let targetFile = fileObj;
        if(!targetFile) {
            targetFile = processedFiles.find(f => f.id === fileId);
        }

        if (!targetFile || !targetFile.extractedText) {
            console.error('❌ File not found or no extracted text:', fileId);
            console.log('📋 Available processed files:', processedFiles.map(f => ({id: f.id, name: f.name})));
            return;
        } 
        
        try {
            console.log('🔄 Converting extracted text to FHIR...');
            console.log('📄 Extracted text preview:', targetFile.extractedText.substring(0, 100) + '...');
            
            const fhirResult = await convertToFHIR(
                targetFile.extractedText,
                targetFile.documentType || 'medical_record'
            );        
            
            console.log('✅ FHIR conversion successful:', fhirResult);
                      
            // Store the converted FHIR data
            setFhirData(prev => {
                const updated = new Map(prev);
                updated.set(fileId, fhirResult);
                return updated;
            });

            if (user?.uid && uploadResult?.documentId) {
                try {
                    const fhirWithMetadata = {
                        ...fhirResult,
                        _metadata:{
                            fileId: fileId,
                            fileName: targetFile.name,
                            uploadedAt: uploadResult.uploadedAt || new Date().toISOString(),
                            fhirConvertedAt: new Date().toISOString(),
                            userId: user.uid,
                            autoSaved: true
                        }
                    };
                    await uploadService.updateWithFHIR(uploadResult.documentId, fhirWithMetadata)
                    console.log('✅ FHIR data saved via service!');

                    toast.success(`💾 FHIR data saved for ${targetFile.name}`, {
                    description: 'Medical data saved to cloud storage',
                    duration: 4000,
                });
                } catch (error) {
                    console.error('❌ Error saving FHIR via service:', error);
                    toast.error(`💾 Failed to save FHIR data for ${targetFile.name}`, {
                        description: 'Conversion succeeded but saving failed',
                        duration: 6000,
                });
                }
            }

            console.log('🎉 FHIR data stored in state for fileId:', fileId);
            console.log('🎯 About to show toast...');

            toast.success(`⚡ FHIR conversion completed for ${targetFile.name}`, {
                description: 'Medical data has been converted to FHIR format',
                duration: 4000,
            });
            
        } catch (error) {
            console.error('❌ FHIR conversion failed:', error);
            
            toast.error(`⚡ FHIR conversion failed for ${targetFile.name}`, {
                description: error instanceof Error ? error.message : 'Unknown error',
                duration: 6000,
            });
        }
    }, [processedFiles, user, uploadService]);

    /**
     * Handle data confirmation from review - Updated to match original functionality
     */
    const handleDataConfirmed = useCallback(async (fileId: string, editedData: any): Promise<void> => {
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
            console.log('✅ uploadFiles exists - attempting upload');
            console.log('Uploading file to Firebase storage...');
            try {
                console.log('Calling uploadFiles (no parameters)');
                const uploadResults = await uploadFiles(); // No parameters
                console.log('✅ Upload completed successfully:', uploadResults);
                
                // Get the document ID from the first (and only) upload result
                if (uploadResults && uploadResults.length > 0 && uploadResults[0].success) {
                    documentId = uploadResults[0].documentId;
                    console.log('📄 Document ID from upload:', documentId);
                } else {
                    console.error('❌ Upload succeeded but no documentId returned:', uploadResults);
                    return;
                }
                
            } catch (error) {
                console.error('❌ Error uploading file:', error);
                return; // Don't continue if file upload fails
            }
        } else {
            console.log('❌ uploadFiles is not available');
            return;
        }

        // Step 2: Prepare FHIR data for storage
        const fhirDataToSave = editedData.fhirData; // This is your FHIR Bundle
        
        if (!fhirDataToSave) {
            console.error('❌ No FHIR data found in editedData');
            return;
        }

        // Optional: Add metadata to track processing
        const fhirWithMetadata = {
            ...fhirDataToSave,
            _metadata: {
                fileId: fileId,
                fileName: originalFile.name,
                uploadedAt: new Date().toISOString(),
                processedAt: new Date().toISOString(),
                userId: user?.uid,
                validationState: editedData.validationState
            }
        };

/**
 * Map FHIR data to HealthRecordCard format
 */
const mapFHIRToHealthRecord = (
    fhirData: FHIRWithValidation,
    fileName: string,
    fileId: string
): HealthRecordData | null => {
    try {
        const bundle = fhirData as FHIRBundle;
        
        // Extract patient information
        const patientResource = bundle.entry?.find(
            entry => entry.resource?.resourceType === 'Patient'
        )?.resource as PatientResource | undefined;

        // Extract observation/procedure information
        const observations = bundle.entry?.filter(
            entry => entry.resource?.resourceType === 'Observation'
        ) || [];

        // Build patient name
        const patientName = patientResource?.name?.[0] 
            ? `${patientResource.name[0].given?.join(' ') || ''} ${patientResource.name[0].family || ''}`.trim()
            : 'Unknown Patient';

        // Extract date from observations or use current date
        const recordDate = (observations[0]?.resource as ObservationResource)?.effectiveDateTime || 
                          new Date().toISOString().split('T')[0];

        // Build clinical notes from FHIR data
        const clinicalNotes = buildClinicalNotes(observations, patientResource || null);

        // Determine subject based on observation type
        const subject = determineSubject(observations, fileName);

        return {
            id: fileId,
            subject: subject,
            provider: extractProvider(observations) || "Unknown Provider",
            institutionName: extractInstitution(observations) || "Unknown Institution",
            institutionAddress: extractAddress(patientResource || null) || "Address not specified",
            date: recordDate,
            clinicNotes: clinicalNotes,
            attachments: [{
                name: fileName,
                size: "N/A",
                url: '#'
            }],
            isBlockchainVerified: false,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            originalFhirData: fhirData
        };
    } catch (error) {
        console.error('Error mapping FHIR data:', error);
        return null;
    }
};

/**
 * Build clinical notes from FHIR observations
 */
const buildClinicalNotes = (
    observations: FHIRBundleEntry[], 
    patientResource: PatientResource | null
): string => {
    let notes = '';

    // Add patient info
    if (patientResource) {
        const patientName = patientResource.name?.[0] 
            ? `${patientResource.name[0].given?.join(' ') || ''} ${patientResource.name[0].family || ''}`.trim()
            : 'Unknown Patient';
        
        notes += `Patient: ${patientName}\n`;
        
        if (patientResource.birthDate) {
            notes += `Date of Birth: ${patientResource.birthDate}\n`;
        }
        
        if (patientResource.identifier?.[0]?.value) {
            notes += `Patient ID: ${patientResource.identifier[0].value}\n`;
        }
        
        notes += '\n';
    }

    // Add observation details
    observations.forEach((obs, index: number) => {
        const resource = obs.resource as ObservationResource;
        
        if (resource.code?.coding?.[0]?.display) {
            notes += `${resource.code.coding[0].display}:\n`;
        } else if (resource.code?.text) {
            notes += `${resource.code.text}:\n`;
        }

        if (resource.effectiveDateTime) {
            notes += `Date: ${resource.effectiveDateTime}\n`;
        }

        // Handle components (like vision prescription details)
        if (resource.component && resource.component.length > 0) {
            resource.component.forEach(component => {
                const label = component.code?.text || 'Measurement';
                const value = component.valueQuantity 
                    ? `${component.valueQuantity.value} ${component.valueQuantity.unit || ''}`
                    : component.valueString || 'N/A';
                
                notes += `  ${label}: ${value}\n`;
            });
        }

        // Handle direct value
        if (resource.valueQuantity) {
            notes += `Value: ${resource.valueQuantity.value} ${resource.valueQuantity.unit || ''}\n`;
        } else if (resource.valueString) {
            notes += `Value: ${resource.valueString}\n`;
        }

        notes += '\n';
    });

    return notes.trim();
};

        // Step 3: Save FHIR data directly to Firestore
        if (user?.uid && documentId) {
            try {
                console.log('💾 Saving FHIR data to Firestore document:', documentId);
                
                // Import the updateFirestoreWithFHIR function
                const { updateFirestoreWithFHIR } = await import('@/firebase/uploadUtils');
                
                // Save the FHIR data directly (no conversion to legacy format)
                await updateFirestoreWithFHIR(documentId, fhirWithMetadata);
                
                console.log('✅ FHIR data saved successfully to document:', documentId);
                
                // Update the firestoreData Map to reflect this save
                if (updateFirestoreRecord) {
                    updateFirestoreRecord(fileId, { 
                        documentId, 
                        fhirData: fhirWithMetadata,
                        status: 'saved' 
                    });
                }
                
            } catch (error) {
                console.error('❌ Error saving FHIR data to Firestore:', error);
                // You might want to show a user-friendly error message here
            }
        } else {
            console.error('❌ Cannot save FHIR data: missing user or documentId', {
                hasUser: !!user?.uid,
                documentId
            });
        }
    }, [processedFiles, uploadFiles, user?.uid, updateFirestoreRecord]);

    /**
     * Handle data rejection
     */
    const handleDataRejected = useCallback((fileId: string): void => {
        console.log('❌ Data rejected for file:', fileId);
        console.log('🔍 removeProcessedFile function exists:', !!removeProcessedFile);
        
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
    }, [removeProcessedFile]);

    /**
     * Check if all files are converted AND reviewed
     */
    const isAllFilesConverted = useCallback((): boolean => {     
        const eligibleFiles = processedFiles.filter(f => {
            const hasExtractedText = !!f.extractedText;
            const isProcessed = ['completed', 'medical_detected', 'non_medical_detected'].includes(f.status);
            
            console.log(`📄 File ${f.name}: status=${f.status}, hasText=${hasExtractedText}, isProcessed=${isProcessed}`);
            
            return hasExtractedText && isProcessed;
        });
        
        // Debug logging
        console.log('🔍 FHIR Data Map contents:', Array.from(fhirData.keys()));
        console.log('🔍 Eligible files:', eligibleFiles.map(f => ({ id: f.id, name: f.name })));
        
        const result = eligibleFiles.length > 0 && eligibleFiles.every(f => {
            const hasFhir = fhirData.has(f.id);
            console.log(`📋 File ${f.name} (${f.id}) has FHIR: ${hasFhir}`);
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
        reset
    };
};

/**
 * Generate review data from FHIR bundle
 */
const generateReviewDataFromFHIR = (
    fhirData: FHIRWithValidation, 
    fileId: string, 
    processedFiles: FileObject[]
): ReviewedData | null => {
    try {
        if (fhirData.resourceType !== 'Bundle') {
            console.warn('FHIR data is not a Bundle, cannot generate review data');
            return null;
        }

        const bundle = fhirData as FHIRBundle;
        const fileName = processedFiles.find(f => f.id === fileId)?.name || 'Unknown File';

        // Extract patient and observations
        const patientEntry = bundle.entry?.find(entry => entry.resource?.resourceType === 'Patient');
        const patientResource = patientEntry?.resource as PatientResource | undefined;
        
        const observations = bundle.entry?.filter(entry => entry.resource?.resourceType === 'Observation') || [];

        // Generate review data
        const subject = determineSubject(observations, fileName);
        const provider = extractProvider(observations);
        const institution = extractInstitution(observations);
        const address = extractAddress(patientResource || null);
        const notes = generateNotes(observations, patientResource || null);
        const documentType = determineDocumentType(observations, fileName);

        return {
            subject,
            provider,
            institution,
            address,
            notes,
            documentType,
            confirmedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error generating review data from FHIR:', error);
        return null;
    }
};

/**
 * Extract patient name from patient resource
 */
const extractPatientName = (patientResource: PatientResource | null): string => {
    if (!patientResource?.name?.[0]) {
        return 'Unknown Patient';
    }
    
    const name = patientResource.name[0];
    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    
    return `${given} ${family}`.trim() || 'Unknown Patient';
};

/**
 * Extract provider from FHIR observations
 */
const extractProvider = (observations: FHIRBundleEntry[]): string | null => {
    for (const obs of observations) {
        const resource = obs.resource as ObservationResource;
        if (resource?.performer?.[0]?.display) {
            return resource.performer[0].display;
        }
    }
    return null;
};

/**
 * Extract institution from FHIR observations
 */
const extractInstitution = (observations: FHIRBundleEntry[]): string | null => {
    for (const obs of observations) {
        const resource = obs.resource as ObservationResource;
        if (resource?.performer) {
            const institution = resource.performer.find(p => 
                p.display && (p.display.includes('Hospital') || p.display.includes('Clinic'))
            );
            if (institution?.display) {
                return institution.display;
            }
        }
    }
    return null;
};

/**
 * Extract address from patient resource
 */
const extractAddress = (patientResource: PatientResource | null): string | null => {
    if (patientResource?.address?.[0]) {
        const addr = patientResource.address[0];
        const line = addr.line?.join(', ') || '';
        const city = addr.city || '';
        const postalCode = addr.postalCode || '';
        
        return [line, city, postalCode].filter(Boolean).join(', ');
    }
    return null;
};

/**
 * Generate notes from FHIR observations and patient data
 */
const generateNotes = (
    observations: FHIRBundleEntry[], 
    patientResource: PatientResource | null
): string => {
    let notes = '';

    // Add patient information
    if (patientResource) {
        const patientName = extractPatientName(patientResource);
        notes += `Patient: ${patientName}\n`;
        
        if (patientResource.birthDate) {
            notes += `Date of Birth: ${patientResource.birthDate}\n`;
        }
        
        if (patientResource.identifier?.[0]?.value) {
            notes += `Patient ID: ${patientResource.identifier[0].value}\n`;
        }
        
        notes += '\n';
    }

    // Add observation details
    observations.forEach((obs, index: number) => {
        const resource = obs.resource as ObservationResource;
        
        if (resource.code?.coding?.[0]?.display) {
            notes += `${resource.code.coding[0].display}:\n`;
        } else if (resource.code?.text) {
            notes += `${resource.code.text}:\n`;
        }

        if (resource.effectiveDateTime) {
            notes += `Date: ${resource.effectiveDateTime}\n`;
        }

        // Handle components (like vision prescription details)
        if (resource.component && resource.component.length > 0) {
            resource.component.forEach(component => {
                const label = component.code?.text || 'Measurement';
                const value = component.valueQuantity 
                    ? `${component.valueQuantity.value} ${component.valueQuantity.unit || ''}`
                    : component.valueString || 'N/A';
                
                notes += `  ${label}: ${value}\n`;
            });
        }

        // Handle direct value
        if (resource.valueQuantity) {
            notes += `Value: ${resource.valueQuantity.value} ${resource.valueQuantity.unit || ''}\n`;
        } else if (resource.valueString) {
            notes += `Value: ${resource.valueString}\n`;
        }

        notes += '\n';
    });

    return notes.trim();
};

/**
 * Determine document type based on FHIR content
 */
const determineDocumentType = (observations: FHIRBundleEntry[], fileName: string): DocumentType => {
    // Check for vision prescription
    if (observations.some(obs => {
        const resource = obs.resource as ObservationResource;
        return resource?.code?.coding?.[0]?.display?.toLowerCase().includes('vision') ||
               resource?.code?.text?.toLowerCase().includes('vision') ||
               resource?.component?.some(comp => 
                   comp.code?.text?.toLowerCase().includes('eye')
               );
    })) {
        return DEFAULT_DOCUMENT_TYPES.VISION_PRESCRIPTION;
    }

    // Check for lab results
    if (observations.some(obs => {
        const resource = obs.resource as ObservationResource;
        return resource?.code?.coding?.[0]?.display?.toLowerCase().includes('lab');
    }) || fileName.toLowerCase().includes('lab')) {
        return DEFAULT_DOCUMENT_TYPES.LABORATORY_RESULTS;
    }

    // Default based on filename or generic
    if (fileName.toLowerCase().includes('prescription')) {
        return DEFAULT_DOCUMENT_TYPES.PRESCRIPTION;
    } else if (fileName.toLowerCase().includes('report')) {
        return DEFAULT_DOCUMENT_TYPES.MEDICAL_REPORT;
    } else {
        return DEFAULT_DOCUMENT_TYPES.MEDICAL_RECORD;
    }
};

/**
 * Determine subject based on FHIR content  
 */
const determineSubject = (observations: FHIRBundleEntry[], fileName: string): string => {
    // Check for vision prescription
    if (observations.some(obs => {
        const resource = obs.resource as ObservationResource;
        return resource?.code?.coding?.[0]?.display?.toLowerCase().includes('vision') ||
               resource?.code?.text?.toLowerCase().includes('vision') ||
               resource?.component?.some(comp => 
                   comp.code?.text?.toLowerCase().includes('eye')
               );
    })) {
        return 'Vision Prescription';
    }

    // Check for lab results
    if (observations.some(obs => {
        const resource = obs.resource as ObservationResource;
        return resource?.code?.coding?.[0]?.display?.toLowerCase().includes('lab');
    }) || fileName.toLowerCase().includes('lab')) {
        return 'Laboratory Results';
    }

    // Default based on filename or generic
    if (fileName.toLowerCase().includes('prescription')) {
        return 'Prescription';
    } else if (fileName.toLowerCase().includes('report')) {
        return 'Medical Report';
    } else {
        return 'Medical Record';
    }
};