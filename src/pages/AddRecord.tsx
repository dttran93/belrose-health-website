import React, { useState } from 'react';
import useFileManager from '@/features/AddRecord/hooks/useFileManager';
import { useFHIRConversion } from '@/features/AddRecord/hooks/useFHIRConversion';
import { convertToFHIR } from '@/features/AddRecord/services/fhirConversionService';
import { ExportService } from '@/features/AddRecord/services/exportService';
import { FileObject } from '@/types/core';
import { toast } from 'sonner';
import HealthRecordFull from "@/features/ViewEditRecord/components/RecordFull";

// Import components
import CombinedUploadFHIR from '@/features/AddRecord/components/CombinedUploadFHIR';
import { useSonner } from 'sonner';

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
  stats: {
    files: any; // Return type from getStats()
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
    const hookResult = useFileManager();
    console.log('📁 Files from hook:', hookResult.files.length);

    const {
        files,
        processedFiles,
        savingToFirestore,
        addFiles,
        removeFileFromLocal,
        removeFileComplete,
        retryFile,
        updateFileStatus,
        clearAll,
        enhancedClearAll,
        uploadFiles,
        updateFirestoreRecord,
        getStats,
        savedToFirestoreCount,
        savingCount,
        addFhirAsVirtualFile, 
        setFHIRConversionCallback,
        shouldAutoUpload,
        reset: resetFileUpload
    } = useFileManager();

    const {
        fhirData,
        handleFHIRConverted,
        reset: resetFHIR
    } = useFHIRConversion(
        processedFiles,
        updateFirestoreRecord,
        uploadFiles,
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
                console.log('📋 Available files:', files.map(f => ({id: f.id, name: f.fileName})));
                return Promise.resolve();
            }
            
            console.log('✅ Found file for FHIR conversion:', currentFile.fileName);
            return handleFHIRConverted(fileId, uploadResult); // Pass the file object
        });
    }, [setFHIRConversionCallback, handleFHIRConverted, files]);

    console.log('🔍 Destructured updateFileStatus:', updateFileStatus);

    console.log('📊 AddRecord state:', {
        filesCount: files.length,
        processedFilesCount: processedFiles.length,
        savedToFirestoreCount,
        savingCount
    });

    const [reviewMode, setReviewMode] = useState<{active: Boolean; record: FileObject | null}>({
        active: false,
        record: null
    });

    const handleReviewFile = (fileRecord: FileObject) => {
        const latestFile = files.find (f => f.id === fileRecord.id);

        if (!latestFile?.id) {
            console.error('File not found:', fileRecord.id);
            return;
        }

        setReviewMode({ active: true, record: fileRecord });
    };

    const handleSaveFromReview = async (updatedRecord: FileObject) => {
        try {
            const documentId = updatedRecord.id;

            if (!documentId) {
                throw new Error('Cannot save record - no document ID found');
            }
            
            await updateFirestoreRecord(documentId, {
                fhirData: updatedRecord.fhirData,
                belroseFields: updatedRecord.belroseFields,
                lastModified: new Date().toISOString()
            });

            //To update local files array with fresh data
            updateFileStatus(updatedRecord.id, 'completed', {
                fhirData: updatedRecord.fhirData,
                belroseFields: updatedRecord.belroseFields,
                lastModified: new Date().toISOString()
            });

            toast.success(`Record "${updatedRecord.belroseFields?.title}" saved successfully`, {
                duration: 4000
            });
            setReviewMode({ active: false, record: null });

        } catch (error) {
            console.error('Failed to save record:', error);
            toast.error('Failed to save record', { duration: 4000 });
        }
    };

    // Export service instance
    const exportService = new ExportService();

    // ==================== EVENT HANDLERS ====================

    /**
     * Download all processed data as JSON
     * Includes files and statistics
     */
    const downloadAllData = (): void => {        
    const exportData: ExportData = {
        files: processedFiles,
        stats: {
        files: getStats(),
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

    if (reviewMode.active && reviewMode.record) {
        return (
            <HealthRecordFull
            record={reviewMode.record}
            initialEditMode={true}
            comingFromAddRecord={true}
            onBack={() => setReviewMode({ active: false, record: null })}
            onSave={handleSaveFromReview}
            />
        );
    }

    return (
        <div className={`min-h-screen bg-gray-50 ${className || ''}`}>
            <div className="max-w-7xl mx-auto px-4 py-8">

                {/* Main Upload Interface */}
                <CombinedUploadFHIR
                    files={files}
                    addFiles={addFiles}
                    removeFile={removeFileComplete}
                    removeFileFromLocal={removeFileFromLocal}
                    retryFile={retryFile}
                    getStats={getStats}
                    updateFileStatus={updateFileStatus}
                    addFhirAsVirtualFile={addFhirAsVirtualFile}
                    uploadFiles={uploadFiles}
                    fhirData={fhirData}
                    onFHIRConverted={handleFHIRConverted}
                    convertTextToFHIR={convertToFHIR}
                    shouldAutoUpload={shouldAutoUpload}
                    savingToFirestore={savingToFirestore}
                    onReview={handleReviewFile}
                />

            </div>
        </div>
    );
};

export default AddRecord;