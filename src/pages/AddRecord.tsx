import React, { useState } from 'react';
import useFileManager from '@/features/AddRecord/hooks/useFileManager';
import { useFHIRConversion } from '@/features/AddRecord/hooks/useFHIRConversion';
import { convertToFHIR } from '@/features/AddRecord/services/fhirConversionService';
import { FileObject } from '@/types/core';
import { toast } from 'sonner';
import RecordFull from '@/features/ViewEditRecord/components/ui/RecordFull';
import { useRecordFileActions } from '@/features/ViewEditRecord/hooks/useRecordFileActions';
import CombinedUploadFHIR from '@/features/AddRecord/components/CombinedUploadFHIR';
import { useAuthContext } from '@/components/auth/AuthContext';

interface AddRecordProps {
  className?: string;
}

// ==================== COMPONENT ====================

/**
 * Main page component for uploading and managing health records.
 * Handles both file uploads and direct FHIR input
 */
const AddRecord: React.FC<AddRecordProps> = ({ className }) => {
  const { user } = useAuthContext();
  const {
    files,
    processedFiles,
    savingToFirestore,
    addFiles,
    removeFileFromLocal,
    removeFileComplete,
    retryFile,
    updateFileStatus,
    uploadFiles,
    updateFirestoreRecord,
    getStats,
    savedToFirestoreCount,
    savingCount,
    addFhirAsVirtualFile,
    setFHIRConversionCallback,
    shouldAutoUpload,
    reset: resetFileUpload,
  } = useFileManager();

  const { handleCopyRecord, handleDownloadRecord } = useRecordFileActions();

  // ==================== DELETE FUNCTION ====================
  const handleDeleteRecord = async (record: FileObject) => {
    if (
      !confirm(
        `Are you sure you want to delete "${record.belroseFields?.title}"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      if (!record.id) {
        throw new Error('Cannot delete record - no document ID found');
      }

      // Use the existing removeFileComplete function from useFileManager
      await removeFileComplete(record.id);

      toast.success(`Deleted ${record.belroseFields?.title}`, {
        description: 'Entry deleted from record',
        duration: 4000,
      });

      // Return to file list
      setReviewMode({ active: false, record: null });
    } catch (error) {
      console.error('Failed to delete record:', error);
      toast.error(`Failed to delete ${record.belroseFields?.title}`, {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        duration: 4000,
      });
    }
  };

  const {
    fhirData,
    handleFHIRConverted,
    reset: resetFHIR,
  } = useFHIRConversion(processedFiles, updateFirestoreRecord, uploadFiles);

  // 🔥 SET UP FHIR CONVERSION CALLBACK WITH DEBUGGING
  React.useEffect(() => {
    console.log('🔍 Setting FHIR callback:', typeof handleFHIRConverted);
    setFHIRConversionCallback((fileId: string, uploadResult: any) => {
      console.log('🎯 FHIR CALLBACK TRIGGERED:', fileId, uploadResult);

      // 🔥 FIND THE FILE IN THE CURRENT FILES ARRAY
      const currentFile = files.find(f => f.id === fileId);
      if (!currentFile || !currentFile.extractedText) {
        console.error('❌ File not found in current files:', fileId);
        console.log(
          '📋 Available files:',
          files.map(f => ({ id: f.id, name: f.fileName }))
        );
        return Promise.resolve();
      }

      console.log('✅ Found file for FHIR conversion:', currentFile.fileName);
      return handleFHIRConverted(fileId, uploadResult); // Pass the file object
    });
  }, [setFHIRConversionCallback, handleFHIRConverted, files]);

  console.log('🔍 Destructured updateFileStatus:', updateFileStatus);

  console.log('📊 AddRecord state:', {
    filesCount: files.length,
    processedFilesCount: processedFiles.length,
    savedToFirestoreCount,
    savingCount,
  });

  const [reviewMode, setReviewMode] = useState<{ active: Boolean; record: FileObject | null }>({
    active: false,
    record: null,
  });

  const handleReviewFile = (fileRecord: FileObject) => {
    const latestFile = files.find(f => f.id === fileRecord.id);

    if (!latestFile?.id) {
      console.error('File not found:', fileRecord.id);
      return;
    }

    setReviewMode({ active: true, record: fileRecord });
  };

  /**
   * Saves changes to a record in Firestore
   */
  const handleSaveRecord = async (updatedRecord: FileObject) => {
    try {
      if (!updatedRecord.id) {
        throw new Error('Cannot save record - no document ID found');
      }

      // Update the record in Firestore with both FHIR data and belroseFields
      await updateFirestoreRecord(updatedRecord.id, {
        fhirData: updatedRecord.fhirData,
        belroseFields: updatedRecord.belroseFields,
        lastModified: new Date().toISOString(),
      });

      console.log('Record saved successfully');
      toast.success(`💾 Record saved for ${updatedRecord.belroseFields?.title}`, {
        description: 'Record updates saved to cloud storage',
        duration: 4000,
      });
    } catch (error) {
      console.error('Failed to save record: ', error);
      toast.error(`Failed to save ${updatedRecord.belroseFields?.title}`, {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        duration: 4000,
      });
    }
  };

  // ==================== RENDER JSX ====================

  if (reviewMode.active && reviewMode.record) {
    return (
      <RecordFull
        record={reviewMode.record}
        initialViewMode={'edit'}
        comingFromAddRecord={true}
        onBack={() => setReviewMode({ active: false, record: null })}
        onSave={handleSaveRecord}
        onCopy={handleCopyRecord}
        onDelete={handleDeleteRecord}
        onDownload={handleDownloadRecord}
      />
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${className || ''}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Main Upload Interface */}
        <CombinedUploadFHIR
          files={files}
          addFiles={addFiles}
          removeFile={removeFileComplete}
          removeFileFromLocal={removeFileFromLocal}
          retryFile={retryFile}
          getStats={getStats}
          updateFileStatus={updateFileStatus}
          addFhirAsVirtualFile={addFhirAsVirtualFile}
          uploadFiles={uploadFiles}
          fhirData={fhirData}
          onFHIRConverted={handleFHIRConverted}
          convertTextToFHIR={convertToFHIR}
          shouldAutoUpload={shouldAutoUpload}
          savingToFirestore={savingToFirestore}
          onReview={handleReviewFile}
        />
      </div>
    </div>
  );
};

export default AddRecord;
