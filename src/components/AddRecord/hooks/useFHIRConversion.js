// Updated useFHIRConversion hook
import { useState } from 'react';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { useAuthContext } from '@/components/auth/AuthContext';

const db = getFirestore();

export const useFHIRConversion = (processedFiles, firestoreData, updateFirestoreRecord) => {
    const [fhirData, setFhirData] = useState(new Map());
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
                    size: "N/A", // You can get this from your file processing
                    url: '#'
                }],
                isBlockchainVerified: false,
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                originalFhirData: fhirData // Keep original for reference
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

    // Updated handleFHIRConverted function
    const handleFHIRConverted = async (fileId, fhirJsonData) => {
        console.log('FHIR converted for file:', fileId, fhirJsonData);
        
        // Ensure fileId is a string
        const recordId = String(fileId).replace(/[^a-zA-Z0-9_-]/g, '_');
        console.log('Using record ID:', recordId);
        
        // Store raw FHIR data
        setFhirData(prev => new Map([...prev, [fileId, fhirJsonData]]));

        // Get the original file info
        const originalFile = processedFiles.find(f => f.id === fileId);
        if (!originalFile) {
            console.error('Original file not found for fileId:', fileId);
            return;
        }

        // Map FHIR data to HealthRecordCard format
        const healthRecord = mapFHIRToHealthRecord(fhirJsonData, originalFile.name, recordId);
        
        if (!healthRecord) {
            console.error('Failed to map FHIR data to health record format');
            return;
        }

        // Save health record to Firestore
        if (user?.uid) {
            try {
                console.log('Saving health record to Firestore:', healthRecord);
                
                // Save to the health-records collection for the Activity page to read
                const healthRecordRef = doc(db, `users/${user.uid}/health-records`, recordId);
                await setDoc(healthRecordRef, healthRecord);
                
                console.log('Health record saved successfully to Firestore');
                
                // Also update the firestoreData if you're still using it elsewhere
                if (updateFirestoreRecord) {
                    updateFirestoreRecord(fileId, {
                        ...healthRecord,
                        fhirData: fhirJsonData // Include raw FHIR data too
                    });
                }
                
            } catch (error) {
                console.error('Error saving health record to Firestore:', error);
                console.error('Error details:', {
                    userId: user?.uid,
                    recordId: recordId,
                    fileId: fileId,
                    originalFileId: originalFile?.id
                });
            }
        } else {
            console.error('No user found, cannot save to Firestore');
        }
    };

    const isAllFilesConverted = () => {
        const completedFiles = processedFiles.filter(f => f.status === 'completed' && f.extractedText);
        return completedFiles.length > 0 && completedFiles.every(f => fhirData.has(f.id));
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
    };

    return {
        fhirData,
        handleFHIRConverted,
        isAllFilesConverted,
        getFHIRStats,
        reset
    };
};