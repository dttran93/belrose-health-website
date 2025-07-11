import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, Image, File, X, AlertCircle, CheckCircle, Loader2, Zap, Eye, EyeOff } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import Tesseract from 'tesseract.js';
import mammoth from 'mammoth';
import { convertToFHIR } from '@/components/AddRecord/services/fhirConversionService';
import { aiImageService } from '@/components/AddRecord/services/aiImageService';
import { aiMedicalDetectionService } from '@/components/AddRecord/services/aiMedicalDetectionService';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Keep existing text extraction functions for non-images
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
};

const extractWordText = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
};

// Enhanced image text extraction with AI Vision
const extractImageText = async (file) => {
    console.log('Using AI Vision for image analysis...');
    try {
        // Use AI Vision for much better results
        const result = await aiImageService.extractTextFromImage(file);
        return result;
    } catch (error) {
        console.warn('AI Vision failed, falling back to Tesseract:', error);
        // Fallback to Tesseract if AI Vision fails
        const tesseractResult = await Tesseract.recognize(file, 'eng', {
            logger: m => console.log('Tesseract:', m)
        });
        return tesseractResult.data.text;
    }
};

/**
 * Combined Document Upload & FHIR Conversion Component with AI Medical Detection
 * 
 * This component handles the entire workflow:
 * 1. File upload (drag & drop or click)
 * 2. Text extraction from documents (AI Vision for images, local for others)
 * 3. Medical content detection (prevents non-medical docs from FHIR conversion)
 * 4. Automatic FHIR conversion for medical documents
 * 
 * @param {Object} props
 * @param {Function} props.onFHIRResult - Callback when FHIR conversion is complete: (fileId, fhirData) => {}
 * @param {Function} props.onFilesProcessed - Callback when files are extracted (for workflow integration)
 * @param {Array} props.acceptedTypes - File types to accept
 * @param {number} props.maxFiles - Maximum number of files (default: 5)
 * @param {number} props.maxSizeBytes - Maximum file size in bytes (default: 10MB)
 * @param {string} props.className - Additional CSS classes
 */
function CombinedUploadFHIR({
    onFHIRResult,
    onFilesProcessed,
    acceptedTypes = ['.pdf', '.docx', '.doc', '.txt', '.jpg', '.jpeg', '.png'],
    maxFiles = 5,
    maxSizeBytes = 10 * 1024 * 1024, // 10MB
    className = ''
}) {
    // File management state
    const [files, setFiles] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);
    
    // FHIR conversion state
    const [fhirResults, setFhirResults] = useState(new Map());
    const [expandedFiles, setExpandedFiles] = useState(new Set());

    // Enhanced text extraction that routes to appropriate service
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

    // Enhanced process file with medical detection
    const processFile = async (fileItem) => {
        console.log('Processing file:', fileItem.name);
        
        try {
            // Step 1: Handle different file types for detection + extraction
            if (fileItem.file.type.startsWith('image/')) {
                // For images, use AI Vision for both detection and extraction
                setFiles(prev => prev.map(f => 
                    f.id === fileItem.id ? { ...f, status: 'analyzing_image' } : f
                ));

                try {
                    // Use AI Vision for full analysis
                    const visionResult = await aiImageService.analyzeImageFull(fileItem.file);
                    
                    // Create the processed file data
                    let processedFileData = null;
                    setFiles(prev => prev.map(f => {
                        if (f.id === fileItem.id) {
                            processedFileData = { 
                                ...f, 
                                status: visionResult.isMedical ? 'medical_detected' : 'non_medical_detected',
                                extractedText: visionResult.extractedText,
                                wordCount: visionResult.extractedText?.split(/\s+/).length || 0,
                                medicalDetection: {
                                    ...visionResult,
                                    source: 'claude_vision'
                                },
                                extractedAt: new Date().toISOString()
                            };
                            return processedFileData;
                        }
                        return f;
                    }));

                    // IMPORTANT: Always notify parent about processed file, regardless of medical status
                    if (onFilesProcessed && processedFileData) {
                        console.log('Calling onFilesProcessed callback for workflow integration...');
                        onFilesProcessed([processedFileData]);
                    }

                    // If not medical, stop here (but workflow can still proceed)
                    if (!visionResult.isMedical || visionResult.confidence < 0.3) {
                        return; // User can choose to force convert later
                    }

                    // Continue to FHIR conversion
                    return await convertToFHIRStep(fileItem.id, visionResult.extractedText, visionResult.documentType);

                } catch (visionError) {
                    console.warn('AI Vision failed, using fallback:', visionError);
                    
                    // Fallback to traditional extraction + text detection
                    return await processWithTextDetection(fileItem);
                }

            } else {
                // For non-images, use traditional extraction + AI detection
                return await processWithTextDetection(fileItem);
            }

        } catch (error) {
            console.error('Error processing file:', error);
            handleProcessingError(fileItem.id, error);
        }
    };

    // Process files using text extraction + AI medical detection
    const processWithTextDetection = async (fileItem) => {
        // Step 1: Extract text
        setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, status: 'extracting' } : f
        ));

        const extractedText = await extractTextFromFile(fileItem.file);
        
        // Step 2: AI medical detection
        setFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { 
                ...f, 
                status: 'detecting_medical',
                extractedText,
                wordCount: extractedText.split(/\s+/).length
            } : f
        ));

        const detection = await aiMedicalDetectionService.detectMedicalRecord(
            extractedText, 
            fileItem.name, 
            fileItem.file.type
        );

        // Create the processed file data
        let processedFileData = null;
        setFiles(prev => prev.map(f => {
            if (f.id === fileItem.id) {
                processedFileData = { 
                    ...f, 
                    status: detection.isMedical ? 'medical_detected' : 'non_medical_detected',
                    medicalDetection: {
                        ...detection,
                        source: 'text_analysis'
                    },
                    extractedAt: new Date().toISOString()
                };
                return processedFileData;
            }
            return f;
        }));

        // IMPORTANT: Always notify parent about processed file, regardless of medical status
        if (onFilesProcessed && processedFileData) {
            console.log('Calling onFilesProcessed callback for workflow integration...');
            onFilesProcessed([processedFileData]);
        }

        // If not medical, stop here
        if (!detection.isMedical || detection.confidence < 0.3) {
            return; // User can choose to force convert later
        }

        // Continue to FHIR conversion
        return await convertToFHIRStep(fileItem.id, extractedText, detection.documentType);
    };

    // FHIR conversion step
   const convertToFHIRStep = async (fileId, extractedText, documentType) => {
    setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'converting' } : f
    ));

    try {
        const fhirData = await convertToFHIR(extractedText, documentType || 'medical_record');
        
        const fhirResult = {
            success: true,
            fhirData,
            convertedAt: new Date().toISOString()
        };

        // Store FHIR results
        setFhirResults(prev => new Map([...prev, [fileId, fhirResult]]));
        
        // Update file status to completed
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'completed' } : f));

        // Notify parent component about FHIR result
        if (onFHIRResult) {
            onFHIRResult(fileId, fhirData);
        }

        // Notify about processed file after state has updated
        setTimeout(() => {
            setFiles(currentFiles => {
                const completedFile = currentFiles.find(f => f.id === fileId);
                
                if (onFilesProcessed && completedFile) {
                    onFilesProcessed([completedFile]);
                }
                
                return currentFiles; // Don't modify state, just read it
            });
        }, 0);

        } catch (fhirError) {
            const fhirResult = {
                success: false,
                error: fhirError.message,
                convertedAt: new Date().toISOString()
            };
            
            setFhirResults(prev => new Map([...prev, [fileId, fhirResult]]));
            
            setFiles(prev => prev.map(f => 
                f.id === fileId ? { 
                    ...f, 
                    status: 'fhir_error',
                    error: fhirError.message
                } : f
            ));
        }
    };

    // Handle processing errors
    const handleProcessingError = (fileId, error) => {
        if (error.message.includes('extract text')) {
            setFiles(prev => prev.map(f => 
                f.id === fileId ? { 
                    ...f, 
                    status: 'extraction_error', 
                    error: error.message 
                } : f
            ));
        } else if (error.message.includes('detection') || error.message.includes('analyze')) {
            setFiles(prev => prev.map(f => 
                f.id === fileId ? { 
                    ...f, 
                    status: 'detection_error', 
                    error: error.message 
                } : f
            ));
        } else {
            setFiles(prev => prev.map(f => 
                f.id === fileId ? { 
                    ...f, 
                    status: 'processing_error', 
                    error: error.message 
                } : f
            ));
        }
    };

    // Force convert non-medical files (user override)
    const forceConvertFile = async (fileItem) => {
        if (!fileItem.extractedText) {
            console.error('No extracted text available for force conversion');
            return;
        }

        console.log('Force converting non-medical file:', fileItem.name);
        await convertToFHIRStep(fileItem.id, fileItem.extractedText, 'medical_record');
    };

    // File validation (unchanged)
    const validateFile = (file) => {
        if (file.size > maxSizeBytes) {
            return `File size exceeds ${formatFileSize(maxSizeBytes)} limit`;
        }

        const fileExtension = '.' + file.name.toLowerCase().split('.').pop();
        if (!acceptedTypes.includes(fileExtension) && !acceptedTypes.includes(file.type)) {
            return `File type not supported. Accepted: ${acceptedTypes.join(', ')}`;
        }

        return null;
    };

    // Handle file selection (unchanged)
    const handleFiles = useCallback((fileList) => {
        const selectedFiles = Array.from(fileList);
        
        if (files.length + selectedFiles.length > maxFiles) {
            alert(`Maximum ${maxFiles} files allowed`);
            return;
        }

        const newFiles = selectedFiles.map(file => {
            const validationError = validateFile(file);
            return {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                name: file.name,
                size: file.size,
                type: file.type,
                documentType: 'medical_record',
                status: validationError ? 'error' : 'ready',
                error: validationError
            };
        });

        setFiles(prev => [...prev, ...newFiles]);

        // Auto-process valid files
        setTimeout(() => {
            newFiles.forEach(fileItem => {
                if (fileItem.status === 'ready') {
                    processFile(fileItem);
                }
            });
        }, 0);
    }, [files.length, maxFiles]);

    // Drag and drop handlers (unchanged)
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

    // UI helper functions
    const removeFile = (fileId) => {
        setFiles(prev => prev.filter(f => f.id !== fileId));
        setFhirResults(prev => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            return newMap;
        });
    };

    const retryFile = (fileItem) => {
        processFile(fileItem);
    };

    const toggleExpanded = (fileId) => {
        setExpandedFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileId)) {
                newSet.delete(fileId);
            } else {
                newSet.add(fileId);
            }
            return newSet;
        });
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
            case 'extracting':
                return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
            case 'analyzing_image':
                return <Eye className="w-4 h-4 animate-pulse text-purple-500" />;
            case 'detecting_medical':
                return <Loader2 className="w-4 h-4 animate-spin text-orange-500" />;
            case 'medical_detected':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'non_medical_detected':
                return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'converting':
                return <Loader2 className="w-4 h-4 animate-spin text-purple-500" />;
            case 'completed':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'extraction_error':
            case 'detection_error':
            case 'fhir_error':
            case 'processing_error':
            case 'error':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                return null;
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'extracting':
                return 'Extracting text...';
            case 'analyzing_image':
                return 'AI analyzing image...';
            case 'detecting_medical':
                return 'Detecting medical content...';
            case 'medical_detected':
                return 'Medical content detected';
            case 'non_medical_detected':
                return 'Not detected as medical';
            case 'converting':
                return 'Converting to FHIR...';
            case 'completed':
                return 'Complete';
            case 'extraction_error':
                return 'Text extraction failed';
            case 'detection_error':
                return 'Medical detection failed';
            case 'fhir_error':
                return 'FHIR conversion failed';
            case 'processing_error':
                return 'Processing failed';
            case 'error':
                return 'Error';
            default:
                return 'Ready';
        }
    };

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Upload Section - unchanged */}
            <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span>Document Upload & FHIR Conversion</span>
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Upload medical documents - AI will detect medical content and convert to FHIR format
                    </p>
                </div>
                
                <div className="p-6">
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
                            Drop medical documents here or click to upload
                        </p>
                        <p className="text-sm text-gray-500 mb-2">
                            Supports PDF, Word documents, images, and text files
                        </p>
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
                </div>
            </div>

            {/* Files Processing List - enhanced with medical detection info */}
            {files.length > 0 && (
                <div className="space-y-4">
                    {files.map((fileItem) => {
                        const fhirResult = fhirResults.get(fileItem.id);
                        const isExpanded = expandedFiles.has(fileItem.id);

                        return (
                            <div key={fileItem.id} className="bg-white border rounded-lg shadow-sm">
                                {/* File Header */}
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                        {getFileIcon(fileItem.type)}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{fileItem.name}</p>
                                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                                                <span>{formatFileSize(fileItem.size)}</span>
                                                {fileItem.wordCount && (
                                                    <span>{fileItem.wordCount} words extracted</span>
                                                )}
                                                <span className="flex items-center space-x-1">
                                                    {getStatusIcon(fileItem.status)}
                                                    <span>{getStatusText(fileItem.status)}</span>
                                                </span>
                                            </div>
                                            
                                            {/* Medical Detection Info */}
                                            {fileItem.medicalDetection && (
                                                <div className="flex items-center space-x-2 mt-1 text-xs">
                                                    <span className={`px-2 py-1 rounded-full ${
                                                        fileItem.medicalDetection.isMedical 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {fileItem.medicalDetection.isMedical ? 'Medical' : 'Non-Medical'}
                                                    </span>
                                                    <span className="text-gray-500">
                                                        {Math.round(fileItem.medicalDetection.confidence * 100)}% confidence
                                                    </span>
                                                    {fileItem.medicalDetection.source === 'claude_vision' && (
                                                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                                                            Vision AI
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        {/* Force convert button for non-medical files */}
                                        {fileItem.status === 'non_medical_detected' && fileItem.extractedText && (
                                            <button
                                                onClick={() => forceConvertFile(fileItem)}
                                                className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                                                title="Convert to FHIR anyway"
                                            >
                                                Convert Anyway
                                            </button>
                                        )}

                                        {/* Retry button for failed files */}
                                        {(fileItem.status === 'extraction_error' || 
                                          fileItem.status === 'detection_error' || 
                                          fileItem.status === 'fhir_error' ||
                                          fileItem.status === 'processing_error') && (
                                            <button
                                                onClick={() => retryFile(fileItem)}
                                                className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                                            >
                                                Retry
                                            </button>
                                        )}

                                        {/* Expand/collapse button */}
                                        {(fileItem.extractedText || fhirResult || fileItem.medicalDetection) && (
                                            <button
                                                onClick={() => toggleExpanded(fileItem.id)}
                                                className="text-gray-400 hover:text-gray-600 p-1"
                                            >
                                                {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        )}

                                        {/* Remove button */}
                                        <button
                                            onClick={() => removeFile(fileItem.id)}
                                            className="text-gray-400 hover:text-red-500 p-1"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Error Messages */}
                                {fileItem.error && (
                                    <div className="px-4 pb-2">
                                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                                            <strong>Error:</strong> {fileItem.error}
                                        </div>
                                    </div>
                                )}

                                {/* Medical Detection Suggestion */}
                                {fileItem.medicalDetection && !fileItem.medicalDetection.isMedical && (
                                    <div className="px-4 pb-2">
                                        <div className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                                            <strong>AI Analysis:</strong> {fileItem.medicalDetection.suggestion}
                                        </div>
                                    </div>
                                )}

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="border-t bg-gray-50">
                                        {/* Medical Detection Details */}
                                        {fileItem.medicalDetection && (
                                            <div className="p-4 border-b">
                                                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                                    <AlertCircle className="w-4 h-4 mr-1" />
                                                    AI Medical Detection Results
                                                </h4>
                                                <div className="bg-white p-3 rounded text-sm border">
                                                    <div className="grid grid-cols-2 gap-4 mb-2">
                                                        <div>
                                                            <span className="font-medium">Classification:</span> {fileItem.medicalDetection.documentType}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium">Source:</span> {fileItem.medicalDetection.source}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Reasoning:</span> {fileItem.medicalDetection.reasoning}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Extracted Text Preview */}
                                        {fileItem.extractedText && (
                                            <div className="p-4 border-b">
                                                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                                    <FileText className="w-4 h-4 mr-1" />
                                                    Extracted Text Preview
                                                </h4>
                                                <div className="bg-white p-3 rounded text-sm text-gray-600 max-h-32 overflow-y-auto border">
                                                    {fileItem.extractedText.substring(0, 500)}
                                                    {fileItem.extractedText.length > 500 && '...'}
                                                </div>
                                            </div>
                                        )}

                                        {/* FHIR Results */}
                                        {fhirResult && (
                                            <div className="p-4">
                                                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                                    <Zap className="w-4 h-4 mr-1 text-purple-600" />
                                                    FHIR Conversion Result
                                                </h4>
                                                
                                                {fhirResult.success ? (
                                                    <div>
                                                        <div className="bg-purple-50 p-3 rounded mb-3 text-sm border border-purple-200">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <span className="font-medium">Resource Type:</span> {fhirResult.fhirData.resourceType}
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium">Entries:</span> {fhirResult.fhirData.entry?.length || 0}
                                                                </div>
                                                            </div>
                                                            {fhirResult.fhirData.entry && fhirResult.fhirData.entry.length > 0 && (
                                                                <div className="mt-2">
                                                                    <span className="font-medium">Contains:</span>{' '}
                                                                    {[...new Set(fhirResult.fhirData.entry.map(e => e.resource?.resourceType))].join(', ')}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Full FHIR JSON */}
                                                        <div className="bg-white p-3 rounded text-xs text-gray-700 max-h-64 overflow-y-auto border">
                                                            <pre className="whitespace-pre-wrap">
                                                                {JSON.stringify(fhirResult.fhirData, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
                                                        <strong>FHIR Conversion Error:</strong> {fhirResult.error}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Enhanced Summary */}
                    <div className="text-sm text-gray-500 text-center bg-gray-50 p-3 rounded">
                        {files.filter(f => f.status === 'completed').length} of {files.length} files successfully converted to FHIR
                        {files.filter(f => f.status === 'non_medical_detected').length > 0 && (
                            <span className="ml-2 text-yellow-600">
                                ({files.filter(f => f.status === 'non_medical_detected').length} detected as non-medical)
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default CombinedUploadFHIR;