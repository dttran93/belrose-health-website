import React, { useState, useEffect } from 'react';
import { useFileUpload } from '@/components/AddRecord/hooks/useFileUpload';
import { useFHIRConversion } from '@/components/AddRecord/hooks/useFHIRConversion';
import { ExportService } from '@/components/AddRecord/services/exportService';

// Import all components
import { ProgressSteps } from '@/components/AddRecord/components/ProgressSteps';
import { StatusBanner } from '@/components/AddRecord/components/StatusBanner';
import CombinedUploadFHIR from '@/components/AddRecord/components/CombinedUploadFHIR';
import { FHIRConversionSection } from '@/components/AddRecord/components/FHIRConversionSection';
import DataReviewSection from '@/components/AddRecord/components/DataReviewSection';
import { CompletionScreen } from '@/components/AddRecord/components/CompletionScreen';
import { StatsPanel } from '@/components/AddRecord/components/StatsPanel';

const AddRecord = () => {
    const [currentStep, setCurrentStep] = useState('upload'); // 'upload' -> 'convert' -> 'review' -> 'complete'
    
    // File upload hook
    const {
        processedFiles,
        firestoreData,
        savingToFirestore,
        handleFilesProcessed,
        updateFirestoreRecord,
        reset: resetFileUpload,
        savedToFirestoreCount,
        savingCount,
        deduplicationService,
        uploadFiles
    } = useFileUpload();

    // FHIR conversion hook
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

    // Export service
    const exportService = new ExportService();

    // Step management effect with new review step
    useEffect(() => {
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

    // Reset everything
    const resetProcess = () => {
        resetFileUpload();
        resetFHIR();
        setCurrentStep('upload');
    };

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
                            onFHIRResult={handleFHIRConverted}
                            onFilesProcessed={handleFilesProcessed}
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