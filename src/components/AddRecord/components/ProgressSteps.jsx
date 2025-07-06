import React from 'react';
import { ArrowRight, Cloud, Zap, Eye, Database } from 'lucide-react';
import { StepIndicator } from './StepIndicator';

export const ProgressSteps = ({ currentStep, processedFiles, fhirData, reviewedData = new Map() }) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                <StepIndicator
                    step="upload"
                    title="Upload & Save"
                    description="Upload documents and save to cloud storage"
                    icon={Cloud}
                    currentStep={currentStep}
                    processedFiles={processedFiles}
                    fhirData={fhirData}
                    reviewedData={reviewedData}
                />
                
                <div className="hidden md:flex items-center justify-center">
                    <ArrowRight className="w-6 h-6 text-gray-400" />
                </div>
                
                <StepIndicator
                    step="convert"
                    title="Convert to FHIR"
                    description="Transform text into standardized FHIR format"
                    icon={Zap}
                    currentStep={currentStep}
                    processedFiles={processedFiles}
                    fhirData={fhirData}
                    reviewedData={reviewedData}
                />
                
                <div className="hidden md:flex items-center justify-center">
                    <ArrowRight className="w-6 h-6 text-gray-400" />
                </div>
                
                {/* NEW: Review Step */}
                <StepIndicator
                    step="review"
                    title="Review & Edit"
                    description="Review and edit extracted data before saving"
                    icon={Eye}
                    currentStep={currentStep}
                    processedFiles={processedFiles}
                    fhirData={fhirData}
                    reviewedData={reviewedData}
                />
                
                <div className="hidden md:flex items-center justify-center">
                    <ArrowRight className="w-6 h-6 text-gray-400" />
                </div>
                
                <StepIndicator
                    step="complete"
                    title="Complete"
                    description="Records saved and ready for use"
                    icon={Database}
                    currentStep={currentStep}
                    processedFiles={processedFiles}
                    fhirData={fhirData}
                    reviewedData={reviewedData}
                />
            </div>
        </div>
    );
};