// src/features/Credibility/components/Disputes/DisputeUserCard

/**
 * UserCard customized for the Dispute Manager
 * Includes badges for dispute details and reaction buttons
 */

import ReactionButtons, { ReactionType } from '@/components/ui/ReactionButtons';
import UserCard, { BadgeConfig } from '@/features/Users/components/ui/UserCard';
import {
  DisputeWithVersion,
  getCulpabilityConfig,
  getSeverityConfig,
} from '../../services/disputeService';
import { BelroseUserProfile } from '@/types/core';

interface DisputeCardProps {
  dispute: DisputeWithVersion;
  userProfile: BelroseUserProfile | undefined;
  isInactive: boolean;
  onViewUser: () => void;
  onViewDetails: () => void;
  reactionStats: {
    supports: number;
    opposes: number;
    userReaction: ReactionType;
  };
  onReact: (support: boolean) => void;
  isLoadingReaction?: boolean;
  isOwnDispute?: boolean;
}

const DisputeUserCard: React.FC<DisputeCardProps> = ({
  dispute,
  userProfile,
  isInactive,
  onViewUser,
  onViewDetails,
  reactionStats,
  onReact,
  isLoadingReaction = false,
  isOwnDispute = false,
}) => {
  const severityInfo = getSeverityConfig(dispute.severity);
  const culpabilityInfo = getCulpabilityConfig(dispute.culpability);

  if (!severityInfo || !culpabilityInfo) {
    throw new Error('Invalid severity or culpability level');
  }

  // Version badge
  const versionBadgeText = dispute.versionNumber === 1 ? 'Current' : `v${dispute.versionNumber}`;
  const versionBadgeColor = dispute.versionNumber === 1 ? 'green' : 'yellow';

  // Badge configs for the UserCard
  const badges: BadgeConfig[] = [
    {
      text: versionBadgeText,
      color: versionBadgeColor,
      tooltip:
        dispute.versionNumber === 1
          ? 'Disputed the current version'
          : `Disputed version ${dispute.versionNumber} of ${dispute.totalVersions}`,
    },
    {
      text: severityInfo.name,
      color: dispute.severity === 3 ? 'red' : dispute.severity === 2 ? 'yellow' : 'blue',
      tooltip: `Severity: ${severityInfo.name}`,
    },
    {
      text: culpabilityInfo.name,
      color: 'purple',
      tooltip: `Culpability: ${culpabilityInfo.name}`,
    },
  ];

  // Add status badge if inactive
  if (isInactive) {
    badges.push({
      text: 'Retracted',
      color: 'red',
      tooltip: 'This dispute has been retracted',
    });
  }

  // Chain status badge
  if (dispute.chainStatus === 'pending') {
    badges.push({
      text: 'Pending',
      color: 'yellow',
      tooltip: 'Awaiting blockchain confirmation',
    });
  } else if (dispute.chainStatus === 'failed') {
    badges.push({
      text: 'Failed',
      color: 'red',
      tooltip: 'Blockchain transaction failed',
    });
  }

  return (
    <UserCard
      user={userProfile}
      userId={dispute.disputerId}
      variant="default"
      color={isInactive ? 'red' : 'yellow'}
      badges={badges}
      onViewUser={onViewUser}
      onViewDetails={onViewDetails}
      className={isInactive ? 'opacity-50' : ''}
      metadata={[
        {
          label: 'Filed',
          value: dispute.createdAt.toDate().toLocaleDateString(),
        },
      ]}
      // Pass ReactionButtons as rightContent (between badges and menu)
      content={
        <ReactionButtons
          supportCount={reactionStats.supports}
          opposeCount={reactionStats.opposes}
          userReaction={reactionStats.userReaction}
          onSupport={() => onReact(true)}
          onOppose={() => onReact(false)}
          disabled={isInactive || isOwnDispute}
          isLoading={isLoadingReaction}
          supportTooltip={
            isOwnDispute ? "You can't react to your own dispute" : 'Support this dispute'
          }
          opposeTooltip={
            isOwnDispute ? "You can't react to your own dispute" : 'Oppose this dispute'
          }
        />
      }
    />
  );
};

export default DisputeUserCard;
