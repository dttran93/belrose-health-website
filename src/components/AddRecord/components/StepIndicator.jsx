import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const StepIndicator = ({ step, title, description, icon: Icon, currentStep, processedFiles, fhirData }) => {
    const getStepStatus = (step) => {
        if (currentStep === step) return 'current';
        
        switch (step) {
            case 'upload':
                return processedFiles.length > 0 ? 'completed' : 'pending';
            case 'convert':
                return fhirData.size > 0 ? 'completed' : 'pending';
            case 'complete':
                return currentStep === 'complete' ? 'completed' : 'pending';
            default:
                return 'pending';
        }
    };

    const status = getStepStatus(step);
    
    return (
        <div className="flex items-center space-x-4">
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
                    font-medium
                    ${status === 'current' ? 'text-blue-900' : status === 'completed' ? 'text-green-900' : 'text-gray-500'}
                `}>
                    {title}
                </h3>
                <p className="text-sm text-gray-600">{description}</p>
            </div>
        </div>
    );
};