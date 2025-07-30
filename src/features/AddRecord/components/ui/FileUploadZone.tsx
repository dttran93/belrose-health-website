import { useRef, useCallback, useState } from 'react';
import { Upload } from 'lucide-react';

/**
 * Reusable file upload zone with drag & drop functionality
 */
function FileUploadZone({
    onFilesSelected,
    acceptedTypes = [],
    maxFiles = 5,
    maxSizeBytes = 10 * 1024 * 1024,
    multiple = true,
    title = "Drop files here or click to upload",
    subtitle = "Supports various file formats",
    className = ""
}) {
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onFilesSelected(e.dataTransfer.files);
        }
    }, [onFilesSelected]);

    const handleFileInputChange = (e) => {
        if (e.target.files) {
            onFilesSelected(e.target.files);
        }
    };

    return (
        <div className={className}>
            <div
                className={`
                    border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer
                    ${dragActive 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    }
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
                <p className="text-lg font-medium text-gray-700 mb-2">
                    {title}
                </p>
                <p className="text-sm text-gray-500 mb-2">
                    {subtitle}
                </p>
                <p className="text-xs text-gray-400">
                    Max {maxFiles} files, {formatFileSize(maxSizeBytes)} each
                </p>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple={multiple}
                accept={acceptedTypes.join(',')}
                onChange={handleFileInputChange}
                className="hidden"
            />
        </div>
    );
}

export default FileUploadZone;