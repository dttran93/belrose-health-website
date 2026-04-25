// src/features/IdentityVerification/components/CapturePreview.tsx

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface CapturePreviewProps {
  file: File;
  label: string;
  onConfirm: () => void;
  onRetake: () => void;
  isUploading?: boolean;
}

const CapturePreview: React.FC<CapturePreviewProps> = ({
  file,
  label,
  onConfirm,
  onRetake,
  isUploading = false,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600 text-center">{label}</p>

      {/* Preview image */}
      {previewUrl && (
        <div className="relative rounded-lg overflow-hidden bg-black">
          <img src={previewUrl} alt="Captured" className="w-full object-contain max-h-64" />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onRetake} disabled={isUploading} className="flex-1">
          Retake
        </Button>
        <Button variant="default" onClick={onConfirm} disabled={isUploading} className="flex-1">
          {isUploading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Uploading...
            </span>
          ) : (
            'Use this photo'
          )}
        </Button>
      </div>
    </div>
  );
};

export default CapturePreview;
