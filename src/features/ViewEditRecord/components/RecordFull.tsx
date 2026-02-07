import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X, Save, Ellipsis, Info, UserCheck, AlertCircle } from 'lucide-react';
import { FileObject, BelroseFields } from '@/types/core';
import { LayoutSlot } from '@/components/app/LayoutProvider';
import VersionControlPanel from './VersionControlPanel';
import { RecordVersion } from '../services/versionControlService.types';
import { CredibilityView } from '@/features/Credibility/components/CredibilityView';
import HealthRecordMenu from './View/RecordMenu';
import { CredibilityBadge } from '@/features/Credibility/components/ui/CredibilityBadge';
import RecordView from './View/RecordView';
import { TabType } from './View/RecordView';
import { EncryptionAccessView } from '@/features/Sharing/components/EncryptionAccessView';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import PermissionsManager from '@/features/Permissions/component/PermissionManager';
import SubjectManager from '@/features/Subject/components/SubjectManager';
import SubjectBadge from '@/features/Subject/components/SubjectBadge';
import useAuth from '@/features/Auth/hooks/useAuth';
import { useSubjectFlow } from '@/features/Subject/hooks/useSubjectFlow';
import { SubjectActionDialog } from '@/features/Subject/components/ui/SubjectActionDialog';
import {
  PendingSubjectRequestAlert,
  RejectionResponseAlert,
  RemovalRequestAlert,
} from '@/features/Subject/components/SubjectAlertBanners';
import { useSubjectAlerts } from '@/features/Subject/hooks/useSubjectAlerts';
import SubjectService from '@/features/Subject/services/subjectService';
import SubjectRemovalService from '@/features/Subject/services/subjectRemovalService';

type ViewMode =
  | 'record'
  | 'edit'
  | 'versions'
  | 'version-detail'
  | 'credibility'
  | 'access'
  | 'permissions'
  | 'subject';

interface RecordFullProps {
  record: FileObject;
  className?: string;
  showMenu?: boolean;

  //File Management Props --> done by useRecordActions hook
  onSave: (updatedRecord: FileObject) => void;
  onDownload: (record: FileObject) => void;
  onCopy: (record: FileObject) => void;
  onDelete: (record: FileObject) => void;
  onRefreshRecord?: () => void;

  //Navigation Props
  onBack: (record: FileObject) => void; //for returning to the previous screen, could be different so need a prop
  initialViewMode?:
    | 'record'
    | 'edit'
    | 'versions'
    | 'credibility'
    | 'permissions'
    | 'access'
    | 'subject'; //version-detail can never be the initial view, since it only comes from versions
  comingFromAddRecord?: boolean; //so the Save button is activated when coming from the AddRecord screen, otherwise it'd be disabled and the user is stuck
  readOnly?: boolean;
}

export const RecordFull: React.FC<RecordFullProps> = ({
  record,
  onSave,
  onDownload,
  onCopy,
  onDelete,
  onRefreshRecord,
  onBack,
  initialViewMode = 'record',
  comingFromAddRecord = false,
  readOnly = false,
}) => {
  const { user } = useAuth();

  // Subject Alerts hook
  const subjectAlerts = useSubjectAlerts({ recordId: record.id });

  // Subject flow hook for accept/decline actions
  const subjectFlow = useSubjectFlow({
    record,
    onSuccess: () => {
      // Clear the pending request banner after successful action
      subjectAlerts.refetch();
      onRefreshRecord?.();
    },
  });

  const getInitialViewMode = (): ViewMode => {
    return initialViewMode as ViewMode;
  };

  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode());
  const [activeTab, setActiveTab] = useState<TabType>('record');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasFhirChanges, setHasFhirChanges] = useState(false);
  const [currentFhirData, setCurrentFhirData] = useState(record.fhirData);
  const [editedBelroseFields, setEditedBelroseFields] = useState<BelroseFields | undefined>(
    record.belroseFields
  );
  const [viewingVersion, setViewingVersion] = useState<RecordVersion | null>(null);
  const [decryptedVersionData, setDecryptedVersionData] = useState<any>(null);
  const [enterVerificationInModifyMode, setEnterVerificationinModifyMode] = useState(false);
  const [enterDisputeInModifyMode, setEnterDisputeinModifyMode] = useState(false);

  /**
   * Decrypt a version's snapshot if it's encrypted
   */
  const decryptVersionSnapshot = async (version: RecordVersion): Promise<any> => {
    // If not encrypted, return plain data directly
    if (!version.recordSnapshot.isEncrypted) {
      return {
        fileName: version.recordSnapshot.fileName ?? null,
        fhirData: version.recordSnapshot.fhirData ?? null,
        belroseFields: version.recordSnapshot.belroseFields ?? null,
        extractedText: version.recordSnapshot.extractedText ?? null,
        originalText: version.recordSnapshot.originalText ?? null,
      };
    }

    // Check if encryption session is active
    const masterKey = await EncryptionKeyManager.getSessionKey();
    if (!masterKey) {
      throw new Error('Please unlock your encryption to view this version.');
    }

    // Decrypt the version
    const encryptedRecord = {
      id: record.id,
      encryptedFileName: version.recordSnapshot.encryptedFileName,
      encryptedExtractedText: version.recordSnapshot.encryptedExtractedText,
      encryptedOriginalText: version.recordSnapshot.encryptedOriginalText,
      encryptedContextText: version.recordSnapshot.encryptedContextText,
      encryptedFhirData: version.recordSnapshot.encryptedFhirData,
      encryptedBelroseFields: version.recordSnapshot.encryptedBelroseFields,
      isEncrypted: true,
    };

    const decryptedData = await RecordDecryptionService.decryptRecord(encryptedRecord);

    return {
      fileName: decryptedData.fileName ?? null,
      fhirData: decryptedData.fhirData ?? null,
      belroseFields: decryptedData.belroseFields ?? null,
      extractedText: decryptedData.extractedText ?? null,
      originalText: decryptedData.originalText ?? null,
    };
  };

  const reconstructFileObjectFromVersion = (
    versionData: any,
    version: RecordVersion,
    originalRecord: FileObject
  ): FileObject => {
    return {
      ...originalRecord,

      //Restored Data from Snapshot
      fhirData: versionData.fhirData,
      belroseFields: versionData.belroseFields,
      extractedText: versionData.extractedText,
      originalText: versionData.originalText,

      // Get Hashes from Version Metadata
      recordHash: version.recordHash ?? null,
      previousRecordHash: originalRecord.recordHash
        ? [...(originalRecord.previousRecordHash ?? []), originalRecord.recordHash]
        : (originalRecord.previousRecordHash ?? null),
      originalFileHash: originalRecord.originalFileHash ?? null,
    };
  };

  const displayRecord =
    viewMode === 'version-detail' && viewingVersion && decryptedVersionData
      ? reconstructFileObjectFromVersion(decryptedVersionData, viewingVersion, record)
      : record;

  // View Mode Handlers

  const handleModifyVerificationFromVersions = () => {
    setEnterVerificationinModifyMode(true);
    setViewMode('credibility');
  };

  const handleModifyDisputeFromVersions = () => {
    setEnterDisputeinModifyMode(true);
    setViewMode('credibility');
  };

  const handleEnterEditMode = () => {
    if (readOnly) return;
    setViewMode('edit');
    setActiveTab('record');
    setEditedBelroseFields(record.belroseFields || undefined);
  };

  const handleViewVersionHistory = () => {
    setViewMode('versions');
  };

  const handleViewCredibility = () => {
    setEnterVerificationinModifyMode(false);
    setViewMode('credibility');
  };

  const handleAccessPage = () => {
    setViewMode('access');
  };

  const handlePermissionManager = () => {
    setViewMode('permissions');
  };

  const handleSubjectPage = () => {
    setViewMode('subject');
  };

  const handleViewVersion = async (version: RecordVersion) => {
    try {
      // Decrypt the version data
      const decryptedData = await decryptVersionSnapshot(version);

      // Store both the version and its decrypted data
      setViewingVersion(version);
      setDecryptedVersionData(decryptedData);
      setViewMode('version-detail');
    } catch (error: any) {
      console.error('Failed to view version:', error);
      alert(error.message || 'Failed to view version. Please try again.');
    }
  };

  const handleBackToRecord = () => {
    setViewMode('record');
    setViewingVersion(null);
    setDecryptedVersionData(null); //Clear decrypted data
  };

  // DATA HANDLERS
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

  const handleSaveRecord = () => {
    const updatedRecord = {
      ...record,
      fhirData: currentFhirData,
      belroseFields: editedBelroseFields,
    };

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
    setEditedBelroseFields(record.belroseFields || undefined);
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

  const handleVersionControlRollback = () => {
    setHasUnsavedChanges(false);
    setHasFhirChanges(false);
    setViewMode('record');
    onRefreshRecord?.();
  };

  const handleDropRejection = async (subjectId: string) => {
    try {
      await SubjectService.respondToSubjectRejection(record.id, subjectId, 'dropped');
      subjectAlerts.refetch();
      onRefreshRecord?.();
    } catch (error) {
      console.error('Error dropping rejection:', error);
    }
  };

  const handleEscalateRejection = async (subjectId: string) => {
    try {
      await SubjectService.respondToSubjectRejection(record.id, subjectId, 'escalated');
      subjectAlerts.refetch();
      onRefreshRecord?.();
    } catch (error) {
      console.error('Error escalating rejection:', error);
    }
  };

  const handleRemoveSelf = () => {
    subjectFlow.initiateRemoveSubjectStatus();
  };

  const handleDisputeRemoval = async () => {
    try {
      await SubjectRemovalService.rejectRemoval(record.id);
      subjectAlerts.refetch();
      onRefreshRecord?.();
    } catch (error) {
      console.error('Error escalating rejection:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto bg-background rounded-2xl shadow-xl rounded-lg">
      {/* ===== HEADER SECTION ===== */}
      <div className="bg-primary rounded-lg">
        {/* Pending Subject Request Banner */}
        {/* Subject-related Alert Banners */}
        {!subjectAlerts.isLoading && viewMode !== 'version-detail' && (
          <LayoutSlot slot="header">
            <div className="space-y-2">
              {/* Pending subject request - someone invited you to be a subject */}
              {subjectAlerts.hasSubjectRequest && (
                <PendingSubjectRequestAlert
                  onAccept={() => subjectFlow.initiateAcceptRequest(record.id)}
                  onDecline={() => subjectFlow.initiateRejectRequest(record.id)}
                  isLoading={subjectFlow.isLoading}
                />
              )}

              {/* Rejection responses needed - subjects who removed themselves */}
              {subjectAlerts.pendingRejectionResponses.map(rejection => (
                <RejectionResponseAlert
                  key={rejection.subjectId}
                  subjectName={rejection.subjectName}
                  onDrop={() => handleDropRejection(rejection.subjectId)}
                  onEscalate={() => handleEscalateRejection(rejection.subjectId)}
                  isLoading={subjectFlow.isLoading}
                />
              ))}

              {/* Removal request - owner asked you to remove yourself */}
              {subjectAlerts.hasRemovalRequest && subjectAlerts.removalRequest && (
                <RemovalRequestAlert
                  onRemove={handleRemoveSelf}
                  onDispute={handleDisputeRemoval}
                  isLoading={subjectFlow.isLoading}
                />
              )}
            </div>
          </LayoutSlot>
        )}

        {/* Version View Banner - for Viewing Old Versions */}
        {viewMode === 'version-detail' && viewingVersion && (
          <LayoutSlot slot="header">
            <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="ml-3 flex items-center gap-2 text-yellow-100">
                  <span className="text-sm font-medium text-primary">
                    Viewing historical version #{viewingVersion.versionNumber} from{' '}
                    {formatTimestamp(viewingVersion.editedAt, 'long')}
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

        {/* Main Header */}
        <div className="bg-primary px-8 py-6 rounded-t-lg">
          {/* Top Row - Badges and Actions */}
          <div className="flex items-center justify-between space-x-1 mb-3">
            <div className="flex items-center gap-2">
              {viewMode !== 'edit' && (
                <>
                  <span className="px-2 py-1 text-xs font-medium rounded-full border bg-background text-primary">
                    {displayRecord.belroseFields?.visitType}
                  </span>
                  <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded border">
                    {displayRecord.sourceType}
                  </span>
                </>
              )}
              {viewMode === 'edit' && (
                <span className="px-2 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-100 rounded border border-yellow-500/30">
                  Editing Mode
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <SubjectBadge
                record={record}
                onOpenManager={handleSubjectPage}
                onSuccess={() => {}}
              />
              <CredibilityBadge score={record.credibility?.score} />
              {!readOnly && (
                <HealthRecordMenu
                  record={record}
                  triggerIcon={Ellipsis}
                  triggerClassName="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                  showView={false} //Don't need view because we're already on view full record
                  onEdit={viewMode !== 'edit' ? handleEnterEditMode : undefined}
                  onVersion={viewMode !== 'versions' ? handleViewVersionHistory : undefined}
                  onSubject={viewMode !== 'subject' ? handleSubjectPage : undefined}
                  onAccess={viewMode !== 'access' ? handleAccessPage : undefined}
                  onCredibility={viewMode !== 'credibility' ? handleViewCredibility : undefined}
                  onPermissions={viewMode !== 'permissions' ? handlePermissionManager : undefined}
                  onDownload={onDownload}
                  onCopy={onCopy}
                  onDelete={onDelete}
                />
              )}
              <Button
                variant="default"
                className="p-2 w-8 h-8 hover:bg-white/20 transition-colors"
                onClick={handleExit}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Content Area */}
          {viewMode === 'edit' ? (
            // Edit Mode Banner
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                <div className="text-center flex-1">
                  <h3 className="text-yellow-100 font-medium mb-1">Editing Record</h3>
                  <p className="text-yellow-200/80 text-sm">
                    Scroll down to edit your records, FHIR data, and other fields. Hash fields will
                    recalculate when you refresh the page.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // View Mode - Normal Header
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-white">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">{displayRecord.belroseFields?.title}</h1>
                  </div>
                </div>
              </div>

              <div className="flex text-sm text-white items-start gap-4 my-2">
                <div>
                  {displayRecord.belroseFields?.completedDate} •{' '}
                  {displayRecord.belroseFields?.patient} • {displayRecord.belroseFields?.provider} •{' '}
                  {displayRecord.belroseFields?.institution}
                </div>
              </div>

              <div className="flex justify-left text-white/50 text-left">
                <p>{displayRecord.belroseFields?.summary}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== MAIN CONTENT AREA ===== */}
      {viewMode === 'versions' && (
        <VersionControlPanel
          documentId={record.id}
          onBack={handleBackToRecord}
          onRollback={handleVersionControlRollback}
          onViewVersion={handleViewVersion}
          record={record}
          onModifyVerification={handleModifyVerificationFromVersions}
          onModifyDispute={handleModifyDisputeFromVersions}
        />
      )}

      {(viewMode === 'record' || viewMode === 'edit' || viewMode === 'version-detail') && (
        <RecordView
          record={displayRecord}
          editable={viewMode === 'edit'}
          onFhirChanged={handleFhirChanged}
          onFhirDataChange={handleFhirDataChange}
          onBelroseFieldsChange={handleBelroseFieldsChange}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}

      {viewMode === 'permissions' && (
        <PermissionsManager record={displayRecord} onBack={handleBackToRecord} />
      )}

      {viewMode === 'subject' && (
        <SubjectManager record={displayRecord} onBack={handleBackToRecord} />
      )}

      {/* ===== FOOTER SECTIONS ===== */}
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
              {comingFromAddRecord ? (
                <>
                  {/* Buttons when coming from "Add Record" */}
                  <Button onClick={handleCancelEdit} disabled={hasAnyChanges}>
                    Confirm
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCancelEdit}>
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                </>
              )}
              <Button onClick={handleSaveRecord} disabled={!hasAnyChanges}>
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

      {viewMode === 'access' && (
        <EncryptionAccessView record={record} onBack={handleBackToRecord} />
      )}

      {viewMode === 'credibility' && (
        <CredibilityView
          record={record}
          onBack={handleBackToRecord}
          startModVerifyFromVersions={enterVerificationInModifyMode}
          startModDisputeFromVersions={enterDisputeInModifyMode}
        />
      )}

      {/* Subject Action Dialog for accept/decline flows */}
      <SubjectActionDialog {...subjectFlow.dialogProps} />
    </div>
  );
};

export default RecordFull;
