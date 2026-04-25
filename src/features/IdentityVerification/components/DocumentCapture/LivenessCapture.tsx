// src/features/IdentityVerification/components/LivenessCapture.tsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';

type ChallengeDirection = 'left' | 'right';

interface LivenessFrame {
  frame_base64: string;
  timestamp: number;
  phase: 'turn_start' | 'turn_peak' | 'turn_return';
}

interface LivenessCaptureResult {
  selfieFile: File;
  livenessMetadata: {
    challenge_type: 'head_turn';
    challenge_direction: ChallengeDirection;
    frames: LivenessFrame[];
    start_timestamp: number;
    end_timestamp: number;
  };
}

interface LivenessCaptureProps {
  onComplete: (result: LivenessCaptureResult) => void;
  onError: (error: Error) => void;
}

// ── Challenge config ─────────────────────────────────────────────────────
const CAPTURE_DURATION_MS = 10000; // 10 seconds of capture. Idwyft requires 8-90 seconds
const FRAME_INTERVAL_MS = 833; // 12 frames exactly at 3s
const DIRECTIONS: ChallengeDirection[] = ['left', 'right'];

const LivenessCapture: React.FC<LivenessCaptureProps> = ({ onComplete, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<LivenessFrame[]>([]);
  const startTimestampRef = useRef<number>(0);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'capturing' | 'done'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [progress, setProgress] = useState(0); // 0-100
  const [direction] = useState<ChallengeDirection>(
    DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)] as ChallengeDirection
  );

  // ── Start camera ─────────────────────────────────────────────────────
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { min: 640, ideal: 1920, max: 1920 },
            height: { min: 480, ideal: 1080, max: 1080 },
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setIsReady(true);
        }
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionDenied(true);
        } else {
          onError(new Error(`Camera error: ${err.message}`));
        }
      }
    };

    startCamera();

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    };
  }, []);

  // ── Capture a single frame from video ────────────────────────────────
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);

    return canvas.toDataURL('image/jpeg', 0.92); // lower quality for frames
  }, []);

  // ── Finish — take final selfie and package result ────────────────────
  const finishCapture = useCallback(() => {
    setPhase('done');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Final high-quality selfie frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      blob => {
        if (!blob) {
          onError(new Error('Failed to capture selfie'));
          return;
        }

        const selfieFile = new File([blob], `selfie_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });

        onComplete({
          selfieFile,
          livenessMetadata: {
            challenge_type: 'head_turn',
            challenge_direction: direction,
            frames: framesRef.current,
            start_timestamp: startTimestampRef.current,
            end_timestamp: Date.now(),
          },
        });
      },
      'image/jpeg',
      0.92
    );
  }, [direction, onComplete, onError]);

  // ── Capture frames for CAPTURE_DURATION_MS ───────────────────────────
  const startCapturing = useCallback(() => {
    framesRef.current = [];
    startTimestampRef.current = Date.now();
    setPhase('capturing');
    setProgress(0);

    let elapsed = 0;
    captureIntervalRef.current = setInterval(() => {
      elapsed += FRAME_INTERVAL_MS;
      const progressPct = Math.min((elapsed / CAPTURE_DURATION_MS) * 100, 100);
      setProgress(progressPct);

      const framePhase: 'turn_start' | 'turn_peak' | 'turn_return' =
        elapsed < 2000
          ? 'turn_start'
          : elapsed < 6000
            ? 'turn_peak' // 2-8s
            : 'turn_return'; // 8-12s

      const frame_base64 = captureFrame();
      if (frame_base64 && framesRef.current.length < 12) {
        const base64Data = frame_base64.split(',')[1] ?? ''; // ← TypeScript knows this is string
        if (base64Data.length <= 200000) {
          framesRef.current.push({
            frame_base64: base64Data,
            timestamp: elapsed,
            phase: framePhase,
          });
        }
        console.log(
          `Frame ${framesRef.current.length}: base64 length=${base64Data.length}, videoSize=${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`
        );
      }

      if (elapsed >= CAPTURE_DURATION_MS) {
        clearInterval(captureIntervalRef.current!);
        finishCapture();
      }
    }, FRAME_INTERVAL_MS);
  }, [captureFrame, finishCapture]);

  // ── Start countdown then capture ─────────────────────────────────────
  const handleStart = useCallback(() => {
    setPhase('countdown');
    setCountdown(3);

    let count = 3;
    const countdownInterval = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count === 0) {
        clearInterval(countdownInterval);
        startCapturing();
      }
    }, 1000);
  }, [direction, startCapturing]);

  // ── Direction arrow ──────────────────────────────────────────────────
  const DirectionArrow = () => (
    <div className="flex flex-col items-center gap-1">
      <span className="text-4xl">{direction === 'left' ? '⬅️' : '➡️'}</span>
      <span className="text-white text-sm font-medium">Turn {direction}</span>
    </div>
  );

  // ── Permission denied ─────────────────────────────────────────────────
  if (permissionDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-2xl">📷</span>
        </div>
        <p className="font-medium text-gray-900">Camera access denied</p>
        <p className="text-sm text-gray-500">
          Please allow camera access in your browser settings and refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Camera viewfinder */}
      <div
        className="relative w-full overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: '4/3' }}
      >
        {/* Video feed — mirrored for selfie */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover -scale-x-100"
        />

        {/* Face oval overlay */}
        {isReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/40" />
            <div
              className={`relative border-2 z-10 transition-colors duration-300 ${
                phase === 'capturing' ? 'border-green-400' : 'border-white'
              }`}
              style={{
                width: '60%',
                aspectRatio: '0.75',
                borderRadius: '50%',
              }}
            />
          </div>
        )}

        {/* Countdown overlay */}
        {phase === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-white text-7xl font-bold drop-shadow-lg">{countdown}</div>
          </div>
        )}

        {phase === 'capturing' && (
          <div className="absolute top-4 left-0 right-0 flex justify-center z-20">
            <div className="bg-black/60 rounded-full px-4 py-2">
              {progress < 60 ? (
                <DirectionArrow />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-4xl">↩️</span>
                  <span className="text-white text-sm font-medium">Return to center</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {phase === 'capturing' && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30 z-20">
            <div
              className="h-full bg-green-400 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Done checkmark */}
        {phase === 'done' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
            <div className="text-green-400 text-6xl">✓</div>
          </div>
        )}

        {/* Loading */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        )}

        {/* Hidden canvas */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {phase === 'capturing' && (
        <p className="text-sm text-center text-gray-600 animate-pulse">
          {progress < 60 ? (
            <>
              Slowly turn your head to the <span className="font-semibold">{direction}</span> and
              then slowly return to the center when prompted...
            </>
          ) : (
            <>Now slowly return to face the camera</>
          )}
        </p>
      )}

      {/* Instruction text below viewfinder */}
      {phase === 'idle' && isReady && (
        <p className="text-sm text-center text-gray-600">
          When ready, press Start. Slowly turn your head to the{' '}
          <span className="font-semibold">{direction}</span> and hold...
        </p>
      )}

      {phase === 'countdown' && (
        <p className="text-sm text-center text-gray-600">
          Get ready to turn your head to the <span className="font-semibold">{direction}</span>...
        </p>
      )}

      {/* Start button — only in idle */}
      {phase === 'idle' && isReady && (
        <Button onClick={handleStart} variant="default" className="w-full">
          Start Liveness Check
        </Button>
      )}
    </div>
  );
};

export default LivenessCapture;
