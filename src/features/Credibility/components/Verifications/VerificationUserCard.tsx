//src/features/Credibility/components/Verifications/VerificationUserCard.tsx

import React from 'react';
import UserCard from '@/features/Users/components/ui/UserCard';
import { UserBadge } from '@/features/Users/components/ui/UserBadge';
import { getVerificationConfig, VerificationWithVersion } from '../../services/verificationService';
import { BelroseUserProfile } from '@/types/core';

interface VerificationCardProps {
  verification: VerificationWithVersion;
  userProfile: BelroseUserProfile | undefined;
  isInactive: boolean;
  onViewUser: () => void;
  onViewDetails: () => void;
  onClick?: () => void;
}

const VerificationUserCard: React.FC<VerificationCardProps> = ({
  verification,
  userProfile,
  isInactive,
  onViewUser,
  onViewDetails,
  onClick,
}) => {
  const levelInfo = getVerificationConfig(verification.level);
  const versionBadgeText =
    verification.versionNumber === 1 ? 'Current' : `v${verification.versionNumber}`;

  // Helper to render the badges in the content slot
  const renderBadges = () => (
    <div className="flex items-center gap-2">
      {/* Version Badge */}
      <UserBadge
        text={versionBadgeText}
        color={verification.versionNumber === 1 ? 'green' : 'yellow'}
        tooltip={
          verification.versionNumber === 1
            ? 'Verified the current version'
            : `Verified version ${verification.versionNumber} of ${verification.totalVersions}`
        }
      />

      {/* Level Badge */}
      <UserBadge
        text={levelInfo.name}
        color="purple"
        tooltip={`Verification level: ${levelInfo.name}`}
      />

      {/* Retracted Status Badge */}
      {isInactive && (
        <UserBadge text="Retracted" color="red" tooltip="This verification has been retracted" />
      )}
    </div>
  );

  return (
    <div className={`transition-colors ${isInactive ? 'opacity-60' : ''}`}>
      <UserCard
        user={userProfile}
        userId={verification.verifierId}
        variant="default"
        color={isInactive ? 'red' : 'green'}
        content={renderBadges()}
        onViewUser={onViewUser}
        onViewDetails={onViewDetails}
        metadata={[
          {
            label: 'Verified',
            value: verification.createdAt.toDate().toLocaleDateString(),
          },
        ]}
        onCardClick={onClick}
        clickable={!!onClick}
      />
    </div>
  );
};

export default VerificationUserCard;
