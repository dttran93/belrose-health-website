import React from 'react';
import { Zap } from 'lucide-react';
import FHIRConverter from '@/components/AddRecord/components/FHIRConverter';

export const FHIRConversionSection = ({ processedFiles, onFHIRConverted }) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <span>FHIR Conversion</span>
                </h2>
            </div>
            
            <div className="p-6">
                <FHIRConverter
                    extractedFiles={processedFiles}
                    onFHIRConverted={onFHIRConverted}
                    autoConvert={false}
                />
            </div>
        </div>
    );
};