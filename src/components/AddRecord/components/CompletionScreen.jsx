import React from 'react';
import { CheckCircle2, Download } from 'lucide-react';

export const CompletionScreen = ({ onDownload, onReset }) => {
    return (
        <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
            <div className="text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Records Added Successfully!</h2>
                <p className="text-gray-600 mb-6">
                    All documents have been processed, converted to FHIR format, and saved to your medical records database.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={onDownload}
                        className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                    >
                        <Download className="w-5 h-5" />
                        <span>Export All Data</span>
                    </button>
                    
                    <button
                        onClick={onReset}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Add More Records
                    </button>
                </div>
            </div>
        </div>
    );
};