// src/pages/FulfillRequestPage.tsx

/**
 * FulfillRequestPage
 *
 * Public route — no auth required to land here.
 * URL: /fulfill-request?code=<inviteCode>
 *
 * Step flow:
 *   'landing'   → Show who is requesting + Belrose value prop + account soft gate
 *   'upload'    → CombinedUploadFHIR ingestion (processing only, no Firestore write yet)
 *   'uploading' → FulfillRequestService.fulfill() in progress
 *   'success'   → Confirmation + post-upload account nudge if anonymous
 *   'cancelled' → Request was cancelled by requester
 *   'error'     → Invalid code, already fulfilled, network failure etc.
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getDoc, doc, getFirestore, updateDoc, serverTimestamp } from 'firebase/firestore';
import { AlertTriangle, Loader2 } from 'lucide-react';
import useFileManager from '@/features/AddRecord/hooks/useFileManager';
import { useFHIRConversion } from '@/features/AddRecord/hooks/useFHIRConversion';
import { convertToFHIR } from '@/features/AddRecord/services/fhirConversionService';
import {
  FulfillRequestService,
  RecordRequest,
} from '../features/RequestRecord/services/fulfillRequestService';
import { useAuthContext } from '@/features/Auth/AuthContext';
import type { FileObject } from '@/types/core';
import StatusCard from '@/features/RequestRecord/components/ui/StatusCard';
import PageShell from '@/features/RequestRecord/components/ui/PageShell';
import LandingGate from '@/features/RequestRecord/components/Respond/LandingGate';
import UploadView from '@/features/RequestRecord/components/Respond/UploadView';
import SuccessView from '@/features/RequestRecord/components/Respond/SuccessView';

// ── Types ─────────────────────────────────────────────────────────────────────

type PageStep = 'loading' | 'landing' | 'upload' | 'uploading' | 'success' | 'cancelled' | 'error';

// ── Component ─────────────────────────────────────────────────────────────────

const FulfillRequestPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();

  const [step, setStep] = useState<PageStep>('loading');
  const [recordRequest, setRecordRequest] = useState<RecordRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Held in state after a successful upload so Path B (register after upload)
  // can call wrapAndSaveForProvider(). Gone permanently if the page unmounts.
  const [uploadedRecordId, setUploadedRecordId] = useState<string | null>(null);
  const [uploadedFileKey, setUploadedFileKey] = useState<CryptoKey | null>(null);

  // ── File manager (same wiring as AddRecord.tsx) ───────────────────────────
  const {
    files,
    processedFiles,
    savingToFirestore,
    addFiles,
    removeFileFromLocal,
    removeFileComplete,
    retryFile,
    getStats,
    uploadFiles, // not used directly — we intercept via handleSubmit
    updateFirestoreRecord,
    setFHIRConversionCallback,
    processFile,
    processVirtualRecord,
    reset: resetFileUpload,
  } = useFileManager();

  const {
    fhirData,
    handleFHIRConverted,
    reset: resetFHIR,
  } = useFHIRConversion(processedFiles, updateFirestoreRecord, uploadFiles);

  // Wire FHIR callback (mirrors AddRecord.tsx pattern)
  React.useEffect(() => {
    setFHIRConversionCallback((fileId: string, uploadResult: any) => {
      const currentFile = files.find(f => f.id === fileId);
      if (!currentFile?.extractedText) return Promise.resolve();
      return handleFHIRConverted(fileId, uploadResult);
    });
  }, [setFHIRConversionCallback, handleFHIRConverted, files]);

  // ── Load request on mount ─────────────────────────────────────────────────
  useEffect(() => {
    loadRequest();
  }, []);

  const loadRequest = async () => {
    const code = searchParams.get('code');
    if (!code) {
      setErrorMessage('No invite code found in this link. Please check the email you received.');
      setStep('error');
      return;
    }

    try {
      const db = getFirestore();
      const requestDoc = await getDoc(doc(db, 'recordRequests', code));

      if (!requestDoc.exists()) {
        setErrorMessage('This link is invalid or has expired.');
        setStep('error');
        return;
      }

      const data = { ...requestDoc.data(), inviteCode: code } as RecordRequest;

      if (data.status === 'fulfilled') {
        setErrorMessage('This request has already been fulfilled.');
        setStep('error');
        return;
      }

      if (data.status === 'cancelled') {
        setRecordRequest(data);
        setStep('cancelled');
        return;
      }

      // Stamp readAt on first open (only if not already read)
      if (data.status === 'pending' && !data.readAt) {
        const db = getFirestore();
        updateDoc(doc(db, 'recordRequests', code), {
          readAt: serverTimestamp(),
        }).catch(err => console.warn('Failed to stamp readAt:', err));
        // Fire and forget — don't await, don't block the page load
      }

      setRecordRequest(data);
      setStep('landing');
    } catch (err: any) {
      setErrorMessage('Failed to load the request. Please try again.');
      setStep('error');
    }
  };

  // ── Submit handler — intercepts CombinedUploadFHIR's normal upload path ──
  const handleSubmit = async () => {
    if (!recordRequest) return;

    // Get the completed files from the file manager
    const completedFiles = files.filter(f => f.status === 'completed' && !f.firestoreId);
    if (completedFiles.length === 0) return;

    // For now we take the first completed file.
    // Multi-file support can be added later — each file would be a separate
    // fulfill() call writing a separate record.
    const fileObj = completedFiles[0] as FileObject;

    setStep('uploading');

    try {
      // Determine if the provider is a registered Belrose user
      // user?.isGuest covers the anonymous sign-in case
      const isRegisteredUser = user && !user.isGuest && user.encryption?.publicKey;
      const providerPublicKey = isRegisteredUser ? user.encryption.publicKey : undefined;
      const providerUserId = isRegisteredUser ? user.uid : undefined;

      const result = await FulfillRequestService.fulfill(
        recordRequest,
        fileObj,
        providerPublicKey,
        providerUserId
      );

      // Hold the file key in state for Path B (register after upload)
      setUploadedRecordId(result.recordId);
      setUploadedFileKey(result.fileKey);
      setStep('success');
    } catch (err: any) {
      console.error('❌ Fulfill failed:', err);
      setErrorMessage(err.message || 'Upload failed. Please try again.');
      setStep('error');
    }
  };

  // ── Path B: provider registers after upload ───────────────────────────────
  // Watch for auth state change — if they were anonymous and just registered,
  // wrap the key for them while it's still in memory.
  useEffect(() => {
    if (
      step === 'success' &&
      uploadedRecordId &&
      uploadedFileKey &&
      user &&
      !user.isGuest &&
      user.encryption?.publicKey
    ) {
      FulfillRequestService.wrapAndSaveForProvider(
        uploadedRecordId,
        uploadedFileKey,
        user.uid,
        user.encryption.publicKey
      )
        .then(() => {
          console.log('✅ Post-registration wrap completed');
          // Clear key from memory now that it's been persisted
          setUploadedFileKey(null);
        })
        .catch(err => {
          console.error('⚠️ Post-registration wrap failed:', err);
        });
    }
  }, [user?.uid, step]);

  // ── Whether upload button should be enabled ───────────────────────────────
  const completedFiles = files.filter(f => f.status === 'completed' && !f.firestoreId);
  const canSubmit = completedFiles.length > 0 && step === 'upload';

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <PageShell>
      {step === 'loading' && <LoadingView />}

      {step === 'landing' && recordRequest && (
        <LandingGate
          recordRequest={recordRequest}
          isAlreadyLoggedIn={!!(user && !user.isGuest)}
          onContinueWithAccount={() =>
            navigate('/auth/register?redirect=' + encodeURIComponent(window.location.href))
          }
          onContinueWithoutAccount={() => setStep('upload')}
        />
      )}

      {step === 'upload' && recordRequest && (
        <UploadView
          recordRequest={recordRequest}
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
          processFile={processFile}
          canSubmit={canSubmit}
          onSubmit={handleSubmit}
          onBack={() => setStep('landing')}
        />
      )}

      {step === 'uploading' && <UploadingView />}

      {step === 'success' && recordRequest && (
        <SuccessView
          recordRequest={recordRequest}
          isRegisteredUser={!!(user && !user.isGuest)}
          hasKeyInMemory={!!uploadedFileKey}
          onRegister={() => navigate('/auth/register')}
        />
      )}

      {step === 'cancelled' && recordRequest && (
        <CancelledView requesterName={recordRequest.requesterName} />
      )}

      {step === 'error' && <ErrorView message={errorMessage} />}
    </PageShell>
  );
};

// ============================================================================
// SUB-VIEWS
// ============================================================================

const LoadingView: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24 gap-4">
    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    <p className="text-sm text-slate-500">Loading request...</p>
  </div>
);

const UploadingView: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24 gap-4">
    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    <p className="text-sm font-medium text-slate-700">Encrypting and uploading...</p>
    <p className="text-xs text-slate-400">Your file is being encrypted in your browser</p>
  </div>
);

// ── Cancelled view ────────────────────────────────────────────────────────────

const CancelledView: React.FC<{ requesterName: string }> = ({ requesterName }) => (
  <StatusCard
    icon={<AlertTriangle className="w-8 h-8 text-amber-500" />}
    title="This request has been cancelled"
    description={`${requesterName} has cancelled this record request. No action is needed.`}
    bg="bg-amber-50"
    border="border-amber-200"
  />
);

// ── Error view ────────────────────────────────────────────────────────────────

const ErrorView: React.FC<{ message: string }> = ({ message }) => (
  <StatusCard
    icon={<AlertTriangle className="w-8 h-8 text-red-500" />}
    title="Something went wrong"
    description={message}
    bg="bg-red-50"
    border="border-red-200"
  />
);

export default FulfillRequestPage;
