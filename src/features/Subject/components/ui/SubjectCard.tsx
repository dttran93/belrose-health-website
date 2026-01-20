// src/features/Subject/components/ui/SubjectCard.tsx
import React from 'react';
import UserCard from '@/features/Users/components/ui/UserCard';
import { UserBadge } from '@/features/Users/components/ui/UserBadge';
import { BelroseUserProfile, FileObject } from '@/types/core';
import { SubjectConsentRequest } from '../../services/subjectConsentService';

interface SubjectCardProps {
  userId: string;
  userProfile: BelroseUserProfile | undefined;
  record: FileObject;
  subjectRequest: SubjectConsentRequest | null;
  isPending?: boolean;
  isRejected?: boolean;
  onDelete: () => void;
  onClick?: () => void;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({
  userId,
  userProfile,
  record,
  subjectRequest,
  isPending = false,
  isRejected = false,
  onDelete,
  onClick,
}) => {
  const isEscalated = subjectRequest?.rejection?.creatorResponse?.status === 'escalated';

  // Determine card color based on status
  const getCardColor = () => {
    if (isRejected) return 'yellow';
    if (isPending) return 'primary';
    return 'red'; // Default for confirmed subjects
  };

  const renderBadges = () => {
    const isOwner = record.owners?.includes(userId);
    const isAdmin = record.administrators?.includes(userId);
    const isCreator = record.uploadedBy === userId;

    return (
      <div className="flex flex-wrap items-center gap-2">
        {isEscalated && <UserBadge text="Escalated" color="green" />}
        {/* Role badges */}
        {isCreator && <UserBadge text="Creator" color="purple" />}
        {isOwner && <UserBadge text="Owner" color="red" />}
        {isAdmin && !isOwner && <UserBadge text="Admin" color="blue" />}
      </div>
    );
  };

  return (
    <UserCard
      user={userProfile}
      userId={userId}
      color={getCardColor()}
      content={renderBadges()}
      onDelete={onDelete}
      variant="default"
      onViewUser={() => {}}
      onCardClick={onClick}
      clickable={!!onClick}
    />
  );
};

export default SubjectCard;
