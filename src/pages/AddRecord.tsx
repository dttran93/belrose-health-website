import React from 'react';
import useFileUpload from '@/features/AddRecord/hooks/useFileUpload';
import { ExportService } from '@/features/AddRecord/services/exportService';

// Import components
import CombinedUploadFHIR from '@/features/AddRecord/components/CombinedUploadFHIR';
import { StatsPanel } from '@/features/AddRecord/components/StatsPanel';

// ==================== TYPE DEFINITIONS ====================

/**
 * Props for the AddRecord component (currently none, but good for future extensibility)
 */
interface AddRecordProps {
  className?: string;
}

/**
 * Shape of the export data that gets downloaded
 */
interface ExportData {
  files: any[]; // Using any[] since processedFiles type varies
  firestoreData: Record<string, any>;
  stats: {
    files: any; // Return type from getStats()
    deduplication: any; // Return type from deduplicationService.getStats()
  };
  exportedAt: string;
}

// ==================== COMPONENT ====================

/**
 * AddRecord Component
 * 
 * Main page component for uploading and managing health records.
 * Handles both file uploads and direct FHIR input, with automatic
 * cloud storage and export capabilities.
 * 
 * Key Features:
 * - File drag & drop upload
 * - Direct FHIR data input
 * - Automatic cloud storage
 * - Export all data as JSON
 * - Real-time upload status
 * - Deduplication service
 */
const AddRecord: React.FC<AddRecordProps> = ({ className }) => {
    // CONSOLIDATED FILE MANAGEMENT: Single source of truth for all file operations
    const {
        files,
        processedFiles,
        firestoreData,
        savingToFirestore,
        addFiles,
        removeFile,
        retryFile,
        clearAll,
        uploadFiles,
        updateFirestoreRecord,
        getStats,
        savedToFirestoreCount,
        savingCount,
        deduplicationService,
        addFhirAsVirtualFile, // NEW: For direct FHIR input
        reset: resetFileUpload
    } = useFileUpload();

    console.log('📊 AddRecord state:', {
        filesCount: files.length,
        processedFilesCount: processedFiles.length,
        savedToFirestoreCount,
        savingCount
    });

    // Export service instance
    const exportService = new ExportService();

    // ==================== EVENT HANDLERS ====================

    /**
     * Download all processed data as JSON
     * Includes files, firestore data, and statistics
     */
    const downloadAllData = (): void => {
        const deduplicationStats = deduplicationService.getStats();
        
        const exportData: ExportData = {
            files: processedFiles,
            firestoreData: Object.fromEntries(firestoreData),
            stats: {
                files: getStats(),
                deduplication: deduplicationStats
            },
            exportedAt: new Date().toISOString()
        };

        exportService.downloadData(exportData, 'belrose-health-records');
    };

    /**
     * Reset everything and refresh the page
     * Provides a clean slate for new uploads
     */
    const resetAll = (): void => {
        resetFileUpload();
        window.location.reload(); // Fresh start
    };

    // ==================== COMPUTED VALUES ====================

    // Check if we have any data to show download/reset buttons
    const hasData = files.length > 0 || savedToFirestoreCount > 0;

    // Check if we're in a success state (no files left, but some saved)
    const isSuccessState = files.length === 0 && savedToFirestoreCount > 0;

    // ==================== RENDER JSX ====================

    return (
        <div className={`min-h-screen bg-gray-50 ${className || ''}`}>
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Add Health Records</h1>
                            <p className="text-gray-600 mt-2">
                                Upload medical documents or input FHIR data - everything gets saved automatically
                            </p>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                            {hasData && (
                                <>
                                    <button
                                        onClick={downloadAllData}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                        type="button"
                                    >
                                        📥 Download Data
                                    </button>
                                    <button
                                        onClick={resetAll}
                                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                        type="button"
                                    >
                                        🔄 Reset
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Upload Status */}
                {(savedToFirestoreCount > 0 || savingCount > 0) && (
                    <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-medium text-gray-900">Cloud Storage Status</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    {savedToFirestoreCount} record{savedToFirestoreCount !== 1 ? 's' : ''} saved to cloud
                                    {savingCount > 0 && (
                                        <span className="text-blue-600 ml-2">
                                            ({savingCount} uploading...)
                                        </span>
                                    )}
                                </p>
                            </div>
                            
                            {savedToFirestoreCount > 0 && (
                                <div className="text-green-600 flex items-center">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2" aria-hidden="true"></span>
                                    <span className="text-sm font-medium">Synced</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Main Upload Interface */}
                <CombinedUploadFHIR
                    files={files}
                    addFiles={addFiles}
                    removeFile={removeFile}
                    retryFile={retryFile}
                    getStats={getStats}
                    addFhirAsVirtualFile={addFhirAsVirtualFile} // NEW: Direct FHIR support
                    uploadFiles={uploadFiles} // NEW: Direct upload support
                />

                {/* Stats Panel */}
                {files.length > 0 && (
                    <div className="mt-8">
                        <StatsPanel 
                            processedFiles={processedFiles}
                            savedToFirestoreCount={savedToFirestoreCount}
                            fhirData={new Map()} // Empty since we're not using review flow
                            totalFhirResources={0}
                        />
                    </div>
                )}

                {/* Success State */}
                {isSuccessState && (
                    <div className="mt-8 text-center">
                        <div className="text-6xl mb-4" role="img" aria-label="Success">✅</div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                            All Records Uploaded!
                        </h2>
                        <p className="text-gray-600 mb-6">
                            {savedToFirestoreCount} health record{savedToFirestoreCount !== 1 ? 's' : ''} successfully saved to your cloud storage.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={resetAll}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                type="button"
                            >
                                Upload More Records
                            </button>
                            <a 
                                href="/edit-fhir"
                                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Edit Records
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddRecord;