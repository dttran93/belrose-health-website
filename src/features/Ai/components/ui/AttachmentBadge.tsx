// src/features/Ai/components/ui/AttachmentBadge.tsx

import { File, X } from 'lucide-react';
import { useState } from 'react';

interface AttachmentBadgeProps {
  file: File;
  onRemove: () => void;
}

const AttachmentBadge = ({ file, onRemove }: AttachmentBadgeProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/');
  const mimeLabel = getMimeTypeLabel(file.type);

  // Generate thumbnail for images/videos
  if (isMedia && !thumbnailUrl) {
    const url = URL.createObjectURL(file);
    setThumbnailUrl(url);
  }

  return (
    <div className="relative inline-flex flex-col w-32 rounded-lg border border-gray-200 bg-white overflow-hidden group">
      {/* Remove button - shows on hover */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 z-10 p-1 rounded-full bg-gray-900/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove attachment"
      >
        <X className="w-3 h-3" />
      </button>

      {isMedia ? (
        // Image/Video thumbnail
        <>
          {file.type.startsWith('image/') ? (
            <img src={thumbnailUrl || ''} alt={file.name} className="w-full h-24 object-cover" />
          ) : (
            <video src={thumbnailUrl || ''} className="w-full h-24 object-cover" />
          )}
          <div className="px-2 py-1.5 text-xs text-gray-600 border-t border-gray-200">
            {mimeLabel}
          </div>
        </>
      ) : (
        // Document/text-based files
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center p-3 bg-gray-50">
            <File className="w-8 h-8 text-gray-400" />
          </div>
          <div className="px-2 py-1.5 border-t border-gray-200">
            <div className="text-xs font-medium text-gray-900 truncate" title={file.name}>
              {file.name}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{mimeLabel}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Convert MIME type to readable label
function getMimeTypeLabel(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-powerpoint': 'PPT',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'text/plain': 'TXT',
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'video/mp4': 'MP4',
    'video/quicktime': 'MOV',
  };

  return mimeMap[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'FILE';
}

export default AttachmentBadge;
