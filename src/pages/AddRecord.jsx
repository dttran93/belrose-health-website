// Main AddRecord.jsx component
import React, { useState, useEffect } from 'react';
import { useFileUpload } from '@/components/AddRecord/hooks/useFileUpload';
import { useFHIRConversion } from '@/components/AddRecord/hooks/useFHIRConversion';
import { ExportService } from '@/components/AddRecord/services/exportService';

// Import all components
import { ProgressSteps } from '@/components/AddRecord/components/ProgressSteps';
import { StatusBanner } from '@/components/AddRecord/components/StatusBanner';
import { FileUploadSection } from '@/components/AddRecord/components/FileUploadSection';
import { FHIRConversionSection } from '@/components/AddRecord/components/FHIRConversionSection';
import { CompletionScreen } from '@/components/AddRecord/components/CompletionScreen';
import { StatsPanel } from '@/components/AddRecord/components/StatsPanel';

const AddRecord = () => {
    const [currentStep, setCurrentStep] = useState('upload');
    
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
        deduplicationService
    } = useFileUpload();

    // FHIR conversion hook
    const {
        fhirData,
        handleFHIRConverted,
        isAllFilesConverted,
        getFHIRStats,
        reset: resetFHIR
    } = useFHIRConversion(processedFiles, firestoreData, updateFirestoreRecord);

    // Export service
    const exportService = new ExportService();

    // Step management effect
    useEffect(() => {
        if (processedFiles.length > 0 && currentStep === 'upload') {
            setCurrentStep('convert');
        }
        if (isAllFilesConverted() && currentStep === 'convert') {
            setCurrentStep('complete');
        }
    }, [processedFiles.length, isAllFilesConverted(), currentStep]);

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
                        Upload documents, extract text, convert to FHIR, and save to your medical records
                    </p>
                </div>

                {/* Progress Steps */}
                <ProgressSteps 
                    currentStep={currentStep} 
                    processedFiles={processedFiles} 
                    fhirData={fhirData}
                />

                {/* Status Banner */}
                <StatusBanner 
                    savedToFirestoreCount={savedToFirestoreCount} 
                    savingCount={savingCount} 
                />

                {/* Main Content - Upload and Conversion Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <FileUploadSection 
                        onFilesProcessed={handleFilesProcessed}
                    />

                    <FHIRConversionSection
                        processedFiles={processedFiles}
                        onFHIRConverted={handleFHIRConverted}
                    />
                </div>

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
                    savedToFirestoreCount={savedToFirestoreCount}
                    fhirData={fhirData}
                    totalFhirResources={getFHIRStats()}
                />
            </div>
        </div>
    );
};

export default AddRecord;