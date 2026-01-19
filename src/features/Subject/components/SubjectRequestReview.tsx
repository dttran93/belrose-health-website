// features/Subject/components/SubjectRequestReviewInline.tsx

/**
 * SubjectRequestReviewInline Component
 *
 * Component where a user reviews a request from a requester to
 * confirm they are the subject of a record.
 *
 */

import React from 'react';
import { ArrowLeft, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RecordFull } from '@/features/ViewEditRecord/components/RecordFull';
import { SubjectActionDialog } from './ui/SubjectActionDialog';
import { useSubjectFlow } from '../hooks/useSubjectFlow';
import { FileObject } from '@/types/core';
import { SubjectConsentRequest } from '../services/subjectConsentService';

interface SubjectRequestReviewInlineProps {
  record: FileObject;
  request: SubjectConsentRequest;
  onBack: () => void;
  onComplete: () => void;
}

export const SubjectRequestReview: React.FC<SubjectRequestReviewInlineProps> = ({
  record,
  request,
  onBack,
  onComplete,
}) => {
  const subjectFlow = useSubjectFlow({
    record,
    onSuccess: onComplete,
  });

  const handleAccept = () => {
    subjectFlow.initiateAcceptRequest(record.id);
  };

  const handleDecline = () => {
    subjectFlow.initiateRejectRequest(record.id);
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* Review Header Banner */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="p-4 bg-yellow-500/20 border-b border-yellow-500/30">
          <div className="flex items-center justify-between gap-4">
            {/* Left side - back button and info */}
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" onClick={onBack} className="p-2 flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="p-2 rounded-lg flex-shrink-0 bg-yellow-500/30">
                <UserCheck className="w-6 h-6 text-yellow-700" />
              </div>
              <div className="min-w-0 text-left">
                <p className="font-semibold truncate">Subject Request</p>
                <p className="text-sm text-gray-600 truncate">
                  Please confirm if this record is about you.
                </p>
              </div>
            </div>

            {/* Right side - action buttons */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Button variant="outline" onClick={handleDecline} disabled={subjectFlow.isLoading}>
                Decline
              </Button>
              <Button onClick={handleAccept} disabled={subjectFlow.isLoading}>
                Accept & Link
              </Button>
            </div>
          </div>
        </div>

        {/* Info bar */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-700">
            <strong>Review carefully:</strong> Accepting will link you as a subject of this record
            and anchor this relationship on the blockchain.
          </p>
        </div>
      </div>

      {/* Record Preview */}
      <div className="max-w-7xl mx-auto p-4">
        <RecordFull
          record={record}
          initialViewMode="record"
          readOnly={true}
          onSave={() => {}}
          onDownload={() => {}}
          onCopy={() => {}}
          onDelete={() => {}}
          onBack={onBack}
        />
      </div>

      {/* Bottom sticky action bar for mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg md:hidden">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={subjectFlow.isLoading}
            className="flex-1"
          >
            Decline
          </Button>
          <Button onClick={handleAccept} disabled={subjectFlow.isLoading} className="flex-1">
            Accept & Link
          </Button>
        </div>
      </div>

      {/* Subject Action Dialog for the accept/decline flows */}
      <SubjectActionDialog {...subjectFlow.dialogProps} />
    </div>
  );
};

export default SubjectRequestReview;
