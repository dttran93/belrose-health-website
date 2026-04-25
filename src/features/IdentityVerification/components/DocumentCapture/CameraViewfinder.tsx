// src/features/IdentityVerification/components/CameraViewfinder.tsx

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface CameraViewfinderProps {
  mode: 'document' | 'selfie';
  facingMode?: 'user' | 'environment';
  onCapture: (file: File) => void;
  onError: (error: Error) => void;
}

const CameraViewfinder: React.FC<CameraViewfinderProps> = ({
  mode,
  facingMode = mode === 'selfie' ? 'user' : 'environment',
  onCapture,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // ── Start camera stream ──────────────────────────────────────────────
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
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

    // Cleanup — stop all tracks when unmounting
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [facingMode]);

  // ── Capture frame from video ─────────────────────────────────────────
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      blob => {
        if (!blob) {
          onError(new Error('Failed to capture image'));
          return;
        }
        const file = new File([blob], `${mode}_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
      },
      'image/jpeg',
      0.92
    );
  }, [mode, onCapture, onError]);

  // ── Overlays ─────────────────────────────────────────────────────────
  const DocumentOverlay = () => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {/* Darken outside the ID area */}
      <div className="absolute inset-0 bg-black/40" />
      {/* ID card cutout */}
      <div
        className="relative bg-transparent border-2 border-white rounded-lg z-10"
        style={{ width: '85%', aspectRatio: '1.586' }} // ISO/IEC 7810 ID-1 ratio
      >
        {/* Corner markers */}
        {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map(pos => (
          <div
            key={pos}
            className={`absolute w-5 h-5 border-white ${pos}`}
            style={{
              borderTopWidth: pos.includes('top') ? 3 : 0,
              borderBottomWidth: pos.includes('bottom') ? 3 : 0,
              borderLeftWidth: pos.includes('left') ? 3 : 0,
              borderRightWidth: pos.includes('right') ? 3 : 0,
            }}
          />
        ))}
      </div>
    </div>
  );

  const SelfieOverlay = () => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40" />
      {/* Face oval cutout */}
      <div
        className="relative border-2 border-white z-10"
        style={{
          width: '60%',
          aspectRatio: '0.75',
          borderRadius: '50%',
          background: 'transparent',
        }}
      ></div>
    </div>
  );

  // ── Permission denied state ───────────────────────────────────────────
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
    <div
      className="relative w-full overflow-hidden rounded-lg bg-black"
      style={{ aspectRatio: '4/3' }}
    >
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${mode === 'selfie' ? '-scale-x-100' : ''}`}
      />

      {/* Overlay */}
      {isReady && (mode === 'document' ? <DocumentOverlay /> : <SelfieOverlay />)}

      {/* Loading state */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      )}

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Capture button */}
      {isReady && (
        <button
          onClick={handleCapture}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 transition-colors shadow-lg z-20"
          aria-label="Capture"
        />
      )}
    </div>
  );
};

export default CameraViewfinder;
