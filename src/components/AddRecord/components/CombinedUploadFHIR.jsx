// components/CombinedUploadFHIR.jsx
import { FileText } from 'lucide-react';
import FileUploadZone from './ui/FileUploadZone';
import { FileListItem } from './ui/FileListItem';
import { useFileUploadManager } from '@/components/AddRecord/hooks/useFileUploadManager';

/**
 * Streamlined Document Upload & FHIR Conversion Component
 * 
 * This component is now focused purely on orchestration and layout,
 * with all complex logic extracted into services and hooks.
 */
function CombinedUploadFHIR({
    onFHIRResult,
    onFilesProcessed,
    acceptedTypes = ['.pdf', '.docx', '.doc', '.txt', '.jpg', '.jpeg', '.png'],
    maxFiles = 5,
    maxSizeBytes = 10 * 1024 * 1024, // 10MB
    className = ''
}) {
    // Use our custom hook for all file management
    const {
        files,
        fhirResults,
        addFiles,
        removeFile,
        retryFile,
        forceConvertFile,
        getStats
    } = useFileUploadManager({
        maxFiles,
        maxSizeBytes,
        onFilesProcessed,
        onFHIRResult
    });

    // Handle file selection with error handling
    const handleFilesSelected = (fileList) => {
        try {
            addFiles(fileList);
        } catch (error) {
            alert(error.message);
        }
    };

    const stats = getStats();
    const hasFiles = files.length > 0;
    const canAddMore = files.length < maxFiles;

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Main Content Section */}
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
                    {/* Show upload zone if no files, or file list if files exist */}
                    {!hasFiles ? (
                        <FileUploadZone
                            onFilesSelected={handleFilesSelected}
                            acceptedTypes={acceptedTypes}
                            maxFiles={maxFiles}
                            maxSizeBytes={maxSizeBytes}
                            title="Drop medical documents here or click to upload"
                            subtitle="Supports PDF, Word documents, images, and text files"
                        />
                    ) : (
                        <div className="space-y-4">
                            {/* File List */}
                            {files.map((fileItem) => (
                                <FileListItem
                                    key={fileItem.id}
                                    fileItem={fileItem}
                                    fhirResult={fhirResults.get(fileItem.id)}
                                    onRemove={removeFile}
                                    onRetry={retryFile}
                                    onForceConvert={forceConvertFile}
                                    showFHIRResults={true}
                                />
                            ))}

                            {/* Add More Files Button (if not at max limit) */}
                            {canAddMore && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <FileUploadZone
                                        onFilesSelected={handleFilesSelected}
                                        acceptedTypes={acceptedTypes}
                                        maxFiles={maxFiles - files.length}
                                        maxSizeBytes={maxSizeBytes}
                                        title="Add more files"
                                        subtitle={`You can add ${maxFiles - files.length} more file${maxFiles - files.length > 1 ? 's' : ''}`}
                                        compact={true} // This would be a smaller version
                                    />
                                </div>
                            )}

                            {/* Summary Statistics */}
                            <div className="text-sm text-gray-500 text-center bg-gray-50 p-3 rounded mt-4">
                                {stats.completed} of {stats.total} files successfully converted to FHIR
                                {stats.nonMedical > 0 && (
                                    <span className="ml-2 text-yellow-600">
                                        ({stats.nonMedical} detected as non-medical)
                                    </span>
                                )}
                                {stats.processing > 0 && (
                                    <span className="ml-2 text-blue-600">
                                        ({stats.processing} processing)
                                    </span>
                                )}
                                {stats.errors > 0 && (
                                    <span className="ml-2 text-red-600">
                                        ({stats.errors} errors)
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CombinedUploadFHIR;