import React, { useState, useEffect, useRef } from 'react';
import { FileText, Check, X, AlertCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Custom hooks
import { useDataReview } from '@/features/EditRecord/hooks/useDataReview';

// Import DynamicFHIRForm
import DynamicFHIRForm from './DynamicFHIRForm';

// UI components
import { TabNavigation } from '../../AddRecord/components/ui/TabNavigation';

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
    const [activeTab, setActiveTab] = useState('preview');
    
    // State for tracking form validation and changes
    const [validationState, setValidationState] = useState({});
    const [currentFhirData, setCurrentFhirData] = useState(new Map());
    
    // Track which files have been edited to prevent overwriting user changes
    const [editedFiles, setEditedFiles] = useState(new Set());
    
    // Use ref to track the last fhirData we initialized from
    const lastInitializedFhirData = useRef(new Map());

    const {
        reviewableFiles
    } = useDataReview(processedFiles, fhirData);

    // Smart initialization that preserves user edits
    useEffect(() => {
        console.log('🔄 Checking if FHIR data initialization is needed...');
        
        // Create a new Map for any files that don't have edits
        const newCurrentFhirData = new Map(currentFhirData);
        let hasChanges = false;

        // Check each file in the incoming fhirData
        fhirData.forEach((data, fileId) => {
            const hasBeenEdited = editedFiles.has(fileId);
            const isNewFile = !lastInitializedFhirData.current.has(fileId);
            const hasDataChanged = JSON.stringify(lastInitializedFhirData.current.get(fileId)) !== JSON.stringify(data);

            // Only update if:
            // 1. It's a completely new file, OR
            // 2. The original data changed AND the user hasn't made edits
            if (isNewFile || (hasDataChanged && !hasBeenEdited)) {
                console.log(`📥 Initializing/updating FHIR data for file ${fileId} (edited: ${hasBeenEdited}, new: ${isNewFile})`);
                newCurrentFhirData.set(fileId, data);
                hasChanges = true;
            } else if (hasBeenEdited) {
                console.log(`🔒 Preserving user edits for file ${fileId}`);
            }
        });

        // Remove any files that are no longer in fhirData
        newCurrentFhirData.forEach((data, fileId) => {
            if (!fhirData.has(fileId)) {
                console.log(`🗑️ Removing data for file ${fileId} (no longer in props)`);
                newCurrentFhirData.delete(fileId);
                setEditedFiles(prev => new Set([...prev].filter(id => id !== fileId)));
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setCurrentFhirData(newCurrentFhirData);
        }

        // Update our reference
        lastInitializedFhirData.current = new Map(fhirData);
    }, [fhirData, editedFiles]);

    useEffect(() => {
        if (reviewableFiles.length === 0) {
            console.log('No files available for review, navigating back to AddRecord');
            if(onResetAll) {
                onResetAll();
            }
        }
    }, [reviewableFiles.length, onResetAll]);

    // MANUAL SAVE: Handle FHIR data updates (only called when user clicks save in form)
    const handleFHIRUpdate = (fileId, updatedFhirData) => {
        console.log('💾 MANUAL SAVE: FHIR data saved for file:', fileId);
        
        // Update the current FHIR data
        setCurrentFhirData(prev => new Map([...prev, [fileId, updatedFhirData]]));
        
        // Mark this file as edited to prevent overwriting
        setEditedFiles(prev => new Set([...prev, fileId]));

        lastInitializedFhirData.current.set(fileId, updatedFhirData);
        
        console.log(`🔒 File ${fileId} marked as edited and saved`);
    };

    // Handle validation state changes from the dynamic form
    const handleValidationChange = (fileId, validation) => {
        setValidationState(prev => ({
            ...prev,
            [fileId]: validation
        }));
    };

    // Function to reset edits for a specific file
    const handleResetFileEdits = (fileId) => {
        console.log(`🔄 Resetting edits for file ${fileId}`);
        
        // Restore original data
        const originalData = fhirData.get(fileId);
        if (originalData) {
            setCurrentFhirData(prev => new Map([...prev, [fileId, originalData]]));
        }
        
        // Remove from edited files
        setEditedFiles(prev => new Set([...prev].filter(id => id !== fileId)));
        
        // Clear validation for this file
        setValidationState(prev => {
            const newState = { ...prev };
            delete newState[fileId];
            return newState;
        });
    };

    const handleConfirmData = async (file) => {
        const fileValidation = validationState[file.id];
        
        // Check if form is valid before confirming
        if (fileValidation && !fileValidation.isValid) {
            alert('Please fix validation errors before confirming');
            return;
        }

        // Check if there are unsaved changes
        if (fileValidation && fileValidation.hasUnsavedChanges) {
            alert('Please save your changes before confirming the data');
            return;
        }

        setIsLoading(true);
        try {
            // Use the updated FHIR data
            const updatedFhirData = currentFhirData.get(file.id);
            
            // Create export data structure
            const exportData = {
                fhirData: updatedFhirData,
                originalFile: file,
                validationState: fileValidation
            };

            // Call the parent's confirmation handler
            if (onDataConfirmed) {
                await onDataConfirmed(file.id, exportData);
            }
            
            console.log('✅ Data confirmed successfully for file:', file.id);
            
        } catch (error) {
            console.error('❌ Error confirming data:', error);
            alert('Error confirming data. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRejectData = (file) => {
        if (onDataRejected) {
            onDataRejected(file.id);
        }
    };

    // If no reviewable files, show empty state
    if (reviewableFiles.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">No files ready for review</p>
                <p>Upload and process files to begin the review process</p>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            <div className="bg-white rounded-lg border shadow-sm">
                <div className="p-6 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">Review Medical Data</h3>
                    <p className="text-gray-600 mt-1">
                        Review and edit the extracted medical information. Remember to save your changes before confirming.
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    {reviewableFiles.map((file) => {
                        const fileValidation = validationState[file.id] || {};
                        const hasErrors = fileValidation.isValid === false;
                        const hasChanges = editedFiles.has(file.id);
                        const hasUnsavedChanges = fileValidation.hasUnsavedChanges === true;

                        return (
                            <div key={file.id} className="border rounded-lg">
                                <div className="p-4 border-b bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <FileText className="w-5 h-5 text-gray-500" />
                                            <div>
                                                <h4 className="font-medium text-gray-900">{file.name}</h4>
                                                <p className="text-sm text-gray-500">
                                                    Status: {file.status}
                                                    {hasUnsavedChanges && <span className="text-amber-600 ml-2">• Unsaved changes</span>}
                                                    {hasChanges && !hasUnsavedChanges && <span className="text-green-600 ml-2">• Saved</span>}
                                                    {!hasChanges && <span className="text-gray-500 ml-2">• Original</span>}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* Reset button for files with changes */}
                                        {hasChanges && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleResetFileEdits(file.id)}
                                                className="text-gray-600 hover:text-gray-800"
                                            >
                                                Reset to Original
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Tab Navigation */}
                                <TabNavigation 
                                    tabs={TABS} 
                                    activeTab={activeTab} 
                                    onTabChange={setActiveTab}
                                    className="border-b"
                                />

                                {/* Tab Content */}
                                <div className="p-4">
                                    {activeTab === 'extracted' && (
                                        <div className="space-y-4">
                                            <h4 className="font-medium text-gray-900">Extracted Text</h4>
                                            <div className="bg-gray-50 p-4 rounded-lg border max-h-96 overflow-y-auto">
                                                <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                                                    {file.extractedText || 'No extracted text available'}
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
                                            </div>
                                            
                                            <DynamicFHIRForm
                                                fhirData={currentFhirData.get(file.id) || fhirData.get(file.id)}
                                                originalFile={file}
                                                onFHIRUpdate={(updatedFhir) => handleFHIRUpdate(file.id, updatedFhir)}
                                                onValidationChange={(validation) => handleValidationChange(file.id, validation)}
                                                showSaveButton={true}
                                                autoSaveOnBlur={false}
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
                                                    Please fix validation errors
                                                </div>
                                            )}
                                            
                                            {hasUnsavedChanges && (
                                                <div className="flex items-center text-amber-600 text-sm">
                                                    <Save className="w-4 h-4 mr-1" />
                                                    Save your changes before confirming
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex space-x-3">
                                            <Button
                                                variant="outline"
                                                onClick={() => handleRejectData(file)}
                                                disabled={isLoading}
                                            >
                                                <X className="w-4 h-4 mr-2" />
                                                Reject
                                            </Button>
                                            <Button
                                                onClick={() => handleConfirmData(file)}
                                                disabled={hasErrors || hasUnsavedChanges || isLoading}
                                                loading={isLoading}
                                            >
                                                <Check className="w-4 h-4 mr-2" />
                                                Confirm & Save
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default DataReviewSection;