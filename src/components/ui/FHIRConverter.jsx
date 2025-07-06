import { useState } from 'react';
import { Zap, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { convertToFHIR } from '../../services/fhirConversionService';

/**
 * FHIR Converter Component - Handles conversion of extracted text to FHIR format
 * 
 * @param {Object} props
 * @param {Array} props.extractedFiles - Array of files with extracted text
 * @param {Function} props.onFHIRConverted - Callback when FHIR conversion is complete: (fileId, fhirData) => {}
 * @param {boolean} props.autoConvert - Whether to auto-convert when new files are added (default: false)
 * @param {string} props.className - Additional CSS classes
 */
function FHIRConverter({
    extractedFiles = [],
    onFHIRConverted,
    autoConvert = false,
    className = ''
}) {
    const [convertingFiles, setConvertingFiles] = useState(new Set());
    const [fhirResults, setFhirResults] = useState(new Map());
    const [expandedFiles, setExpandedFiles] = useState(new Set());

    const convertFileToFHIR = async (fileData) => {
        const fileId = fileData.id;
        
        setConvertingFiles(prev => new Set([...prev, fileId]));

        try {
            const fhirData = await convertToFHIR(fileData.extractedText, fileData.documentType);
            
            const result = {
                success: true,
                fhirData,
                convertedAt: new Date().toISOString()
            };

            setFhirResults(prev => new Map([...prev, [fileId, result]]));
            
            if (onFHIRConverted) {
                onFHIRConverted(fileId, fhirData);
            }

        } catch (error) {
            const result = {
                success: false,
                error: error.message,
                convertedAt: new Date().toISOString()
            };

            setFhirResults(prev => new Map([...prev, [fileId, result]]));
        } finally {
            setConvertingFiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(fileId);
                return newSet;
            });
        }
    };

    const convertAllFiles = async () => {
        const unconvertedFiles = extractedFiles.filter(file => 
            file.status === 'completed' && 
            file.extractedText && 
            !fhirResults.has(file.id) &&
            !convertingFiles.has(file.id)
        );

        for (const file of unconvertedFiles) {
            await convertFileToFHIR(file);
        }
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

    const getConversionStatus = (fileId) => {
        if (convertingFiles.has(fileId)) return 'converting';
        if (fhirResults.has(fileId)) {
            const result = fhirResults.get(fileId);
            return result.success ? 'completed' : 'error';
        }
        return 'ready';
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'converting':
                return <Loader2 className="w-4 h-4 animate-spin text-purple-500" />;
            case 'completed':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            default:
                return <Zap className="w-4 h-4 text-purple-600" />;
        }
    };

    const formatFHIRPreview = (fhirData) => {
        if (!fhirData) return '';
        
        const preview = {
            resourceType: fhirData.resourceType,
            total: fhirData.total || fhirData.entry?.length || 0,
            entryTypes: fhirData.entry?.map(e => e.resource?.resourceType).filter(Boolean) || []
        };

        return JSON.stringify(preview, null, 2);
    };

    const completedFiles = extractedFiles.filter(f => f.status === 'completed' && f.extractedText);
    const convertedCount = completedFiles.filter(f => fhirResults.has(f.id) && fhirResults.get(f.id).success).length;
    const hasUnconvertedFiles = completedFiles.some(f => !fhirResults.has(f.id) && !convertingFiles.has(f.id));

    if (completedFiles.length === 0) {
        return (
            <div className={`p-6 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded-lg ${className}`}>
                <Zap className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>No files with extracted text available for FHIR conversion</p>
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Header and Controls */}
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center space-x-3">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <div>
                        <h3 className="font-medium text-gray-900">FHIR Converter</h3>
                        <p className="text-sm text-gray-600">
                            Convert extracted medical text to standardized FHIR format
                        </p>
                    </div>
                </div>
                
                {hasUnconvertedFiles && (
                    <button
                        onClick={convertAllFiles}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        Convert All to FHIR
                    </button>
                )}
            </div>

            {/* Conversion Statistics */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{completedFiles.length}</div>
                    <div className="text-sm text-gray-600">Files Ready</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{convertedCount}</div>
                    <div className="text-sm text-gray-600">Converted</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{convertingFiles.size}</div>
                    <div className="text-sm text-gray-600">Converting</div>
                </div>
            </div>

            {/* File List */}
            <div className="space-y-3">
                {completedFiles.map((file) => {
                    const status = getConversionStatus(file.id);
                    const result = fhirResults.get(file.id);
                    const isExpanded = expandedFiles.has(file.id);

                    return (
                        <div key={file.id} className="bg-white border rounded-lg p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    {getStatusIcon(status)}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{file.name}</p>
                                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                                {file.documentType?.replace('_', ' ') || 'Unknown'}
                                            </span>
                                            <span>{file.wordCount} words</span>
                                            {result?.success && (
                                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                                    FHIR Converted
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    {status === 'converting' && (
                                        <span className="text-sm text-purple-600">Converting...</span>
                                    )}

                                    {status === 'ready' && (
                                        <button
                                            onClick={() => convertFileToFHIR(file)}
                                            className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                                        >
                                            Convert to FHIR
                                        </button>
                                    )}

                                    {status === 'error' && (
                                        <button
                                            onClick={() => convertFileToFHIR(file)}
                                            className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                                        >
                                            Retry
                                        </button>
                                    )}

                                    {(result?.success || result?.error) && (
                                        <button
                                            onClick={() => toggleExpanded(file.id)}
                                            className="text-gray-400 hover:text-gray-600 p-1"
                                        >
                                            {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Error Display */}
                            {result?.error && (
                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                    <strong>Conversion Error:</strong> {result.error}
                                </div>
                            )}

                            {/* FHIR Data Preview */}
                            {result?.success && isExpanded && (
                                <div className="mt-3 border-t pt-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-gray-700">FHIR Bundle</p>
                                        <span className="text-xs text-gray-500">
                                            Converted {new Date(result.convertedAt).toLocaleString()}
                                        </span>
                                    </div>
                                    
                                    {/* FHIR Summary */}
                                    <div className="bg-purple-50 p-3 rounded mb-3 text-sm">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="font-medium">Resource Type:</span> {result.fhirData.resourceType}
                                            </div>
                                            <div>
                                                <span className="font-medium">Entries:</span> {result.fhirData.entry?.length || 0}
                                            </div>
                                        </div>
                                        {result.fhirData.entry && result.fhirData.entry.length > 0 && (
                                            <div className="mt-2">
                                                <span className="font-medium">Contains:</span>{' '}
                                                {[...new Set(result.fhirData.entry.map(e => e.resource?.resourceType))].join(', ')}
                                            </div>
                                        )}
                                    </div>

                                    {/* Full FHIR JSON */}
                                    <div className="bg-gray-50 p-3 rounded text-xs text-gray-700 max-h-64 overflow-y-auto">
                                        <pre className="whitespace-pre-wrap">
                                            {JSON.stringify(result.fhirData, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default FHIRConverter;