// src/pages/HealthProfile.tsx

/**
 * HealthProfile page
 *
 * Entry point for the HealthProfile feature. Reads :subjectId from the URL,
 * delegates clinical data loading to useHealthProfile, and fetches the
 * patient context record directly by deterministic ID.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clipboard,
  HeartPulse,
  IdCard,
  LayoutGrid,
  List,
  ListChecks,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useHealthProfile } from '@/features/HealthProfile/hooks/useHealthProfile';
import HealthDataDisplay from '@/features/HealthProfile/components/HealthDataTabs/HealthDataDisplay';
import { useAuthContext } from '@/features/Auth/AuthContext';
import ProfileHeader from '../features/HealthProfile/components/ui/ProfileHeader';
import ProfileRecordsTab from '../features/HealthProfile/components/RecordsTab/ProfileRecordsTab';
import { ProfileCredibilityTab } from '../features/HealthProfile/components/CredibilityTab/ProfileCredibilityTab';
import { Tab, TabNavigation } from '@/components/ui/TabNavigation';
import { getUserProfile } from '@/features/Users/services/userProfileService';
import { BelroseUserProfile } from '@/types/core';
import { useUserRecords } from '@/features/ViewEditRecord/hooks/useUserRecords';
import { parseIdentityFromRecord } from '../features/HealthProfile/utils/parseUserIdentity';
import { ALL_DATA_VIEW, SCR_VIEW } from '../features/HealthProfile/configs/healthDataViews';
import { IdentityTab } from '../features/HealthProfile/components/IdentityTab/IdentityTab';
import { useProfileCompleteness } from '../features/HealthProfile/hooks/useProfileCompleteness';
import ProfileCompletenessTab from '../features/HealthProfile/components/ProfileCompletenessTab/ProfileCompletenessTab';
import useBlockchainCompleteness from '../features/HealthProfile/hooks/useBlockchainCompleteness';
import { getIdentityRecordId } from '@/features/HealthProfile/services/userIdentityService';

// ============================================================================
// TAB CONFIG
// ============================================================================

export type HealthProfileTabs =
  | 'summary'
  | 'all-data'
  | 'records'
  | 'identity'
  | 'blockchain'
  | 'completeness';

const PROFILE_TABS: Tab[] = [
  { id: 'summary', label: 'Summary', icon: LayoutGrid },
  { id: 'all-data', label: 'All Data', icon: List },
  { id: 'records', label: 'Records', icon: Clipboard },
  { id: 'identity', label: 'Identity', icon: IdCard },
  { id: 'blockchain', label: 'Credibility', icon: ShieldCheck },
  { id: 'completeness', label: 'Compeleteness', icon: ListChecks },
];

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
  const navigate = useNavigate();
  const { subjectId } = useParams<{ subjectId: string }>();
  const [activeTab, setActiveTab] = useState<HealthProfileTabs>('summary');

  const { user } = useAuthContext();
  const resolvedSubjectId = subjectId === 'me' ? user?.uid : subjectId;
  const isGuest = (user as any)?.isGuest === true;

  // Guard: subjectId missing from URL
  if (!resolvedSubjectId) return <MissingSubjectId />;

  // ── Clinical data ──────────────────────────────────────────────────────────
  const { records, grouped, summary, isLoading, error, isOwnProfile, recordCount, subjectName } =
    useHealthProfile(resolvedSubjectId);

  // ── Belrose account profile (avatar, email) ────────────────────────────────
  const [profile, setProfile] = useState<BelroseUserProfile | null>(null);
  useEffect(() => {
    getUserProfile(resolvedSubjectId).then(setProfile);
  }, [resolvedSubjectId]);

  //=== Call blockchain hook to populate widget and pass down to child components ====
  const { anchoredRecordIds, isLoading: blockchainLoading } = useBlockchainCompleteness(
    resolvedSubjectId,
    records
  );

  // ── Patient context record — fetched via normal record pipeline ────────────
  // Deterministic ID means we can find it with a simple .find() after the
  // subject records load — no extra Firestore query needed.
  const { records: allSubjectRecords } = useUserRecords(user?.uid, {
    filterType: 'subject',
    subjectId: resolvedSubjectId,
  });

  const identityRecord = useMemo(
    () => allSubjectRecords.find(r => r.id === getIdentityRecordId(resolvedSubjectId)) ?? null,
    [allSubjectRecords, resolvedSubjectId]
  );

  const userIdentity = useMemo(
    () => (identityRecord ? parseIdentityFromRecord(identityRecord) : null),
    [identityRecord]
  );

  const visibleTabs = useMemo(
    () => (isOwnProfile ? PROFILE_TABS : PROFILE_TABS.filter(t => t.id !== 'completeness')),
    [isOwnProfile]
  );

  const completeness = useProfileCompleteness({ profile, userIdentity, grouped, records });

  const renderTab = () => {
    if (error) return <ErrorState message={error.message} />;

    switch (activeTab) {
      case 'summary':
        return (
          <HealthDataDisplay
            grouped={grouped}
            view={SCR_VIEW}
            isLoading={isLoading}
            isOwnProfile={isOwnProfile}
          />
        );
      case 'all-data':
        return (
          <HealthDataDisplay
            grouped={grouped}
            view={ALL_DATA_VIEW}
            isLoading={isLoading}
            isOwnProfile={isOwnProfile}
          />
        );

      case 'records':
        return <ProfileRecordsTab records={records} isLoading={isLoading} />;

      case 'identity':
        // Placeholder — PatientContextTab coming soon
        return (
          <IdentityTab
            userId={resolvedSubjectId}
            userIdentity={userIdentity}
            hasIdentityRecord={identityRecord !== null}
            isOwnProfile={isOwnProfile}
            onSaved={() => {}}
          />
        );

      case 'blockchain':
        return (
          <ProfileCredibilityTab
            subjectFirebaseUid={resolvedSubjectId}
            records={records}
            subjectName={subjectName}
          />
        );

      case 'completeness':
        return (
          <ProfileCompletenessTab
            completeness={completeness}
            onNavigateToTab={tab => setActiveTab(tab as HealthProfileTabs)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4">
      <div className="max-w-7xl mx-auto bg-background rounded=2xl shadow-xl rounded-lg flex flex-col">
        <ProfileHeader
          subjectId={resolvedSubjectId}
          profile={profile}
          userIdentity={userIdentity}
          isOwnProfile={isOwnProfile}
          completeness={isOwnProfile ? completeness : undefined}
          onViewCompleteness={() => setActiveTab('completeness')}
          anchoredRecordIds={anchoredRecordIds}
          recordIds={records.map(r => r.id).filter(Boolean) as string[]}
          isLoading={blockchainLoading}
          onViewCredibility={() => setActiveTab('blockchain')}
        />
        <TabNavigation
          tabs={visibleTabs}
          activeTab={activeTab}
          onTabChange={tab => setActiveTab(tab as HealthProfileTabs)}
        />
        <div className="flex-1 overflow-auto p-6">{renderTab()}</div>
      </div>
    </div>
  );
};

export default HealthProfile;
