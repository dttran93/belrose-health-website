import React, { useEffect, useRef, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/Button';

const IDSWYFT_BASE = import.meta.env.VITE_IDSWYFT_URL || 'http://localhost:3001';
const IDSWYFT_API_KEY = import.meta.env.VITE_IDSWYFT_API_KEY || '';
const IDSWYFT_FRONTEND = import.meta.env.VITE_IDSWYFT_FRONTEND_URL || 'http://192.168.0.9';

interface QRHandoffProps {
  userId: string;
  onComplete: (verificationId: string, finalResult: string) => void;
  onError: (error: Error) => void;
}

type QRState = 'loading' | 'ready' | 'scanning' | 'expired' | 'error';

const QRHandoff: React.FC<QRHandoffProps> = ({ userId, onComplete, onError }) => {
  const [qrState, setQrState] = useState<QRState>('loading');
  const [verificationUrl, setVerificationUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(600);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verificationIdRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, []);

  useEffect(() => {
    createSession();
    return cleanup;
  }, []);

  const createSession = async () => {
    setQrState('loading');
    try {
      // Step 1 — create a v2 verification session
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

      if (!res.ok) throw new Error(`Initialize failed: ${res.status}`);

      const { verification_id, session_token } = await res.json();
      verificationIdRef.current = verification_id;

      // Step 2 — build QR URL using the session_token
      const url = `${IDSWYFT_FRONTEND}/user-verification?session=${session_token}`;
      setVerificationUrl(url);
      setQrState('ready');

      console.log('🔗 QR URL:', url);
      console.log('🆔 Verification ID:', verification_id);

      startCountdown();
      startPolling(verification_id);
    } catch (err: any) {
      setQrState('error');
      setErrorMessage(err.message);
      onError(err instanceof Error ? err : new Error('Failed to create session'));
    }
  };

  const startCountdown = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    countdownIntervalRef.current = setInterval(() => {
      const secondsLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(countdownIntervalRef.current!);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setQrState('expired');
      }
    }, 1000);
  };

  const startPolling = (verificationId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${IDSWYFT_BASE}/api/v2/verify/${verificationId}/status`, {
          headers: { 'X-API-Key': IDSWYFT_API_KEY },
        });

        if (!res.ok) return;

        const data = await res.json();
        console.log('📊 Poll status:', JSON.stringify(data)); // ← add this line

        // Map v2 status fields to QR states
        if (data.status === 'processing') {
          setQrState('scanning');
        }

        if (
          data.status === 'completed' ||
          data.status === 'verified' ||
          data.status === 'failed' ||
          data.status === 'manual_review' ||
          data.status === 'HARD_REJECTED' || // ← add this
          data.final_result === 'verified' || // ← also check final_result directly
          data.final_result === 'failed' ||
          data.final_result === 'manual_review'
        ) {
          cleanup();
          const finalResult = data.final_result ?? data.status;
          onComplete(verificationId, finalResult);
        }
      } catch {
        // network hiccup, retry next tick
      }
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {qrState === 'loading' && (
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          <p className="text-sm text-gray-500">Generating QR code...</p>
        </div>
      )}

      {(qrState === 'ready' || qrState === 'scanning') && (
        <>
          <div className="text-center">
            <p className="font-medium text-gray-900 mb-1">
              {qrState === 'scanning'
                ? '📱 Phone connected — complete verification on your phone'
                : 'Scan with your phone camera'}
            </p>
            <p className="text-sm text-gray-500">
              Open your phone camera and point it at the QR code
            </p>
          </div>

          <div
            className={`p-4 bg-white rounded-xl border-2 transition-colors ${
              qrState === 'scanning' ? 'border-green-400' : 'border-gray-200'
            }`}
          >
            <QRCodeSVG value={verificationUrl} size={200} level="M" includeMargin={false} />
          </div>

          <div
            className={`flex items-center gap-2 text-sm ${
              timeLeft < 60 ? 'text-red-500' : 'text-gray-500'
            }`}
          >
            <span>⏱</span>
            <span>Expires in {formatTime(timeLeft)}</span>
          </div>

          {qrState === 'scanning' && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />
              <span>Waiting for verification to complete...</span>
            </div>
          )}
        </>
      )}

      {qrState === 'expired' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <span className="text-2xl">⏰</span>
          </div>
          <p className="font-medium text-gray-900">QR code expired</p>
          <p className="text-sm text-gray-500">Generate a new code to continue</p>
          <Button onClick={createSession} variant="default">
            Generate New Code
          </Button>
        </div>
      )}

      {qrState === 'error' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-2xl">❌</span>
          </div>
          <p className="font-medium text-red-600">Something went wrong</p>
          <p className="text-sm text-red-500">{errorMessage}</p>
          <Button onClick={createSession} variant="default">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
};

export default QRHandoff;
