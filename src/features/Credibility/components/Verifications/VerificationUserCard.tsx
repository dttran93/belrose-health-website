//src/features/Credibility/components/Verifications/VerificationUserCard.tsx

/**
 * Customized UserCard for Verification Management
 * Includes badges to show verifiation details such as current version and level
 */

import UserCard, { BadgeConfig } from '@/features/Users/components/ui/UserCard';
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

  // Badge configs for the UserCard
  const badges: BadgeConfig[] = [
    {
      text: versionBadgeText,
      color: verification.versionNumber === 1 ? 'green' : 'yellow',
      tooltip:
        verification.versionNumber === 1
          ? 'Verified the current version'
          : `Verified version ${verification.versionNumber} of ${verification.totalVersions}`,
    },
    {
      text: levelInfo.name,
      color: 'purple',
      tooltip: `Verification level: ${levelInfo.name}`,
    },
  ];

  // Add status badge if inactive
  if (isInactive) {
    badges.push({
      text: 'Retracted',
      color: 'red',
      tooltip: 'This verification has been retracted',
    });
  }

  return (
    <div
      className={`cursor-pointer hover:bg-gray-50 rounded-lg transition-colors ${isInactive ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      <UserCard
        user={userProfile}
        userId={verification.verifierId}
        variant="default"
        color={isInactive ? 'red' : 'green'}
        badges={badges}
        onViewUser={onViewUser}
        onViewDetails={onViewDetails}
        metadata={[
          {
            label: 'Verified',
            value: verification.createdAt.toDate().toLocaleDateString(),
          },
        ]}
        onCardClick={onClick}
      />
    </div>
  );
};

export default VerificationUserCard;
