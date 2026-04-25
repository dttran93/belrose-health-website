// src/features/IdentityVerification/adapters/IDswyftAdapter.tsx

import React, { useEffect, useRef, useState } from 'react';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, setDoc, Timestamp, getDoc } from 'firebase/firestore';
import type { VerificationAdapterProps } from '../identity.types';
import type { OCRData } from '@idswyft/sdk';
import {
  getIdentityRecordId,
  saveUserIdentityRecord,
} from '@/features/HealthProfile/services/userIdentityService';
import type { UserIdentity } from '@/features/HealthProfile/utils/parseUserIdentity';
import CameraViewfinder from '../components/DocumentCapture/CameraViewfinder';
import CapturePreview from '../components/DocumentCapture/CapturePreview';
import StepIndicator, { StepStatus } from '../components/StepIndicator';
import LivenessCapture from '../components/DocumentCapture/LivenessCapture';
import QRHandoff from '../components/QRHandoff';

const IDSWYFT_BASE = import.meta.env.VITE_IDSWYFT_URL || 'http://localhost:3001';
const IDSWYFT_API_KEY = import.meta.env.VITE_IDSWYFT_API_KEY || '';

type CaptureStep = 'front' | 'back' | 'selfie';
type AdapterStep =
  | 'choice'
  | 'qr'
  | CaptureStep
  | 'processing'
  | 'done'
  | 'error'
  | 'manual_review';

// Which sub-state each capture step is in
type CaptureState = 'capturing' | 'preview' | 'uploading';

const IDswyftAdapter: React.FC<VerificationAdapterProps> = ({
  userId,
  onStatusChange,
  onSuccess,
  onError,
}) => {
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const [step, setStep] = useState<AdapterStep>(isMobileDevice ? 'front' : 'choice');
  const [captureState, setCaptureState] = useState<CaptureState>('capturing');
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const livenessMetadataRef = useRef<any>(null);

  const verificationIdRef = useRef<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const capturedFilesRef = useRef<{
    front?: File;
    back?: File;
    selfie?: File;
  }>({});

  const initSession = async () => {
    try {
      onStatusChange('loading');
      const res = await fetch(`${IDSWYFT_BASE}/api/v2/verify/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': IDSWYFT_API_KEY,
        },
        body: JSON.stringify({
          document_type: 'drivers_license',
          user_id: crypto.randomUUID(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => res.text());
        throw new Error(`Init failed: ${JSON.stringify(err)}`);
      }

      const { verification_id, session_token } = await res.json();
      verificationIdRef.current = verification_id;
      sessionTokenRef.current = session_token;
      onStatusChange('verifying');
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err.message);
      onStatusChange('error');
      onError(err instanceof Error ? err : new Error('Failed to initialise session'));
    }
  };

  useEffect(() => {
    // Only init if starting directly on webcam (mobile)
    if (isMobileDevice) {
      initSession();
    }
  }, []);

  const handleChooseWebcam = () => {
    setStep('front');
    initSession();
  };

  const handleQRComplete = async (verificationId: string, finalResult: string) => {
    setStep('processing');
    onStatusChange('verifying');

    try {
      // Fetch full status for OCR data and results
      const statusRes = await fetch(`${IDSWYFT_BASE}/api/v2/verify/${verificationId}/status`, {
        headers: { 'X-API-Key': IDSWYFT_API_KEY },
      });
      const result = await statusRes.json();
      const ocrData: OCRData = result.ocr_data ?? {};

      // Save certificate — no biometrics since phone captured them
      // but we save the result metadata
      const db = getFirestore();
      await setDoc(
        doc(db, 'IdVerificationCertificates', userId),
        {
          verifiedAt: Timestamp.now(),
          verifiedName: ocrData.full_name ?? null,
          verifiedDOB: ocrData.date_of_birth ?? null,
          verificationProvider: 'idswyft',
          verificationId,
          status: result.status,
          rejectionReason: result.rejection_reason ?? null,
          manualReview: finalResult === 'manual_review',
          liveness: result.liveness_results ?? null,
          faceMatch: result.face_match_results ?? null,
          captureMethod: 'qr_handoff',
          biometricsCapturedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      if (finalResult === 'verified') {
        setStep('done');
        onStatusChange('complete');
        onSuccess({
          verified: true,
          inquiryId: verificationId,
          data: {
            firstName: ocrData.full_name?.split(' ')[0] ?? '',
            lastName: ocrData.full_name?.split(' ').slice(-1)[0] ?? '',
            dateOfBirth: ocrData.date_of_birth ?? '',
            address: ocrData.address ?? '',
            verified: true,
          },
        });
      } else {
        setStep('manual_review');
        onStatusChange('complete');
        onSuccess({
          verified: false,
          inquiryId: verificationId,
          reason: 'pending_manual_review',
          data: {
            firstName: ocrData.full_name?.split(' ')[0] ?? '',
            lastName: ocrData.full_name?.split(' ').slice(-1)[0] ?? '',
            dateOfBirth: '',
            address: '',
            verified: false,
          },
        });
      }
    } catch (err: any) {
      setStep('error');
      onStatusChange('error');
      onError(err instanceof Error ? err : new Error('QR verification check failed'));
    }
  };

  // ── Handle capture from viewfinder ──────────────────────────────────
  const handleCapture = (file: File) => {
    setCapturedFile(file);
    setCaptureState('preview');
  };

  // ── Handle capture from livenessCapture ──────────────────────────────────
  const handleLivenessComplete = (result: { selfieFile: File; livenessMetadata: any }) => {
    livenessMetadataRef.current = result.livenessMetadata;
    capturedFilesRef.current['selfie'] = result.selfieFile;
    setCapturedFile(result.selfieFile);
    setCaptureState('preview');
  };

  // ── Handle confirm — encrypt + upload ───────────────────────────────
  const handleConfirm = async () => {
    if (!capturedFile || !verificationIdRef.current || captureState === 'uploading') return;
    const currentStep = step as CaptureStep;

    setCaptureState('uploading');
    capturedFilesRef.current[currentStep] = capturedFile;

    try {
      // Upload to IDswyft
      const endpoint =
        currentStep === 'selfie'
          ? `${IDSWYFT_BASE}/api/v2/verify/${verificationIdRef.current}/live-capture`
          : `${IDSWYFT_BASE}/api/v2/verify/${verificationIdRef.current}/${currentStep}-document`;

      const formData = new FormData();
      if (currentStep === 'selfie') {
        formData.append('selfie', capturedFile);
        // ← include liveness metadata
        if (livenessMetadataRef.current) {
          console.log(
            '🎯 Liveness metadata being sent:',
            JSON.stringify(livenessMetadataRef.current, null, 2)
          );
          formData.append('liveness_metadata', JSON.stringify(livenessMetadataRef.current));
        }
      } else {
        formData.append('document', capturedFile);
      }

      console.log('🔍 livenessMetadataRef.current:', livenessMetadataRef.current);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-API-Key': IDSWYFT_API_KEY,
          Authorization: `Bearer ${sessionTokenRef.current}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => res.text());
        console.error('❌ Upload error body:', err);
        throw new Error(`Upload failed: ${JSON.stringify(err)}`);
      }

      const responseData = await res.json();
      console.log('📊 Live capture response:', JSON.stringify(responseData, null, 2));

      // Advance to next step
      setCapturedFile(null);
      setCaptureState('capturing');

      if (currentStep === 'front') setStep('back');
      else if (currentStep === 'back') setStep('selfie');
      else await runVerification();
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err.message || 'Upload failed');
      onStatusChange('error');
    }
  };

  // ── Retake ───────────────────────────────────────────────────────────
  const handleRetake = () => {
    setCapturedFile(null);
    setCaptureState('capturing');
  };

  // ── Run verification after selfie ────────────────────────────────────
  const runVerification = async () => {
    setStep('processing');
    onStatusChange('verifying');

    try {
      const statusRes = await fetch(
        `${IDSWYFT_BASE}/api/v2/verify/${verificationIdRef.current}/status`,
        { headers: { 'X-API-Key': IDSWYFT_API_KEY } }
      );
      const result = await statusRes.json();
      const ocrData: OCRData = result.ocr_data ?? {};

      await saveCapturesToBelrose(result, ocrData);

      if (result.final_result === 'verified') {
        setStep('done');
        onStatusChange('complete');
        onSuccess({
          verified: true,
          inquiryId: verificationIdRef.current!,
          data: {
            firstName: ocrData.full_name?.split(' ')[0] ?? '',
            lastName: ocrData.full_name?.split(' ').slice(-1)[0] ?? '',
            dateOfBirth: ocrData.date_of_birth ?? '',
            address: ocrData.address ?? '',
            verified: true,
          },
        });
      } else if (
        result.final_result === 'manual_review' ||
        result.rejection_reason === 'HARD_REJECTED'
      ) {
        setStep('manual_review');
        onStatusChange('complete');
        onSuccess({
          verified: false,
          inquiryId: verificationIdRef.current!,
          reason: 'pending_manual_review',
          data: {
            firstName: ocrData.full_name?.split(' ')[0] ?? '',
            lastName: ocrData.full_name?.split(' ').slice(-1)[0] ?? '',
            dateOfBirth: '',
            address: '',
            verified: false,
          },
        });
      } else {
        setStep('error');
        setErrorMessage(result.rejection_detail || 'Verification failed');
        onStatusChange('error');
        onError(new Error(result.rejection_detail || 'Verification failed'));
      }
    } catch (err: any) {
      setStep('error');
      onStatusChange('error');
      onError(err instanceof Error ? err : new Error('Verification check failed'));
    }
  };

  // ── Save captures to Belrose ─────────────────────────────────────────
  const saveCapturesToBelrose = async (result: any, ocrData: OCRData) => {
    try {
      const masterKey = await EncryptionKeyManager.getSessionKey();
      if (!masterKey) return;

      const storage = getStorage();
      const db = getFirestore();
      const recordId = getIdentityRecordId(userId);
      const biometrics: Record<string, any> = {};

      // Ensure identity record exists
      const existing = await getDoc(doc(db, 'records', recordId));
      if (!existing.exists()) {
        const identityFromOCR: UserIdentity = {
          fullName: ocrData.full_name || undefined,
          dateOfBirth: ocrData.date_of_birth ? new Date(ocrData.date_of_birth) : undefined,
        };
        await saveUserIdentityRecord(userId, identityFromOCR);
      }

      // Encrypt and upload each captured file
      for (const [label, file] of Object.entries(capturedFilesRef.current) as [string, File][]) {
        const arrayBuffer = await file.arrayBuffer();
        const { encrypted, iv } = await EncryptionService.encryptFile(arrayBuffer, masterKey);

        const path = `records/${recordId}/${label}_${Date.now()}.encrypted`;
        const storageRef = ref(storage, path);

        await uploadBytes(storageRef, new Blob([encrypted]), {
          contentType: 'application/octet-stream',
          customMetadata: { encrypted: 'true', label, recordId, uploadedBy: userId },
        });

        const downloadURL = await getDownloadURL(storageRef);
        biometrics[label] = {
          downloadURL,
          iv: Array.from(new Uint8Array(iv)),
          path,
        };
      }

      // Write certificate
      await setDoc(
        doc(db, 'IdVerificationCertificates', userId),
        {
          verifiedAt: Timestamp.now(),
          verifiedName: ocrData.full_name ?? null,
          verifiedDOB: ocrData.date_of_birth ?? null,
          verificationProvider: 'idswyft',
          verificationId: verificationIdRef.current,
          status: result.status,
          rejectionReason: result.rejection_reason ?? null,
          manualReview:
            result.final_result === 'manual_review' || result.rejection_reason === 'HARD_REJECTED',
          liveness: result.liveness_results ?? null,
          faceMatch: result.face_match_results ?? null,
          biometrics,
          biometricsCapturedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('❌ Failed to save to Belrose:', err);
    }
  };

  // ── Step indicator config ────────────────────────────────────────────
  const steps: { label: string; status: StepStatus }[] = [
    {
      label: 'Front of ID',
      status:
        step === 'front'
          ? 'current'
          : ['back', 'selfie', 'processing', 'done', 'manual_review'].includes(step)
            ? 'complete'
            : 'upcoming',
    },
    {
      label: 'Back of ID',
      status:
        step === 'back'
          ? 'current'
          : ['selfie', 'processing', 'done', 'manual_review'].includes(step)
            ? 'complete'
            : 'upcoming',
    },
    {
      label: 'Selfie',
      status:
        step === 'selfie'
          ? 'current'
          : ['processing', 'done', 'manual_review'].includes(step)
            ? 'complete'
            : 'upcoming',
    },
  ];

  // ── Step labels ──────────────────────────────────────────────────────
  const stepConfig = {
    front: {
      viewfinderMode: 'document' as const,
      previewLabel: 'Front of your ID — does it look clear and readable?',
      instruction: 'Place the front of your ID within the frame',
    },
    back: {
      viewfinderMode: 'document' as const,
      previewLabel: 'Back of your ID — does it look clear and readable?',
      instruction: 'Now flip your ID and photograph the back',
    },
    selfie: {
      viewfinderMode: 'selfie' as const,
      previewLabel: 'Your selfie — is your face clearly visible?',
      instruction: 'Turn your head as directed below and back',
    },
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Choice screen — desktop only */}
      {step === 'choice' && (
        <div className="flex flex-col gap-4 py-4">
          <p className="text-sm text-center text-gray-600 mb-2">
            How would you like to verify your identity?
          </p>

          {/* QR option */}
          <button
            onClick={() => setStep('qr')}
            className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-primary transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">📱</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Use your phone</p>
              <p className="text-sm text-gray-500">
                Scan a QR code to complete verification on your phone — better camera quality
              </p>
              <span className="text-xs font-medium text-green-600 mt-1 inline-block">
                Recommended
              </span>
            </div>
          </button>

          {/* Webcam option */}
          <button
            onClick={handleChooseWebcam}
            className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-primary transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">💻</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Use this device's camera</p>
              <p className="text-sm text-gray-500">
                Use your webcam to capture your ID and selfie directly
              </p>
            </div>
          </button>
        </div>
      )}

      {/* QR handoff flow */}
      {step === 'qr' && (
        <QRHandoff
          userId={userId}
          onComplete={handleQRComplete}
          onError={err => {
            setStep('error');
            setErrorMessage(err.message);
            onStatusChange('error');
          }}
        />
      )}
      {/* Step indicator — only during capture steps */}
      {['front', 'back', 'selfie'].includes(step) && <StepIndicator steps={steps} />}

      {/* Capture steps */}
      {(['front', 'back', 'selfie'] as CaptureStep[]).includes(step as CaptureStep) && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-center text-gray-600">
            {stepConfig[step as CaptureStep].instruction}
          </p>

          {captureState === 'capturing' && step !== 'selfie' && (
            <CameraViewfinder
              mode={stepConfig[step as CaptureStep].viewfinderMode}
              onCapture={handleCapture}
              onError={err => {
                setStep('error');
                setErrorMessage(err.message);
                onStatusChange('error');
              }}
            />
          )}

          {captureState === 'capturing' && step === 'selfie' && (
            <LivenessCapture
              onComplete={handleLivenessComplete}
              onError={err => {
                setStep('error');
                setErrorMessage(err.message);
                onStatusChange('error');
              }}
            />
          )}

          {(captureState === 'preview' || captureState === 'uploading') && capturedFile && (
            <CapturePreview
              file={capturedFile}
              label={stepConfig[step as CaptureStep].previewLabel}
              onConfirm={handleConfirm}
              onRetake={handleRetake}
              isUploading={captureState === 'uploading'}
            />
          )}
        </div>
      )}

      {/* Processing */}
      {step === 'processing' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          <p className="text-gray-500 animate-pulse">Verifying your identity...</p>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-3xl">✅</span>
          </div>
          <p className="text-green-600 font-medium text-lg">Identity verified</p>
        </div>
      )}

      {/* Manual review */}
      {step === 'manual_review' && (
        <div className="flex flex-col items-center py-8 gap-3 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-3xl">⏳</span>
          </div>
          <p className="text-amber-700 font-medium">Documents submitted for review</p>
          <p className="text-sm text-amber-600">
            A Belrose team member will review your identity — usually within 24 hours.
          </p>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="flex flex-col items-center py-8 gap-3 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-3xl">❌</span>
          </div>
          <p className="text-red-600 font-medium">Verification failed</p>
          <p className="text-sm text-red-500">{errorMessage || 'Please try again.'}</p>
        </div>
      )}
    </div>
  );
};

export default IDswyftAdapter;
