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
import { LayoutSlot } from '@/components/app/LayoutProvider';

type ReviewState = 'loading' | 'ready' | 'no-request' | 'error';

export const SubjectRequestReview: React.FC = () => {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();

  const [record, setRecord] = useState<FileObject | null>(null);
  const [reviewState, setReviewState] = useState<ReviewState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load record first
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

  // Show loading/error states before we have a record
  if (reviewState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (reviewState === 'error' || !record) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (reviewState === 'no-request') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">No Pending Request</h1>
          <p className="text-gray-600 mb-6">
            There's no pending subject request for you on this record.
          </p>
          <Button onClick={() => navigate('/records')}>Back to Records</Button>
        </div>
      </div>
    );
  }

  // Only render the inner component once we have a record
  return (
    <SubjectRequestReviewContent
      record={record}
      onComplete={() => navigate(`/records/${recordId}`)}
    />
  );
};

// Separate component that safely uses the hook
const SubjectRequestReviewContent: React.FC<{
  record: FileObject;
  onComplete: () => void;
}> = ({ record, onComplete }) => {
  const navigate = useNavigate();

  const subjectFlow = useSubjectFlow({
    record, // Now guaranteed to be non-null
    onSuccess: onComplete,
  });

  const handleAccept = () => {
    subjectFlow.initiateAcceptRequest(record.id);
  };

  const handleDecline = () => {
    subjectFlow.initiateRejectRequest(record.id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Review Banner */}
      <LayoutSlot slot="header">
        <div className="p-3 bg-yellow-500/20 border border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg flex-shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0 text-left">
                <p className="font-semibold truncate">Subject Request</p>
                <p className="text-sm truncate">Please confirm if this record is about you.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Button variant="outline" onClick={handleDecline}>
                Decline
              </Button>
              <Button onClick={handleAccept}>Accept & Link</Button>
            </div>
          </div>
        </div>
      </LayoutSlot>

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
          onBack={() => navigate(-1)}
        />
      </div>

      <SubjectActionDialog {...subjectFlow.dialogProps} />
    </div>
  );
};

export default SubjectRequestReview;
