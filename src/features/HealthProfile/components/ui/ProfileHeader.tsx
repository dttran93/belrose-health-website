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

interface ProfileHeaderProps {
  subjectId: string;
  profile: BelroseUserProfile | null;
  userIdentity: UserIdentity | null;
  isOwnProfile: boolean;
  isLoading: boolean;
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

  const showAccess = anchoredCount > 0;
  const showCompleteness = isOwnProfile && !!completeness && !!onViewCompleteness;
  const showWidgets = showAccess || showCompleteness;

  return (
    <div className="bg-accent px-6 py-4 rounded-t-lg">
      {/* Badge + back button */}
      <div className="flex justify-between items-center w-full mb-3">
        <span className="px-2 py-1 text-xs font-medium rounded-full border bg-background text-primary">
          Health Profile
        </span>
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-card-foreground"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Avatar + identity + widgets (desktop: side by side, mobile: stacked) */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-start gap-2">
          {/* Left: avatar + text */}
          <div className="flex items-start gap-2 min-w-0">
            <Avatar profile={profile} size="xl" />
            <div className="flex flex-col gap-1 min-w-0">
              <h1 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
                {displayName}
                {profile?.identityVerified && <IdentityVerifiedBadge />}
              </h1>

              {/* Account row */}
              <div className="flex items-center text-sm gap-1.5 flex-wrap">
                <div className="flex gap-1 items-center">
                  <User className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{subjectId}</span>
                </div>
                <div className="hidden md:block h-3 w-px bg-border" />
                <div className="flex gap-1 items-center">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="md:truncate max-w-[160px]">{profile?.email}</span>
                </div>
              </div>

              {/* Identity row — stacked on mobile, inline on md+ */}
              {userIdentity && (
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-1.5 text-sm">
                  <div className="flex gap-1 items-center">
                    <Cake className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{userAgeInfo}</span>
                  </div>
                  <div className="hidden md:block h-3 w-px bg-border" />
                  <div className="flex gap-1 items-center">
                    <Transgender className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{userGenderInfo}</span>
                  </div>
                  <div className="hidden md:block h-3 w-px bg-border" />
                  <div className="flex gap-1 items-center">
                    <MapPinHouse className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{userHomeInfo}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: widgets — desktop only */}
          {showWidgets && (
            <div className="hidden md:flex gap-2 flex-shrink-0">
              {showAccess && (
                <div className="w-44">
                  <RecordAccessWidget
                    anchoredCount={anchoredCount}
                    visibleCount={visibleCount}
                    isLoading={isLoading}
                    onViewDetails={onViewCredibility}
                  />
                </div>
              )}
              {showCompleteness && (
                <div className="w-44">
                  <ProfileCompletenessWidget
                    completeness={completeness!}
                    onViewDetails={onViewCompleteness!}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Widgets — mobile only, full-width strip below identity */}
        {showWidgets && (
          <div className="flex md:hidden gap-2 pt-3 border-t border-border">
            {showAccess && (
              <div className="flex-1">
                <RecordAccessWidget
                  anchoredCount={anchoredCount}
                  visibleCount={visibleCount}
                  isLoading={isLoading}
                  onViewDetails={onViewCredibility}
                />
              </div>
            )}
            {showCompleteness && (
              <div className="flex-1">
                <ProfileCompletenessWidget
                  completeness={completeness!}
                  onViewDetails={onViewCompleteness!}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;
