import React, { useRef, useState } from 'react';
import useFileManager from '@/features/AddRecord/hooks/useFileManager';
import { convertToFHIR } from '@/features/AddRecord/services/fhirConversionService';
import { FileObject } from '@/types/core';
import CombinedUploadFHIR from '@/features/AddRecord/components/CombinedUploadFHIR';
import { useBlocker, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { useInboundRequests } from '@/features/RequestRecord/hooks/useInboundRequests';
import { GuestUploadBlockerModal } from '@/features/GuestAccess/components/GuestUploadBlockerModal';
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
  const { user } = useAuthContext();

  const isGuest = user?.isGuest === true;

  const {
    files,
    savingToFirestore,
    addFiles,
    removeFileFromLocal,
    removeFileComplete,
    retryFile,
    updateFileStatus,
    uploadFiles,
    getStats,
    savedToFirestoreCount,
    savingCount,
    processVirtualRecord,
    processFile,
    reset: resetFileUpload,
  } = useFileManager();

  const [linkRequestFile, setLinkRequestFile] = useState<FileObject | null>(null);
  const [fulfilling, setFulfilling] = useState(false);
  const isFulfilled = useRef(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const hasCompletedFiles = files.some(f => f.status === 'completed');
  const {
    filtered: pendingRequests,
    loading: requestsLoading,
    refresh: refreshRequests,
  } = useInboundRequests();
  const pendingRequest = isGuest ? (pendingRequests[0] ?? null) : null;

  const completedFileIds = files
    .filter(f => f.status === 'completed' && f.firestoreId)
    .map(f => f.firestoreId!);

  // Block navigation if guest has uploaded something

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isGuest &&
      hasCompletedFiles &&
      !isFulfilled.current &&
      currentLocation.pathname !== nextLocation.pathname
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
          convertTextToFHIR={convertToFHIR}
          savingToFirestore={savingToFirestore}
          onReview={handleReviewFile}
          processFile={processFile}
          externalLinkRequestFile={linkRequestFile}
          onExternalLinkRequestClose={() => {
            isFulfilled.current = true;
            setLinkRequestFile(null);
            refreshRequests();
          }}
          isGuest={isGuest}
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
