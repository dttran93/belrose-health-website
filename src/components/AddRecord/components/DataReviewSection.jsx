import React, { useState, useEffect } from 'react';
import { Eye, Edit3, FileText, Stethoscope, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';

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
    originalUploadCount = 0,
    onDataConfirmed,
    onDataRejected,
    onResetAll,
    className = ''
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    
    const {
        editingFile,
        editedData,
        activeTab,
        reviewableFiles,
        setActiveTab,
        handleEditFile,
        handleFieldChange,
        handleCancelEdit
    } = useDataReview(processedFiles, fhirData, originalUploadCount);

    useEffect(() => {
    if (reviewableFiles.length === 0) {
        console.log('No files available for review, navigating back to AddRecord');
        if(onResetAll) {
            onResetAll();
        }
        navigate('/dashboard/addrecord', { replace: true });
    }
    }, [reviewableFiles.length, navigate, onResetAll]);

    const handleConfirmData = async (fileId) => {
        setIsLoading(true);
        try {
            const dataToSave = editedData[fileId];
            if (onDataConfirmed) {
                await onDataConfirmed(fileId, dataToSave);
            }
            handleCancelEdit();
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
        handleCancelEdit();
    };

    // Helper function to handle field changes for a specific file
    const createFieldChangeHandler = (fileId) => (fieldName, value) => {
        handleFieldChange(fileId, fieldName, value);
    };

    const isSingleFileMode = originalUploadCount === 1;
    console.log('Debug isSingleFileMode:', {
    originalUploadCount,
    processedFilesLength: processedFiles.length,
    editingFile,
    isSingleFileMode });

    return (
        <div className={`space-y-6 ${className}`}>
            <div className="bg-white rounded-lg shadow-sm border">
                <SectionHeader 
                    isSingleFileMode={isSingleFileMode}
                    fileName={isSingleFileMode ? reviewableFiles[0]?.name : null}
                    onBackToList={isSingleFileMode ? handleCancelEdit : null}
                />
                
                <div className="p-6">
                    {reviewableFiles.map((file) => (
                        <FileReviewCard
                            key={file.id}
                            file={file}
                            isEditing={editingFile === file.id}
                            editedData={editedData[file.id]}
                            fhirData={fhirData.get(file.id)}
                            activeTab={activeTab}
                            onEditFile={handleEditFile}
                            onFieldChange={createFieldChangeHandler(file.id)}
                            onTabChange={setActiveTab}
                            onConfirm={() => handleConfirmData(file.id)}
                            onReject={() => handleRejectData(file.id)}
                            isLoading={isLoading}
                            isSingleFileMode={isSingleFileMode}
                        />
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

const FileReviewCard = ({
    file,
    isEditing,
    editedData,
    fhirData,
    activeTab,
    onEditFile,
    onFieldChange,
    onTabChange,
    onConfirm,
    onReject,
    isLoading,
    isSingleFileMode = false
}) => (
    <div className={isSingleFileMode ? "" : "border rounded-lg p-4 mb-4"}>
        {(!isSingleFileMode) && (
        <FileHeader 
            file={file} 
            isEditing={isEditing} 
            onEditFile={() => onEditFile(file)} 
        /> 
        )}
        
        {isEditing ? (
            <EditingView
                file={file}
                editedData={editedData}
                fhirData={fhirData}
                activeTab={activeTab}
                onFieldChange={onFieldChange}
                onTabChange={onTabChange}
                onConfirm={onConfirm}
                onReject={onReject}
                isLoading={isLoading}
            />
        ) : (
            <ReadOnlyView file={file} fhirData={fhirData} />
        )}
    </div>
);

const FileHeader = ({ file, isEditing, onEditFile }) => (
    <div className="flex justify-between items-start mb-4">
        <div>
            <h3 className="font-medium text-gray-900">{file.name}</h3>
            <p className="text-sm text-gray-500">
                {file.documentType} • {(file.file.size / 1024).toFixed(1)} KB
            </p>
        </div>
        
        {!isEditing && (
            <button
                onClick={onEditFile}
                className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-1 text-sm"
            >
                <Edit3 className="w-4 h-4" />
                <span>Review & Edit</span>
            </button>
        )}
    </div>
);

const EditingView = ({
    file,
    editedData,
    fhirData,
    activeTab,
    onFieldChange,
    onTabChange,
    onConfirm,
    onReject,
    isLoading
}) => (
    <>
        <TabNavigation 
            activeTab={activeTab} 
            onTabChange={onTabChange} 
            tabs={TABS} 
        />
        
        <div className="mt-4">
            {activeTab === 'extracted' && <ExtractedTextView file={file} onReject={onReject} isLoading={isLoading} />}
            {activeTab === 'fhir' && <FhirDataView fhirData={fhirData} onReject={onReject} isLoading={isLoading} />}
            {activeTab === 'preview' && editedData && (
                <EditablePreview 
                    data={editedData} 
                    onChange={onFieldChange}
                    onConfirm={onConfirm}
                    onReject={onReject}
                    isLoading={isLoading}
                />
            )}
        </div>
    </>
);

const ReadOnlyView = ({ file, fhirData }) => (
    <div className="text-sm text-gray-600">
        <div className="flex justify-between">
            <span>Status: Ready for review</span>
            <span>FHIR entries: {fhirData?.entry?.length || 0}</span>
        </div>
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