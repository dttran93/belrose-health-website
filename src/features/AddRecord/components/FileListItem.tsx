// Updated FileListItem.tsx

import React, { useState, useRef, useEffect } from 'react';
import { FileText, X, Eye, EyeOff, Check, HardDriveUpload } from 'lucide-react';
import { EnhancedFHIRResults } from '@/features/AddRecord/components/FHIRValidation';
import { ProgressChips, createFileProcessingSteps } from './ui/ProgressChips';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Button } from '@/components/ui/Button';
import type { FileListItemProps } from './CombinedUploadFHIR.type';

export const FileListItem: React.FC<FileListItemProps> = ({
  fileItem,
  fhirResult,
  onRemove,
  onConfirm,
  onRetry,
  onComplete,
  showFHIRResults = true,
  onReview,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const onCompleteCalledRef = useRef<boolean>(false);

  //utility functions

  const getContainerStyles = () => {
    if (fileItem.status === 'error') {
      return 'border-2 border-red-200 bg-gradient-to-r from-red-50 to-pink-50';
    } else if (fileItem.status === 'completed' && fhirResult?.success) {
      return 'border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50';
    } else if (fileItem.status === 'processing') {
      return 'border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50';
    }
    return 'border border-gray-200 bg-white';
  };

  // Create processing steps using utility function
  const processingSteps = createFileProcessingSteps(fileItem);

  // Event handlers
  const handleRemove = () => onRemove(fileItem.id);
  const handleConfirm = () => onConfirm(fileItem.id);
  const handleRetry = () => onRetry(fileItem);
  const handleToggleExpanded = () => setIsExpanded(!isExpanded);

  // Modified effect to prevent duplicate calls
  useEffect(() => {
    if (
      onComplete &&
      fileItem.status === 'completed' &&
      fileItem.extractedText &&
      !onCompleteCalledRef.current &&
      !fileItem.firestoreId && // 🧠 Skip if already uploaded
      !fileItem.uploadInProgress // 🧠 Skip if upload still in progress
    ) {
      console.log('📞 FileListItem calling onComplete for:', fileItem.fileName);
      onCompleteCalledRef.current = true;
      onComplete(fileItem);
    }
  }, [
    fileItem.status,
    fileItem.extractedText,
    fileItem.firestoreId,
    fileItem.uploadInProgress,
    onComplete,
    fileItem,
  ]);

  // ✅ OPTIONAL: Reset the ref if file goes back to processing (for retry scenarios)
  useEffect(() => {
    if (fileItem.status !== 'completed') {
      onCompleteCalledRef.current = false;
    }
  }, [fileItem.status]);

  //Function to show expanded text in originalText/extractedText preview
  function ExpandableText({ text, maxLength = 500 }: { text: string; maxLength?: number }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const isLongText = text.length > maxLength;
    const displayText = isExpanded ? text : text.slice(0, maxLength);

    return (
      <div className="bg-white p-3 rounded text-sm text-gray-600 border">
        <div className={`${isExpanded ? '' : 'max-h-32'} overflow-y-auto`}>
          {displayText}
          {!isExpanded && isLongText && '...'}
        </div>

        {isLongText && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-foreground hover:text-destructive text-xs font-medium"
          >
            {isExpanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>
    );
  }

  // Derived state
  const canRetry = fileItem.status.includes('error');
  const hasExpandableContent = fileItem.extractedText || fhirResult;
  const isFullyProcessed = fileItem.status === 'completed' && fileItem.firestoreId;

  return (
    <Tooltip.Provider>
      <div className={`rounded-xl shadow-sm ${getContainerStyles()}`}>
        {/* File Header */}
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <HardDriveUpload />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900 truncate">{fileItem.fileName}</p>
                <div className="text-right ml-4">
                  {hasExpandableContent && (
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          onClick={handleToggleExpanded}
                          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                        >
                          {isExpanded ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          className="bg-gray-900 text-white px-2 py-1 rounded text-xs max-w-xs"
                          sideOffset={5}
                        >
                          {isExpanded ? 'Hide details' : 'Preview extracted text and FHIR data'}
                          <Tooltip.Arrow className="fill-gray-900" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  )}

                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        onClick={handleRemove}
                        className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-gray-900 text-white px-2 py-1 rounded text-xs max-w-xs"
                        sideOffset={5}
                      >
                        Cancel File Upload and Remove from List
                        <Tooltip.Arrow className="fill-gray-900" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>

                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        onClick={handleConfirm}
                        className="text-gray-400 hover:text-green-700 p-1 rounded-full hover:bg-green-300 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-gray-900 text-white px-2 py-1 rounded text-xs max-w-xs"
                        sideOffset={5}
                      >
                        Confirm File Upload, Clear from List
                        <Tooltip.Arrow className="fill-gray-900" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <ProgressChips steps={processingSteps} />

                <div>
                  {canRetry && (
                    <button
                      onClick={handleRetry}
                      className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm hover:bg-orange-600 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  <Button
                    variant="default"
                    onClick={() => onReview?.(fileItem)}
                    disabled={!isFullyProcessed}
                  >
                    Review
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4"></div>
        </div>

        {/* Error Messages */}
        {fileItem.error && (
          <div className="px-5 pb-3">
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
              <strong>Error:</strong> {fileItem.error}
            </div>
          </div>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t bg-gray-50">
            {fileItem.extractedText && (
              <div className="p-4 border-b">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  Extracted Text Preview
                </h4>
                <div className="bg-white p-3 rounded text-sm text-gray-600 max-h-32 overflow-y-auto border">
                  <ExpandableText text={fileItem.extractedText} maxLength={500} />
                </div>
              </div>
            )}
            {fileItem.originalText && (
              <div className="p-4 border-b">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  Original Text Preview
                </h4>
                <div className="bg-white p-3 rounded text-sm text-gray-600 max-h-32 overflow-y-auto">
                  <ExpandableText text={fileItem.originalText} maxLength={500} />
                </div>
              </div>
            )}

            {showFHIRResults && fhirResult && (
              <div className="p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  FHIR Conversion Result
                </h4>
                <EnhancedFHIRResults fhirResult={fhirResult} />
              </div>
            )}
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
};
