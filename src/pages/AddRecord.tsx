import React, { useState } from 'react';
import useFileManager from '@/features/AddRecord/hooks/useFileManager';
import { useFHIRConversion } from '@/features/AddRecord/hooks/useFHIRConversion';
import { convertToFHIR } from '@/features/AddRecord/services/fhirConversionService';
import { ExportService } from '@/features/AddRecord/services/exportService';
import { FileObject } from '@/types/core';
import { toast } from 'sonner';
import RecordFull from '@/features/ViewEditRecord/components/ui/RecordFull';
import { useAuthContext } from '@/components/auth/AuthContext';
import { useRecordFileActions } from '@/features/ViewEditRecord/hooks/useRecordFileActions';

// Import components
import CombinedUploadFHIR from '@/features/AddRecord/components/CombinedUploadFHIR';

// ==================== TYPE DEFINITIONS ====================

/**
 * Props for the AddRecord component (currently none, but good for future extensibility)
 */
interface AddRecordProps {
  className?: string;
}

/**
 * Shape of the export data that gets downloaded
 */
interface ExportData {
  files: any[]; // Using any[] since processedFiles type varies
  stats: {
    files: any; // Return type from getStats()
  };
  exportedAt: string;
}

// ==================== COMPONENT ====================

/**
 * AddRecord Component
 *
 * Main page component for uploading and managing health records.
 * Handles both file uploads and direct FHIR input, with automatic
 * cloud storage and export capabilities.
 *
 * Key Features:
 * - File drag & drop upload
 * - Direct FHIR data input
 * - Automatic cloud storage
 * - Export all data as JSON
 * - Real-time upload status
 * - Deduplication service
 */
const AddRecord: React.FC<AddRecordProps> = ({ className }) => {
  // CONSOLIDATED FILE MANAGEMENT: Single source of truth for all file operations

  //DEBUGGING
  console.log('🔄 AddRecord component rendering');
  const hookResult = useFileManager();
  console.log('📁 Files from hook:', hookResult.files.length);
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
    clearAll,
    enhancedClearAll,
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

  //Important because if you just use the normal Save, it will make a second copy
  const handleSaveFromReview = async (updatedRecord: FileObject) => {
    try {
      const documentId = updatedRecord.id;

      if (!documentId) {
        throw new Error('Cannot save record - no document ID found');
      }

      const currentFile = files.find(f => f.id === documentId);
      if (!currentFile) {
        throw new Error('File not found in local state');
      }

      console.log('🔍 Current file state:', {
        id: currentFile.id,
        status: currentFile.status,
        firestoreId: currentFile.firestoreId,
        hasFirestoreId: !!currentFile.firestoreId,
      });

      // ✅ Use the Firestore document ID, not the file ID
      if (currentFile.firestoreId) {
        console.log('📝 Document exists in Firestore, updating with ID:', currentFile.firestoreId);

        // 🔥 KEY CHANGE: Use currentFile.firestoreId instead of documentId
        await updateFirestoreRecord(currentFile.firestoreId, {
          fhirData: updatedRecord.fhirData,
          belroseFields: updatedRecord.belroseFields,
          lastModified: new Date().toISOString(),
        });
      } else {
        console.log('📤 No firestoreId found - uploading for the first time');

        // Update local state with the edited data
        updateFileStatus(updatedRecord.id, 'uploading', {
          fhirData: updatedRecord.fhirData,
          belroseFields: updatedRecord.belroseFields,
          lastModified: new Date().toISOString(),
        });

        // Upload to Firestore for the first time
        await uploadFiles([updatedRecord.id]);
      }

      // Update local state to reflect the save
      updateFileStatus(updatedRecord.id, 'completed', {
        fhirData: updatedRecord.fhirData,
        belroseFields: updatedRecord.belroseFields,
        lastModified: new Date().toISOString(),
      });

      toast.success(`Record "${updatedRecord.belroseFields?.title}" saved successfully`, {
        duration: 4000,
      });
      setReviewMode({ active: false, record: null });
    } catch (error) {
      console.error('Failed to save record:', error);
      toast.error('Failed to save record', { duration: 4000 });
    }
  };

  // Export service instance
  const exportService = new ExportService();

  // ==================== EVENT HANDLERS ====================

  /**
   * Download all processed data as JSON
   * Includes files and statistics
   */
  const downloadAllData = (): void => {
    const exportData: ExportData = {
      files: processedFiles,
      stats: {
        files: getStats(),
      },
      exportedAt: new Date().toISOString(),
    };

    exportService.downloadData(exportData, 'belrose-health-records');
  };

  /**
   * Reset everything and refresh the page
   * Provides a clean slate for new uploads
   */
  const resetAll = (): void => {
    resetFileUpload();
    window.location.reload(); // Fresh start
  };

  // ==================== COMPUTED VALUES ====================

  // Check if we have any data to show download/reset buttons
  const hasData = files.length > 0 || savedToFirestoreCount > 0;

  // Check if we're in a success state (no files left, but some saved)
  const isSuccessState = files.length === 0 && savedToFirestoreCount > 0;

  // ==================== RENDER JSX ====================

  if (reviewMode.active && reviewMode.record) {
    return (
      <RecordFull
        record={reviewMode.record}
        initialViewMode={'edit'}
        comingFromAddRecord={true}
        onBack={() => setReviewMode({ active: false, record: null })}
        onSave={handleSaveFromReview}
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
