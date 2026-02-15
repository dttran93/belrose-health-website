// src/features/Ai/components/ui/AttachmentBadge.tsx

import { CornerDownLeft, File, FileText, X } from 'lucide-react';
import { useState } from 'react';

interface AttachmentBadgeProps {
  attachment: ChatAttachment;
  onRemove: () => void;
  onPasteInline?: () => void;
}
/**
 * Represents a virtual attachment for pasted text
 * For treating large pasted text as similar to file attachment in the UI
 */
export interface PastedTextAttachment {
  type: 'pasted-text';
  id: string;
  content: string;
  timestamp: number;
  preview: string; // First ~200 chars for badge preview
}

export type ChatAttachment = File | PastedTextAttachment;

/**
 * Type guard to check if attachment is pasted text
 */
export function isPastedText(attachment: ChatAttachment): attachment is PastedTextAttachment {
  return (attachment as PastedTextAttachment).type === 'pasted-text';
}

/**
 * Helper to create a pasted text attachment
 */
export function createPastedTextAttachment(content: string): PastedTextAttachment {
  const preview = content.length > 200 ? content.substring(0, 200) + '...' : content;

  return {
    type: 'pasted-text',
    id: `pasted-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    content,
    timestamp: Date.now(),
    preview,
  };
}

const AttachmentBadge = ({ attachment, onRemove, onPasteInline }: AttachmentBadgeProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Handle pasted text attachments
  if (isPastedText(attachment)) {
    return (
      <div className="relative inline-flex flex-col w-32 rounded-lg border border-gray-200 bg-white overflow-hidden group">
        <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* ✅ "Paste Inline" button - part of the badge */}
          {onPasteInline && (
            <button
              type="button"
              onClick={onPasteInline}
              className="p-1 rounded-full bg-blue-600/90 text-white hover:bg-blue-700"
              aria-label="Paste text inline"
            >
              <CornerDownLeft className="w-3 h-3" />
            </button>
          )}
          {/* Remove button */}
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded-full bg-gray-900/70 text-white hover:bg-gray-900"
            aria-label="Remove pasted text"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Pasted text Attachment (Includes paste inline button)*/}
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center p-3 bg-gray-50">
            <p className="text-xs text-gray-600 line-clamp-3 text-center leading-relaxed">
              {attachment.preview}
            </p>
          </div>
          <div className="px-2 py-1.5 border-t border-gray-200">
            <div className="text-xs font-medium text-gray-900 truncate" title={attachment.preview}>
              Pasted Text
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {attachment.content.length.toLocaleString()} chars
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle file attachments
  const file = attachment as File;
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
