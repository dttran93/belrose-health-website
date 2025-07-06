import React from 'react';

export const StatsPanel = ({ 
    processedFiles, 
    savedToFirestoreCount, 
    fhirData, 
    totalFhirResources 
}) => {
    const totalWords = processedFiles.reduce((sum, f) => sum + (f.wordCount || 0), 0);

    return (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg p-4 text-center border">
                <div className="text-2xl font-bold text-blue-600">{processedFiles.length}</div>
                <div className="text-sm text-gray-600">Files Processed</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 text-center border">
                <div className="text-2xl font-bold text-green-600">{savedToFirestoreCount}</div>
                <div className="text-sm text-gray-600">Saved to Cloud</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 text-center border">
                <div className="text-2xl font-bold text-purple-600">{fhirData.size}</div>
                <div className="text-sm text-gray-600">FHIR Converted</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 text-center border">
                <div className="text-2xl font-bold text-orange-600">{totalWords}</div>
                <div className="text-sm text-gray-600">Words Extracted</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 text-center border">
                <div className="text-2xl font-bold text-red-600">{totalFhirResources}</div>
                <div className="text-sm text-gray-600">FHIR Resources</div>
            </div>
        </div>
    );
};