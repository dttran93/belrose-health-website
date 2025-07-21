// Modified StepIndicator.jsx component with review step logic
import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const StepIndicator = ({ 
    step, 
    title, 
    description, 
    icon: Icon, 
    currentStep, 
    processedFiles, 
    fhirData, 
    reviewedData = new Map() 
}) => {
    const getStepStatus = (step) => {
        if (currentStep === step) return 'current';
        
        switch (step) {
            case 'upload':
                return processedFiles.length > 0 ? 'completed' : 'pending';
            case 'convert':
                return fhirData.size > 0 ? 'completed' : 'pending';
            case 'review': // NEW: Review step logic
                // Completed if all files that have FHIR data are also reviewed
                const filesWithFhir = processedFiles.filter(f => 
                    f.status === 'completed' && 
                    f.extractedText && 
                    fhirData.has(f.id)
                );
                const allReviewed = filesWithFhir.length > 0 && 
                                 filesWithFhir.every(f => reviewedData.has(f.id));
                return allReviewed ? 'completed' : 'pending';
            case 'complete':
                return currentStep === 'complete' ? 'completed' : 'pending';
            default:
                return 'pending';
        }
    };

    const status = getStepStatus(step);
    
    // Get counts for display
    const getCounts = () => {
        switch (step) {
            case 'upload':
                return `${processedFiles.length} file${processedFiles.length !== 1 ? 's' : ''}`;
            case 'convert':
                return `${fhirData.size} converted`;
            case 'review':
                return `${reviewedData.size} reviewed`;
            case 'complete':
                return reviewedData.size > 0 ? `${reviewedData.size} saved` : '';
            default:
                return '';
        }
    };
    
    return (
        <div className="flex flex-col items-center text-center space-y-2">
            <div className={`
                flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all
                ${status === 'completed' 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : status === 'current' 
                        ? 'bg-blue-500 border-blue-500 text-white' 
                        : 'bg-gray-100 border-gray-300 text-gray-400'
                }
            `}>
                {status === 'completed' ? (
                    <CheckCircle2 className="w-6 h-6" />
                ) : (
                    <Icon className="w-6 h-6" />
                )}
            </div>
            
            <div className="flex-1">
                <h3 className={`
                    font-medium text-sm
                    ${status === 'current' ? 'text-blue-900' : status === 'completed' ? 'text-green-900' : 'text-gray-500'}
                `}>
                    {title}
                </h3>
                <p className="text-xs text-gray-600 mb-1">{description}</p>
                {getCounts() && (
                    <p className={`text-xs font-medium ${
                        status === 'completed' ? 'text-green-600' : 
                        status === 'current' ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                        {getCounts()}
                    </p>
                )}
            </div>
        </div>
    );
};