import React, { useState } from 'react';
import useFileManager from '@/features/AddRecord/hooks/useFileManager';
import { useFHIRConversion } from '@/features/AddRecord/hooks/useFHIRConversion';
import { convertToFHIR } from '@/features/AddRecord/services/fhirConversionService';
import { FileObject } from '@/types/core';
import CombinedUploadFHIR from '@/features/AddRecord/components/CombinedUploadFHIR';
import { useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { useInboundRequests } from '@/features/RequestRecord/hooks/usePendingInboundRequests';
import { GuestUploadBlockerModal } from '@/features/GuestAccess/components/GuestUploadBlockerModal';
import { FulfillRequestService } from '@/features/RequestRecord/services/fulfillRequestService';
import { GuestClaimAccountModal } from '@/features/GuestAccess/components/GuestClaimAccountModal';

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
  const location = useLocation();
  const { user } = useAuthContext();

  const isGuest = user?.isGuest === true;

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
    processVirtualRecord,
    setFHIRConversionCallback,
    processFile,
    reset: resetFileUpload,
  } = useFileManager();

  const [linkRequestFile, setLinkRequestFile] = useState<FileObject | null>(null);
  const [fulfilling, setFulfilling] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const hasCompletedFiles = files.some(f => f.status === 'completed');
  const { filtered: pendingRequests, loading: requestsLoading } = useInboundRequests();
  const pendingRequest = isGuest ? (pendingRequests[0] ?? null) : null;

  const completedFileIds = files
    .filter(f => f.status === 'completed' && f.firestoreId)
    .map(f => f.firestoreId!);

  const {
    fhirData,
    handleFHIRConverted,
    reset: resetFHIR,
  } = useFHIRConversion(processedFiles, updateFirestoreRecord, uploadFiles);

  React.useEffect(() => {
    console.log('🔍 Setting FHIR callback:', typeof handleFHIRConverted);
    setFHIRConversionCallback((fileId: string, uploadResult: any) => {
      console.log('🎯 FHIR CALLBACK TRIGGERED:', fileId, uploadResult);

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

  // Block navigation if guest has uploaded something

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isGuest && hasCompletedFiles && currentLocation.pathname !== nextLocation.pathname
  );

  const handleReviewFile = (fileRecord: FileObject, viewMode: string = 'record') => {
    if (!fileRecord.id) {
      console.error('File not found:', fileRecord.firestoreId);
      return;
    }

    // Navigate to AllRecords with the record to open in correct mode
    navigate(`/app/records/${fileRecord.id}?view=${viewMode}`);
  };

  // When the blocker fires, auto-select the first completed file
  const handleFulfillAndExit = () => {
    if (blocker.state !== 'blocked') return; // ← narrows the type
    const fileObj = files.find(f => f.status === 'completed' && f.firestoreId) as FileObject;
    if (!fileObj) return;
    blocker.reset();
    setLinkRequestFile(fileObj);
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
          addFhirAsVirtualFile={processVirtualRecord}
          uploadFiles={uploadFiles}
          fhirData={fhirData}
          onFHIRConverted={handleFHIRConverted}
          convertTextToFHIR={convertToFHIR}
          savingToFirestore={savingToFirestore}
          onReview={handleReviewFile}
          processFile={processFile}
          externalLinkRequestFile={linkRequestFile}
          onExternalLinkRequestClose={() => setLinkRequestFile(null)}
        />
      </div>

      {/* Blocks navigation until guest resolves their upload */}
      {blocker.state === 'blocked' && (
        <GuestUploadBlockerModal
          pendingRequest={pendingRequest}
          completedFiles={files.filter(f => f.status === 'completed') as FileObject[]}
          fulfilling={fulfilling}
          onClaim={() => {
            blocker.reset();
            setShowClaimModal(true);
          }}
          onFulfillAndExit={handleFulfillAndExit}
          onLeave={() => blocker.proceed()}
        />
      )}

      {showClaimModal && (
        <GuestClaimAccountModal
          isOpen={showClaimModal}
          onClose={() => setShowClaimModal(false)}
          onComplete={() => navigate('/app/record-requests')}
          guestContext="record_request"
          pendingRecordIds={completedFileIds}
        />
      )}
    </div>
  );
};

export default AddRecord;
