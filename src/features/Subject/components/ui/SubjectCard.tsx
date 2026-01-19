// src/features/Subject/components/ui/SubjectCard.tsx
import React from 'react';
import UserCard from '@/features/Users/components/ui/UserCard';
import { UserBadge } from '@/features/Users/components/ui/UserBadge';
import { BelroseUserProfile, FileObject } from '@/types/core';
import { Clock } from 'lucide-react';

interface SubjectCardProps {
  userId: string;
  userProfile: BelroseUserProfile | undefined;
  record: FileObject;
  isPending?: boolean;
  onDelete: () => void;
  onClick?: () => void;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({
  userId,
  userProfile,
  record,
  isPending = false,
  onDelete,
  onClick,
}) => {
  const renderBadges = () => {
    const isOwner = record.owners?.includes(userId);
    const isAdmin = record.administrators?.includes(userId);
    const isCreator = record.uploadedBy === userId;

    return (
      <div className="flex flex-wrap items-center gap-2">
        {isPending && (
          <UserBadge text="Pending" color="yellow" tooltip="Awaiting consent response" />
        )}
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
      color={isPending ? 'yellow' : 'red'}
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
