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
  if (fileObj.sourceType === 'Plain Text Submission') return 'text';
  if (fileObj.sourceType === 'Manual FHIR JSON Submission') return 'json';
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

export const createFileProcessingSteps = (fileObj: FileObject): ProcessingStep[] => {
  const uploadType = getUploadType(fileObj);
  const steps = [];

  if (uploadType === 'json') {
      steps.push(
          { id: 'received', label: 'FHIR Received' },
          { id: 'validate', label: 'Validate FHIR' },
          { id: 'ai', label: 'AI Analysis' },
          { id: 'save', label: 'Save to Cloud' }
      );
  } else {
      steps.push(
          { id: 'received', label: uploadType === 'text' ? 'Text Received' : 'File Received' },
          { id: 'extract', label: uploadType === 'text' ? 'Process Text' : 'Extract Text' },
          { id: 'fhir', label: 'Convert to FHIR' },
          { id: 'ai', label: 'AI Analysis' },
          { id: 'save', label: 'Save to Cloud' }
      );
  }

  // Get current state
  const hasTextContent = !!fileObj.extractedText || !!fileObj.originalText;
  const hasFhirData = !!fileObj.fhirData;
  const hasDocumentId = !!fileObj.id;
  const hasError = fileObj.status === 'error';
  const isProcessing = fileObj.status === 'processing';
  const isCompleted = fileObj.status === 'completed';
  const processingStage = fileObj.processingStage;
  const aiStatus = fileObj.aiProcessingStatus || 'not_needed';
  const hasBelroseFields = !!fileObj.belroseFields && Object.keys(fileObj.belroseFields).length > 0;

  console.log('🔍 ProgressChips Debug:', {
      fileName: fileObj.fileName,
      status: `"${fileObj.status}"`,
      processingStage: `"${processingStage}"`,
      aiStatus: aiStatus,
      hasFhirData: hasFhirData,
      hasBelroseFields: hasBelroseFields,
      hasDocumentId: hasDocumentId,
      hasTextContent: hasTextContent,
      isProcessing: isProcessing,
      isCompleted: isCompleted
  });

  return steps.map((step) => {
    // Handle error states first
    if (hasError) {
      if (step.id === 'received') return {...step, status: 'completed'};
      
      if (uploadType === 'json') {
          if (step.id === 'validate' && !hasFhirData) return { ...step, status: 'error' };
          if (step.id === 'ai' && hasFhirData && aiStatus === 'failed') return { ...step, status: 'error' };
          if (step.id === 'save' && !hasDocumentId) return { ...step, status: 'error' };
      } else {
          if (step.id === 'extract' && !hasTextContent) return { ...step, status: 'error' };
          if (step.id === 'fhir' && hasTextContent && !hasFhirData) return { ...step, status: 'error' };
          if (step.id === 'ai' && hasFhirData && aiStatus === 'failed') return { ...step, status: 'error' };
          if (step.id === 'save' && !hasDocumentId) return { ...step, status: 'error' };
      }
      return {...step, status: 'pending'};
    }

    // Handle each step with SIMPLE, NON-OVERLAPPING logic
    switch (step.id) {
      case 'received':
          return { ...step, status: 'completed' }; // Always completed once file is added

      case 'extract': // For file and text uploads
        if (hasTextContent) {
          console.log(`🔍 Extract step: COMPLETED (has text)`);
          return { ...step, status: 'completed' }; // ✅ Once text exists, ALWAYS completed
        } else if (isProcessing && (
          processingStage === 'Starting processing...' ||
          processingStage === 'Extracting text...'
        )) {
          console.log(`🔍 Extract step: ACTIVE`);
          return { ...step, status: 'active' }; // 🔄 Only active during specific stages
        } else {
          console.log(`🔍 Extract step: PENDING`);
          return { ...step, status: 'pending' }; // ⏳ Default state
        }

      case 'validate': // For JSON uploads only
        if (hasFhirData) {
            return { ...step, status: 'completed' };
        } else if (isProcessing) {
            return { ...step, status: 'active' };
        } else {
            return { ...step, status: 'pending' };
        }

case 'fhir': // For file and text uploads
    if (hasFhirData) {
        console.log(`🔍 FHIR step: COMPLETED (has FHIR data)`);
        return { ...step, status: 'completed' }; // ✅ Once FHIR exists, ALWAYS completed
    } else if (hasTextContent && isProcessing && processingStage === 'Converting to FHIR...') {
        console.log(`🔍 FHIR step: ACTIVE (converting)`);
        return { ...step, status: 'active' }; // 🔄 Only active during exact FHIR stage
    } else if (hasTextContent) {
        console.log(`🔍 FHIR step: PENDING (ready for conversion)`);
        return { ...step, status: 'pending' }; // ⏳ Ready for conversion
    } else {
        console.log(`🔍 FHIR step: PENDING (waiting for text)`);
        return { ...step, status: 'pending' }; // ⏳ Waiting for text
    }

      case 'ai': // SIMPLE: Check AI status first
          if (aiStatus === 'completed' || hasBelroseFields) {
              console.log(`🔍 AI step: COMPLETED`);
              return { ...step, status: 'completed' }; // ✅ AI complete
          } else if (aiStatus === 'failed') {
              console.log(`🔍 AI step: ERROR`);
              return { ...step, status: 'error' }; // ❌ AI failed
          } else if (aiStatus === 'processing' || (isProcessing && (
              processingStage === 'AI processing...' || 
              processingStage === 'AI analyzing content...'
          ))) {
              console.log(`🔍 AI step: ACTIVE`);
              return { ...step, status: 'active' }; // 🔄 AI processing
          } else if (hasFhirData || aiStatus === 'not_needed') {
              console.log(`🔍 AI step: PENDING (ready)`);
              return { ...step, status: 'pending' }; // ⏳ Ready or not needed
          } else {
              console.log(`🔍 AI step: PENDING (waiting)`);
              return { ...step, status: 'pending' }; // ⏳ Waiting
          }

      case 'save': // SIMPLE: Check upload states
          if (hasDocumentId) {
              console.log(`🔍 Save step: COMPLETED`);
              return { ...step, status: 'completed' }; // ✅ Saved
          } else if (fileObj.status === 'uploading') {
              console.log(`🔍 Save step: ACTIVE`);
              return { ...step, status: 'active' }; // 🔄 Uploading
          } else {
              console.log(`🔍 Save step: PENDING`);
              return { ...step, status: 'pending' }; // ⏳ Waiting to upload
          }

      default:
          return { ...step, status: 'pending' };
    }
  });
};

export default ProgressChips;