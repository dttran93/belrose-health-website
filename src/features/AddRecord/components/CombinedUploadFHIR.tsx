import React, { useState, useCallback, useRef } from 'react';
import {
  FileText,
  Upload,
  Code,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  X,
  SquarePen,
} from 'lucide-react';
import FileUploadZone from './ui/FileUploadZone';
import { FileListItem } from './FileListItem';
import { TabNavigation } from './ui/TabNavigation';
import { toast } from 'sonner';
import { FileObject } from '@/types/core';
import { Button } from '@/components/ui/Button';

// Import the fixed types
import type { CombinedUploadFHIRProps, FHIRValidation, TabType } from './CombinedUploadFHIR.type';
import type { FHIRWithValidation } from '../services/fhirConversionService.type';

const TABS = [
  {
    id: 'upload',
    label: 'File Upload',
    icon: Upload,
  },
  {
    id: 'text',
    label: 'Text Input',
    icon: MessageSquare,
  },
  {
    id: 'fhir',
    label: 'FHIR Data',
    icon: Code,
  },
  {
    id: 'manual',
    label: 'Manual Record',
    icon: SquarePen,
  },
];

// Helper to format file size
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const CombinedUploadFHIR: React.FC<CombinedUploadFHIRProps> = ({
  // File management props
  files,
  addFiles,
  removeFile,
  removeFileFromLocal,
  retryFile,
  getStats,
  updateFileStatus,
  onReview,
  processFile,
  uploadFiles,

  // Direct upload functions
  addFhirAsVirtualFile,
  convertTextToFHIR,

  // Configuration props
  acceptedTypes = ['.pdf', '.docx', '.doc', '.txt', '.jpg', '.jpeg', '.png'] as string[],
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
  className = '',
}) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as TabType);
  };

  // FHIR input state
  const [fhirText, setFhirText] = useState<string>('');
  const [fhirValidation, setFhirValidation] = useState<FHIRValidation | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Plain text input state (context)
  const [contextText, setContextText] = useState<string>('');

  // Plain text input state
  const [plainText, setPlainText] = useState<string>('');
  const [submittingText, setSubmittingText] = useState<boolean>(false);

  //Track files while processing
  const [processing, setProcessing] = useState<boolean>(false);

  // Determine which section to show. Input section if no files. FileList if yes files
  const stats = getStats();
  const hasProcessingFiles = files.length > 0;
  const allFilesCompleted =
    hasProcessingFiles && stats.completed === stats.total && stats.errors === 0;
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

  // Get pending (attached but not yet processed) files
  const pendingFiles = files.filter(f => f.status === 'pending');
  const hasAttachedFiles = pendingFiles.length > 0;

  // Handle removing an attached file before processing
  const handleRemoveAttached = (fileId: string) => {
    removeFileFromLocal(fileId);
    toast.info('File removed');
  };

  // Handle "Process & Upload" button click
  const handleProcessAndUpload = async () => {
    if (!hasAttachedFiles) {
      toast.error('No files attached');
      return;
    }

    setProcessing(true);

    try {
      console.log('🚀 Starting to process attached files...');
      console.log(
        '📋 Pending files:',
        pendingFiles.map(f => ({
          id: f.id,
          name: f.fileName,
          hasFile: !!f.file,
          status: f.status,
        }))
      );

      const processedFiles: FileObject[] = []; // ✅ Collect processed files here

      // Step 1: Process each pending file
      for (const fileObj of pendingFiles) {
        console.log(`📋 Processing file: ${fileObj.fileName}`);
        console.log('🔍 File object BEFORE processing:', {
          id: fileObj.id,
          hasFile: !!fileObj.file,
          hasEncryptedData: !!fileObj.encryptedData,
          status: fileObj.status,
        });

        // Add context if provided
        if (contextText.trim()) {
          updateFileStatus(fileObj.id, 'pending', {
            originalText: contextText.trim(),
          });
        }

        // Make sure fileObj still has the File reference
        if (!fileObj.file) {
          throw new Error(`File object missing for ${fileObj.fileName}`);
        }

        // ✅ GET THE RETURN VALUE - don't look at state!
        const processedFile = await processFile(fileObj);
        processedFiles.push(processedFile); // ✅ Save it!

        // 🔍 Check the RETURNED file object
        console.log('🔍 File object AFTER processing (from return):', {
          id: processedFile.id,
          hasEncryptedData: !!processedFile.encryptedData,
          encryptedDataKeys: processedFile.encryptedData
            ? Object.keys(processedFile.encryptedData)
            : [],
          status: processedFile.status,
        });
      }

      console.log('✅ All files processed, now uploading...');

      // 🔍 Check processed files RIGHT before upload
      console.log(
        '🔍 Processed files array RIGHT BEFORE upload:',
        processedFiles.map(f => ({
          id: f.id,
          name: f.fileName,
          hasEncryptedData: !!f.encryptedData,
          encryptedDataKeys: f.encryptedData ? Object.keys(f.encryptedData) : [],
          status: f.status,
        }))
      );

      // ✅ Upload using the IDs from the processed files
      await uploadFiles(processedFiles);

      setContextText('');
      toast.success('✅ Files processed and uploaded successfully!');
    } catch (error) {
      console.error('❌ Error:', error);
      toast.error('Failed to process files');
    } finally {
      setProcessing(false);
    }
  };

  // Keeps files, starts uploading things all over again
  const handleCancelDeleteReset = () => {
    // Remove all files from Firebase and Local
    files.forEach(file => removeFile(file.id));
    files.forEach(file => removeFileFromLocal(file.id));

    // Reset form states
    setFhirText('');
    setFhirValidation(null);
    setPlainText('');
    setSubmitting(false);
    setSubmittingText(false);

    // Reset to upload tab
    setActiveTab('upload');
  };

  const handleConfirm = useCallback(
    (fileId: string) => {
      //Confirm individual item and remove from processing list
      console.log(`File Confirmed, Removing individual file from processing list: ${fileId}`);
      removeFileFromLocal(fileId);
    },
    [removeFileFromLocal]
  );

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
          resourceTypes: [...new Set(resourceTypes)],
        };
      } else {
        return {
          valid: true,
          resourceType: parsed.resourceType,
          isSingleResource: true,
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

  const handleTextSubmit = async (): Promise<void> => {
    if (!plainText.trim()) return;

    setSubmittingText(true);
    try {
      console.log('🎯 Converting plain text to FHIR...');
      let fhirData: FHIRWithValidation;

      if (convertTextToFHIR) {
        fhirData = await convertTextToFHIR(plainText);
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
                content: [
                  {
                    attachment: {
                      contentType: 'text/plain',
                      data: btoa(plainText),
                    },
                  },
                ],
                description: `Medical note`,
                date: new Date().toISOString(),
              },
            },
          ],
          _validation: {
            isValid: true,
            hasErrors: false,
            hasWarnings: false,
            errors: [],
            warnings: [],
            info: [],
            validatedAt: new Date().toISOString(),
            validatorVersion: '1.0.0',
          },
        };
      }

      // Create virtual file - hook will handle AI processing, hashing, encryption
      await addFhirAsVirtualFile(fhirData, {
        fileName: `Medical Note - ${new Date().toLocaleDateString()}`,
        sourceType: 'Plain Text Submission',
        originalText: plainText.trim(),
        autoUpload: true,
      });

      console.log('✅ Plain text converted to FHIR successfully');
      toast.success('✅ Medical note saved successfully!', {
        description: 'Your note has been converted to FHIR and saved to your health record',
        duration: 4000,
      });

      // Clear the form
      setPlainText('');
    } catch (error) {
      console.error('❌ Error converting text to FHIR:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to convert text to FHIR: ${errorMessage}`, { duration: 6000 });
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

      // Create virtual file - hook will handle AI processing, hashing, encryption
      await addFhirAsVirtualFile(fhirData, {
        fileName: `Manual FHIR Input - ${fhirData.resourceType}`,
        sourceType: 'Manual FHIR JSON Submission',
        originalText: fhirText.trim(),
        autoUpload: true,
      });

      console.log('✅ FHIR data uploaded successfully');

      // Clear the form
      setFhirText('');
      setFhirValidation(null);

      // Show success message
      toast.success('✅ FHIR data uploaded successfully!', {
        description: 'Your FHIR Data is now in your Comprehensive Health Record',
        duration: 4000,
      });
    } catch (error) {
      console.error('❌ Error submitting FHIR data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to upload FHIR data: ${errorMessage}`, {
        duration: 6000,
      });
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
                <span>Add Health Record</span>
              </h2>
              <p className="text-sm text-left text-gray-600 m-3">
                Add your health record in any format you like. Upload images, PDFs, word docs; type
                medical notes; input FHIR data, or manually write a record - everything will be
                processed and uploaded automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Processing Files View OR Input Interface */}
        {hasProcessingFiles && !hasAttachedFiles ? (
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
                    <span className="ml-2 text-red-600 font-medium">({stats.errors} errors)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* File List */}
              {files.map((fileItem: FileObject) => {
                const fhirResult = fileItem.fhirData
                  ? {
                      success: true,
                      fhirData: fileItem.fhirData,
                      error: undefined,
                    }
                  : undefined;

                return (
                  <FileListItem
                    key={fileItem.id}
                    fileItem={fileItem}
                    fhirResult={fhirResult}
                    onConfirm={handleConfirm}
                    onRemove={handleCancelDeleteReset}
                    onRetry={handleRetryFile}
                    showFHIRResults={true}
                    onReview={onReview}
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
              <TabNavigation tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
            </div>

            {/* Context Input (shows for upload and fhir tabs) */}
            {(activeTab === 'upload' || activeTab === 'fhir') && (
              <div className="px-6 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Record Context (Optional)
                </label>
                <textarea
                  value={contextText}
                  onChange={e => setContextText(e.target.value)}
                  placeholder={`Add any relevant context. For example:

• "This file is from Dr. Smith and contains my X-ray after my right leg injury"
• "This is my vaccination record from childhood"`}
                  className="w-full bg-background min-h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            )}

            <div className="p-6">
              {/* File Upload Tab */}
              {activeTab === 'upload' && (
                <div className="space-y-4">
                  <FileUploadZone
                    onFilesSelected={handleFilesSelected}
                    acceptedTypes={acceptedTypes}
                    maxFiles={maxFiles}
                    maxSizeBytes={maxSizeBytes}
                    title="Drop medical documents here or click to upload"
                    subtitle="Attach files to process and upload"
                  />

                  {/* Attached Files Display */}
                  {hasAttachedFiles && (
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-gray-700">
                        Attached Files ({pendingFiles.length})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {pendingFiles.map(file => {
                          return (
                            <div
                              key={file.id}
                              className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {file.fileName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatFileSize(file.fileSize)}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveAttached(file.id)}
                                className="flex-shrink-0 p-1 hover:bg-gray-200 rounded transition-colors"
                                aria-label="Remove file"
                              >
                                <X className="w-4 h-4 text-gray-500 hover:text-red-600" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* ✅ NEW: Process & Upload Button */}
                      <div className="pt-2">
                        <Button
                          onClick={handleProcessAndUpload}
                          disabled={processing}
                          className={`w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                            processing ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : ''
                          }`}
                        >
                          {processing ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Processing Files...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5" />
                              <span>Process & Upload Files</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
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
                      onChange={e => setPlainText(e.target.value)}
                      placeholder={`Describe what happened during the medical visit...

  Examples:
  • "Had routine checkup with Dr. Smith. Blood pressure was 120/80. Everything looks normal."
  • "Visited urgent care for sore throat. Prescribed amoxicillin 500mg, take twice daily for 10 days."
  • "Follow-up appointment for diabetes. HbA1c improved to 7.2%. Continue current medication."
  • "Annual physical exam completed. All vitals within normal range. Recommended yearly mammogram."`}
                      className="w-full bg-background min-h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      disabled={submittingText}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Your text will be automatically converted to medical FHIR format and saved.
                    </div>

                    <Button
                      onClick={handleTextSubmit}
                      disabled={!plainText.trim() || submittingText}
                      className={`px-6 py-2 rounded-lg font-medium ${
                        plainText.trim() && !submittingText
                          ? ''
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
                    </Button>
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
                      onChange={e => handleFhirTextChange(e.target.value)}
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
                    <div
                      className={`p-3 rounded-lg border ${
                        fhirValidation.valid
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {fhirValidation.valid ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-600" />
                        )}
                        <span
                          className={`font-medium ${
                            fhirValidation.valid ? 'text-green-800' : 'text-red-800'
                          }`}
                        >
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
                    <Button
                      onClick={handleFhirSubmit}
                      disabled={!fhirValidation?.valid || submitting}
                      className={`px-6 py-2 rounded-lg font-medium ${
                        fhirValidation?.valid && !submitting
                          ? ''
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
                    </Button>
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
