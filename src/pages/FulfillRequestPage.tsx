// src/pages/FulfillRequestPage.tsx

/**
 * FulfillRequestPage
 *
 * Public route — no auth required to land here.
 * URL: /fulfill-request?code=<inviteCode>&guestCode=<guestInviteCode>#<providerPrivateKeyBase64>
 *
 * Step flow:
 *   'loading'   → Validate code, read private key from hash, stamp readAt
 *   'landing'   → LandingGate — who is requesting, account CTA
 *   'upload'    → CombinedUploadFHIR ingestion
 *   'uploading' → FulfillRequestService.fulfill() in progress
 *   'success'   → Confirmation + GuestClaimAccountModal if still a guest
 *   'cancelled' → Request was cancelled by requester
 *   'error'     → Invalid code, already fulfilled, network failure etc.
 *
 * Key wiring:
 *   - On mount: private key is read from window.location.hash and stored
 *     in providerPrivateKeyRef (in-memory only), hash cleared from URL
 *   - "Create account & upload": calls redeemGuestInvite(guestCode) →
 *     signInWithCustomToken → transition to upload
 *   - "Upload without account": transition straight to upload (anonymous)
 *   - On success: GuestClaimAccountModal opens if user.isGuest is true
 */

import React, { useEffect, useRef, useState } from 'react';
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
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import { GuestClaimAccountModal } from '@/features/GuestAccess/components/GuestClaimAccountModal';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';

// ── Types ─────────────────────────────────────────────────────────────────────

type PageStep = 'loading' | 'landing' | 'upload' | 'uploading' | 'success' | 'cancelled' | 'error';

// ── Component ─────────────────────────────────────────────────────────────────

const FulfillRequestPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuthContext();

  const [step, setStep] = useState<PageStep>('loading');
  const [recordRequest, setRecordRequest] = useState<RecordRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [targetIsRegistered, setTargetIsRegistered] = useState(false);

  // Provider's RSA private key — read once from URL hash on mount,
  // held in memory for the lifetime of the page, never persisted.
  // Used by FulfillRequestService.fulfill() to wrap the file key.
  const providerPrivateKeyRef = useRef<string | null>(null);

  // Held after a successful upload so Path B (register after upload)
  // can call wrapAndSaveForProvider() while the key is still in memory.
  const [uploadedRecordId, setUploadedRecordId] = useState<string | null>(null);
  const [uploadedFileKey, setUploadedFileKey] = useState<CryptoKey | null>(null);

  const navigate = useNavigate();

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
    uploadFiles,
    updateFirestoreRecord,
    setFHIRConversionCallback,
    processFile,
    processVirtualRecord,
    reset: resetFileUpload,
  } = useFileManager();

  const { fhirData, handleFHIRConverted } = useFHIRConversion(
    processedFiles,
    updateFirestoreRecord,
    uploadFiles
  );

  React.useEffect(() => {
    setFHIRConversionCallback((fileId: string, uploadResult: any) => {
      const currentFile = files.find(f => f.id === fileId);
      if (!currentFile?.extractedText) return Promise.resolve();
      return handleFHIRConverted(fileId, uploadResult);
    });
  }, [setFHIRConversionCallback, handleFHIRConverted, files]);

  // ── On mount: extract private key from hash + load request ───────────────
  useEffect(() => {
    // 1. Extract provider private key from URL hash and immediately clear it.
    //    The hash never leaves the browser but we still don't want it
    //    sitting in the address bar or browser history.
    const hash = window.location.hash.slice(1); // strip leading #
    if (hash) {
      providerPrivateKeyRef.current = hash;
      EncryptionKeyManager.setGuestRsaPrivateKey(hash);
      console.log('🔑 Guest RSA private key stored from URL hash');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

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

      // Stamp readAt on first open — fire and forget
      if (data.status === 'pending' && !data.readAt) {
        updateDoc(doc(db, 'recordRequests', code), {
          readAt: serverTimestamp(),
        }).catch(err => console.warn('Failed to stamp readAt:', err));
      }

      // Check if targetEmail has already registered a full account
      // Non-fatal — defaults to false (show "create account") if the query fails.
      // This determines whether LandingGate shows "sign in" vs "create account"
      // as the primary CTA for providers who aren't currently signed in.
      try {
        const checkRegFn = httpsCallable<{ email: string }, { isRegistered: boolean }>(
          getFunctions(),
          'checkEmailRegistrationStatus'
        );

        // Just pass the string directly
        const { data: result } = await checkRegFn({ email: data.targetEmail });
        setTargetIsRegistered(result.isRegistered);
      } catch (err) {
        console.warn('Registration check failed, defaulting to false:', err);
        setTargetIsRegistered(false);
      }

      // Sign out the wrong user
      const currentUser = getAuth().currentUser;
      if (currentUser && currentUser.email?.toLowerCase() !== data.targetEmail?.toLowerCase()) {
        await signOut(getAuth());
        await refreshUser();
      }

      setRecordRequest(data);
      setStep('landing');
    } catch (err: any) {
      setErrorMessage('Failed to load the request. Please try again.');
      setStep('error');
    }
  };

  // ── Sign in as guest via redeemGuestInvite ────────────────────────────────
  const handleContinueWithAccount = async () => {
    const guestCode = searchParams.get('guestCode');
    if (!guestCode) {
      throw new Error('No Guest Code');
    }

    setSigningIn(true);
    try {
      const redeemFn = httpsCallable<{ inviteCode: string }, { customToken: string }>(
        getFunctions(),
        'redeemGuestInvite'
      );
      const { data } = await redeemFn({ inviteCode: guestCode });
      await signInWithCustomToken(getAuth(), data.customToken);
      await refreshUser();
      setShowClaimModal(true);
    } catch (err: any) {
      console.error('❌ Guest sign-in failed:', err);
      setErrorMessage('Failed to create your session. Please try again.');
      setStep('error');
    } finally {
      setSigningIn(false);
    }
  };

  // Called when GuestClaimAccountModal closes (either completed or dismissed)
  const handleClaimModalClose = () => {
    setShowClaimModal(false);
    // Proceed to upload regardless — if they completed the modal their master
    // key is in session; if they dismissed it they're still signed in as a
    // guest and fulfill() will fall back to the anonymous path
    setStep('upload');
  };

  // ── Submit handler ────────────────────────────────────────────────────────
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

  // ── Path B: wrap key if provider registers after upload ───────────────────
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
          setUploadedFileKey(null);
        })
        .catch(err => console.error('⚠️ Post-registration wrap failed:', err));
    }
  }, [user?.uid, step]);

  const completedFiles = files.filter(f => f.status === 'completed' && !f.firestoreId);
  const canSubmit = completedFiles.length > 0 && step === 'upload';

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <PageShell>
        {step === 'loading' && <LoadingView />}

        {step === 'landing' && recordRequest && (
          <LandingGate
            recordRequest={recordRequest}
            isAlreadyLoggedIn={
              !!(
                user &&
                !user.isGuest &&
                user.email?.toLowerCase() === recordRequest.targetEmail?.toLowerCase()
              )
            }
            targetIsRegistered={targetIsRegistered}
            onContinueWithAccount={handleContinueWithAccount}
            onContinueWithoutAccount={() => setStep('upload')}
            onContinueAsExistingUser={() => navigate('/app/add-record')}
            signingIn={signingIn}
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
            onRegister={() => setShowClaimModal(true)}
          />
        )}

        {step === 'cancelled' && recordRequest && (
          <CancelledView requesterName={recordRequest.requesterName} />
        )}

        {step === 'error' && <ErrorView message={errorMessage} />}
      </PageShell>

      {/* GuestClaimAccountModal
          - Before upload: opened by handleContinueWithAccount after sign-in
            onClose → proceeds to upload (handleClaimModalClose)
          - After upload (Path C): opened by SuccessView's onRegister button
            onClose → just closes, wrapAndSaveForProvider fires via useEffect */}
      {user && (
        <GuestClaimAccountModal
          isOpen={showClaimModal}
          onClose={
            step === 'landing' || step === 'upload'
              ? handleClaimModalClose
              : () => setShowClaimModal(false)
          }
          guestContext="record_request"
          onComplete={
            step === 'success' ? () => navigate('/app/add-record') : handleClaimModalClose
          }
        />
      )}
    </>
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
