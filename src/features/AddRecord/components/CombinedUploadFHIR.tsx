import React, { useState, useCallback } from 'react';
import { FileText, Upload, Code, MessageSquare, AlertCircle, CheckCircle, ExternalLink, RefreshCw, X } from 'lucide-react';
import FileUploadZone from './ui/FileUploadZone';
import { FileListItem } from './FileListItem';
import { TabNavigation } from './ui/TabNavigation';
import { toast } from 'sonner';

// Import the fixed types
import type {
  CombinedUploadFHIRProps,
  FHIRValidation,
  TabType,
} from './CombinedUploadFHIR.type';

import type { FHIRWithValidation } from '../services/fhirConversionService.type';
import { FileObject, UploadResult } from '@/types/core';
import { Button } from '@/components/ui/Button';

const TABS = [
  { 
    id: 'upload', 
    label: 'File Upload',
    icon: Upload 
  },
  { 
    id: 'text', 
    label: 'Text Input',
    icon: MessageSquare 
  },
  { 
    id: 'fhir', 
    label: 'FHIR Data',
    icon: Code 
  }
];

const CombinedUploadFHIR: React.FC<CombinedUploadFHIRProps> = ({
  // File management props
  files,
  addFiles,
  confirmFile,
  removeFile,
  removeFileFromLocal,
  retryFile,
  getStats,
  updateFileStatus,
  
  // Direct upload functions
  addFhirAsVirtualFile,
  uploadFiles,
  convertTextToFHIR,

  //FHIR props
  fhirData,
  onFHIRConverted,
  
  // Configuration props
  acceptedTypes = ['.pdf', '.docx', '.doc', '.txt', '.jpg', '.jpeg', '.png'],
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
  className = ''
}) => {

  //DEBUG LOGGING
  console.log('🔍 CombinedUploadFHIR props check:');
  console.log('🔍 updateFileStatus:', typeof updateFileStatus, updateFileStatus);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as TabType);
  }
  
  // FHIR input state
  const [fhirText, setFhirText] = useState<string>('');
  const [fhirValidation, setFhirValidation] = useState<FHIRValidation | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Plain text input state
  const [plainText, setPlainText] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [submittingText, setSubmittingText] = useState<boolean>(false);

  // Determine which section to show. Input section if no files. FileList if yes files
  const stats = getStats();
  const hasFiles = files.length > 0;
  const allFilesCompleted = hasFiles && stats.completed === stats.total && stats.errors === 0;
  const hasErrors = stats.errors > 0;

  // Handle file selection
  const handleFilesSelected = (fileList: FileList): void => {
    try {
      addFiles(fileList, { maxFiles, maxSizeBytes });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(errorMessage);
    }
  };

  // Keeps files, starts uploading things all over again
  const handleStartOver = () => {
    // Remove all files
    files.forEach(file => removeFileFromLocal(file.id));
    
    // Reset form states
    setFhirText('');
    setFhirValidation(null);
    setPlainText('');
    setPatientName('');
    setSubmitting(false);
    setSubmittingText(false);
    
    // Reset to upload tab
    setActiveTab('upload');
  };

  //Cancels uploads and deletes any files from session. 
  const handleCancelandDelete = () => {
    // Remove all files
    files.forEach(file => removeFile(file.id));
  };

  const handleConfirm = useCallback((fileId: string) => {
    //Confirm individual item and remove from processing list
    console.log(`File Confirmed, Removing individual file from processing list: ${fileId}`);
    removeFileFromLocal(fileId);
  }, [removeFileFromLocal]);

  // Validate FHIR JSON
  const validateFhirJson = (jsonString: string): FHIRValidation => {
    try {
      const parsed = JSON.parse(jsonString);
      
      if (!parsed.resourceType) {
        return { valid: false, error: 'Missing resourceType field' };
      }
      
      if (parsed.resourceType === 'Bundle') {
        if (!parsed.entry || !Array.isArray(parsed.entry)) {
          return { valid: false, error: 'Bundle must have an entry array' };
        }
        const resourceTypes = parsed.entry
          .map((e: any) => e.resource?.resourceType)
          .filter((type: any): type is string => typeof type === 'string') as string[];
        
        return { 
          valid: true, 
          resourceType: 'Bundle',
          entryCount: parsed.entry.length,
          resourceTypes: [...new Set(resourceTypes)]
        };
      } else {
        return { 
          valid: true, 
          resourceType: parsed.resourceType,
          isSingleResource: true
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { valid: false, error: `Invalid JSON: ${errorMessage}` };
    }
  };

  // Handle FHIR text changes
  const handleFhirTextChange = (value: string): void => {
    setFhirText(value);
    
    if (value.trim()) {
      const validation = validateFhirJson(value);
      setFhirValidation(validation);
    } else {
      setFhirValidation(null);
    }
  };

  // Submit FHIR data and immediately upload to Firestore
const handleFileComplete = async (fileItem: FileObject): Promise<void> => {
  console.log('🚨 handleFileComplete called for:', fileItem.name, 'status:', fileItem.status);
  
  if (!updateFileStatus) {
    console.error('❌ updateFileStatus is not available in handleFileComplete');
    return;
  }

  // 🚨 PREVENT MULTIPLE UPLOADS - Check if already uploaded or uploading
  if (fileItem.documentId || fileItem.uploadInProgress === true) {
    console.log('⏭️ Skipping upload - already processed:', {
      documentId: fileItem.documentId,
      uploadInProgress: fileItem.uploadInProgress
    });
    return;
  }
  
  // Only upload if file is completed and has extracted text
  // FHIR data is now already attached to the file during processing! 🎉
  if (fileItem.status === 'completed' && fileItem.extractedText) {
    try {
      // Mark as upload in progress to prevent duplicate calls
      updateFileStatus(fileItem.id, 'uploading', { uploadInProgress: true });
      
      console.log('🚀 Auto-uploading completed file with FHIR data:', fileItem.name);      
      console.log('🏥 File has FHIR data:', !!fileItem.fhirData);
      
      // Upload the file - it now includes both text AND FHIR data! 🎯
      const uploadResults: UploadResult[] = await uploadFiles([fileItem.id]);

      if (uploadResults && uploadResults[0]?.success) {
        console.log('✅ File and FHIR data uploaded together successfully!', fileItem.name);
        
        updateFileStatus(fileItem.id, 'completed', {
          documentId: uploadResults[0].documentId,
          uploadedAt: new Date().toISOString(),
          uploadInProgress: false // Clear the flag
        });

        // 🎉 SUCCESS - Both file content and FHIR data are now in Firestore!
        console.log('🎯 Complete pipeline successful: File → Text → FHIR → Firestore');

      } else {
        throw new Error('Upload failed - no success result')
      }
    } catch (error) {
      console.error('🔍 Error in handleFileComplete:', error);
      updateFileStatus(fileItem.id, 'completed', {
        error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        uploadInProgress: false // Clear the flag
      });
    }
  }
};

const handleTextSubmit = async (): Promise<void> => {
  if (!plainText.trim()) return;

  setSubmittingText(true);
  try {
    console.log('🎯 Converting plain text to FHIR...');
    let fhirData: FHIRWithValidation;

    if (convertTextToFHIR) {
      fhirData = await convertTextToFHIR(plainText, patientName || undefined);
    } else {
       // Fallback: Create a simple FHIR Bundle with the text as a note
        fhirData = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            resource: {
              resourceType: 'DocumentReference',
              status: 'current',
              content: [{
                attachment: {
                  contentType: 'text/plain',
                  data: btoa(plainText) // base64 encode
                }
              }],
              description: `Medical note${patientName ? ` for ${patientName}` : ''}`,
              date: new Date().toISOString()
            }
          }
        ],
        _validation: {
          isValid: true,
          hasErrors: false,
          hasWarnings: false,
          errors: [],
          warnings: [],
          info: [],
          validatedAt: new Date().toISOString(),
          validatorVersion: '1.0.0'
        }
      };
    }

      // Create virtual file with FHIR data
      const { fileId, virtualFile } = await addFhirAsVirtualFile(fhirData, {
        name: `Medical Note${patientName ? ` - ${patientName}` : ''} - ${new Date().toLocaleDateString()}`,
        documentType: 'medical_note_from_text'
      });

      console.log('✅ Plain text converted to FHIR successfully');
      
      // Clear the form
      setPlainText('');
      setPatientName('');
    
    } catch (error) {
      console.error('❌ Error converting text to FHIR:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to convert text to FHIR: ${errorMessage}`);
    } finally {
      setSubmittingText(false);
    }
  };

const handleFhirSubmit = async (): Promise<void> => {
  if (!fhirText.trim() || !fhirValidation?.valid) return;
  
  setSubmitting(true);
  try {
    const fhirData: FHIRWithValidation = JSON.parse(fhirText);
    
    console.log('🎯 Submitting FHIR data directly to Firestore');
    
    // Step 1: Create virtual file with FHIR data
    const { fileId, virtualFile } = await addFhirAsVirtualFile(fhirData, {
      name: `Manual FHIR Input - ${fhirData.resourceType}`,
      documentType: 'fhir_manual_input'
    });
    
    console.log('📤 Uploading FHIR data to Firestore...');
    
    await uploadFiles([fileId]);
    
    console.log('✅ FHIR data uploaded successfully');
    
    // Clear the form
    setFhirText('');
    setFhirValidation(null);
    
    // Show success message
    toast.success('✅ FHIR data uploaded successfully!', {
    description: 'Your FHIR Data is now in your Comprehensive Health Record',
    duration: 4000,});
    
  } catch (error) {
    console.error('❌ Error submitting FHIR data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    alert(`Failed to upload FHIR data: ${errorMessage}`);
  } finally {
    setSubmitting(false);
  }
};


const handleRetryFile = (fileItem: FileObject): void => {
  retryFile(fileItem.id);
};

return (
  <div className={`space-y-6 ${className}`}>
    {/* Main Container */}
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Add Health Records</span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {hasFiles 
                ? 'Processing your files...' 
                : 'Upload documents, type medical notes, or input FHIR data - everything gets saved automatically'
              }
            </p>
          </div>
          
          {/* Add More Files Button - only show when files are present - resets to the main page */}
          {hasFiles && (
            <div className="flex items-center space-x-2 px-4 py-2">
              <Button
                variant="outline"
                onClick={() => {handleCancelandDelete(); handleStartOver();}}
              >
                <X className="w-4 h-4"/>
                <span>Cancel Upload</span>
              </Button>
              <Button
                variant="default"
                onClick={handleStartOver}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Add More Files</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 🔥 CONDITIONAL CONTENT: Files OR Input Interface */}
      {hasFiles ? (
        /* FILE PROCESSING VIEW */
        <>
          <div className="p-4 border-b bg-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {allFilesCompleted ? 'All Files Processed!' : 'Processing Files'}
                </h3>
              </div>
              <div className="text-sm text-gray-600">
                {stats.completed} of {stats.total} completed
                {stats.processing > 0 && (
                  <span className="ml-2 text-blue-600 font-medium">
                    ({stats.processing} processing)
                  </span>
                )}
                {hasErrors && (
                  <span className="ml-2 text-red-600 font-medium">
                    ({stats.errors} errors)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* File List */}
            {files.map((fileItem: FileObject) => {
              const fhirResult = fileItem.fhirData ? {
                success: true,
                fhirData: fileItem.fhirData,
                error: undefined
              } : undefined;

              return (
                <FileListItem
                  key={fileItem.id}
                  fileItem={fileItem}
                  fhirResult={fhirResult}
                  onConfirm={handleConfirm}
                  onRemove={removeFile}
                  onRetry={handleRetryFile}
                  onComplete={handleFileComplete}
                  showFHIRResults={true}
                />
              );
            })}
          </div>

          {/* Success/Actions Footer */}
          {allFilesCompleted && (
            <div className="bg-green-50 px-4 py-3 border-t border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-green-800">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">All files processed successfully!</span>
                </div>
                <a 
                  href="/edit-fhir" 
                  className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  <span>View Records</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </>
      ) : (
        /* INPUT INTERFACE */
        <>
          <div className="p-4 pb-0">
            <TabNavigation 
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </div>
          
          <div className="p-6">
            {/* File Upload Tab */}
            {activeTab === 'upload' && (
              <div>
                <FileUploadZone
                  onFilesSelected={handleFilesSelected}
                  acceptedTypes={acceptedTypes}
                  maxFiles={maxFiles}
                  maxSizeBytes={maxSizeBytes}
                  title="Drop medical documents here or click to upload"
                  subtitle="Files will be processed and automatically saved to your cloud storage"
                />
              </div>
            )}

            {/* Plain Text Input Tab */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medical Note or Description
                  </label>
                  <textarea
                    value={plainText}
                    onChange={(e) => setPlainText(e.target.value)}
                    placeholder={
                      `Describe what happened during the medical visit...

  Examples:
  • "Had routine checkup with Dr. Smith. Blood pressure was 120/80. Everything looks normal."
  • "Visited urgent care for sore throat. Prescribed amoxicillin 500mg, take twice daily for 10 days."
  • "Follow-up appointment for diabetes. HbA1c improved to 7.2%. Continue current medication."
  • "Annual physical exam completed. All vitals within normal range. Recommended yearly mammogram."`}
                    className="w-full bg-background h-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    disabled={submittingText}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Your text will be automatically converted to medical FHIR format and saved.
                  </div>
                  
                  <button
                    onClick={handleTextSubmit}
                    disabled={!plainText.trim() || submittingText}
                    className={`px-6 py-2 rounded-lg font-medium ${
                      plainText.trim() && !submittingText
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {submittingText ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Converting...</span>
                      </div>
                    ) : (
                      'Save Medical Note'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* FHIR Input Tab */}
            {activeTab === 'fhir' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    FHIR JSON Data
                  </label>
                  <textarea
                    value={fhirText}
                    onChange={(e) => handleFhirTextChange(e.target.value)}
                    placeholder={`Paste your FHIR JSON here...

Example:
{
"resourceType": "Bundle",
"type": "collection",
"entry": [
  {
    "resource": {
      "resourceType": "Patient",
      "name": [{"family": "Smith", "given": ["John"]}],
      "birthDate": "1990-01-01"
    }
  }
]
}`}
                    className="w-full h-64 px-3 py-2 bg-background border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    disabled={submitting}
                  />
                </div>

                {/* Validation Display */}
                {fhirValidation && (
                  <div className={`p-3 rounded-lg border ${
                    fhirValidation.valid 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {fhirValidation.valid ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className={`font-medium ${
                        fhirValidation.valid ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {fhirValidation.valid ? 'Valid FHIR Data' : 'Invalid FHIR Data'}
                      </span>
                    </div>
                    
                    {fhirValidation.error && (
                      <p className="text-red-700 text-sm mt-1">{fhirValidation.error}</p>
                    )}
                    
                    {fhirValidation.valid && (
                      <div className="text-green-700 text-sm mt-1">
                        Resource Type: {fhirValidation.resourceType}
                        {fhirValidation.entryCount && (
                          <span> • {fhirValidation.entryCount} entries</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleFhirSubmit}
                    disabled={!fhirValidation?.valid || submitting}
                    className={`px-6 py-2 rounded-lg font-medium ${
                      fhirValidation?.valid && !submitting
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {submitting ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Uploading...</span>
                      </div>
                    ) : (
                      'Upload FHIR Data'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  </div>
);
};

export default CombinedUploadFHIR;