// src/pages/HealthProfile.tsx

/**
 * HealthProfile page
 *
 * Entry point for the HealthProfile feature. Reads :subjectId from the URL,
 * delegates all data loading/processing to useHealthProfile
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HeartPulse, ShieldCheck } from 'lucide-react';
import { useHealthProfile } from '@/features/HealthProfile/hooks/useHealthProfile';
import { HealthCategoryGrid } from '@/features/HealthProfile/components/ui/HealthCategoryGrid';
import { useAuthContext } from '@/features/Auth/AuthContext';
import ProfileHeader from './ui/ProfileHeader';
import ProfileTabs, { ProfileTab } from './ui/ProfileTab';
import ProfileRecordsTab from './ui/ProfileRecords';
import ProfileBlockchainTab from './CredibilityTab/ProfileCredibilityTab';

/** Placeholder for the blockchain tab — will be replaced with SubjectVerificationView */
const BlockchainTabPlaceholder: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
      <ShieldCheck className="w-7 h-7 text-muted-foreground" />
    </div>
    <h3 className="text-base font-semibold text-card-foreground mb-1">Blockchain Verification</h3>
    <p className="text-sm text-muted-foreground max-w-xs">
      On-chain completeness verification coming soon. This will show which records are anchored and
      whether any are missing or tampered.
    </p>
  </div>
);

// ============================================================================
// ERROR STATE
// ============================================================================

const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center px-6">
    <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
      <HeartPulse className="w-7 h-7 text-destructive" />
    </div>
    <h3 className="text-base font-semibold text-card-foreground mb-1">
      Could not load health profile
    </h3>
    <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
  </div>
);

// ============================================================================
// MISSING PARAM STATE
// ============================================================================

const MissingSubjectId: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <p className="text-sm text-muted-foreground mb-3">No subject ID provided in the URL.</p>
      <button
        onClick={() => navigate('/app/all-records')}
        className="text-sm font-medium text-primary hover:underline"
      >
        Go to All Records
      </button>
    </div>
  );
};

// ============================================================================
// PAGE
// ============================================================================

const HealthProfile: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const [activeTab, setActiveTab] = useState<ProfileTab>('summary');

  const { user } = useAuthContext();
  const resolvedSubjectId = subjectId === 'me' ? user?.uid : subjectId;

  // Guard: subjectId missing from URL
  if (!resolvedSubjectId) return <MissingSubjectId />;

  const {
    records,
    grouped,
    populatedCategories,
    summary,
    isLoading,
    error,
    isOwnProfile,
    recordCount,
  } = useHealthProfile(resolvedSubjectId);

  const renderTab = () => {
    if (error) return <ErrorState message={error.message} />;

    switch (activeTab) {
      case 'summary':
        return (
          <HealthCategoryGrid
            grouped={grouped}
            populatedCategories={populatedCategories}
            isLoading={isLoading}
            isOwnProfile={isOwnProfile}
          />
        );
      case 'records':
        return <ProfileRecordsTab records={records} isLoading={isLoading} />;
      case 'blockchain':
        return <ProfileBlockchainTab subjectFirebaseUid={resolvedSubjectId} records={records} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <ProfileHeader
        subjectId={resolvedSubjectId}
        recordCount={recordCount}
        totalResources={summary.totalResourcesExtracted}
        isOwnProfile={isOwnProfile}
        isLoading={isLoading}
      />
      <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-auto p-6">{renderTab()}</div>
    </div>
  );
};

export default HealthProfile;
