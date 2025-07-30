import React, { useState } from 'react';
import { FileText, Upload, Code, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import FileUploadZone from './ui/FileUploadZone';
import { FileListItem } from './ui/FileListItem';

import type {
  CombinedUploadFHIRProps,
  FileItem,
  FHIRValidation,
  TabType,
  UploadResult
} from './CombinedUploadFHIR.type';

import type { FHIRWithValidation } from '../services/fhirConversionService.type';

const CombinedUploadFHIR: React.FC<CombinedUploadFHIRProps> = ({
  // File management props
  files,
  addFiles,
  removeFile,
  retryFile,
  getStats,
  
  // Direct upload functions
  addFhirAsVirtualFile,
  uploadFiles,
  
  // Configuration props
  acceptedTypes = ['.pdf', '.docx', '.doc', '.txt', '.jpg', '.jpeg', '.png'],
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB
  className = ''
}) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  
  // FHIR input state
  const [fhirText, setFhirText] = useState<string>('');
  const [fhirValidation, setFhirValidation] = useState<FHIRValidation | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Handle file selection
  const handleFilesSelected = (fileList: FileList): void => {
    try {
      addFiles(fileList, { maxFiles, maxSizeBytes });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(errorMessage);
    }
  };

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
      
      // Step 2: Immediately upload to Firestore
      console.log('📤 Uploading FHIR data to Firestore...');
      const uploadResults: UploadResult[] = await uploadFiles([virtualFile]);
      
      if (uploadResults && uploadResults[0]?.success) {
        console.log('✅ FHIR data uploaded successfully:', uploadResults[0]);
        
        // Clear the form
        setFhirText('');
        setFhirValidation(null);
        
        // Show success message
        alert(`✅ FHIR data uploaded successfully!\nDocument ID: ${uploadResults[0].documentId}`);
        
      } else {
        throw new Error('Upload failed');
      }
      
    } catch (error) {
      console.error('❌ Error submitting FHIR data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to upload FHIR data: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-upload files when they finish processing
  const handleFileComplete = async (fileItem: FileItem): Promise<void> => {
    if (fileItem.status === 'completed' && fileItem.extractedText) {
      try {
        console.log('🚀 Auto-uploading completed file:', fileItem.name);
        const uploadResults: UploadResult[] = await uploadFiles([fileItem]);
        
        if (uploadResults && uploadResults[0]?.success) {
          console.log('✅ File auto-uploaded:', uploadResults[0]);
        } else {
          console.error('❌ Auto-upload failed for:', fileItem.name);
        }
      } catch (error) {
        console.error('❌ Auto-upload error:', error);
      }
    }
  };

  const handleRetryFile = (fileItem: FileItem) : void => {
    retryFile(fileItem);
  };
  const stats = getStats();
  const hasFiles = files.length > 0;
  const canAddMore = files.length < maxFiles;

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Upload Medical Data</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload documents or input FHIR data - everything gets saved to your cloud storage
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-4">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Upload className="w-4 h-4" />
                <span>File Upload</span>
                {hasFiles && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                    {files.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('fhir')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'fhir'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4" />
                <span>FHIR Input</span>
              </div>
            </button>
          </nav>
        </div>
        
        <div className="p-6">
          {/* File Upload Tab */}
          {activeTab === 'upload' && (
            <div>
              {!hasFiles ? (
                <FileUploadZone
                  onFilesSelected={handleFilesSelected}
                  acceptedTypes={acceptedTypes}
                  maxFiles={maxFiles}
                  maxSizeBytes={maxSizeBytes}
                  title="Drop medical documents here or click to upload"
                  subtitle="Files will be processed and automatically saved to your cloud storage"
                />
              ) : (
                <div className="space-y-4">
                  {/* File List */}
                  {files.map((fileItem: FileItem) => (
                    <FileListItem
                      key={fileItem.id}
                      fileItem={fileItem}
                      onRemove={removeFile}
                      onRetry={handleRetryFile}
                      onComplete={handleFileComplete}
                      showFHIRResults={true}
                    />
                  ))}

                  {/* Add More Files Button */}
                  {canAddMore && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <FileUploadZone
                        onFilesSelected={handleFilesSelected}
                        acceptedTypes={acceptedTypes}
                        maxFiles={maxFiles - files.length}
                        maxSizeBytes={maxSizeBytes}
                        title="Add more files"
                        subtitle={`${maxFiles - files.length} more files allowed`}
                        compact={true}
                      />
                    </div>
                  )}
                </div>
              )}
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
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
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
                  <div className="flex items-start space-x-2">
                    {fhirValidation.valid ? (
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      {fhirValidation.valid ? (
                        <div>
                          <p className="text-green-800 font-medium text-sm">
                            Valid FHIR {fhirValidation.resourceType}
                          </p>
                          {fhirValidation.entryCount && (
                            <p className="text-green-700 text-sm mt-1">
                              {fhirValidation.entryCount} entries: {fhirValidation.resourceTypes?.join(', ')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-red-800 text-sm">
                          {fhirValidation.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleFhirSubmit}
                  disabled={!fhirText.trim() || !fhirValidation?.valid || submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload to Cloud</span>
                    </>
                  )}
                </button>
              </div>

              {/* Help Text */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm">
                  <strong>Direct Upload:</strong> Your FHIR data will be validated and immediately saved to your cloud storage. 
                  Use the Edit tab to modify records later.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Summary Footer */}
        {hasFiles && (
          <div className="bg-gray-50 px-6 py-4 border-t">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {stats.processedFiles} of {stats.totalFiles} files processed
                {stats.processingFiles > 0 && (
                  <span className="ml-2 text-blue-600">
                    ({stats.processingFiles} processing)
                  </span>
                )}
              </div>
              
              <a 
                href="/edit-fhir" 
                className="flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Edit Records
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CombinedUploadFHIR;