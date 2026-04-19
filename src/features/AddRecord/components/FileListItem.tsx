//src/features/AddRecord/components/FileListItem.tsx

import React, { useState } from 'react';
import { FileText, X, Eye, EyeOff, Check, HardDriveUpload, AlertCircle, Ban } from 'lucide-react';
import { EnhancedFHIRResults } from '@/features/AddRecord/components/FHIRValidation';
import { ProgressChips, createFileProcessingSteps } from './ui/ProgressChips';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Button } from '@/components/ui/Button';
import { FileObject } from '@/types/core';
import { FHIRWithValidation } from '../services/fhirConversionService.type';
import useRecordFollowUps from '@/features/RefineRecord/hooks/useRecordFollowUps';
import FollowUpItems from '@/features/RefineRecord/components/ui/FollowUpItems';

export interface FileListItemProps {
  fileItem: FileObject;
  fhirResult?: {
    success: boolean;
    fhirData?: FHIRWithValidation;
    error?: string;
  };
  onRemove: (fileId: string) => void;
  onConfirm: (fileId: string) => void;
  onRetry: (fileItem: FileObject) => void;
  onForceConvert?: (fileItem: FileObject) => void;
  showFHIRResults?: boolean;
  onReview: (fileItem: FileObject) => void;
  onAction?: (fileItem: FileObject, itemId: string) => void;
}

export const FileListItem: React.FC<FileListItemProps> = ({
  fileItem,
  fhirResult,
  onRemove,
  onConfirm,
  onRetry,
  showFHIRResults = true,
  onReview,
  onAction,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [followUpDismissed, setFollowUpDismissed] = useState(false);

  // ── Derived state ────────────────────────────────────────────────────────────

  const isFullyProcessed = fileItem.status === 'completed' && !!fileItem.firestoreId;
  const canRetry = fileItem.status.includes('error');
  const hasExpandableContent = fileItem.extractedText || fhirResult;

  // ── Follow-up items ───────────────────────────────────────────────────────────
  // The hook checks the FileObject and returns only items that genuinely need action.

  const { followUpItems, isLoading: followUpsLoading } = useRecordFollowUps(fileItem, {
    onAction: (item, itemId) => {
      if (onAction) {
        onAction(item, itemId);
      } else {
        onReview(item); // existing fallback for callers that haven't updated yet
      }
    },
  });
  const showFollowUp = !followUpDismissed && followUpItems.length > 0;
  const isRecordComplete =
    isFullyProcessed && !followUpsLoading && (followUpItems.length === 0 || followUpDismissed);
  const showChipOverlay =
    isFullyProcessed && !followUpDismissed && (followUpsLoading || followUpItems.length > 0);

  // ── Container styles ─────────────────────────────────────────────────────────

  const getContainerStyles = () => {
    if (fileItem.status === 'error') {
      return 'border-2 border-red-200 bg-gradient-to-r from-red-50 to-pink-50';
    }
    if (fileItem.status === 'processing') {
      return 'border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50';
    }
    if (showFollowUp) {
      return 'border-2 border-amber-300 bg-white';
    }
    if (isRecordComplete) {
      return 'border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50';
    }
    // Covers: still loading follow-up check, or completed but no fhirResult
    return 'border border-gray-200 bg-white';
  };

  // ── Sub-components ────────────────────────────────────────────────────────────

  function ExpandableText({ text, maxLength = 500 }: { text: string; maxLength?: number }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = text.length > maxLength;
    return (
      <div className="bg-white p-3 rounded text-sm text-gray-600 border">
        <div className={`${expanded ? '' : 'max-h-32'} overflow-y-auto`}>
          {expanded ? text : text.slice(0, maxLength)}
          {!expanded && isLong && '...'}
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-foreground hover:text-destructive text-xs font-medium"
          >
            {expanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Tooltip.Provider>
      <div className={`rounded-xl shadow-sm ${getContainerStyles()}`}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <HardDriveUpload />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900 truncate">{fileItem.fileName}</p>

                <div className="flex items-center">
                  {hasExpandableContent && (
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          onClick={() => setIsExpanded(!isExpanded)}
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
                        onClick={() => onRemove(fileItem.id)}
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
                        onClick={() => onConfirm(fileItem.id)}
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
                <div className="relative">
                  <ProgressChips steps={createFileProcessingSteps(fileItem)} />
                  {/*// Overlay to dim the chips if there are follow-up actions*/}
                  {showChipOverlay && (
                    <div className="absolute inset-0 bg-amber-50 opacity-60 rounded-full pointer-events-none" />
                  )}
                </div>
                <div>
                  {canRetry && (
                    <button
                      onClick={() => onRetry(fileItem)}
                      className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm hover:bg-orange-600 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  <Button
                    variant="default"
                    onClick={() => onReview(fileItem)}
                    disabled={!isFullyProcessed || followUpsLoading}
                  >
                    Review
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-4" />
        </div>

        {/* Error message */}
        {fileItem.error && (
          <div className="px-5 pb-3">
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
              <strong>Error:</strong> {fileItem.error}
            </div>
          </div>
        )}

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t bg-gray-50">
            {fileItem.extractedText && (
              <div className="p-4 border-b">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  Extracted Text Preview
                </h4>
                <ExpandableText text={fileItem.extractedText} maxLength={500} />
              </div>
            )}
            {fileItem.originalText && (
              <div className="p-4 border-b">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  Original Text Preview
                </h4>
                <ExpandableText text={fileItem.originalText} maxLength={500} />
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

        {/* Follow-up items — only rendered when hook finds outstanding actions */}
        {showFollowUp && (
          <div className="flex flex-col px-4 py-3 m-2 rounded-xl">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs font-medium text-amber-800 flex-1">
                File Uploaded! There are a few follow-up steps to complete this record.
              </span>
              <button
                onClick={() => setFollowUpDismissed(true)}
                className="flex items-center gap-1 hover:bg-amber-400 rounded-xl p-1"
              >
                <Ban className="w-3 h-3 text-amber-600" />
                <span className="text-xs text-amber-600">Dismiss</span>
              </button>
            </div>
            <FollowUpItems items={followUpItems} />
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
};
