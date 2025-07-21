import { useState } from 'react';
import { FileText, Image, File, X, AlertCircle, CheckCircle, Loader2, Zap, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { EnhancedFHIRResults } from '@/features/AddRecord/components/FHIRValidation';

/**
 * Individual file list item with processing status and expandable details
 */
export function FileListItem({
    fileItem,
    fhirResult,
    onRemove,
    onRetry,
    onForceConvert,
    showFHIRResults = true
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (type) => {
        if (!type) return <File className="w-5 h-5 text-gray-500" />;
        if (type.startsWith('image/')) return <Image className="w-5 h-5 text-blue-500" />;
        if (type === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
        if (type.includes('word')) return <FileText className="w-5 h-5 text-blue-600" />;
        return <File className="w-5 h-5 text-gray-500" />;
    };

    const getStatusIcon = (status, fhirResult) => {
        switch (status) {
            case 'processing':
                return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
            case 'medical_detected':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'non_medical_detected':
                return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'converting':
                return <Loader2 className="w-4 h-4 animate-spin text-purple-500" />;
            case 'completed':
                if (fhirResult?.success && fhirResult.fhirData?._validation) {
                    const validation = fhirResult.fhirData._validation;
                    if (validation.isValid && !validation.hasWarnings) {
                        return <CheckCircle className="w-4 h-4 text-green-500" />;
                    } else if (validation.isValid && validation.hasWarnings) {
                        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
                    } else if (validation.hasErrors) {
                        return <AlertCircle className="w-4 h-4 text-red-500" />;
                    }
                }
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

    const getStatusText = (status, fhirResult) => {
        const baseStatuses = {
            'processing': 'Processing document...',
            'medical_detected': 'Medical content detected',
            'non_medical_detected': 'Not detected as medical',
            'converting': 'Converting to FHIR...',
            'completed': 'Complete',
            'extraction_error': 'Text extraction failed',
            'detection_error': 'Medical detection failed',
            'fhir_error': 'FHIR conversion failed',
            'processing_error': 'Processing failed',
            'error': 'Error',
            'ready': 'Ready'
        };
        
        const baseStatus = baseStatuses[status] || 'Ready';
        
        if (status === 'completed' && fhirResult?.success && fhirResult.fhirData?._validation) {
            const validation = fhirResult.fhirData._validation;
            if (validation.isValid && !validation.hasWarnings) {
                return baseStatus + ' • Valid FHIR';
            } else if (validation.isValid && validation.hasWarnings) {
                return baseStatus + ` • Valid (${validation.warnings.length} warnings)`;
            } else if (validation.hasErrors) {
                return baseStatus + ` • Invalid (${validation.errors.length} errors)`;
            }
        }
        
        return baseStatus;
    };

    const canForceConvert = fileItem.status === 'non_medical_detected' && fileItem.extractedText;
    const canRetry = fileItem.status.includes('error');
    const hasExpandableContent = fileItem.extractedText || fhirResult || fileItem.medicalDetection;

    return (
        <div className="bg-white border rounded-lg shadow-sm">
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
                            {fileItem.processingTime && (
                                <span>{fileItem.processingTime}ms</span>
                            )}
                            <span className="flex items-center space-x-1">
                                {getStatusIcon(fileItem.status, fhirResult)}
                                <span>{getStatusText(fileItem.status, fhirResult)}</span>
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
                                {fileItem.processingMethod && (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                        {fileItem.processingMethod.replace(/_/g, ' ')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    {/* Action Buttons */}
                    {canForceConvert && (
                        <button
                            onClick={() => onForceConvert(fileItem)}
                            className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
                            title="Convert to FHIR anyway"
                        >
                            Convert Anyway
                        </button>
                    )}

                    {canRetry && (
                        <button
                            onClick={() => onRetry(fileItem)}
                            className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                        >
                            Retry
                        </button>
                    )}

                    {/* Expand/collapse button */}
                    {hasExpandableContent && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                        >
                            {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    )}

                    {/* Remove button */}
                    <button
                        onClick={() => onRemove(fileItem.id)}
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
                        <strong>AI Analysis:</strong> {fileItem.medicalDetection.reasoning}
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
                                        <span className="font-medium">Method:</span> {fileItem.processingMethod?.replace(/_/g, ' ')}
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
                    {showFHIRResults && fhirResult && (
                        <div className="p-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                <Zap className="w-4 h-4 mr-1 text-purple-600" />
                                FHIR Conversion Result
                            </h4>
                            
                            <EnhancedFHIRResults fhirResult={fhirResult} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}