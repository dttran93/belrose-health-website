import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';
import FileUploadZone from '../ui/FileUploadZone';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { FileObject } from '@/types/core';
import { ProcessFileOptions, UploadFilesOptions } from '../../hooks/useFileManager.type';
import { useOnChainActivityTray } from '@/features/OnChainActivityTray/OnChainActivityTrayContext';

interface UploadTabProps {
  files: FileObject[];
  addFiles: (fileList: FileList, options: { maxFiles: number; maxSizeBytes: number }) => void;
  removeFileFromLocal: (fileId: string) => void;
  processFile: (fileObj: FileObject, options?: ProcessFileOptions) => Promise<FileObject>;
  uploadFiles: (files: FileObject[], options?: UploadFilesOptions) => Promise<any[]>;
  acceptedTypes: string[];
  maxFiles: number;
  maxSizeBytes: number;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const UploadTab: React.FC<UploadTabProps> = ({
  files,
  addFiles,
  removeFileFromLocal,
  processFile,
  uploadFiles,
  acceptedTypes,
  maxFiles,
  maxSizeBytes,
}) => {
  const [contextText, setContextText] = useState('');
  const [processing, setProcessing] = useState(false);
  const { addActivity, updateActivity } = useOnChainActivityTray();

  const pendingFiles = files.filter(f => f.status === 'pending');
  const hasAttachedFiles = pendingFiles.length > 0;

  const handleFilesSelected = (fileList: FileList) => {
    try {
      addFiles(fileList, { maxFiles, maxSizeBytes });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  };

  const handleRemoveAttached = (fileId: string) => {
    removeFileFromLocal(fileId);
    toast.info('File removed');
  };

  const handleProcessAndUpload = async () => {
    if (!hasAttachedFiles) {
      toast.error('No files attached');
      return;
    }

    setProcessing(true);
    try {
      const processedFiles: FileObject[] = [];
      // One activity per file, created up front and threaded through both processFile and
      // uploadFiles, so the tray shows a single continuous card per file (processing stages ->
      // saving -> "uploaded!") instead of two separate cards that each resolve on their own.
      const activityIds: Record<string, string> = {};

      for (const fileObj of pendingFiles) {
        const fileObjWithContext: FileObject = {
          ...fileObj,
          contextText: contextText.trim() || undefined,
        };

        const activityId = addActivity({
          label: `Processing "${fileObjWithContext.fileName}"`,
          kind: 'task',
        });
        activityIds[fileObj.id] = activityId;

        if (!fileObjWithContext.file) {
          const message = `File object missing for ${fileObjWithContext.fileName}`;
          updateActivity(activityId, { status: 'failed', errorMessage: message });
          throw new Error(message);
        }

        const processedFile = await processFile(fileObjWithContext, { activityId });
        processedFiles.push(processedFile);
      }

      await uploadFiles(processedFiles, { activityIds });
      setContextText('');
      // Per-file success/failure is already surfaced via the OnChainActivityTray cards created
      // above — no separate batch-level toast needed.
    } catch (error) {
      console.error('Error processing files:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="px-6 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Record Context (Optional)
        </label>
        <textarea
          value={contextText}
          onChange={e => setContextText(e.target.value)}
          placeholder={`Add any relevant context. For example:\n\n• "This file is from Dr. Smith and contains my X-ray after my right leg injury"\n• "This is my vaccination record from childhood"`}
          className="w-full bg-background min-h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-none focus:ring-1 focus:ring-complement-1 resize-none"
        />
      </div>

      <div className="px-6 pb-6 space-y-4">
        <FileUploadZone
          onFilesSelected={handleFilesSelected}
          acceptedTypes={acceptedTypes}
          maxFiles={maxFiles}
          maxSizeBytes={maxSizeBytes}
          title="Drop medical documents here or click to upload"
          subtitle="Attach files to process and upload"
        />

        {hasAttachedFiles && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">
              Attached Files ({pendingFiles.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingFiles.map(file => (
                <div
                  key={file.id}
                  className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {file.fileName}
                    </div>
                    <div className="text-xs text-gray-500">{formatFileSize(file.fileSize)}</div>
                  </div>
                  <button
                    onClick={() => handleRemoveAttached(file.id)}
                    className="flex-shrink-0 p-1 hover:bg-gray-200 rounded transition-colors"
                    aria-label="Remove file"
                  >
                    <X className="w-4 h-4 text-gray-500 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>

            <Button
              onClick={handleProcessAndUpload}
              disabled={processing}
              className={`w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                processing ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : ''
              }`}
            >
              {processing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
        )}
      </div>
    </div>
  );
};

export default UploadTab;
