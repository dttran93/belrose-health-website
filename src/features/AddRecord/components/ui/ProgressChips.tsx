import React from 'react';
import { FileObject } from '@/types/core';

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error' | 'needs-attention';
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
          container: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg',
          icon: (
            <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xs font-bold">✓</span>
            </div>
          ),
        };
      case 'needs-attention':
        return {
          container: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-lg',
          icon: (
            <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
              <span className="text-amber-500 text-xs font-bold">!</span>
            </div>
          ),
        };
      case 'active':
        return {
          container: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg relative',
          icon: (
            <>
              <div className="absolute inset-0 bg-blue-400 rounded-full opacity-75"></div>
              <div className="relative w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </>
          ),
        };
      case 'error':
        return {
          container: 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg relative',
          icon: (
            <>
              <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                <span className="text-red-600 text-xs font-bold">✗</span>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
            </>
          ),
        };
      default: // pending
        return {
          container:
            'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600 shadow-sm border border-gray-300',
          icon: <div className="w-4 h-4 border-2 border-gray-400 rounded-full"></div>,
        };
    }
  };

  const { container, icon } = getChipStyles();

  return (
    <div
      className={`flex justify-start space-x-2 px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 ${container}`}
    >
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
export const ProgressChips: React.FC<ProgressChipsProps> = ({ steps, className = '' }) => {
  return (
    <div className={`flex flex-wrap gap-1 sm:gap-2 md:gap-3 ${className}`}>
      {steps.map(step => (
        <ProcessingChip key={step.id} step={step} />
      ))}
    </div>
  );
};

export const createFileProcessingSteps = (
  fileObj: FileObject,
  hasFollowUps: boolean = false
): ProcessingStep[] => {
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

  const hasTextContent = !!fileObj.extractedText || !!fileObj.originalText;
  const hasFhirData = !!fileObj.fhirData;
  const hasDocumentId = !!fileObj.id;
  const hasError = fileObj.status === 'error';
  const isProcessing = fileObj.status === 'processing';
  const isCompleted = fileObj.status === 'completed';
  const processingStage = fileObj.processingStage;
  const aiStatus = fileObj.aiProcessingStatus || 'not_needed';
  const hasBelroseFields = !!fileObj.belroseFields && Object.keys(fileObj.belroseFields).length > 0;

  return steps.map(step => {
    if (hasError) {
      if (step.id === 'received') return { ...step, status: 'completed' as const };
      if (uploadType === 'json') {
        if (step.id === 'validate' && !hasFhirData) return { ...step, status: 'error' as const };
        if (step.id === 'ai' && hasFhirData && aiStatus === 'failed')
          return { ...step, status: 'error' as const };
        if (step.id === 'save' && !hasDocumentId) return { ...step, status: 'error' as const };
      } else {
        if (step.id === 'extract' && !hasTextContent) return { ...step, status: 'error' as const };
        if (step.id === 'fhir' && hasTextContent && !hasFhirData)
          return { ...step, status: 'error' as const };
        if (step.id === 'ai' && hasFhirData && aiStatus === 'failed')
          return { ...step, status: 'error' as const };
        if (step.id === 'save' && !hasDocumentId) return { ...step, status: 'error' as const };
      }
      return { ...step, status: 'pending' as const };
    }

    switch (step.id) {
      case 'received':
        return { ...step, status: 'completed' as const };

      case 'extract':
        if (hasTextContent) return { ...step, status: 'completed' as const };
        if (
          isProcessing &&
          (processingStage === 'Starting processing...' || processingStage === 'Extracting text...')
        )
          return { ...step, status: 'active' as const };
        return { ...step, status: 'pending' as const };

      case 'validate':
        if (hasFhirData) return { ...step, status: 'completed' as const };
        if (isProcessing) return { ...step, status: 'active' as const };
        return { ...step, status: 'pending' as const };

      case 'fhir':
        if (hasFhirData) return { ...step, status: 'completed' as const };
        if (hasTextContent && isProcessing && processingStage === 'Converting to FHIR...')
          return { ...step, status: 'active' as const };
        return { ...step, status: 'pending' as const };

      case 'ai':
        if (aiStatus === 'completed' || hasBelroseFields)
          return { ...step, status: 'completed' as const };
        if (aiStatus === 'failed') return { ...step, status: 'error' as const };
        if (
          aiStatus === 'processing' ||
          (isProcessing &&
            (processingStage === 'AI processing...' ||
              processingStage === 'AI analyzing content...'))
        )
          return { ...step, status: 'active' as const };
        return { ...step, status: 'pending' as const };

      case 'save':
        if (isCompleted) {
          return {
            ...step,
            status: 'completed' as const,
          };
        }
        if (fileObj.status === 'uploading') return { ...step, status: 'active' as const };
        return { ...step, status: 'pending' as const };

      default:
        return { ...step, status: 'pending' as const };
    }
  });
};

export default ProgressChips;
