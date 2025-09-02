import React, { useState } from 'react';
import { Button } from "@/components/ui/Button";
import { Share2, ClipboardPlus, Code, FileInput } from 'lucide-react';
import { FileObject } from '@/types/core';
import { TabNavigation } from "@/features/AddRecord/components/ui/TabNavigation";
import FHIRRecord from "@/features/ViewEditRecord/components/ui/FHIRRecord"; 

export type TabType = 'record' | 'data' | 'original';

const tabs = [
  { 
    id: 'record', 
    label: 'Full Record',
    icon: ClipboardPlus
  },
  { 
    id: 'data', 
    label: 'FHIR Data',
    icon: Code
  },
  { 
    id: 'original', 
    label: 'Original Data',
    icon: FileInput
  }
];

interface RecordViewProps {
  record: FileObject;
  editable?: boolean;
  onFhirChanged?: (hasChanges: boolean) => void;
  onDataChange?: (updatedData: any) => void;
  className?: string;
  activeTab?: TabType;
  onTabChange?: (tabId: TabType) => void;
}

export const RecordView: React.FC<RecordViewProps> = ({
  record,
  editable = false,
  onFhirChanged,
  onDataChange,
  className = '',
  activeTab: externalActiveTab,
  onTabChange: externalOnTabChange
}) => {
    const [internalActiveTab, setInternalActiveTab] = useState<TabType>('record');
    const activeTab = externalActiveTab || internalActiveTab;
    const setActiveTab = externalOnTabChange || setInternalActiveTab;

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as TabType);
  };

  return (
    <div className={className}>
      {/* Tab Navigation */}
      <TabNavigation 
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Tab Content */}
      <div>
        {/* Full Record Tab - FHIR Resources */}
        {activeTab === 'record' && (
          <div className="space-y-6">
            <FHIRRecord 
              fhirData={record.fhirData}
              editable={editable}
              onFhirChanged={onFhirChanged}
              onDataChange={onDataChange}
            />
          </div>
        )}

        {/* FHIR Data JSON Tab */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">FHIR Data</h2>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border">
              {record.fhirData ? (
                <div>
                  <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <span className="text-sm font-medium text-gray-600">
                      {record.fhirData.type} Bundle • {record.fhirData.entry?.length || 0} entries
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(record.fhirData, null, 2))}
                      className="text-xs px-2 py-1 rounded"
                    >
                      Copy JSON
                    </Button>
                  </div>
                  <pre className="text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {JSON.stringify(record.fhirData, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-gray-600">No FHIR data available</p>
              )}
            </div>
          </div>
        )}

        {/* Original Data Tab */}
        {activeTab === 'original' && (
          <div className="space-y-6">
            {/* Original Text Submission */}
            {record.originalText && (
              <div className="flex flex-col">
                <h2 className="text-xl font-semibold text-gray-900">Original Text Submission</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600">{record.originalText}</p>
                </div>
              </div>
            )}

            {/* Extracted Text from File */}
            {record.extractedText && (
              <div className="flex flex-col">
                <h2 className="text-xl font-semibold text-gray-900">Extracted Text from File</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600">{record.extractedText}</p>
                </div>
              </div>
            )}

            {/* Original File Download Section with Embedded Viewer */}
            {record.downloadURL && (
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Original File</h2>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => window.open(record.downloadURL, '_blank')}
                      className="flex items-center space-x-2"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Open</span>
                    </Button>
                    <Button 
                      variant="default"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = record.downloadURL || '#';
                        link.download = record.fileName || 'document';
                        link.click();
                      }}
                      className="flex items-center space-x-2"
                    >
                      <FileInput className="w-4 h-4" />
                      <span>Download</span>
                    </Button>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <FileInput className="w-6 h-6 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {record.fileName || record.name || 'Original Document'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {record.fileType || record.type} • {
                          record.fileSize ? `${(record.fileSize / 1024).toFixed(1)} KB` : 
                          record.size ? `${(record.size / 1024).toFixed(1)} KB` : 
                          'Unknown size'
                        }
                      </p>
                    </div>
                  </div>
                  
                  {/* Embedded Document Viewer */}
                  <div className="border rounded-lg overflow-hidden bg-white">
                    {(record.fileType?.includes('image') || record.type?.includes('image')) ? (
                      // Image preview
                      <img 
                        src={record.downloadURL} 
                        alt={record.fileName || record.name || 'Document preview'}
                        className="w-full max-h-96 object-contain"
                      />
                    ) : (record.fileType === 'application/pdf' || record.type === 'application/pdf') ? (
                      // PDF embed
                      <iframe
                        src={`${record.downloadURL}#toolbar=0&navpanes=0&scrollbar=1`}
                        className="w-full h-96"
                        title={record.fileName || record.name || 'PDF preview'}
                      />
                    ) : (
                      // Fallback for other file types
                      <div className="p-8 text-center">
                        <FileInput className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2">Preview not available for this file type</p>
                        <p className="text-sm text-gray-500">Click "Open" to view in a new tab</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Show message if no original data */}
            {!record.originalText && !record.extractedText && !record.downloadURL && (
              <div className="text-center py-12">
                <FileInput className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Original Data</h3>
                <p className="text-gray-600">
                  This record doesn't have any original text submissions, extracted text, or file attachments.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordView;