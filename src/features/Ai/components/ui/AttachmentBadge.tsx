// src/features/Ai/components/ui/AttachmentBadge.tsx

import { File, FileText, ImageIcon, Video, X } from 'lucide-react';

interface AttachmentBadgeProps {
  file: File;
  onRemove: () => void;
}

const AttachmentBadge = ({ file, onRemove }: AttachmentBadgeProps) => {
  const { icon, label, bgColor, textColor } = getFileDisplay(file);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${bgColor} ${textColor} text-xs font-medium`}
    >
      {icon}
      <span className="max-w-[120px] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="hover:opacity-70 transition-opacity"
        aria-label="Remove attachment"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// Helper to determine icon and styling based on file type
function getFileDisplay(file: File) {
  const extension = file.name.split('.').pop()?.toUpperCase() || 'FILE';

  if (file.type.startsWith('image/')) {
    return {
      icon: <ImageIcon className="w-3.5 h-3.5" />,
      label: extension,
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
    };
  }

  if (file.type.startsWith('video/')) {
    return {
      icon: <Video className="w-3.5 h-3.5" />,
      label: extension,
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-700',
    };
  }

  if (file.type.includes('pdf')) {
    return {
      icon: <FileText className="w-3.5 h-3.5" />,
      label: 'PDF',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
    };
  }

  if (file.type.includes('word') || extension === 'DOCX' || extension === 'DOC') {
    return {
      icon: <FileText className="w-3.5 h-3.5" />,
      label: 'DOCX',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
    };
  }

  if (extension === 'TXT') {
    return {
      icon: <FileText className="w-3.5 h-3.5" />,
      label: 'TXT',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
    };
  }

  return {
    icon: <File className="w-3.5 h-3.5" />,
    label: extension,
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  };
}

export default AttachmentBadge;
