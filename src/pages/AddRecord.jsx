import React, { useState, useEffect } from 'react';
import useFileUpload from '@/features/AddRecord/hooks/useFileUpload';
import { ExportService } from '@/features/AddRecord/services/exportService';

// Import components
import CombinedUploadFHIR from '@/features/AddRecord/components/CombinedUploadFHIR';
import { StatsPanel } from '@/features/AddRecord/components/StatsPanel';

const AddRecord = () => {
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

    // Export service
    const exportService = new ExportService();

    // Download all data
    const downloadAllData = () => {
        const deduplicationStats = deduplicationService.getStats();
        
        const exportData = {
            files: processedFiles,
            firestoreData: Object.fromEntries(firestoreData),
            stats: {
                files: getStats(),
                deduplication: deduplicationStats
            },
            exportedAt: new Date().toISOString()
        };

        exportService.downloadJson(exportData, 'belrose-health-records');
    };

    // Reset everything
    const resetAll = () => {
        resetFileUpload();
        window.location.reload(); // Fresh start
    };

    return (
        <div className="min-h-screen bg-gray-50">
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
                            {(files.length > 0 || savedToFirestoreCount > 0) && (
                                <>
                                    <button
                                        onClick={downloadAllData}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                    >
                                        📥 Download Data
                                    </button>
                                    <button
                                        onClick={resetAll}
                                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                    >
                                        🔄 Reset
                                    </button>
                                </>
                            )}
                            
                            <a 
                                href="/edit-fhir"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                ✏️ Edit Records
                            </a>
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
                                    {savedToFirestoreCount} records saved to cloud
                                    {savingCount > 0 && (
                                        <span className="text-blue-600 ml-2">
                                            ({savingCount} uploading...)
                                        </span>
                                    )}
                                </p>
                            </div>
                            
                            {savedToFirestoreCount > 0 && (
                                <div className="text-green-600 flex items-center">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
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
                {files.length === 0 && savedToFirestoreCount > 0 && (
                    <div className="mt-8 text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                            All Records Uploaded!
                        </h2>
                        <p className="text-gray-600 mb-6">
                            {savedToFirestoreCount} health record{savedToFirestoreCount !== 1 ? 's' : ''} successfully saved to your cloud storage.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={resetAll}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Upload More Records
                            </button>
                            <a 
                                href="/edit-fhir"
                                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
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