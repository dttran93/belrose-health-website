import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, Image, File, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import Tesseract from 'tesseract.js';
import mammoth from 'mammoth';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const extractPdfText = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + ' ';
    }

    return fullText.trim();
}

const extractImageText = async (file) => {
    const result = await Tesseract.recognize(file, 'eng', {
        logger: m => console.log(m) // Optional: progress logging
    });
    return result.data.text;
};

const extractWordText = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
};

/**
 * Reusable Document Uploader Component
 * 
 * @param {Object} props
 * @param {Function} props.onFilesProcessed - Callback when files are processed: (processedFiles) => {}
 * @param {Array} props.acceptedTypes - File types to accept, e.g., ['.pdf', '.docx', '.jpg']
 * @param {number} props.maxFiles - Maximum number of files (default: 10)
 * @param {number} props.maxSizeBytes - Maximum file size in bytes (default: 10MB)
 * @param {boolean} props.autoProcess - Whether to auto-process files on upload (default: true)
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.customMessages - Custom messages for different states
 */
function DocumentUploader({
    onFilesProcessed,
    acceptedTypes = ['.pdf', '.docx', '.doc', '.txt', '.jpg', '.jpeg', '.png', '.gif'],
    maxFiles = 10,
    maxSizeBytes = 10 * 1024 * 1024, // 10MB
    autoProcess = true,
    className = '',
    customMessages = {}
}) {
    // State
    const [files, setFiles] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const messages = {
        dropZoneTitle: 'Drop medical documents here or click to upload',
        dropZoneSubtitle: 'Supports PDF, Word documents, images, and text files',
        processing: 'Processing...',
        completed: 'Completed',
        failed: 'Failed',
        ...customMessages
    };

    // Notify parent component when files change
    useEffect(() => {
        const allProcessedFiles = files.filter(f => f.status === 'completed');
        
        if (allProcessedFiles.length > 0 && onFilesProcessed) {
            onFilesProcessed(allProcessedFiles);
        }
    }, [files, onFilesProcessed]);

    // File processing functions
    const extractTextFromFile = async (file) => {
        try {
            switch (true) {
                case file.type === 'application/pdf':
                    return await extractPdfText(file);

                case file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                case file.type === 'application/msword':
                    return await extractWordText(file);

                case file.type.startsWith('text/'):
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = reject;
                        reader.readAsText(file);
                    });

                case file.type.startsWith('image/'):
                    return await extractImageText(file);

                default:
                    throw new Error(`Unsupported file type: ${file.type}`);
            }
        } catch (error) {
            console.error(`Error extracting text from ${file.name}:`, error);
            throw new Error(`Failed to extract text: ${error.message}`);
        }
    };

    // Process individual file
    const processFile = async (fileItem) => {
        // Set processing status
        setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, status: 'processing' } : f
        ));

        try {
            const extractedText = await extractTextFromFile(fileItem.file);
            
            const processedFile = {
                ...fileItem,
                status: 'completed',
                extractedText,
                wordCount: extractedText.split(/\s+/).length,
                extractedAt: new Date().toISOString()
            };

            // Update file with results
            setFiles(prev => prev.map(f => 
                f.id === fileItem.id ? processedFile : f
            ));

        } catch (error) {
            console.error('Error processing file:', fileItem.name, error);
            setFiles(prev => prev.map(f => 
                f.id === fileItem.id ? { ...f, status: 'error', error: error.message } : f
            ));
        }
    };

    const validateFile = (file) => {
        // Check file size
        if (file.size > maxSizeBytes) {
            return `File size exceeds ${formatFileSize(maxSizeBytes)} limit`;
        }

        // Check file type
        const fileExtension = '.' + file.name.toLowerCase().split('.').pop();
        if (!acceptedTypes.includes(fileExtension) && !acceptedTypes.includes(file.type)) {
            return `File type not supported. Accepted types: ${acceptedTypes.join(', ')}`;
        }

        return null;
    };

    // Handle file selection/drop
    const handleFiles = useCallback((selectedFiles) => {
        const fileArray = Array.from(selectedFiles);

        // Check max files limit
        if (files.length + fileArray.length > maxFiles) {
            alert(`Maximum ${maxFiles} files allowed`);
            return;
        }

        const newFiles = fileArray.map(file => {
            const validationError = validateFile(file);
            return {
                id: Date.now() + Math.random(),
                file,
                name: file.name,
                size: file.size,
                type: file.type,
                status: validationError ? 'error' : 'ready',
                error: validationError
            };
        });

        setFiles(prev => [...prev, ...newFiles]);

        // Process files after state update
        if (autoProcess) {
            setTimeout(() => {
                newFiles.forEach(fileItem => {
                    if (fileItem.status === 'ready') {
                        processFile(fileItem);
                    }
                });
            }, 0);
        }
    }, [files.length, maxFiles, autoProcess]);

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
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles]);

    const removeFile = (fileId) => {
        setFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const retryFile = (fileItem) => {
        processFile(fileItem);
    };

    const getFileIcon = (type) => {
        if (type.startsWith('image/')) return <Image className="w-5 h-5 text-blue-500" />;
        if (type === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
        if (type.includes('word')) return <FileText className="w-5 h-5 text-blue-600" />;
        return <File className="w-5 h-5 text-gray-500" />;
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'processing':
                return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
            case 'completed':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                return null;
        }
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Upload Drop Zone */}
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
                <p className="text-lg font-medium text-gray-700 mb-2">{messages.dropZoneTitle}</p>
                <p className="text-sm text-gray-500 mb-2">{messages.dropZoneSubtitle}</p>
                <p className="text-xs text-gray-400">
                    Max {maxFiles} files, {formatFileSize(maxSizeBytes)} each
                </p>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptedTypes.join(',')}
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
            />

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-3">
                    {files.map((fileItem) => (
                        <div key={fileItem.id} className="bg-white border rounded-lg p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    {getFileIcon(fileItem.type)}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{fileItem.name}</p>
                                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                                            <span>{formatFileSize(fileItem.size)}</span>
                                            {fileItem.wordCount && (
                                                <span>{fileItem.wordCount} words extracted</span>
                                            )}
                                            {fileItem.extractedAt && (
                                                <span>Processed {new Date(fileItem.extractedAt).toLocaleTimeString()}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    {getStatusIcon(fileItem.status)}
                                    
                                    {fileItem.status === 'ready' && !autoProcess && (
                                        <button
                                            onClick={() => processFile(fileItem)}
                                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                                        >
                                            Process
                                        </button>
                                    )}
                                    
                                    {fileItem.status === 'error' && (
                                        <button
                                            onClick={() => retryFile(fileItem)}
                                            className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                                        >
                                            Retry
                                        </button>
                                    )}
                                    
                                    <button
                                        onClick={() => removeFile(fileItem.id)}
                                        className="text-gray-400 hover:text-red-500 p-1"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Error Message */}
                            {fileItem.status === 'error' && fileItem.error && (
                                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                                    {fileItem.error}
                                </div>
                            )}

                            {/* Extracted Text Preview */}
                            {fileItem.status === 'completed' && fileItem.extractedText && (
                                <div className="mt-3 border-t pt-3">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Extracted Text Preview:</p>
                                    <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 max-h-32 overflow-y-auto">
                                        {fileItem.extractedText.substring(0, 300)}
                                        {fileItem.extractedText.length > 300 && '...'}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Summary */}
            {files.length > 0 && (
                <div className="text-sm text-gray-500 text-center">
                    {files.filter(f => f.status === 'completed').length} of {files.length} files processed
                </div>
            )}
        </div>
    );
}

export default DocumentUploader;