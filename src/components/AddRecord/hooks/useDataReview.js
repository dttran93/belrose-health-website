import { useState, useMemo, useEffect } from 'react';

export const useDataReview = (processedFiles, fhirData, originalUploadCount = 0) => {
    const [editingFile, setEditingFile] = useState(null);
    const [editedData, setEditedData] = useState({});
    const [activeTab, setActiveTab] = useState('extracted');

    // Get files that have both extracted text and FHIR data
    const reviewableFiles = useMemo(() => {
        return processedFiles.filter(file => {
            // File must have extracted text
            if (!file.extractedText) return false;
            
            // Include files that:
            // 1. Successfully completed FHIR conversion (status: 'completed' + has FHIR data)
            // 2. Were detected as medical but need manual review (status: 'medical_detected')
            // 3. Were detected as non-medical but user might want to review (status: 'non_medical_detected')
            const isCompleted = file.status === 'completed' && fhirData.has(file.id);
            const isMedicalDetected = file.status === 'medical_detected';
            const isNonMedicalDetected = file.status === 'non_medical_detected';
            
            return isCompleted || isMedicalDetected || isNonMedicalDetected;
        });
    }, [processedFiles, fhirData]);

    // Helper functions for extracting data from FHIR
    const extractProvider = (observations) => {
        for (const obs of observations) {
            if (obs.resource?.performer?.[0]?.display) {
                return obs.resource.performer[0].display;
            }
        }
        return '';
    };

    const extractInstitution = (observations) => {
        for (const obs of observations) {
            const performer = obs.resource?.performer?.find(p => 
                p.display && (p.display.includes('Hospital') || p.display.includes('Clinic'))
            );
            if (performer) return performer.display;
        }
        return '';
    };

    const extractProviderAddress = (observations) => {
        // Try to extract address from FHIR organization or practitioner resources
        for (const obs of observations) {
            // Look for address in performer references
            if (obs.resource?.performer) {
                for (const performer of obs.resource.performer) {
                    // If there's address information in the performer
                    if (performer.address) {
                        const addr = performer.address[0];
                        const line = addr.line?.join(', ') || '';
                        const city = addr.city || '';
                        const state = addr.state || '';
                        const postalCode = addr.postalCode || '';
                        
                        return [line, city, state, postalCode].filter(Boolean).join(', ');
                    }
                }
            }
        }
        return '';
    };

    const extractClinicalNotes = (observations) => {
        return observations.map(obs => {
            const resource = obs.resource;
            let note = '';
            
            if (resource.code?.coding?.[0]?.display) {
                note += `${resource.code.coding[0].display}: `;
            }
            
            if (resource.valueQuantity) {
                note += `${resource.valueQuantity.value} ${resource.valueQuantity.unit || ''}`;
            } else if (resource.valueString) {
                note += resource.valueString;
            } else if (resource.component) {
                note += resource.component.map(comp => {
                    const label = comp.code?.text || 'Measurement';
                    const value = comp.valueQuantity 
                        ? `${comp.valueQuantity.value} ${comp.valueQuantity.unit || ''}`
                        : comp.valueString || 'N/A';
                    return `${label}: ${value}`;
                }).join(', ');
            }
            
            return note;
        }).filter(Boolean).join('\n');
    };

    // Extract editable fields from FHIR data
    const extractEditableFields = (fhirJsonData, originalFile) => {
        // Base fields that can be extracted from the file itself
        const baseFields = {
            // Document info
            documentTitle: originalFile.name || '',
            documentType: originalFile.documentType || 'Medical Record',
            documentDate: new Date().toISOString().split('T')[0],
            
            // Provider info (matching your form fields)
            providerName: '',
            providerInstitution: '',
            providerAddress: '',
            
            // Clinical data
            clinicalNotes: originalFile.extractedText || '',
            
            // Keep reference to original FHIR data (if any)
            originalFhirData: fhirJsonData || null
        };

        // If we have FHIR data, extract additional fields
        if (fhirJsonData?.entry) {
            const patient = fhirJsonData.entry.find(e => e.resource?.resourceType === 'Patient')?.resource;
            const observations = fhirJsonData.entry.filter(e => e.resource?.resourceType === 'Observation');
            
            // Override base fields with FHIR data
            baseFields.providerName = extractProvider(observations) || baseFields.providerName;
            baseFields.providerInstitution = extractInstitution(observations) || baseFields.providerInstitution;
            baseFields.providerAddress = extractProviderAddress(observations) || baseFields.providerAddress;
            baseFields.clinicalNotes = extractClinicalNotes(observations) || baseFields.clinicalNotes;
            baseFields.originalFhirData = fhirJsonData;
        }

        return baseFields; 
    };

    const handleEditFile = (file) => {
        const fhirJsonData = fhirData.get(file.id);
        const fields = extractEditableFields(fhirJsonData, file);
        setEditedData({ [file.id]: fields });
        setEditingFile(file.id);
        setActiveTab('preview');
    };

    const handleFieldChange = (fileId, fieldName, value) => {
        setEditedData(prev => ({
            ...prev,
            [fileId]: {
                ...prev[fileId],
                [fieldName]: value
            }
        }));
    };

    const handleCancelEdit = () => {
        setEditingFile(null);
        setEditedData(prev => {
            const newData = { ...prev };
            delete newData[editingFile];
            return newData;
        });
    };

    return {
        // State
        editingFile,
        editedData,
        activeTab,
        reviewableFiles,
        
        // Actions
        setActiveTab,
        handleEditFile,
        handleFieldChange,
        handleCancelEdit,
        
        // Utils
        extractEditableFields
        // FIXED: Removed baseFields from return (it's not defined in scope)
    };
};