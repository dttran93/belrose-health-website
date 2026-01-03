// src/features/Credibility/components/CredibilityView.tsx

import React, { useState } from 'react';
import { FileObject } from '@/types/core';
import { RecordHashService } from '@/features/ViewEditRecord/services/generateRecordHash';
import { ArrowLeft, Shield, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RecordReviewPanel } from './RecordReviewPanel';
import { DisputeData } from './ui/DisputeForm';
import { useAuth } from '@/features/Auth/hooks/useAuth'; // Adjust import path as needed

interface CredibilityViewProps {
  record: FileObject;
  onBack: () => void;
}

export const CredibilityView: React.FC<CredibilityViewProps> = ({ record, onBack }) => {
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const { user } = useAuth(); // Get current user for verifierId

  // Generate or retrieve the record hash
  const recordHash = (record.recordHash || RecordHashService.generateRecordHash(record)) as string;

  const handleCloseReviewPanel = () => {
    setShowReviewPanel(false);
  };

  const handleVerificationSuccess = () => {
    // Optionally refresh data, show toast, etc.
    console.log('Verification succeeded');
  };

  const handleSubmitDispute = async (data: DisputeData) => {
    // TODO: Call your blockchain/Firebase service
    console.log('Submitting dispute:', data);
    // await disputeService.createDispute(data);

    setShowReviewPanel(false);
  };

  if (!user) {
    return <div>Please log in to view credibility information.</div>;
  }

  return (
    <div className="w-full mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <HeartHandshake className="w-5 h-5" />
          Credibility
        </h3>
        <div className="flex items-center gap-2">
          <Button
            onClick={showReviewPanel ? handleCloseReviewPanel : onBack}
            className="w-8 h-8 border-none bg-transparent hover:bg-gray-200"
          >
            <ArrowLeft className="text-primary" />
          </Button>
        </div>
      </div>

      {/* Review Panel */}
      {showReviewPanel ? (
        <RecordReviewPanel
          recordId={record.id}
          recordHash={recordHash}
          recordTitle={record.belroseFields?.title || record.fileName || 'Medical Record'}
          onViewRecord={onBack}
          onSuccess={handleVerificationSuccess}
          existingDispute={null}
        />
      ) : (
        /* Empty State Content */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-medium text-gray-900 mb-4">
              No Verifications or Disputes
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              This record has no verifications or disputes and is fully self-reported. Click below
              to file this record's first credibility review:
            </p>
            <Button onClick={() => setShowReviewPanel(true)}>
              Create Record Credibility Review
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CredibilityView;
