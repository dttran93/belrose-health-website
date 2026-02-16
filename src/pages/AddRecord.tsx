import React, { useState } from 'react';
import useFileManager from '@/features/AddRecord/hooks/useFileManager';
import { useFHIRConversion } from '@/features/AddRecord/hooks/useFHIRConversion';
import { convertToFHIR } from '@/features/AddRecord/services/fhirConversionService';
import { FileObject } from '@/types/core';
import CombinedUploadFHIR from '@/features/AddRecord/components/CombinedUploadFHIR';
import { useNavigate } from 'react-router-dom';

interface AddRecordProps {
  className?: string;
}

// ==================== COMPONENT ====================

/**
 * Main page component for uploading and managing health records.
 * Handles both file uploads and direct FHIR input
 */
const AddRecord: React.FC<AddRecordProps> = ({ className }) => {
  const navigate = useNavigate();
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
    processFile,
    reset: resetFileUpload,
  } = useFileManager();

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

  const handleReviewFile = (fileRecord: FileObject) => {
    if (!fileRecord.id) {
      console.error('File not found:', fileRecord.firestoreId);
      return;
    }

    console.log('🚀 Navigating to AllRecords with record:', fileRecord.firestoreId);

    // Navigate to AllRecords with the record to open in edit mode
    navigate('/app/all-records', {
      state: {
        openRecordId: fileRecord.firestoreId,
        openInEditMode: true,
      },
    });
  };

  // ==================== RENDER JSX ====================

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
          addFhirAsVirtualFile={addFhirAsVirtualFile}
          uploadFiles={uploadFiles}
          fhirData={fhirData}
          onFHIRConverted={handleFHIRConverted}
          convertTextToFHIR={convertToFHIR}
          savingToFirestore={savingToFirestore}
          onReview={handleReviewFile}
          processFile={processFile}
        />
      </div>
    </div>
  );
};

export default AddRecord;
