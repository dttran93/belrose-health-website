import React from 'react';
import { FileText } from 'lucide-react';
import DocumentUploader from '@/components/AddRecord/components/DocumentUploader';

export const FileUploadSection = ({ onFilesProcessed }) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span>Document Upload & Processing</span>
                </h2>
            </div>
            
            <div className="p-6">
                <DocumentUploader 
                    onFilesProcessed={onFilesProcessed}
                    acceptedTypes={['.pdf', '.docx', '.doc', '.txt', '.jpg', '.jpeg', '.png']}
                    maxFiles={5}
                    maxSizeBytes={10 * 1024 * 1024}
                    autoProcess={true}
                />
            </div>
        </div>
    );
};