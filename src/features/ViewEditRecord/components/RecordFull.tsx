import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X, Save } from 'lucide-react';
import { FileObject, BelroseFields } from '@/types/core';
import { LayoutSlot } from '@/components/app/LayoutProvider';
import VersionControlPanel from './VersionControlPanel';
import { RecordVersion } from '../services/versionControlService.types';
import { VerificationView } from '@/features/BlockchainVerification/component/VerificationView';
import RecordHeader from './ui/RecordHeader';
import RecordView from './ui/RecordView';
import { TabType } from './ui/RecordView';
import { ShareRecordView } from '@/features/Sharing/components/ShareRecordView';

type ViewMode = 'record' | 'edit' | 'versions' | 'version-detail' | 'verification' | 'share';

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
  onViewVerification?: (record: FileObject) => void;
  comingFromAddRecord?: boolean;
}

export const RecordFull: React.FC<HealthRecordFullProps> = ({
  record,
  onEdit,
  onDownload,
  onShare,
  onDelete,
  onBack,
  onSave,
  onViewVerification,
  initialEditMode,
  comingFromAddRecord = false,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(initialEditMode ? 'edit' : 'record');
  const [activeTab, setActiveTab] = useState<TabType>('record');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasFhirChanges, setHasFhirChanges] = useState(false);
  const [currentFhirData, setCurrentFhirData] = useState(record.fhirData);

  const [editedBelroseFields, setEditedBelroseFields] = useState<BelroseFields>(
    record.belroseFields || {}
  );
  const [viewingVersion, setViewingVersion] = useState<RecordVersion | null>(null);

  const reconstructFileObjectFromVersion = (
    version: RecordVersion,
    originalRecord: FileObject
  ): FileObject => {
    return {
      ...originalRecord,
      fhirData: version.fileObjectSnapshot.fhirData,
      belroseFields: version.fileObjectSnapshot.belroseFields,
      extractedText: version.fileObjectSnapshot.extractedText,
      originalText: version.fileObjectSnapshot.originalText,
      blockchainVerification: version.fileObjectSnapshot.blockchainVerification ?? null,

      versionInfo: {
        versionId: version.versionId,
        timestamp: version.timestamp,
        isHistoricalView: true,
      },
    };
  };

  const displayRecord =
    viewMode === 'version-detail' && viewingVersion
      ? reconstructFileObjectFromVersion(viewingVersion, record)
      : record;

  // View Mode Handlers
  const handleEnterEditMode = () => {
    setViewMode('edit');
    setActiveTab('record'); //only record tab has stuff to edit
    setEditedBelroseFields(record.belroseFields || {});
  };

  const handleViewVersionHistory = () => setViewMode('versions');

  const handleViewVerification = (record: FileObject) => {
    if (onViewVerification) {
      onViewVerification(record);
    } else {
      setViewMode('verification');
    }
  };

  const handleViewShare = () => {
    setViewMode('share');
  };

  const handleViewVersion = (version: RecordVersion) => {
    setViewingVersion(version);
    setViewMode('version-detail');
  };

  const handleBackToRecord = () => {
    setViewMode('record');
    setViewingVersion(null);
  };

  //DATA HANDLERS
  const handleFhirDataChange = (updatedData: any) => {
    setCurrentFhirData(updatedData);
  };

  const handleFhirChanged = (hasChanges: boolean) => {
    setHasFhirChanges(hasChanges);
  };

  const handleBelroseFieldsChange = (updatedFields: BelroseFields) => {
    setEditedBelroseFields(updatedFields);
    setHasUnsavedChanges(true);
  };

  // SAVE AND CANCEL HANDLERS
  const hasAnyChanges = hasUnsavedChanges || hasFhirChanges;
  const shouldDisableSave = comingFromAddRecord ? false : !hasAnyChanges;

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

    setViewMode('record');
    setHasUnsavedChanges(false);
    setHasFhirChanges(false);
    console.log('✅ Record saved:', updatedRecord);
  };

  const handleCancelEdit = () => {
    setViewMode('record');
    setHasUnsavedChanges(false);
    setHasFhirChanges(false);
    setCurrentFhirData(record.fhirData);
    setEditedBelroseFields(record.belroseFields || {});
  };

  const handleExit = () => {
    if (hasAnyChanges) {
      const confirmExit = window.confirm(
        'You have unsaved changes. Are you sure you want to exit?'
      );
      if (!confirmExit) return;
    }

    if (onBack) {
      onBack(record);
    }
  };

  // VERSION CONTROL HANDLERS
  const handleVersionControlRollback = () => {
    // Clear any unsaved changes
    setHasUnsavedChanges(false);
    setHasFhirChanges(false);
    // Exit version mode and refresh the page to show the rolled-back version
    setViewMode('record');
    window.location.reload();
  };

  // Debug information
  console.log('🔍 Debug Record Data:', {
    hasDownloadURL: !!record.downloadURL,
    downloadURL: record.downloadURL,
    hasOriginalText: !!record.originalText,
    hasExtractedText: !!record.extractedText,
    allKeys: Object.keys(record),
  });

  return (
    <div className="max-w-7xl mx-auto bg-background rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-primary">
        {viewMode === 'version-detail' && viewingVersion && (
          <LayoutSlot slot="header">
            <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="ml-3 flex items-center gap-2 text-yellow-100">
                  <span className="text-sm font-medium text-primary">
                    Viewing historical version from{' '}
                    {new Date(viewingVersion.timestamp).toLocaleString()}
                  </span>
                  {viewingVersion.commitMessage && (
                    <span className="text-xs opacity-75">• {viewingVersion.commitMessage}</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBackToRecord}
                  className="text-primary border-yellow-500/30 hover:bg-yellow-500/20"
                >
                  Return to Current
                </Button>
              </div>
            </div>
          </LayoutSlot>
        )}

        <RecordHeader
          record={record}
          displayRecord={displayRecord}
          isEditMode={viewMode === 'edit'}
          isVersionView={viewMode === 'version-detail'}
          viewingVersion={viewingVersion}
          onEdit={onEdit}
          onDelete={onDelete}
          onShare={handleViewShare}
          onViewVerification={handleViewVerification}
          onVersionMode={handleViewVersionHistory}
          onExit={handleExit}
          onReturnToCurrent={handleBackToRecord}
          onEnterEditMode={handleEnterEditMode}
        />
      </div>

      {/* MAIN CONTENT AREA */}
      {viewMode === 'versions' && (
        <div className="p-8">
          <VersionControlPanel
            documentId={record.id}
            onBack={handleBackToRecord}
            onRollback={handleVersionControlRollback}
            onViewVersion={handleViewVersion}
          />
        </div>
      )}

      {(viewMode === 'record' || viewMode === 'edit' || viewMode === 'version-detail') && (
        <div className="px-4 py-2">
          <RecordView
            record={displayRecord}
            editable={viewMode === 'edit'}
            onFhirChanged={handleFhirChanged}
            onFhirDataChange={handleFhirDataChange}
            onBelroseFieldsChange={handleBelroseFieldsChange}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      )}

      {viewMode === 'edit' && (
        <LayoutSlot slot="footer">
          <div className="flex justify-between items-center p-4 bg-white border-t border-gray-200">
            <div className="flex items-center gap-2">
              {hasAnyChanges && (
                <span className="px-3 py-1 text-sm bg-amber-100 text-amber-800 rounded-full font-medium">
                  Unsaved changes
                </span>
              )}
              <span className="text-sm text-gray-500">Editing health record data</span>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCancelEdit}>
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button onClick={handleSaveRecord} disabled={shouldDisableSave}>
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </LayoutSlot>
      )}
      {viewMode === 'version-detail' && (
        <LayoutSlot slot="footer">
          <div className="flex justify-end items-center p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleViewVersionHistory}>
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

      {viewMode === 'share' && <ShareRecordView record={record} onBack={handleBackToRecord} />}

      {viewMode === 'verification' && (
        <VerificationView record={record} onBack={handleBackToRecord} />
      )}
    </div>
  );
};

export default RecordFull;
