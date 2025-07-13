import React, { useState, useEffect } from 'react';
import { Eye, FileText, Stethoscope, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Custom hooks
import { useDataReview } from '../hooks/useDataReview';

// Form component
import UploadEditForms from './UploadEditForms';

// UI components
import { TabNavigation } from './ui/TabNavigation';

const TABS = [
    { id: 'extracted', label: 'Extracted Text' },
    { id: 'fhir', label: 'FHIR Data' },
    { id: 'preview', label: 'Edit & Preview' }
];

export const DataReviewSection = ({
    processedFiles = [],
    fhirData = new Map(),
    onDataConfirmed,
    onDataRejected,
    onResetAll,
    className = ''
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('preview'); // Default to preview tab
    const [editedData, setEditedData] = useState({});
    
    const {
        reviewableFiles,
        extractEditableFields
    } = useDataReview(processedFiles, fhirData);

    useEffect(() => {
        if (reviewableFiles.length > 0) {
            const newEditedData = {};
            reviewableFiles.forEach(file => {
                if (!editedData[file.id]) {
                    const fhirJsonData = fhirData.get(file.id);
                    newEditedData[file.id] = extractEditableFields(fhirJsonData, file);
                }
            });
            
            if (Object.keys(newEditedData).length > 0) {
                setEditedData(prev => ({ ...prev, ...newEditedData }));
            }
        }
    }, [reviewableFiles, fhirData, extractEditableFields]);

    useEffect(() => {
        if (reviewableFiles.length === 0) {
            console.log('No files available for review, navigating back to AddRecord');
            if(onResetAll) {
                onResetAll();
            }
        }
    }, [reviewableFiles.length, onResetAll]);

    const handleConfirmData = async (fileId) => {
        setIsLoading(true);
        try {
            const dataToSave = editedData[fileId];
            if (onDataConfirmed) {
                await onDataConfirmed(fileId, dataToSave);
            }
        } catch (error) {
            console.error('Error confirming data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRejectData = (fileId) => {
        if (onDataRejected) {
            onDataRejected(fileId);
        }
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


 return (
        <div className={`space-y-6 ${className}`}>
            <div className="bg-white rounded-lg shadow-sm border">   
                <SectionHeader />             
                <div className="p-6">
                    {reviewableFiles.map((file) => (
                        <div key={file.id} className="border rounded-lg p-4 mb-4">
                            {/* ✅ SIMPLIFIED: Always show tabs, no editing state needed */}
                            <TabNavigation 
                                activeTab={activeTab} 
                                onTabChange={setActiveTab} 
                                tabs={TABS} 
                            />
                            
                            <div className="mt-4">
                                {activeTab === 'extracted' && (
                                    <ExtractedTextView 
                                        file={file} 
                                        onReject={() => handleRejectData(file.id)} 
                                        isLoading={isLoading} 
                                    />
                                )}
                                
                                {activeTab === 'fhir' && (
                                    <FhirDataView 
                                        fhirData={fhirData.get(file.id)} 
                                        onReject={() => handleRejectData(file.id)} 
                                        isLoading={isLoading} 
                                    />
                                )}
                                
                                {activeTab === 'preview' && editedData[file.id] && (
                                    <EditablePreview 
                                        data={editedData[file.id]} 
                                        onChange={(fieldName, value) => handleFieldChange(file.id, fieldName, value)}
                                        onConfirm={() => handleConfirmData(file.id)}
                                        onReject={() => handleRejectData(file.id)}
                                        isLoading={isLoading}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Supporting Components

const SectionHeader = () => (
    <div className="p-4 border-b">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <span>Review & Edit Data</span>
        </h2>
        <p className="text-sm text-gray-600 mt-1">
            Review the extracted and converted data before saving to your health records
        </p>
    </div>
);

const ExtractedTextView = ({ file, onReject, isLoading }) => (
    <div className="bg-supplement-4/30 p-4 rounded-lg space-y-6">
        <h4 className="font-medium text-gray-900 mb-2 flex items-center">
            <FileText className="w-4 h-4 mr-2" />
            Extracted Text
        </h4>
        <div className="bg-white p-3 rounded border max-h-64 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-700">
                {file.extractedText}
            </pre>
        </div>
        <div className = "flex justify-end space-x-3">
        <Button
            variant="outline"
            onClick={onReject}
            disabled={isLoading}>
            <X className="w-4 h-4" />
            <span>Cancel</span>
        </Button>
        </div>
    </div>
);

const FhirDataView = ({ fhirData, onReject, isLoading }) => (
    <div className="bg-card p-4 rounded-lg space-y-6">
        <h4 className="font-medium text-gray-900 mb-2 flex items-center">
            <Stethoscope className="w-4 h-4 mr-2" />
            FHIR Data
        </h4>
        <div className="bg-white p-3 rounded border max-h-64 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-xs text-gray-700">
                {JSON.stringify(fhirData, null, 2)}
            </pre>
        </div>
        <div className = "flex justify-end space-x-3">
        <Button
            variant="outline"
            onClick={onReject}
            disabled={isLoading}>
            <X className="w-4 h-4" />
            <span>Cancel</span>
        </Button>
        </div>
    </div>
);

const EditablePreview = ({ data, onChange, onConfirm, onReject, isLoading }) => (
    <div className="space-y-6">
        <UploadEditForms data={data} onChange={onChange} />
        <div className = "flex justify-end space-x-3">
        <Button
            variant="outline"
            onClick={onReject}
            disabled={isLoading}>
            <X className="w-4 h-4" />
            <span>Cancel</span>
        </Button>
        <Button
            onClick={onConfirm}
            disabled={isLoading}>
            <Check className="w-4 h-4" />
            <span>{isLoading ? 'Saving...' : 'Confirm & Save'}</span> 
        </Button>
        </div>
    </div>
);

export default DataReviewSection;