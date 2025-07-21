import React, { useState, useEffect } from 'react';
import { FileText, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Custom hooks
import { useDataReview } from '../hooks/useDataReview';

// Import DynamicFHIRForm
import DynamicFHIRForm from './DynamicFHIRForm';

// UI components
import { TabNavigation } from './ui/TabNavigation';

const TABS = [
    { id: 'extracted', label: 'Extracted Text' },
    { id: 'fhir', label: 'FHIR Data' },
    { id: 'preview', label: 'Edit & Preview' }
];

const DataReviewSection = ({
    processedFiles = [],
    fhirData = new Map(),
    onDataConfirmed,
    onDataRejected,
    onResetAll,
    className = ''
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('preview'); // Default to preview tab
    
    // NEW: State for tracking form validation and changes
    const [validationState, setValidationState] = useState({});
    const [currentFhirData, setCurrentFhirData] = useState(new Map());
    
    const {
        reviewableFiles
    } = useDataReview(processedFiles, fhirData);

    // Initialize current FHIR data from props
    useEffect(() => {
        setCurrentFhirData(new Map(fhirData));
    }, [fhirData]);

    useEffect(() => {
        if (reviewableFiles.length === 0) {
            console.log('No files available for review, navigating back to AddRecord');
            if(onResetAll) {
                onResetAll();
            }
        }
    }, [reviewableFiles.length, onResetAll]);

    // NEW: Handle FHIR data updates from the dynamic form
    const handleFHIRUpdate = (fileId, updatedFhirData) => {
        console.log('FHIR data updated for file:', fileId, updatedFhirData);
        setCurrentFhirData(prev => new Map([...prev, [fileId, updatedFhirData]]));
    };

    // NEW: Handle validation state changes from the dynamic form
    const handleValidationChange = (fileId, validation) => {
        setValidationState(prev => ({
            ...prev,
            [fileId]: validation
        }));
    };

    const handleConfirmData = async (file) => {
        const fileValidation = validationState[file.id];
        
        // Check if form is valid before confirming
        if (fileValidation && !fileValidation.isValid) {
            alert('Please fix validation errors before confirming');
            return;
        }

        setIsLoading(true);
        try {
            // Use the updated FHIR data instead of old editedData
            const updatedFhirData = currentFhirData.get(file.id);
            
            // Create export data that includes both original file info and updated FHIR
            const exportData = {
                fileId: file.id,
                fileName: file.name,
                originalFile: file,
                fhirData: updatedFhirData,
                changes: fileValidation?.changes || {},
                confirmedAt: new Date().toISOString()
            };
            
            await onDataConfirmed(file.id, exportData);
        } catch (error) {
            console.error('Error confirming data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRejectData = async (file) => {
        setIsLoading(true);
        try {
            await onDataRejected(file.id);
        } catch (error) {
            console.error('Error rejecting data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!reviewableFiles || reviewableFiles.length === 0) {
        return (
            <div className={`text-center py-8 ${className}`}>
                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Files to Review</h3>
                <p className="text-gray-600">
                    Upload and process some documents to see them here for review.
                </p>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Review & Edit Data
                </h2>
                <p className="text-gray-600">
                    Review the extracted data, make any necessary edits, and confirm to save to your records
                </p>
            </div>

            {reviewableFiles.map((file) => {
                const fileValidation = validationState[file.id] || {};
                const hasChanges = fileValidation.isDirty;
                const hasErrors = !fileValidation.isValid;

                return (
                    <div key={file.id} className="bg-white rounded-lg shadow-sm border">
                        {/* File Header */}
                        <div className="p-4 border-b bg-gray-50 rounded-t-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                    <div>
                                        <h3 className="font-medium text-gray-900">{file.name}</h3>
                                        <p className="text-sm text-gray-600">
                                            {file.documentType || 'Medical Document'}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Status Indicators */}
                                <div className="flex items-center space-x-2">
                                    {hasChanges && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            Modified
                                        </span>
                                    )}
                                    {hasErrors && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                            Errors
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div className="border-b">
                            <TabNavigation 
                                tabs={TABS} 
                                activeTab={activeTab} 
                                onTabChange={setActiveTab} 
                            />
                        </div>

                        {/* Tab Content */}
                        <div className="p-6">
                            {activeTab === 'extracted' && (
                                <div className="space-y-4">
                                    <h4 className="font-medium text-gray-900">Extracted Text</h4>
                                    <div className="bg-gray-50 p-4 rounded-lg border max-h-96 overflow-y-auto">
                                        <pre className="whitespace-pre-wrap text-sm text-gray-700">
                                            {file.extractedText || 'No text extracted from this file.'}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'fhir' && (
                                <div className="space-y-4">
                                    <h4 className="font-medium text-gray-900">FHIR Data</h4>
                                    <div className="bg-gray-50 p-4 rounded-lg border max-h-96 overflow-y-auto">
                                        <pre className="text-xs text-gray-700">
                                            {JSON.stringify(
                                                currentFhirData.get(file.id) || fhirData.get(file.id), 
                                                null, 
                                                2
                                            )}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'preview' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-gray-900">Edit Medical Data</h4>
                                        {hasChanges && (
                                            <span className="text-sm text-blue-600">
                                                {Object.keys(fileValidation.changes || {}).length} fields modified
                                            </span>
                                        )}
                                    </div>
                                    
                                    <DynamicFHIRForm
                                        fhirData={currentFhirData.get(file.id) || fhirData.get(file.id)}
                                        originalFile={file}
                                        onFHIRUpdate={(updatedFhir) => handleFHIRUpdate(file.id, updatedFhir)}
                                        onValidationChange={(validation) => handleValidationChange(file.id, validation)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    {hasErrors && (
                                        <div className="flex items-center text-red-600 text-sm">
                                            <AlertCircle className="w-4 h-4 mr-1" />
                                            Please fix errors before confirming
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex space-x-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => handleRejectData(file)}
                                        disabled={isLoading}
                                        className="flex items-center space-x-2"
                                    >
                                        <X className="w-4 h-4" />
                                        <span>Reject</span>
                                    </Button>
                                    
                                    <Button
                                        onClick={() => handleConfirmData(file)}
                                        disabled={isLoading || hasErrors}
                                        className="flex items-center space-x-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        <span>
                                            {isLoading ? 'Confirming...' : 'Confirm & Save'}
                                        </span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default DataReviewSection;