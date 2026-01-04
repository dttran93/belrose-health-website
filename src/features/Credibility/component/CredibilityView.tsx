// src/features/Credibility/components/CredibilityView.tsx

import React, { useState, useEffect } from 'react';
import { FileObject } from '@/types/core';
import { RecordHashService } from '@/features/ViewEditRecord/services/generateRecordHash';
import { ArrowLeft, Shield, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RecordReviewPanel } from './RecordReviewPanel';
import { useAuth } from '@/features/Auth/hooks/useAuth';
import VerificationManagement from './VerificationManagement';
import { getVerificationsByRecordId, VerificationDoc } from '../services/verificationService';
import { DisputeDoc } from '../services/disputeService';
import DisputeManagement from './DisputeManagement';

type ViewMode = 'loading' | 'empty' | 'list' | 'add';
type ReviewTab = 'verify' | 'dispute';

interface CredibilityViewProps {
  record: FileObject;
  onBack: () => void;
}

export const CredibilityView: React.FC<CredibilityViewProps> = ({ record, onBack }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('loading');
  const [reviewPanelInitialTab, setReviewPanelInitialTab] = useState<ReviewTab>('verify');
  const [verifications, setVerifications] = useState<VerificationDoc[]>([]);
  const { user } = useAuth();

  // Generate or retrieve the record hash
  const recordHash = (record.recordHash || RecordHashService.generateRecordHash(record)) as string;
  const recordId = record.firestoreId || record.id;

  // Fetch verifications on mount and when record changes
  useEffect(() => {
    const fetchVerifications = async () => {
      if (!recordId) {
        setViewMode('empty');
        return;
      }

      try {
        const fetchedVerifications = await getVerificationsByRecordId(recordId);
        setVerifications(fetchedVerifications);

        // Determine initial view mode based on whether verifications exist
        if (fetchedVerifications.length > 0) {
          setViewMode('list');
        } else {
          setViewMode('empty');
        }
      } catch (error) {
        console.error('Error fetching verifications:', error);
        setViewMode('empty');
      }
    };

    fetchVerifications();
  }, [recordId]);

  const handleBackClick = () => {
    if (viewMode === 'add') {
      // Go back to list or empty state
      setViewMode(verifications.length > 0 ? 'list' : 'empty');
    } else {
      onBack();
    }
  };

  const handleAddVerification = () => {
    setReviewPanelInitialTab('verify');
    setViewMode('add');
  };

  const handleAddDispute = () => {
    setReviewPanelInitialTab('dispute');
    setViewMode('add');
  };

  const handleVerificationSuccess = () => {
    // Refresh verifications and go back to list view
    const refreshAndShowList = async () => {
      try {
        const fetchedVerifications = await getVerificationsByRecordId(recordId);
        setVerifications(fetchedVerifications);
        setViewMode('list');
      } catch (error) {
        console.error('Error refreshing verifications:', error);
        setViewMode('list');
      }
    };
    refreshAndShowList();
  };

  const handleSubmitDispute = async (data: DisputeDoc) => {
    // TODO: Call your blockchain/Firebase service
    console.log('Submitting dispute:', data);
    // await disputeService.createDispute(data);
    setViewMode(verifications.length > 0 ? 'list' : 'empty');
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
            onClick={handleBackClick}
            className="w-8 h-8 border-none bg-transparent hover:bg-gray-200"
          >
            <ArrowLeft className="text-primary" />
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {viewMode === 'loading' && (
        <div className="flex justify-center items-center py-12">
          <p className="text-gray-500">Loading credibility data...</p>
        </div>
      )}

      {/* Empty State */}
      {viewMode === 'empty' && (
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
            <Button onClick={handleAddVerification}>Create Record Credibility Review</Button>
          </div>
        </div>
      )}

      {/* List State - Show VerificationManagement */}
      {viewMode === 'list' && (
        <>
          <VerificationManagement
            record={record}
            onBack={onBack}
            onAddMode={handleAddVerification}
            isAddMode={false}
          />
          <DisputeManagement
            record={record}
            onBack={onBack}
            onAddMode={handleAddDispute}
            isAddMode={false}
          />
        </>
      )}

      {/* Add State - Show RecordReviewPanel */}
      {viewMode === 'add' && (
        <RecordReviewPanel
          recordId={recordId}
          recordHash={recordHash}
          recordTitle={record.belroseFields?.title || record.fileName || 'Medical Record'}
          onViewRecord={handleBackClick}
          onSuccess={handleVerificationSuccess}
          initialTab={reviewPanelInitialTab}
          existingDispute={null}
        />
      )}
    </div>
  );
};

export default CredibilityView;
