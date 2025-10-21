import React from 'react';
import { Button } from '@/components/ui/Button';
import { X, Ellipsis } from 'lucide-react';
import { FileObject, BelroseFields } from '@/types/core';
import HealthRecordMenu from './RecordMenu';
import { VerificationBadge } from '@/features/BlockchainVerification/component/VerificationBadge';
import { RecordVersion } from '@/features/ViewEditRecord/services/versionControlService.types';

// Component for editable belrose fields
const EditableBelroseFields = ({
  editedBelroseFields,
  updateBelroseField,
}: {
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
          onChange={e => updateBelroseField('title', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="Enter record title..."
        />
      </div>
      <div className="col-span-2">
        <label className="block text-sm font-medium text-white/90 mb-1">Visit Type</label>
        <input
          type="text"
          value={editedBelroseFields.visitType || ''}
          onChange={e => updateBelroseField('visitType', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="e.g., Follow-up Appointment, Lab Results..."
        />
      </div>

      <div className="col-span-3">
        <label className="block text-sm font-medium text-white/90 mb-1">Completed Date</label>
        <input
          type="date"
          value={
            editedBelroseFields.completedDate ? editedBelroseFields.completedDate.split('T')[0] : ''
          }
          onChange={e => updateBelroseField('completedDate', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
        />
      </div>

      <div className="col-span-3">
        <label className="block text-sm font-medium text-white/90 mb-1">Patient</label>
        <input
          type="text"
          value={editedBelroseFields.patient || ''}
          onChange={e => updateBelroseField('patient', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="Patient Name..."
        />
      </div>

      <div className="col-span-3">
        <label className="block text-sm font-medium text-white/90 mb-1">Provider</label>
        <input
          type="text"
          value={editedBelroseFields.provider || ''}
          onChange={e => updateBelroseField('provider', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="Provider name..."
        />
      </div>

      <div className="col-span-3">
        <label className="block text-sm font-medium text-white/90 mb-1">Institution</label>
        <input
          type="text"
          value={editedBelroseFields.institution || ''}
          onChange={e => updateBelroseField('institution', e.target.value)}
          className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
          placeholder="Healthcare institution..."
        />
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium text-white/90 mb-1">Summary</label>
      <textarea
        value={editedBelroseFields.summary || ''}
        onChange={e => updateBelroseField('summary', e.target.value)}
        rows={2}
        className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
        placeholder="Brief summary of the record..."
      />
    </div>
  </div>
);

interface RecordHeaderProps {
  record: FileObject;
  displayRecord: FileObject;
  isEditMode: boolean;
  isVersionView: boolean;
  viewingVersion: RecordVersion | null;
  editedBelroseFields: BelroseFields;
  onEdit?: (record: FileObject) => void;
  onDelete?: (record: FileObject) => void;
  onShare?: (record: FileObject) => void;
  onViewVerification?: (record: FileObject) => void;
  onVersionMode?: (record: string) => void;
  onExit: () => void;
  onReturnToCurrent?: () => void;
  onEnterEditMode: () => void;
  updateBelroseField: (field: keyof BelroseFields, value: string) => void;
}

export const RecordHeader: React.FC<RecordHeaderProps> = ({
  record,
  displayRecord,
  isEditMode,
  isVersionView,
  viewingVersion,
  editedBelroseFields,
  onEdit,
  onDelete,
  onShare,
  onViewVerification,
  onVersionMode,
  onExit,
  onReturnToCurrent,
  onEnterEditMode,
  updateBelroseField,
}) => {
  const handleViewVerification = (record: FileObject) => {
    onViewVerification?.(record);
  };

  return (
    <>
      {/* Main Header */}
      <div className="bg-primary px-8 py-6">
        {/* Top Row - Badges and Actions */}
        <div className="flex items-center justify-between space-x-1 mb-3">
          <div className="flex items-center gap-2">
            {!isEditMode && (
              <>
                <span className="px-2 py-1 text-xs font-medium rounded-full border bg-background text-primary">
                  {displayRecord.belroseFields?.visitType}
                </span>
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded border">
                  {displayRecord.sourceType}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center">
            <VerificationBadge fileObject={record} />
            <HealthRecordMenu
              record={record}
              triggerIcon={Ellipsis}
              showView={false}
              triggerClassName="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              onEdit={!isEditMode ? onEnterEditMode : undefined}
              onVersion={!isVersionView ? onVersionMode : undefined}
              onDelete={onDelete}
              onShare={onShare}
              onViewVerification={handleViewVerification}
            />
            <Button
              variant="default"
              className="p-2 w-8 h-8 hover:bg-white/20 transition-colors"
              onClick={onExit}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content Area */}
        {isEditMode ? (
          <div className="mt-4">
            <EditableBelroseFields
              editedBelroseFields={editedBelroseFields}
              updateBelroseField={updateBelroseField}
            />
          </div>
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
    </>
  );
};

export default RecordHeader;
