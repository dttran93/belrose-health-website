// src/features/Credibility/components/Disputes/DisputeUserCard.tsx

import React from 'react';
import ReactionButtons, { ReactionType } from '@/components/ui/ReactionButtons';
import UserCard from '@/features/Users/components/ui/UserCard';
import { UserBadge } from '@/features/Users/components/ui/UserBadge';
import { DisputeDoc, getCulpabilityConfig, getSeverityConfig } from '../../services/disputeService';
import { BelroseUserProfile } from '@/types/core';

interface DisputeCardProps {
  dispute: DisputeDoc;
  userProfile: BelroseUserProfile | undefined;
  isInactive: boolean;
  currentRecordHash: string | null | undefined;
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
  currentRecordHash,
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

  const isCurrent = dispute.recordHash === currentRecordHash;

  const renderDisputeContent = () => {
    return (
      <div className="flex items-center gap-3">
        {/* Dispute Badges */}
        <div className="flex flex-wrap gap-2">
          <UserBadge
            text={isCurrent ? 'Current' : 'Non-current'}
            color={isCurrent ? 'green' : 'yellow'}
            tooltip={
              isCurrent
                ? 'Disputed the current version'
                : `Disputed a previous version of this record`
            }
          />
          <UserBadge
            text={severityInfo.name}
            color={dispute.severity === 3 ? 'red' : dispute.severity === 2 ? 'yellow' : 'blue'}
            tooltip={`Severity: ${severityInfo.name}`}
          />
          <UserBadge
            text={culpabilityInfo.name}
            color="purple"
            tooltip={`Culpability: ${culpabilityInfo.name}`}
          />
          {isInactive && (
            <UserBadge text="Retracted" color="red" tooltip="This dispute has been retracted" />
          )}
          {dispute.chainStatus === 'pending' && (
            <UserBadge text="Pending" color="yellow" tooltip="Awaiting blockchain confirmation" />
          )}
          {dispute.chainStatus === 'failed' && (
            <UserBadge text="Failed" color="red" tooltip="Blockchain transaction failed" />
          )}
        </div>

        {/* Reaction Actions */}
        <div className="border-l pl-3">
          <ReactionButtons
            supportCount={reactionStats.supports}
            opposeCount={reactionStats.opposes}
            userReaction={reactionStats.userReaction}
            onSupport={() => onReact(true)}
            onOppose={() => onReact(false)}
            disabled={isInactive || isOwnDispute}
            isLoading={isLoadingReaction}
            supportTooltip={isOwnDispute ? "You can't react to your own" : 'Support this'}
            opposeTooltip={isOwnDispute ? "You can't react to your own" : 'Oppose this'}
          />
        </div>
      </div>
    );
  };

  return (
    <UserCard
      user={userProfile}
      userId={dispute.disputerId}
      variant="default"
      color={isInactive ? 'red' : 'yellow'}
      content={renderDisputeContent()}
      onViewUser={onViewUser}
      onViewDetails={onViewDetails}
      className={isInactive ? 'opacity-60' : ''}
      metadata={[
        {
          label: 'Filed',
          value: dispute.createdAt.toDate().toLocaleDateString(),
        },
      ]}
    />
  );
};

export default DisputeUserCard;
