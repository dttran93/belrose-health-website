// src/features/HealthProfile/components/ui/ProfileHeader.tsx

import { ArrowLeft, Cake, Mail, MapPinHouse, Transgender, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/features/Users/components/Avatar';
import { BelroseUserProfile } from '@/types/core';
import { UserIdentity } from '../../utils/parseUserIdentity';
import { calculateAge, formatTimestamp } from '@/utils/dataFormattingUtils';
import { IdentityVerifiedBadge } from '@/features/Users/components/ui/IdentityVerifiedBadge';
import { ProfileCompletenessResult } from '../../hooks/useProfileCompleteness';
import ProfileCompletenessWidget from './ProfileCompletenessWidget';
import RecordAccessWidget from '../CredibilityTab/ui/RecordAccessWidget';

// ============================================================================
// PROFILE HEADER
// ============================================================================

interface ProfileHeaderProps {
  subjectId: string;
  profile: BelroseUserProfile | null;
  userIdentity: UserIdentity | null;
  isOwnProfile: boolean;
  isLoading: boolean;
  // Only passed when isOwnProfile — visitors don't see completeness
  completeness?: ProfileCompletenessResult;
  onViewCompleteness?: () => void;
  anchoredRecordIds?: Set<string>;
  recordIds?: string[];
  onViewCredibility: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  subjectId,
  profile,
  userIdentity,
  isOwnProfile,
  isLoading,
  completeness,
  onViewCompleteness,
  anchoredRecordIds,
  recordIds,
  onViewCredibility,
}) => {
  const navigate = useNavigate();
  const displayName =
    userIdentity?.fullName ||
    profile?.displayName ||
    (isOwnProfile ? 'My Health Profile' : 'Health Profile');

  // 1. Age/DOB Logic
  const userAgeInfo = userIdentity?.dateOfBirth
    ? `${formatTimestamp(userIdentity.dateOfBirth, 'date-only')} (${calculateAge(userIdentity.dateOfBirth)} years old)`
    : 'Missing Age Information';

  // 2. Gender Logic
  const userGenderInfo = userIdentity?.gender ? userIdentity.gender : 'Missing Gender Information';

  // 3. Home Info Logic (City/Country > Address > Missing)
  const userHomeInfo = (() => {
    if (userIdentity?.city || userIdentity?.country) {
      return [userIdentity.city, userIdentity.country].filter(Boolean).join(', ');
    }
    return userIdentity?.address || 'Missing Location Information';
  })();

  const visibleCount =
    anchoredRecordIds && recordIds
      ? recordIds.filter(id => id && anchoredRecordIds.has(id)).length
      : 0;

  const anchoredCount = anchoredRecordIds?.size ?? 0;

  return (
    <div className="bg-accent px-6 py-4 rounded-t-lg">
      {/* Back + title row */}
      <div className="flex flex-col items-start gap-3 mb-3">
        <div className="flex justify-between items-center w-full">
          <div>
            <span className="px-2 py-1 text-xs font-medium rounded-full border bg-background text-primary">
              Health Profile
            </span>
          </div>
          <div>
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-card-foreground"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center w-full gap-2">
          <div className="flex justify-between items-center gap-2">
            <Avatar profile={profile} size="xl" />
            <div className="flex flex-col items-start gap-1">
              <h1 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                {displayName}
                {profile?.identityVerified && <IdentityVerifiedBadge />}
              </h1>

              {/** Belrose Account Info Row */}
              <div className="flex items-center text-sm gap-1.5">
                <div className="flex gap-1 items-center">
                  <User className="w-3.5 h-3.5" />
                  <span>{subjectId}</span>
                </div>
                <div className="h-3 w-px bg-border m-1" />
                <div className="flex gap-1 items-center">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{profile?.email}</span>
                </div>
              </div>

              {/** User Identity Row */}
              {userIdentity && (
                <div className="flex items-center text-sm gap-1.5">
                  <div className="flex gap-1 items-center">
                    <Cake className="w-3.5 h-3.5" />
                    <span>{userAgeInfo}</span>
                  </div>
                  <div className="h-3 w-px bg-border m-1" />
                  <div className="flex gap-1 items-center">
                    <Transgender className="w-3.5 h-3.5" />
                    <span>{userGenderInfo}</span>
                  </div>
                  <div className="h-3 w-px bg-border m-1" />
                  <div className="flex gap-1 items-center">
                    <MapPinHouse className="w-3.5 h-3.5" />
                    <span>{userHomeInfo}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: profile completeness widget (own profile only) ──────────────── */}
          <div className="flex gap-2 mr-8">
            {anchoredCount > 0 && (
              <div className="w-44 flex-shrink-0">
                <RecordAccessWidget
                  anchoredCount={anchoredCount}
                  visibleCount={visibleCount}
                  isLoading={isLoading}
                  onViewDetails={onViewCredibility}
                />
              </div>
            )}
            {isOwnProfile && completeness && onViewCompleteness && (
              <div className="w-44 flex-shrink-0">
                <ProfileCompletenessWidget
                  completeness={completeness}
                  onViewDetails={onViewCompleteness}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
