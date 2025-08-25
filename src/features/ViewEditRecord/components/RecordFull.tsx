import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { X, Share2, ClipboardPlus, Code, FileInput, Ellipsis, Save, Eye } from 'lucide-react';
import { FileObject, BelroseFields } from '@/types/core';
import { TabNavigation } from "@/features/AddRecord/components/ui/TabNavigation";
import HealthRecord from "@/features/ViewEditRecord/components/ui/Record";
import HealthRecordMenu from "./ui/RecordMenu";
import { LayoutSlot } from "@/components/app/LayoutProvider";
import VersionControlPanel from "./VersionControlPanel";
import { RecordVersion } from "../services/versionControlService.types"

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
  onSave?: (updatedRecord: FileObject) => void;
  initialEditMode?: boolean;
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

// Component for editable belrose fields
const EditableBelroseFields = ({editedBelroseFields, updateBelroseField}: {
  editedBelroseFields: BelroseFields;
  updateBelroseField: (field: keyof BelroseFields, value: string) => void;
}) => (
  <div className="space-y-4">
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-10">
        <label className="block text-sm font-medium text-white/90 mb-1">Title</label>
        <input
          type="text"
          value={editedBelroseFields.title || ''}
          onChange={(e) => updateBelroseField('title', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="Enter record title..."
        />
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-medium text-white/90 mb-1">Visit Type</label>
        <input
          type="text"
          value={editedBelroseFields.visitType || ''}
          onChange={(e) => updateBelroseField('visitType', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="e.g., Follow-up Appointment, Lab Results..."
        />
      </div>
      
      <div className="col-span-3">
        <label className="block text-sm font-medium text-white/90 mb-1">Completed Date</label>
        <input
          type="date"
          value={editedBelroseFields.completedDate ? editedBelroseFields.completedDate.split('T')[0] : ''}
          onChange={(e) => updateBelroseField('completedDate', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
        />
      </div>
      
      <div className="col-span-3">
        <label className="block text-sm font-medium text-white/90 mb-1">Patient</label>
        <input
          type="text"
          value={editedBelroseFields.patient || ''}
          onChange={(e) => updateBelroseField('patient', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="Patient Name..."
        />
      </div>

      <div className="col-span-3">
        <label className="block text-sm font-medium text-white/90 mb-1">Provider</label>
        <input
          type="text"
          value={editedBelroseFields.provider || ''}
          onChange={(e) => updateBelroseField('provider', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="Provider name..."
        />
      </div>
      
      <div className="col-span-3">
        <label className="block text-sm font-medium text-white/90 mb-1">Institution</label>
        <input
          type="text"
          value={editedBelroseFields.institution || ''}
          onChange={(e) => updateBelroseField('institution', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="Healthcare institution..."
        />
      </div>

    </div>
    <div>
      <label className="block text-sm font-medium text-white/90 mb-1">Summary</label>
      <textarea
        value={editedBelroseFields.summary || ''}
        onChange={(e) => updateBelroseField('summary', e.target.value)}
        rows={2}
        className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
        placeholder="Brief summary of the record..."
      />
    </div>
  </div>
);

export const RecordFull: React.FC<HealthRecordFullProps> = ({
  record,
  onEdit,
  onDownload,
  onShare,
  onDelete,
  onBack,
  onSave,
  initialEditMode
}) => {

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('record');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasFhirChanges, setHasFhirChanges] = useState(false);
  const [currentFhirData, setCurrentFhirData] = useState(record.fhirData);
  const [isEditMode, setIsEditMode] = useState(initialEditMode || false);
  const [editedBelroseFields, setEditedBelroseFields] = useState<BelroseFields>(
    record.belroseFields || {}
  );
  const [showVersions, setShowVersions] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<RecordVersion | null>(null);
  const [isVersionView, setIsVersionView] = useState(false);

  const reconstructFileObjectFromVersion = (version: RecordVersion, originalRecord: FileObject): FileObject => {
    return{
      ...originalRecord,
      fhirData: version.fileObjectSnapshot.fhirData,
      belroseFields: version.fileObjectSnapshot.belroseFields,
      extractedText: version.fileObjectSnapshot.extractedText,
      originalText: version.fileObjectSnapshot.originalText,

      _versionInfo: {
      versionId: version.versionId,
      timestamp: version.timestamp,
      isHistoricalView: true
      }
    }
  }

  const displayRecord = isVersionView && viewingVersion
    ? reconstructFileObjectFromVersion(viewingVersion, record)
    : record;

  const handleViewVersion = (version: RecordVersion) => {
    setViewingVersion(version);
    setIsVersionView(true);
    setShowVersions(false);
    setIsEditMode(false);
  }

  const handleReturnToCurrent = () => {
    setIsVersionView(false);
    setViewingVersion(null)
  };

  const handleVersionHistoryBack = () => {
    if (isVersionView) {
      setIsVersionView(false);
      setViewingVersion(null);
      setShowVersions(true);
    } 
  }

  const hasAnyChanges = hasUnsavedChanges || hasFhirChanges;

  const handleFhirDataChange = (updatedData: any) => {
    setCurrentFhirData(updatedData);
  };

  const handleVersionMode = (record: string) => {
    setIsEditMode(false);
    setShowVersions(true);
  }

  const handleFhirChanged = (hasChanges:boolean) => {
    setHasFhirChanges(hasChanges);
  };

  const handleEnterEditMode = () => {
    setIsEditMode(true);
    setShowVersions(false);
    setActiveTab('record'); //only record tab has stuff to edit
    setEditedBelroseFields(record.belroseFields || {});
  }

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as TabType);
  }

  const handleExit = () => {
    if (hasAnyChanges) {
      const confirmExit = window.confirm("You have unsaved changes. Are you sure you want to exit?");
      if (!confirmExit) return;
    }
    
    if (onBack) {
      onBack(record);
    }
  };

  const handleSaveRecord = () => {
    const updatedRecord = {
      ...record,
      fhirData: currentFhirData,
      belroseFields: editedBelroseFields,
    };
    
    // Call the parent save handler if provided
    if (onSave) {
      onSave(updatedRecord);
    }
    
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    setHasFhirChanges(false);
    console.log('✅ Record saved:', updatedRecord);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    setHasFhirChanges(false);
    setCurrentFhirData(record.fhirData);
    setEditedBelroseFields(record.belroseFields || {});
  };

  // Handlers for belroseFields editing
  const updateBelroseField = (field: keyof BelroseFields, value: string) => {
    setEditedBelroseFields(prev => ({...prev, [field]: value
    }));
    setHasUnsavedChanges(true);
  };

  // Handle version control panel callbacks
  const handleVersionControlRollback = () => {
    // Clear any unsaved changes
    setHasUnsavedChanges(false);
    setHasFhirChanges(false);
    // Exit version mode and refresh the page to show the rolled-back version
    setShowVersions(false);
    window.location.reload();
  };

  // Debug information
  console.log('🔍 Debug Record Data:', {
    hasDownloadURL: !!record.downloadURL,
    downloadURL: record.downloadURL,
    hasOriginalText: !!record.originalText,
    hasExtractedText: !!record.extractedText,
    allKeys: Object.keys(record)
  });

  const canEdit = !isVersionView;

 return (
    <div className="max-w-7xl mx-auto bg-background rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-primary px-8 py-6">

         {isVersionView && viewingVersion && (
          <LayoutSlot slot="header">
          <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="ml-3 flex items-center gap-2 text-yellow-100">
                <span className="text-sm font-medium text-primary">
                  Viewing historical version from {new Date(viewingVersion.timestamp).toLocaleString()}
                </span>
                {viewingVersion.commitMessage && (
                  <span className="text-xs opacity-75">
                    • {viewingVersion.commitMessage}
                  </span>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleReturnToCurrent}
                className="text-primary border-yellow-500/30 hover:bg-yellow-500/20"
              >
                Return to Current
              </Button>
            </div>
          </div>
          </LayoutSlot>
        )}

        <div className="flex items-center justify-between space-x-1 mb-3">
          <div className="flex items-center gap-2">
            {!isEditMode && <>
              <span className="px-2 py-1 text-xs font-medium rounded-full border bg-background text-primary">
                {displayRecord.belroseFields?.visitType}
              </span>
              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded border">
                {displayRecord.documentType}
              </span>
            </>}
          </div>
          <div className="flex items-center">
            <span className="px-3 py-1 mx-1 bg-red-500/20 text-red-100 rounded-full text-sm font-medium">
              Self Reported
            </span>
            <HealthRecordMenu 
              record={record}
              triggerIcon={Ellipsis}
              showView={false}         // No view option (already viewing)
              triggerClassName="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              onEdit={canEdit? handleEnterEditMode : undefined}
              onVersion={!isVersionView ? handleVersionMode : undefined}
            />
            <Button 
              variant="default" 
              className="p-2 w-8 h-8 hover:bg-white/20 transition-colors"
              onClick={handleExit}
            >
              <X className="w-5 h-5"/>
            </Button>
          </div>
        </div>

        {isEditMode ? (
          <>
            <div className="mt-4">
              <EditableBelroseFields
                editedBelroseFields={editedBelroseFields}
                updateBelroseField={updateBelroseField}
              />
            </div>
          </>
        ) : (
        <>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-white">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{displayRecord.belroseFields?.title}</h1>
            </div>
          </div>
        </div>
            <div className="flex text-sm text-white items-start gap-4 my-2">
              <div>{displayRecord.belroseFields?.completedDate} • {displayRecord.belroseFields?.patient} • {displayRecord.belroseFields?.provider} • {displayRecord.belroseFields?.institution}</div>
            </div>
            <div className="flex justify-left text-white/50 text-left">
              <p>{displayRecord.belroseFields?.summary}</p>
            </div>
        </>
        )}
      </div>
      
      {showVersions ? (
        <div className="p-8">
          <VersionControlPanel 
            documentId={record.id}
            onBack={() => setShowVersions(!showVersions)} 
            onRollback={handleVersionControlRollback}
            onViewVersion={handleViewVersion}
          />
        </div>
       ) :(
      <>
      <TabNavigation 
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      <div className="p-8">
        {/* Tab Content */}
        {activeTab === "record" && (
          <div className="space-y-6">
            <HealthRecord 
              fhirData={displayRecord.fhirData}
              editable={isEditMode && canEdit}
              onFhirChanged={handleFhirChanged}
              onDataChange={handleFhirDataChange}
            />
          </div>
        )}

        {/* Data Tab */}  
        {activeTab === "data" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">FHIR Data</h2>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border">
              {displayRecord.fhirData ? (
                <div>
                  <div className="flex justify-between items-center mb-4 pb-2 border-b">
                    <span className="text-sm font-medium text-gray-600">
                      {displayRecord.fhirData.type} Bundle • {displayRecord.fhirData.entry?.length || 0} entries
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(displayRecord.fhirData, null, 2))}
                      className="text-xs px-2 py-1 rounded"
                    >
                      Copy JSON
                    </Button>
                  </div>
                  <pre className="text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {JSON.stringify(displayRecord.fhirData, null, 2)}
                  </pre>
                </div>
              ) : (<p className="text-gray-600">No FHIR data available</p>)}
            </div>
          </div>
        )}
        
        {activeTab === "original" && (
          <div className="space-y-6">
            {/* Original Text */}
            {record.originalText && (
              <div className="flex flex-col">
                <h2 className="text-xl font-semibold text-gray-900">Original Text Submission</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600">{displayRecord.originalText}</p>
                </div>
              </div>
            )}

            {/* Extracted Text + Original File */}
            {record.extractedText && (
              <div className="flex flex-col">
                <h2 className="text-xl font-semibold text-gray-900">Extracted Text from File</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-600">{displayRecord.extractedText}</p>
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

      {isEditMode && !isVersionView && (
        <LayoutSlot slot="footer">
          <div className="flex justify-between items-center p-4 bg-white border-t border-gray-200">
            <div className="flex items-center gap-2">
              {hasAnyChanges && (
                <span className="px-3 py-1 text-sm bg-amber-100 text-amber-800 rounded-full font-medium">
                  Unsaved changes
                </span>
              )}
              <span className="text-sm text-gray-500">
                Editing health record data
              </span>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCancelEdit}>
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button onClick={handleSaveRecord} disabled={!hasAnyChanges}>
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </LayoutSlot>
      )}
      {!isEditMode && isVersionView && (
        <LayoutSlot slot="footer">
          <div className="flex justify-end items-center p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleVersionHistoryBack}>
                <X className="w-4 h-4" />
                Return to Version History
              </Button>
              <Button onClick={handleVersionControlRollback}>
                <Save className="w-4 h-4" />
                Rollback
              </Button>
            </div>
          </div>
        </LayoutSlot>
      )}
    </>)}
    </div>
  );
};

export default RecordFull;