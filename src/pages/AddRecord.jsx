import React, { useState, useEffect } from 'react';
import useFileUpload from '@/features/AddRecord/hooks/useFileUpload';
import { useFHIRConversion } from '@/features/AddRecord/hooks/useFHIRConversion';
import { ExportService } from '@/features/AddRecord/services/exportService';

// Import all components
import { ProgressSteps } from '@/features/AddRecord/components/ProgressSteps';
import { StatusBanner } from '@/features/AddRecord/components/StatusBanner';
import CombinedUploadFHIR from '@/features/AddRecord/components/CombinedUploadFHIR';
import DataReviewSection from '@/features/AddRecord/components/DataReviewSection';
import { CompletionScreen } from '@/features/AddRecord/components/CompletionScreen';
import { StatsPanel } from '@/features/AddRecord/components/StatsPanel';

const AddRecord = () => {
    const [currentStep, setCurrentStep] = useState('upload'); // 'upload' -> 'convert' -> 'review' -> 'complete'
    
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
        processFile,
        uploadFiles,
        updateFirestoreRecord,
        getStats,
        savedToFirestoreCount,
        savingCount,
        deduplicationService,
        setFHIRConversionCallback,
        setResetProcessCallback,
        reset: resetFileUpload
    } = useFileUpload();

    // FHIR conversion hook (now receives processedFiles from the consolidated manager)
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
    } = useFHIRConversion(processedFiles, firestoreData, updateFirestoreRecord, uploadFiles);

    // Reset everything
    const resetProcess = () => {
        resetFileUpload();
        resetFHIR();
        setCurrentStep('upload');
    };

    // Connect the FHIR conversion callback
    useEffect(() => {
        setFHIRConversionCallback(handleFHIRConverted);
        setResetProcessCallback(resetProcess);
    }, [setFHIRConversionCallback, setResetProcessCallback, handleFHIRConverted, resetProcess]);

    console.log('📊 AddRecord state:', {
        currentStep,
        filesCount: files.length,
        processedFilesCount: processedFiles.length,
        fhirDataSize: fhirData.size,
        reviewedDataSize: reviewedData.size
    });

    // Export service
    const exportService = new ExportService();

    // Step management effect
    useEffect(() => {
        console.log('🔄 Step management useEffect triggered:', {
            currentStep,
            processedFilesLength: processedFiles.length,
            isAllFilesConverted: isAllFilesConverted(),
            isAllFilesReviewed: isAllFilesReviewed()
        });

        if (processedFiles.length > 0 && currentStep === 'upload') {
            setCurrentStep('convert');
        }
        if (isAllFilesConverted() && currentStep === 'convert') {
            setCurrentStep('review');
        }
        if (isAllFilesReviewed() && currentStep === 'review') {
            setCurrentStep('complete'); 
        }
    }, [processedFiles.length, isAllFilesConverted(), isAllFilesReviewed(), currentStep]);

    // Download all data
    const downloadAllData = () => {
        const deduplicationStats = deduplicationService.getStats();
        const exportData = exportService.generateExportData(
            processedFiles, 
            fhirData, 
            firestoreData, 
            deduplicationStats
        );
        
        const filename = `medical-records-export-${new Date().toISOString().split('T')[0]}.json`;
        exportService.downloadData(exportData, filename);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Add Medical Record
                    </h1>
                    <p className="text-lg text-gray-600">
                        Upload documents, extract text, convert to FHIR, review data, and save to your medical records
                    </p>
                </div>

                {/* Progress Steps */}
                <ProgressSteps 
                    currentStep={currentStep} 
                    processedFiles={processedFiles} 
                    fhirData={fhirData}
                    reviewedData={reviewedData}
                />

                {/* Status Banner */}
                <StatusBanner 
                    savedToFirestoreCount={savedToFirestoreCount} 
                    savingCount={savingCount} 
                />

                {/* Conditional rendering based on current step */}
                
                {/* Upload and Conversion Steps */}
                {(currentStep === 'upload' || currentStep === 'convert') && (
                    <div className="grid grid-cols-1 gap-8 mb-8">
                        <CombinedUploadFHIR
                            // Pass file management functions directly
                            files={files}
                            addFiles={addFiles}
                            removeFile={removeFile}
                            retryFile={retryFile}
                            getStats={getStats}
                            
                            // Configuration
                            maxFiles={5}
                            maxSizeBytes={10 * 1024 * 1024} // 10 MB
                        />
                    </div>
                )}

                {/* Review Step */}
                {currentStep === 'review' && (
                    <div className="mb-8">
                        <DataReviewSection
                            processedFiles={processedFiles}
                            fhirData={fhirData}
                            onDataConfirmed={handleDataConfirmed}
                            onDataRejected={handleDataRejected}
                            onResetAll={resetProcess}
                        />
                    </div>
                )}

                {/* Completion Screen */}
                {currentStep === 'complete' && (
                    <CompletionScreen 
                        onDownload={downloadAllData}
                        onReset={resetProcess}
                    />
                )}

                {/* Statistics Panel */}
                <StatsPanel
                    processedFiles={processedFiles}
                    savedToFirestoreCount={reviewedData.size}
                    fhirData={fhirData}
                    totalFhirResources={getFHIRStats()}
                />
            </div>
        </div>
    );
};

export default AddRecord;