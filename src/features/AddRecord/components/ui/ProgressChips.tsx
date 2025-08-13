import React from 'react';
import { FileObject } from '@/types/core';

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export interface ProgressChipsProps {
  steps: ProcessingStep[];
  className?: string;
}

// Individual Chip Component
const ProcessingChip: React.FC<{ step: ProcessingStep }> = ({ step }) => {
  const getChipStyles = () => {
    switch (step.status) {
      case 'completed':
        return {
          container: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg",
          icon: (
            <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xs font-bold">✓</span>
            </div>
          )
        };
      case 'active':
        return {
          container: "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg relative",
          icon: (
            <>
              <div className="absolute inset-0 bg-blue-400 rounded-full opacity-75"></div>
              <div className="relative w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </>
          )
        };
      case 'error':
        return {
          container: "bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg relative",
          icon: (
            <>
              <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                <span className="text-red-600 text-xs font-bold">✗</span>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
            </>
          )
        };
      default: // pending
        return {
          container: "bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600 shadow-sm border border-gray-300",
          icon: <div className="w-4 h-4 border-2 border-gray-400 rounded-full"></div>
        };
    }
  };

  const { container, icon } = getChipStyles();

  return (
    <div className={`flex justify-start space-x-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 ${container}`}>
      {icon}
      <span className={step.status === 'active' ? 'relative' : ''}>{step.label}</span>
    </div>
  );
};

// Function to determine upload type
const getUploadType = (fileObj: FileObject): 'file' | 'text' | 'json' => {
  if (fileObj.documentType === 'medical_note_from_text') return 'text';
  if (fileObj.documentType === 'fhir_manual_input') return 'json';
  return 'file'; // default for regular file uploads
};

// Main Component
export const ProgressChips: React.FC<ProgressChipsProps> = ({ 
  steps, 
  className = "" 
}) => {
  return (
    <div className={`flex flex-wrap gap-1 sm:gap-2 md:gap-3 ${className}`}>
      {steps.map((step) => (
        <ProcessingChip key={step.id} step={step} />
      ))}
    </div>
  );
};

// Utility function to create common step patterns
export const createFileProcessingSteps = (fileObj: FileObject): ProcessingStep[] => {
    const uploadType = getUploadType(fileObj);
    const steps = [];

    if (uploadType === 'json') {
    // JSON/FHIR input flow: receive → validate → save
    steps.push(
        { id: 'received', label: 'FHIR Received' },
        { id: 'validate', label: 'Validate FHIR' },
        { id: 'save', label: 'Save to Cloud' }
    );
    } else {
    // File and text input flow: receive → extract/process → convert → save
    steps.push(
        { id: 'received', label: uploadType === 'text' ? 'Text Received' : 'File Received' },
        { id: 'extract', label: uploadType === 'text' ? 'Process Text' : 'Extract Text' },
        { id: 'fhir', label: 'Convert to FHIR' },
        { id: 'save', label: 'Save to Cloud' }
    );
    }
    
    // Determine progress based on file object state
    const hasTextContent = !!fileObj.extractedText || !!fileObj.originalText;
    const hasFhirData = !!fileObj.fhirData;
    const hasDocumentId = !!fileObj.documentId;
    const hasError = fileObj.status === 'error';
    const isProcessing = fileObj.status === 'processing';
    const processingStage = fileObj.processingStage;

    return steps.map((step) => {
        // Handle error states
        if (hasError) {
            if (step.id === 'received') return {...step, status: 'completed'};

            //Type-specific errors
            if(uploadType === 'json'){
                if (step.id === 'validate' && !hasFhirData) return { ...step, status: 'error' };
                if (step.id === 'save' && hasFhirData && !hasDocumentId) return { ...step, status: 'error' };
            } else {
                if (step.id === 'extract' && !hasTextContent) return { ...step, status: 'error' };
                if (step.id === 'fhir' && hasTextContent && !hasFhirData) return { ...step, status: 'error' };
                if (step.id === 'save' && hasFhirData && !hasDocumentId) return { ...step, status: 'error' };
            }
            return {...step, status: 'pending'};
        }

        switch (step.id) {
            case 'received':
                return { ...step, status: 'completed' }; // Always completed once file is added

            case 'extract': // For file and text uploads
              if (hasTextContent) {
                return { ...step, status: 'completed' }; // ✅ Text available
              } else if (isProcessing && (
                !processingStage || 
                processingStage.includes('text') || 
                processingStage.includes('Extracting') ||
                processingStage === 'Starting processing...'
              )) {
                return { ...step, status: 'active' }; // 🔄 Currently extracting
              } else {
                return { ...step, status: 'pending' }; // ⏳ Not started yet
              }

            case 'validate': // For JSON uploads
                if (hasFhirData) {
                return { ...step, status: 'completed' }; // ✅ FHIR validation passed
                } else if (isProcessing) {
                return { ...step, status: 'active' }; // 🔄 Currently validating
                } else {
                return { ...step, status: 'pending' }; // ⏳ Not started yet
                }

            case 'fhir': // For file and text uploads
              if (hasFhirData) {
                return { ...step, status: 'completed' }; // ✅ FHIR conversion done
              } else if (hasTextContent && isProcessing && (processingStage?.includes('FHIR') || processingStage?.includes('Converting') || processingStage === 'AI processing...')) {
                return { ...step, status: 'active' }; // 🔄 Currently converting FHIR
              } else if (hasTextContent) {
                return { ...step, status: 'pending' }; // ⏳ Ready for FHIR conversion
              } else {
                return { ...step, status: 'pending' }; // ⏳ Waiting for text
              }

            case 'save': // For all upload types
                if (hasDocumentId) {
                return { ...step, status: 'completed' }; // ✅ Saved to cloud
                } else if (hasFhirData && fileObj.uploadInProgress) {
                return { ...step, status: 'active' }; // 🔄 Currently uploading
                } else if (hasFhirData) {
                return { ...step, status: 'pending' }; // ⏳ Ready to upload
                } else {
                return { ...step, status: 'pending' }; // ⏳ Waiting for data
                }

            default:
                return { ...step, status: 'pending' };
            }
    });
};

export default ProgressChips;