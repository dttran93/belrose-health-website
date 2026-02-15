import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { useFileDrop } from '@/hooks/useFileDrop';

interface FileUploadZoneProps {
  onFilesSelected: (files: FileList) => void;
  acceptedTypes: string[];
  maxFiles: number;
  maxSizeBytes: number;
  title: string;
  subtitle: string;
  compact?: boolean;
}

const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFilesSelected,
  acceptedTypes,
  maxFiles,
  maxSizeBytes,
  title,
  subtitle,
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Use the hook in bounded mode
  const { isDragging, dragHandlers } = useFileDrop({
    onDrop: files => {
      // Convert File[] to FileList-like object
      const fileList = {
        length: files.length,
        item: (index: number) => files[index] || null,
        [Symbol.iterator]: function* () {
          for (let i = 0; i < files.length; i++) {
            yield files[i];
          }
        },
      } as FileList;

      onFilesSelected(fileList);
    },
    global: false, // Bounded to this component only
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <div
      {...dragHandlers} // ✅ Spread drag handlers
      className={`border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer ${
        compact ? 'p-4' : 'p-8'
      } ${
        isDragging
          ? 'border-blue-500 bg-blue-50' // ✅ Visual feedback when dragging
          : 'border-gray-300 hover:border-complement-1'
      }`}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
      />

      <Upload
        className={`mx-auto mb-4 ${compact ? 'h-8 w-8' : 'h-12 w-12'} ${
          isDragging ? 'text-blue-500' : 'text-gray-400'
        }`}
      />

      <h3 className={`font-medium text-gray-900 mb-2 ${compact ? 'text-base' : 'text-lg'}`}>
        {title}
      </h3>

      <p className={`text-gray-600 mb-4 ${compact ? 'text-xs' : 'text-sm'}`}>{subtitle}</p>

      <p className="text-xs text-gray-500">
        Accepted: {acceptedTypes.join(', ')} • Max {maxFiles} files • {formatFileSize(maxSizeBytes)}{' '}
        each
      </p>
    </div>
  );
};

export default FileUploadZone;
