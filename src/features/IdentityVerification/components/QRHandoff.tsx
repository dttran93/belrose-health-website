import React, { useEffect, useRef, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/Button';

const IDSWYFT_BASE = import.meta.env.VITE_IDSWYFT_URL || 'http://localhost:3001';
const IDSWYFT_API_KEY = import.meta.env.VITE_IDSWYFT_API_KEY || '';
// IDswyft frontend runs on port 80 (same host, different port)
const IDSWYFT_FRONTEND = import.meta.env.VITE_IDSWYFT_FRONTEND_URL || 'http://192.168.0.9';

interface QRHandoffProps {
  userId: string;
  onComplete: (verificationId: string, finalResult: string) => void;
  onError: (error: Error) => void;
}

type QRState = 'loading' | 'ready' | 'scanning' | 'expired' | 'error';

const QRHandoff: React.FC<QRHandoffProps> = ({ userId, onComplete, onError }) => {
  const [qrState, setQrState] = useState<QRState>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes
  const [errorMessage, setErrorMessage] = useState<string>('');

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiresAtRef = useRef<Date | null>(null);

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, []);

  useEffect(() => {
    createHandoffSession();
    return cleanup;
  }, []);

  const createHandoffSession = async () => {
    setQrState('loading');
    setToken(null);
    try {
      const res = await fetch(`${IDSWYFT_BASE}/api/verify/handoff/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: IDSWYFT_API_KEY,
          user_id: crypto.randomUUID(),
        }),
      });

      if (!res.ok) throw new Error(`Handoff create failed: ${res.status}`);

      const { token: newToken, expires_at } = await res.json();
      expiresAtRef.current = new Date(expires_at);

      const url = `${IDSWYFT_FRONTEND}/user-verification?session=${newToken}`;
      setToken(newToken);
      setVerificationUrl(url);
      setQrState('ready');

      console.log('🔗 QR URL:', url);
      console.log('🎟️ Token:', newToken);

      startCountdown();
      startPolling(newToken);
    } catch (err: any) {
      setQrState('error');
      setErrorMessage(err.message);
      onError(err instanceof Error ? err : new Error('Failed to create handoff session'));
    }
  };

  const startCountdown = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      if (!expiresAtRef.current) return;
      const secondsLeft = Math.max(
        0,
        Math.floor((expiresAtRef.current.getTime() - Date.now()) / 1000)
      );
      setTimeLeft(secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(countdownIntervalRef.current!);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setQrState('expired');
      }
    }, 1000);
  };

  const startPolling = (pollToken: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${IDSWYFT_BASE}/api/verify/handoff/${pollToken}/status`, {
          headers: { 'X-API-Key': IDSWYFT_API_KEY },
        });

        if (!res.ok) return; // retry on next tick

        const data = await res.json();

        if (data.status === 'scanning') {
          setQrState('scanning');
        }

        if (data.status === 'completed') {
          cleanup();
          onComplete(data.verification_id, data.final_result ?? 'manual_review');
        }

        if (data.status === 'failed') {
          cleanup();
          setQrState('error');
          setErrorMessage(data.message || 'Verification failed on mobile');
          onError(new Error(data.message || 'Verification failed on mobile'));
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

  // ── Render ────────────────────────────────────────────────────────
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

          {/* QR Code */}
          <div
            className={`p-4 bg-white rounded-xl border-2 transition-colors ${
              qrState === 'scanning' ? 'border-green-400' : 'border-gray-200'
            }`}
          >
            <QRCodeSVG value={verificationUrl} size={200} level="M" includeMargin={false} />
          </div>

          {/* Expiry countdown */}
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
          <Button onClick={createHandoffSession} variant="default">
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
          <Button onClick={createHandoffSession} variant="default">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
};

export default QRHandoff;
