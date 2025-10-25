import React from 'react';
import { Button } from '@/components/ui/Button';
import { X, Ellipsis, Info } from 'lucide-react';
import { FileObject, BelroseFields } from '@/types/core';
import HealthRecordMenu from './RecordMenu';
import { VerificationBadge } from '@/features/BlockchainVerification/component/VerificationBadge';
import { RecordVersion } from '@/features/ViewEditRecord/services/versionControlService.types';

interface RecordHeaderProps {
  record: FileObject;
  displayRecord: FileObject;
  isEditMode: boolean;
  isVersionView: boolean;
  viewingVersion: RecordVersion | null;
  onEdit?: (record: FileObject) => void;
  onDelete?: (record: FileObject) => void;
  onShare?: (record: FileObject) => void;
  onViewVerification?: (record: FileObject) => void;
  onVersionMode?: (record: string) => void;
  onExit: () => void;
  onReturnToCurrent?: () => void;
  onEnterEditMode: () => void;
}

export const RecordHeader: React.FC<RecordHeaderProps> = ({
  record,
  displayRecord,
  isEditMode,
  isVersionView,
  viewingVersion,
  onEdit,
  onDelete,
  onShare,
  onViewVerification,
  onVersionMode,
  onExit,
  onReturnToCurrent,
  onEnterEditMode,
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
            {isEditMode && (
              <span className="px-2 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-100 rounded border border-yellow-500/30">
                Editing Mode
              </span>
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
          // Edit Mode Banner
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
              <div className="text-center flex-1">
                <h3 className="text-yellow-100 font-medium mb-1">Editing Record</h3>
                <p className="text-yellow-200/80 text-sm">
                  Scroll down to edit the record details, FHIR data, and other fields. Changes are
                  saved when you click the Save button.
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
    </>
  );
};

export default RecordHeader;
