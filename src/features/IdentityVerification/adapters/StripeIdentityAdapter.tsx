// src/features/IdentityVerification/adapters/StripeIdentityAdapter.tsx
//
// Stripe Identity adapter — launches Stripe's hosted verification modal,
// polls for the result via Cloud Function, and calls onSuccess/onError.
//
// Flow:
//   1. Call createStripeVerificationSession Cloud Function → get clientSecret + sessionId
//   2. Call stripe.verifyIdentity(clientSecret) → Stripe modal opens
//   3. User completes ID + selfie capture inside Stripe's UI
//   4. Poll getStripeSessionStatus every 3s until status is verified/failed
//   5. Call onSuccess or onError, webhook has already saved the certificate

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { loadStripe, Stripe as StripeJS } from '@stripe/stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { VerificationAdapterProps } from '../identity.types';
import { Button } from '@/components/ui/Button';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

type AdapterStep = 'idle' | 'creating' | 'modal' | 'polling' | 'done' | 'error';

const StripeIdentityAdapter: React.FC<VerificationAdapterProps> = ({
  userId,
  onStatusChange,
  onSuccess,
  onError,
}) => {
  const [step, setStep] = useState<AdapterStep>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const stripeRef = useRef<StripeJS | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const functions = getFunctions();

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  }, []);

  useEffect(() => {
    // Pre-load Stripe.js so the modal opens instantly when user clicks
    loadStripe(STRIPE_PUBLISHABLE_KEY).then(stripe => {
      stripeRef.current = stripe;
    });
    return cleanup;
  }, []);

  const startVerification = async () => {
    setStep('creating');
    onStatusChange('loading');

    try {
      // ── Step 1: Create session server-side ───────────────────────
      const createSession = httpsCallable<
        { userId: string },
        { clientSecret: string; sessionId: string }
      >(functions, 'createStripeVerificationSession');

      const { data } = await createSession({ userId });
      sessionIdRef.current = data.sessionId;

      // ── Step 2: Open Stripe modal ────────────────────────────────
      setStep('modal');
      onStatusChange('verifying');

      const stripe = stripeRef.current;
      if (!stripe) throw new Error('Stripe.js failed to load.');

      const { error } = await stripe.verifyIdentity(data.clientSecret);

      if (error) {
        // User cancelled or modal errored
        if (error.code === 'session_cancelled') {
          // User closed the modal — go back to idle so they can retry
          setStep('idle');
          onStatusChange('idle' as any);
          return;
        }
        throw new Error(error.message || 'Verification modal failed');
      }

      // ── Step 3: Modal completed — start polling ──────────────────
      setStep('polling');
      startPolling(data.sessionId);
    } catch (err: any) {
      setStep('error');
      setErrorMessage(err.message || 'Verification failed. Please try again.');
      onStatusChange('error');
      onError(err instanceof Error ? err : new Error('Verification failed'));
    }
  };

  const startPolling = (sessionId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const getStatus = httpsCallable<
      { sessionId: string },
      { status: 'pending' | 'verified' | 'failed'; verifiedName?: string; verifiedDOB?: string }
    >(functions, 'getStripeSessionStatus');

    pollIntervalRef.current = setInterval(async () => {
      try {
        const { data } = await getStatus({ sessionId });

        if (data.status === 'verified') {
          cleanup();
          setStep('done');
          onStatusChange('complete');
          onSuccess({
            verified: true,
            inquiryId: sessionId,
            data: {
              firstName: data.verifiedName?.split(' ')[0] ?? '',
              lastName: data.verifiedName?.split(' ').slice(-1)[0] ?? '',
              dateOfBirth: data.verifiedDOB ?? '',
              address: '',
              verified: true,
            },
          });
        } else if (data.status === 'failed') {
          cleanup();
          setStep('error');
          setErrorMessage('Verification could not be completed. Please try again.');
          onStatusChange('error');
          onError(new Error('Stripe verification failed'));
        }
        // status === 'pending' → keep polling
      } catch {
        // network hiccup, retry next tick
      }
    }, 3000);
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 w-full">
      {step === 'idle' && (
        <div className="flex flex-col gap-4 py-4">
          <p className="text-sm text-center text-gray-600">
            You'll be guided through a quick identity check — takes about 2 minutes.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            {[
              'A government-issued photo ID (passport or driving licence)',
              'A short selfie to match your face to the ID',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-green-500">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <Button onClick={startVerification} variant="default" className="w-full">
            Start Identity Verification
          </Button>
        </div>
      )}

      {step === 'creating' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          <p className="text-sm text-gray-500">Preparing verification...</p>
        </div>
      )}

      {step === 'modal' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          <p className="text-sm text-gray-500">Complete verification in the Stripe window...</p>
          <p className="text-xs text-gray-400">
            If the window didn't open,{' '}
            <button onClick={startVerification} className="text-primary underline">
              click here to try again
            </button>
          </p>
        </div>
      )}

      {step === 'polling' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          <p className="text-gray-500 animate-pulse">Verifying your identity...</p>
          <p className="text-xs text-gray-400">This usually takes less than 30 seconds</p>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-3xl">✅</span>
          </div>
          <p className="text-green-600 font-medium text-lg">Identity verified</p>
        </div>
      )}

      {step === 'error' && (
        <div className="flex flex-col items-center py-8 gap-4 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-3xl">❌</span>
          </div>
          <p className="text-red-600 font-medium text-lg">Verification failed</p>
          <p className="text-sm text-red-500 max-w-xs">{errorMessage}</p>
          <Button onClick={startVerification} variant="default">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
};

export default StripeIdentityAdapter;
