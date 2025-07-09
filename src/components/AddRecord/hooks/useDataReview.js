import { useState, useMemo, useEffect } from 'react';

export const useDataReview = (processedFiles, fhirData) => {
    const [editingFile, setEditingFile] = useState(null);
    const [editedData, setEditedData] = useState({});
    const [activeTab, setActiveTab] = useState('extracted');

    // Get files that have both extracted text and FHIR data
    const reviewableFiles = useMemo(() => {
        return processedFiles.filter(file => 
            file.status === 'completed' && 
            file.extractedText && 
            fhirData.has(file.id)
        );
    }, [processedFiles, fhirData]);

    //Auto-edit effect for single file
    /* Only auto-edit if
    1. There's exactly one reviewable file
    2. No file is currently being edited
    3. No data has been edited yet for this file */
    useEffect(() => {
        if (reviewableFiles.length === 1 && !editingFile && !editedData[reviewableFiles[0].id]){
            const singleFile = reviewableFiles[0];
            handleEditFile(singleFile);    
        }
    }, [reviewableFiles.length, editingFile, editedData]);

    // Extract editable fields from FHIR data
    const extractEditableFields = (fhirJsonData, originalFile) => {
        if (!fhirJsonData?.entry) return {};

        const patient = fhirJsonData.entry.find(e => e.resource?.resourceType === 'Patient')?.resource;
        const observations = fhirJsonData.entry.filter(e => e.resource?.resourceType === 'Observation');
        
        return {
            // Patient info
            patientName: patient?.name?.[0] 
                ? `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim()
                : '',
            patientId: patient?.identifier?.[0]?.value || '',
            birthDate: patient?.birthDate || '',
            gender: patient?.gender || '',
            
            // Document info
            documentTitle: originalFile.name || '',
            documentType: originalFile.documentType || 'Medical Record',
            documentDate: new Date().toISOString().split('T')[0],
            
            // Provider info
            provider: extractProvider(observations),
            institution: extractInstitution(observations),
            
            // Clinical data
            clinicalNotes: extractClinicalNotes(observations),
            
            // Keep reference to original FHIR data
            originalFhirData: fhirJsonData
        };
    };

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
    };
};