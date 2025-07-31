import React, { useState, useEffect } from 'react';
import { FileText, Upload, Code, MessageSquare, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import FileUploadZone from './ui/FileUploadZone';
import { FileListItem } from './ui/FileListItem';

// Import the fixed types
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
  convertTextToFHIR,
  
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

  // Plain text input state
  const [plainText, setPlainText] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [submittingText, setSubmittingText] = useState<boolean>(false);

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
 const handleFileComplete = async (fileItem: FileItem): Promise<void> => {
  if (fileItem.status === 'completed' && fileItem.extractedText && !fileItem.documentId) {
    try {
      console.log('🚀 Auto-uploading completed file:', fileItem.name);      
      await uploadFiles([fileItem.id]);
      console.log('✅ File auto-uploaded:', fileItem.name);
      removeFile(fileItem.id);
    } catch (error) {
      console.error('❌ Auto-upload error:', error);
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
    alert(`✅ FHIR data uploaded successfully!`);
    
  } catch (error) {
    console.error('❌ Error submitting FHIR data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    alert(`Failed to upload FHIR data: ${errorMessage}`);
  } finally {
    setSubmitting(false);
  }
};


const handleRetryFile = (fileItem: FileItem): void => {
  retryFile(fileItem.id);
};

// 4. Fix stats display to use the correct property names
const stats = getStats();
const hasFiles = files.length > 0;
const canAddMore = files.length < maxFiles;

 return (
    <div className={`space-y-6 ${className}`}>
      {/* File Processing Overlay - Always visible when there are files */}
      {hasFiles && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b bg-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <h3 className="text-lg font-semibold text-gray-900">Processing Files</h3>
              </div>
              <div className="text-sm text-gray-600">
                {stats.completed} of {stats.total} completed
                {stats.processing > 0 && (
                  <span className="ml-2 text-blue-600 font-medium">
                    ({stats.processing} processing)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {/* File List - Always visible when files exist */}
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
          </div>

          {/* Quick Actions Footer */}
          <div className="bg-gray-50 px-4 py-3 border-t">
            <div className="flex items-center justify-between">
              <a 
                href="/edit-fhir" 
                className="flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Edit Records
              </a>
              
              {canAddMore && (
                <span className="text-sm text-gray-500">
                  {maxFiles - files.length} more files allowed
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Input Interface */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Add Health Records</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload documents, type medical notes, or input FHIR data - everything gets saved automatically
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-4">
            {/* File Upload Tab */}
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
              </div>
            </button>

            {/* Plain Text Tab */}
            <button
              onClick={() => setActiveTab('text')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'text'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4" />
                <span>Text Input</span>
              </div>
            </button>

            {/* FHIR Input Tab */}
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
                <span>FHIR Data</span>
              </div>
            </button>
          </nav>
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
              
              {/* Add More Files Option - only show if we have files and can add more */}
              {hasFiles && canAddMore && (
                <div className="mt-6 pt-6 border-t border-gray-200">
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

          {/* Plain Text Input Tab */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Name (Optional)
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Enter patient name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={submittingText}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medical Note or Description
                </label>
                <textarea
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  placeholder={`Describe what happened during the medical visit...

Examples:
• "Had routine checkup with Dr. Smith. Blood pressure was 120/80. Everything looks normal."
• "Visited urgent care for sore throat. Prescribed amoxicillin 500mg, take twice daily for 10 days."
• "Follow-up appointment for diabetes. HbA1c improved to 7.2%. Continue current medication."
• "Annual physical exam completed. All vitals within normal range. Recommended yearly mammogram."`}
                  className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
      </div>
    </div>
  );
};

export default CombinedUploadFHIR;