// src/features/RefineRecord/components/RecordFollowUpsView.tsx

/**
 * RecordFollowUpsView
 *
 * Full-panel view for outstanding follow-up actions on a record.
 * Sits inside RecordFull as viewMode === 'follow-ups', matching the
 * same layout pattern as SubjectManager and CredibilityView.
 */

import React from 'react';
import { ArrowLeft, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileObject } from '@/types/core';
import useRecordFollowUps from '../hooks/useRecordFollowUps';
import FollowUpItems from './FollowUpItems';

interface RecordFollowUpsViewProps {
  record: FileObject;
  onBack: () => void;
  onAction: (fileItem: FileObject, itemId: string) => void;
}

export const RecordFollowUpsView: React.FC<RecordFollowUpsViewProps> = ({
  record,
  onBack,
  onAction,
}) => {
  const { followUpItems, isLoading } = useRecordFollowUps(record, { onAction });

  return (
    <div className="w-full mx-auto p-8 space-y-6">
      {/* Header — matches SubjectManager / CredibilityView exactly */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <ListChecks className="w-5 h-5" />
          Complete this record
        </h3>
        <Button onClick={onBack} className="w-8 h-8 border-none bg-transparent hover:bg-gray-200">
          <ArrowLeft className="text-primary" />
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <p className="text-gray-500">Checking record status...</p>
        </div>
      )}

      {/* All done state */}
      {!isLoading && followUpItems.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ListChecks className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-medium text-gray-900 mb-4">Record is complete</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              All optional steps have been completed. This record is fully verified and linked.
            </p>
          </div>
        </div>
      )}

      {/* Follow-up items */}
      {!isLoading && followUpItems.length > 0 && (
        <>
          <p className="text-sm text-gray-500">
            These steps are optional but important for data quality and record credibility.
          </p>
          <FollowUpItems items={followUpItems} />
        </>
      )}
    </div>
  );
};

export default RecordFollowUpsView;
