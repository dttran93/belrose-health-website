// features/Subject/components/SubjectRequestReview.tsx

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RecordFull } from '@/features/ViewEditRecord/components/RecordFull';
import { SubjectActionDialog } from './ui/SubjectActionDialog';
import { useSubjectFlow } from '../hooks/useSubjectFlow';
import { SubjectService } from '../services/subjectService';

import { FileObject } from '@/types/core';
import { Loader2 } from 'lucide-react';
import { getRecord } from '@/features/ViewEditRecord/services/recordService';

type ReviewState = 'loading' | 'ready' | 'no-request' | 'error';

export const SubjectRequestReview: React.FC = () => {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();

  const [record, setRecord] = useState<FileObject | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize the hook once we have the record
  const subjectFlow = useSubjectFlow({
    record: record!, // Will only be used when record is loaded
    onSuccess: () => {
      // Navigate back after successful accept/decline
      navigate(`/records/${recordId}`);
    },
  });

  // Load record and verify pending request exists
  useEffect(() => {
    const load = async () => {
      if (!recordId) {
        setReviewState('error');
        setErrorMessage('No record ID provided');
        return;
      }

      try {
        // Fetch record
        const recordData = await getRecord(recordId);
        if (!recordData) {
          setReviewState('error');
          setErrorMessage('Record not found');
          return;
        }
        setRecord(recordData);

        // Verify pending request exists for this user
        const requests = await SubjectService.getIncomingRequests();
        const hasRequest = requests.some(r => r.recordId === recordId);

        if (!hasRequest) {
          setReviewState('no-request');
          return;
        }

        setReviewState('ready');
      } catch (err) {
        console.error('Failed to load review data:', err);
        setReviewState('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load');
      }
    };

    load();
  }, [recordId]);

  // Handle accept - opens dialog at confirming phase
  const handleAccept = () => {
    subjectFlow.initiateAcceptRequest(recordId);
  };

  // Handle decline - opens dialog at confirming phase
  const handleDecline = () => {
    subjectFlow.initiateRejectRequest(recordId);
  };

  const handleBack = () => {
    navigate(-1);
  };

  // Loading state
  if (reviewState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading record...</p>
        </div>
      </div>
    );
  }

  // No pending request
  if (reviewState === 'no-request') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">No Pending Request</h1>
          <p className="text-gray-600 mb-6">
            There's no pending subject request for you on this record. It may have been canceled or
            already responded to.
          </p>
          <Button onClick={() => navigate('/records')}>Back to Records</Button>
        </div>
      </div>
    );
  }

  // Error state
  if (reviewState === 'error' || !record) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-6">
            {errorMessage || 'Unable to load the record for review.'}
          </p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Ready - show review UI
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Review Banner */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">Subject Request</p>
                <p className="text-sm text-blue-100 truncate">
                  You've been requested as the subject of this record
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/20 hover:text-white"
                onClick={handleDecline}
              >
                Decline
              </Button>
              <Button className="bg-white text-blue-600 hover:bg-blue-50" onClick={handleAccept}>
                Accept & Link
              </Button>
            </div>
          </div>
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
          onBack={handleBack}
        />
      </div>

      {/* Reuse your existing dialog */}
      <SubjectActionDialog {...subjectFlow.dialogProps} />
    </div>
  );
};

export default SubjectRequestReview;
