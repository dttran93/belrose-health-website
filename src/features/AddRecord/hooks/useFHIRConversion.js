import { useState } from 'react';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { useAuthContext } from '@/components/auth/AuthContext';
import { toast } from 'sonner';

const db = getFirestore();

export const useFHIRConversion = (processedFiles, firestoreData, updateFirestoreRecord, uploadFiles, removeProcessedFile) => {

    const [fhirData, setFhirData] = useState(new Map());
    const [reviewedData, setReviewedData] = useState(new Map()); // NEW: Track reviewed files
    const { user } = useAuthContext();

    // Map FHIR data to HealthRecordCard format
    const mapFHIRToHealthRecord = (fhirData, fileName, fileId) => {
        try {
            // Extract patient information
            const patientResource = fhirData.entry?.find(
                entry => entry.resource?.resourceType === 'Patient'
            )?.resource;

            // Extract observation/procedure information
            const observations = fhirData.entry?.filter(
                entry => entry.resource?.resourceType === 'Observation'
            ) || [];

            // Build patient name
            const patientName = patientResource?.name?.[0] 
                ? `${patientResource.name[0].given?.join(' ') || ''} ${patientResource.name[0].family || ''}`.trim()
                : 'Unknown Patient';

            // Extract date from observations or use current date
            const recordDate = observations[0]?.resource?.effectiveDateTime || 
                              new Date().toISOString().split('T')[0];

            // Build clinical notes from FHIR data
            const clinicalNotes = buildClinicalNotes(observations, patientResource);

            // Determine subject based on observation type
            const subject = determineSubject(observations, fileName);

            return {
                id: fileId,
                subject: subject,
                provider: extractProvider(observations) || "Unknown Provider",
                institutionName: extractInstitution(observations) || "Unknown Institution",
                institutionAddress: extractAddress(patientResource) || "Address not specified",
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

    // Build clinical notes from FHIR observations
    const buildClinicalNotes = (observations, patientResource) => {
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
        observations.forEach((obs, index) => {
            const resource = obs.resource;
            
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

    // Determine subject based on FHIR content
    const determineSubject = (observations, fileName) => {
        // Check for vision prescription
        if (observations.some(obs => 
            obs.resource?.code?.coding?.[0]?.display?.toLowerCase().includes('vision') ||
            obs.resource?.code?.text?.toLowerCase().includes('vision') ||
            obs.resource?.component?.some(comp => 
                comp.code?.text?.toLowerCase().includes('eye')
            )
        )) {
            return 'Vision Prescription';
        }

        // Check for lab results
        if (observations.some(obs => 
            obs.resource?.code?.coding?.[0]?.display?.toLowerCase().includes('lab') ||
            fileName.toLowerCase().includes('lab')
        )) {
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

    // Extract provider from FHIR data
    const extractProvider = (observations) => {
        for (const obs of observations) {
            if (obs.resource?.performer?.[0]?.display) {
                return obs.resource.performer[0].display;
            }
        }
        return null;
    };

    // Extract institution from FHIR data
    const extractInstitution = (observations) => {
        for (const obs of observations) {
            if (obs.resource?.performer?.find(p => p.display && (p.display.includes('Hospital') || p.display.includes('Clinic')))) {
                return obs.resource.performer.find(p => p.display && (p.display.includes('Hospital') || p.display.includes('Clinic'))).display;
            }
        }
        return null;
    };

    // Extract address from patient resource
    const extractAddress = (patientResource) => {
        if (patientResource?.address?.[0]) {
            const addr = patientResource.address[0];
            const line = addr.line?.join(', ') || '';
            const city = addr.city || '';
            const postalCode = addr.postalCode || '';
            
            return [line, city, postalCode].filter(Boolean).join(', ');
        }
        return null;
    };

    // MODIFIED: handleFHIRConverted now only stores data, doesn't auto-save
    const handleFHIRConverted = async (fileId, fhirJsonData) => {
        console.log('FHIR converted for file:', fileId, fhirJsonData);
        
        // Store raw FHIR data but don't save to Firestore yet
        setFhirData(prev => new Map([...prev, [fileId, fhirJsonData]]));
        
        console.log('FHIR data stored for review, not yet saved to Firestore');
    };

    // NEW: Handle user-confirmed data from DataReviewSection
    const handleDataConfirmed = async (fileId, editedData) => {
        console.log('Data confirmed for file:', fileId, editedData);

        // Mark as reviewed
        setReviewedData(prev => new Map([...prev, [fileId, editedData]]));
        
        // Get the original file info
        const originalFile = processedFiles.find(f => f.id === fileId);
        if (!originalFile) {
            console.error('Original file not found for fileId:', fileId);
            return;
        }

        console.log('originalFile found:', originalFile);

        let documentId = null;

        // Step 1: Upload the file to Firebase Storage and get documentId
        if (uploadFiles) {
            console.log('✅ uploadFiles exists - attempting upload');
            console.log('Uploading file to Firebase storage...');
            try {
                console.log('Calling uploadFiles with:', [originalFile]);
                const uploadResults = await uploadFiles([originalFile]);
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
    };

    //Handle user rejection of data
    const handleDataRejected = (fileId) => {
        console.log('Data rejected for file:', fileId);
        console.log('🔍 removeProcessedFile function exists:', !!removeProcessedFile);
        // Remove from FHIR data map
        setFhirData(prev => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            return newMap;
        });

        if (removeProcessedFile) {
            removeProcessedFile(fileId);
        }

        toast.info('Document processing cancelled', {
            description: 'The document has been rejected and removed from processing.',
            duration: 3000,
        });
    };

    // Check if all files are converted AND reviewed
    const isAllFilesConverted = () => {     
        const eligibleFiles = processedFiles.filter(f => {
            const hasExtractedText = !!f.extractedText;
            const isProcessed = ['completed', 'medical_detected', 'non_medical_detected'].includes(f.status);
            
            console.log(`📄 File ${f.name}: status=${f.status}, hasText=${hasExtractedText}, isProcessed=${isProcessed}`);
            
            return hasExtractedText && isProcessed;
        });
        
        // 🔍 ADD THIS DEBUG LOGGING
        console.log('🔍 FHIR Data Map contents:', Array.from(fhirData.keys()));
        console.log('🔍 Eligible files:', eligibleFiles.map(f => ({ id: f.id, name: f.name })));
        
        const result = eligibleFiles.length > 0 && eligibleFiles.every(f => {
            const hasFhir = fhirData.has(f.id);
            console.log(`📋 File ${f.name} (${f.id}) has FHIR: ${hasFhir}`);
            return hasFhir;
        });
        
        return result;
    };

    //Check if all files are reviewed and ready for completion
    const isAllFilesReviewed = () => {
        const completedFiles = processedFiles.filter(f => f.status === 'completed' && f.extractedText);
        return completedFiles.length > 0 && completedFiles.every(f => reviewedData.has(f.id));
    };

    const getFHIRStats = () => {
        let totalResources = 0;
        fhirData.forEach(fhir => {
            totalResources += fhir.entry?.length || 0;
        });
        return totalResources;
    };

    const reset = () => {
        setFhirData(new Map());
        setReviewedData(new Map()); 
    };

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