import React from 'react';
import useFileUpload from '@/features/AddRecord/hooks/useFileUpload';
import { useFHIRConversion } from '@/features/AddRecord/hooks/useFHIRConversion';
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

    //DEBUGGING
    console.log('🔄 AddRecord component rendering');
    const hookResult = useFileUpload();
    console.log('📁 Files from hook:', hookResult.files.length);

    const {
        files,
        processedFiles,
        firestoreData,
        savingToFirestore,
        addFiles,
        removeFile,
        retryFile,
        updateFileStatus,
        clearAll,
        uploadFiles,
        updateFirestoreRecord,
        getStats,
        savedToFirestoreCount,
        savingCount,
        deduplicationService,
        addFhirAsVirtualFile, 
        setFHIRConversionCallback,
        reset: resetFileUpload
    } = useFileUpload();

    const {
        fhirData,
        reviewedData,
        handleFHIRConverted,
        handleDataConfirmed,
        handleDataRejected,
        isAllFilesConverted,
        isAllFilesReviewed,
        getFHIRStats,
        reset: resetFHIR
    } = useFHIRConversion(
        processedFiles,
        firestoreData,
        updateFirestoreRecord,
        uploadFiles,
        removeFile
    );

    // 🔥 SET UP FHIR CONVERSION CALLBACK WITH DEBUGGING
    React.useEffect(() => {
        console.log('🔍 Setting FHIR callback:', typeof handleFHIRConverted);
        setFHIRConversionCallback((fileId: string, uploadResult: any) => {
            console.log('🎯 FHIR CALLBACK TRIGGERED:', fileId, uploadResult);
            
            // 🔥 FIND THE FILE IN THE CURRENT FILES ARRAY
            const currentFile = files.find(f => f.id === fileId);
            if (!currentFile || !currentFile.extractedText) {
                console.error('❌ File not found in current files:', fileId);
                console.log('📋 Available files:', files.map(f => ({id: f.id, name: f.name})));
                return Promise.resolve();
            }
            
            console.log('✅ Found file for FHIR conversion:', currentFile.name);
            return handleFHIRConverted(fileId, uploadResult, currentFile); // Pass the file object
        });
    }, [setFHIRConversionCallback, handleFHIRConverted, files]);

    console.log('🔍 Destructured updateFileStatus:', updateFileStatus);

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

                {/* Main Upload Interface */}
                <CombinedUploadFHIR
                    files={files}
                    addFiles={addFiles}
                    removeFile={removeFile}
                    retryFile={retryFile}
                    getStats={getStats}
                    updateFileStatus={updateFileStatus}
                    addFhirAsVirtualFile={addFhirAsVirtualFile} // NEW: Direct FHIR support
                    uploadFiles={uploadFiles} // NEW: Direct upload support
                    fhirData={fhirData}
                    onFHIRConverted={handleFHIRConverted}
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