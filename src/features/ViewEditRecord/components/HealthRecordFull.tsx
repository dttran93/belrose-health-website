import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { X, Share2, ClipboardPlus, Code, FileInput, } from 'lucide-react';
import { FileObject } from '@/types/core';
import { TabNavigation } from "@/features/AddRecord/components/ui/TabNavigation";
import HealthRecord from "@/features/ViewEditRecord/components/ui/HealthRecord";

type TabType = 'record' | 'data' | 'original';

interface HealthRecordFullProps {
  record: FileObject;
  onEdit?: (record: FileObject) => void;
  onDownload?: (record: FileObject) => void;
  onShare?: (record: FileObject) => void;
  onDelete?: (record: FileObject) => void;
  className?: string;
  showMenu?: boolean;
  onBack?: (record: FileObject) => void;
}

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

export const HealthRecordFull: React.FC<HealthRecordFullProps> = ({record}) => {

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('record');
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as TabType);
  }

    // Debug information
  console.log('🔍 Debug Record Data:', {
    hasDownloadURL: !!record.downloadURL,
    downloadURL: record.downloadURL,
    hasOriginalText: !!record.originalText,
    hasExtractedText: !!record.extractedText,
    allKeys: Object.keys(record)
  });

  return (
    <div className="max-w-7xl mx-auto bg-background rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-primary px-8 py-6">
        <div className=" flex items-center justify-between">
          <div className="flex items-center space-x-4 text-white">
            <h1 className="text-2xl font-bold">{record.belroseFields?.title}</h1>
            <p className="mt-1 text-sm">{record.belroseFields?.completedDate} • {record.belroseFields?.provider} • {record.belroseFields?.institution}</p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 bg-red-500/20 text-red-100 rounded-full text-sm font-medium">
              Self Reported
            </span>
            <Button variant="default">
              <Share2 className="w-5 h-5" />
            </Button>
            <Button variant="outline" className="px-4 py-2 rounded-lg font-medium hover:bg-gray-50">
              Edit Record
            </Button>
            <Button variant="outline" className="px-4 py-2 bg-white rounded-lg font-medium hover:bg-gray-50">
              <X className="w-5 h-5"/>
            </Button>
          </div>
        </div>
        <div className="flex justify left text-white/50">
        <p>{record.belroseFields?.summary}</p>
        </div>
      </div>
      <TabNavigation 
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

       <div className="p-8">
        {/* Tab Content */}
        {activeTab === "record" && (
          <div className="space-y-6">
            <HealthRecord fhirData={record.fhirData}/>
          </div>
        )}

        {/*Data Tab*/}  
        {activeTab === "data" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">FHIR Data</h2>
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
              ) : (<p className="text-gray-600">No FHIR data available</p>)}
            </div>
          </div>
        )}
        
        {activeTab === "original" && (
          <div className="space-y-6">
            {/*Original Text */}
            {record.originalText &&(
              <div className="flex flex-col">
                <h2 className="text-xl font-semibold text-gray-900">Original Text Submission</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-600">{record.originalText}</p>
                </div>
              </div>)}

            {/*Extracted Text + Original File */}
            {record.extractedText &&(
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
                    <p className="font-medium text-gray-900">{record.fileName || record.name || 'Original Document'}</p>
                    <p className="text-sm text-gray-500">
                      {record.fileType || record.type} • {record.fileSize ? `${(record.fileSize / 1024).toFixed(1)} KB` : record.size ? `${(record.size / 1024).toFixed(1)} KB` : 'Unknown size'}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthRecordFull;