// This is the healthrecord content of the record, FHIR Formatted, JSON, and Original Text. Combines with the record header to create the full record

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ClipboardPlus, Code, FileInput, Computer, Info } from 'lucide-react';
import { FileObject, BelroseFields } from '@/types/core';
import { TabNavigation } from '@/features/AddRecord/components/ui/TabNavigation';
import FHIRRecord from '@/features/ViewEditRecord/components/ui/FHIRRecord';
import BelroseRecord from './BelroseRecord';
import { DecryptedFileViewer } from '@/features/Encryption/components/DecryptedFileViewer';

export type TabType = 'record' | 'fhir' | 'data' | 'original';

const tabs = [
  {
    id: 'record',
    label: 'Full Record',
    icon: ClipboardPlus,
  },
  {
    id: 'fhir',
    label: 'FHIR Format',
    icon: Computer,
  },
  {
    id: 'data',
    label: 'JSON Data',
    icon: Code,
  },
  {
    id: 'original',
    label: 'Original Data',
    icon: FileInput,
  },
];

interface RecordViewProps {
  record: FileObject;
  editable?: boolean;
  onFhirChanged?: (hasChanges: boolean) => void;
  onFhirDataChange?: (updatedData: any) => void;
  onBelroseFieldsChange?: (updateFields: BelroseFields) => void;
  className?: string;
  activeTab?: TabType;
  onTabChange?: (tabId: TabType) => void;
}

export const RecordView: React.FC<RecordViewProps> = ({
  record,
  editable = false,
  onFhirChanged,
  onFhirDataChange,
  onBelroseFieldsChange,
  className = '',
  activeTab: externalActiveTab,
  onTabChange: externalOnTabChange,
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
      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Tab Content */}
      <div>
        {/* Belrose Record*/}
        {activeTab === 'record' && (
          <div className="space-y-6">
            <BelroseRecord
              Data={record.belroseFields}
              editable={editable}
              onDataChange={onBelroseFieldsChange}
            />
          </div>
        )}

        {/* FHIR Resources Tab*/}
        {activeTab === 'fhir' && (
          <div className="space-y-6">
            <FHIRRecord
              fhirData={record.fhirData}
              editable={editable}
              onFhirChanged={onFhirChanged}
              onDataChange={onFhirDataChange}
            />
          </div>
        )}

        {/* JSON Tab */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            {editable && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-center flex-1">
                    <h3 className="text-primary font-medium mb-1">Editing Record</h3>
                    <p className="text-primary text-sm">
                      The JSON data will be updated automatically when you edit either FHIR or
                      Record data. Hash fields will recalculate when you refresh the page.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">JSON Data</h2>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border">
              {record ? (
                <div>
                  <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <span className="text-sm font-medium text-gray-600">Full Record Data</span>
                    <Button
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(record, null, 2))}
                      className="text-xs px-2 py-1 rounded"
                    >
                      Copy JSON
                    </Button>
                  </div>
                  <pre className="text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {JSON.stringify(record, null, 2)}
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
            {editable && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-center flex-1">
                    <h3 className="text-primary font-medium mb-1">Editing Record</h3>
                    <p className="text-primary text-sm">
                      Upload a new record to add or change original text/files.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {record.originalText && (
              <div className="flex flex-col">
                <h2 className="text-xl font-semibold text-gray-900">Original Text Submission</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600">{record.originalText}</p>
                </div>
              </div>
            )}

            {record.contextText && (
              <div className="flex flex-col">
                <h2 className="text-xl font-semibold text-gray-900">Record Context Submission</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600">{record.contextText}</p>
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
              <DecryptedFileViewer
                downloadURL={record.downloadURL}
                fileName={record.fileName}
                fileType={record.fileType}
                fileSize={record.fileSize}
                isEncrypted={record.isEncrypted || false}
              />
            )}

            {/* Show message if no original data */}
            {!record.contextText &&
              !record.originalText &&
              !record.extractedText &&
              !record.downloadURL && (
                <div className="text-center py-12">
                  <FileInput className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Original Data</h3>
                  <p className="text-gray-600">
                    This record doesn't have any context submissions, original text submissions,
                    extracted text, or file attachments.
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
