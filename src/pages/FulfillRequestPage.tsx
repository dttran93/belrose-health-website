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
import {
  getDoc,
  doc,
  getFirestore,
  updateDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAuthContext } from '@/features/Auth/AuthContext';
import StatusCard from '@/features/RequestRecord/components/ui/StatusCard';
import PageShell from '@/features/RequestRecord/components/ui/PageShell';
import LandingGate from '@/features/RequestRecord/components/Respond/LandingGate';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import { GuestClaimAccountModal } from '@/features/GuestAccess/components/GuestClaimAccountModal';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { RecordRequest } from '@belrose/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

type PageStep = 'loading' | 'landing' | 'cancelled' | 'error';

// ── Component ─────────────────────────────────────────────────────────────────

const FulfillRequestPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuthContext();

  const [step, setStep] = useState<PageStep>('loading');
  const [recordRequest, setRecordRequest] = useState<RecordRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signingInGuest, setSigningInGuest] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [targetIsRegistered, setTargetIsRegistered] = useState(false);

  // Provider's RSA private key — read once from URL hash on mount,
  // held in memory for the lifetime of the page, never persisted.
  const providerPrivateKeyRef = useRef<string | null>(null);

  const navigate = useNavigate();

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
      if (data.status === 'pending') {
        const updateData: any = {
          viewCount: increment(1),
        };

        // Only set readAt if it's the very first time
        if (!data.readAt) {
          updateData.readAt = serverTimestamp();
        }

        updateDoc(doc(db, 'recordRequests', code), updateData).catch(err =>
          console.warn('Failed to update engagement stats:', err)
        );
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

  // ── Redeem guest session (for both "create account" and anonymous paths) ───────
  // Two paths: 1 for providers who create an account and another for those who skip straight to uplaod. Both require guest authentication
  // Path 1 uses guest authentication to populate the claim account modal with correct information. 2 just uses it to login
  const handleContinueWithAccount = async () => {
    setSigningIn(true);
    try {
      const guestCode = searchParams.get('guestCode');
      if (!guestCode) throw new Error('No Guest Code');
      const redeemFn = httpsCallable<{ inviteCode: string }, { customToken: string }>(
        getFunctions(),
        'redeemGuestInvite'
      );
      const { data } = await redeemFn({ inviteCode: guestCode });
      await signInWithCustomToken(getAuth(), data.customToken);
      await refreshUser();
      setShowClaimModal(true); // modal generates real keys, no throwaway needed
    } catch (err: any) {
      setErrorMessage('Failed to create your session. Please try again.');
      setStep('error');
    } finally {
      setSigningIn(false);
    }
  };

  // Branch 3: needs throwaway key to pass EncryptionGate
  const handleContinueWithoutAccount = async () => {
    setSigningInGuest(true);
    try {
      const guestCode = searchParams.get('guestCode');
      if (!guestCode) throw new Error('No Guest Code');
      const redeemFn = httpsCallable<{ inviteCode: string }, { customToken: string }>(
        getFunctions(),
        'redeemGuestInvite'
      );
      const { data } = await redeemFn({ inviteCode: guestCode });
      await signInWithCustomToken(getAuth(), data.customToken);
      await refreshUser();

      // Satisfy EncryptionGate before navigating into /app/*
      const throwawayKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ]);
      EncryptionKeyManager.setSessionKey(throwawayKey);
      navigate('/app/record-requests');
    } catch (err: any) {
      setErrorMessage('Failed to create your session. Please try again.');
      setStep('error');
    } finally {
      setSigningInGuest(false);
    }
  };

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
            onContinueWithoutAccount={handleContinueWithoutAccount}
            onContinueAsExistingUser={() => navigate('/app/record-request')}
            signingIn={signingIn}
            signingInGuest={signingInGuest}
          />
        )}

        {step === 'cancelled' && recordRequest && (
          <CancelledView requesterName={recordRequest.requesterName} />
        )}

        {step === 'error' && <ErrorView message={errorMessage} />}
      </PageShell>

      {/* GuestClaimAccountModal */}
      {user && (
        <GuestClaimAccountModal
          isOpen={showClaimModal}
          onClose={() => navigate('/app/record-requests')} // branch 3 — skipped
          onComplete={() => navigate('/app/record-requests')} // branch 2 — claimed
          guestContext="record_request"
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
