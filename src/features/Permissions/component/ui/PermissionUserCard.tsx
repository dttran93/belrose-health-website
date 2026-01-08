// src/features/Permissions/components/ui/PermissionUserCard.tsx

import React from 'react';
import UserCard from '@/features/Users/components/ui/UserCard';
import { UserBadge } from '@/features/Users/components/ui/UserBadge';
import { BelroseUserProfile, FileObject } from '@/types/core';

interface PermissionUserCardProps {
  userId: string;
  userProfile: BelroseUserProfile | undefined;
  record: FileObject;
  color: 'blue' | 'red' | 'yellow' | 'green';
  onDelete?: () => void;
  onCancel?: () => void;
  menuType?: 'default' | 'cancel';
}

export const PermissionUserCard: React.FC<PermissionUserCardProps> = ({
  userId,
  userProfile,
  record,
  color,
  onDelete,
  onCancel,
  menuType = 'default',
}) => {
  const renderAccessContent = () => {
    const isCreator = record.uploadedBy === userId;
    const isSubject = record.subjects?.includes(userId);

    return (
      <div className="flex flex-wrap items-center gap-2">
        {/* Identity Badges */}
        {isCreator && (
          <UserBadge text="Creator" color="purple" tooltip="Original uploader of this record" />
        )}
        {isSubject && (
          <UserBadge text="Subject" color="pink" tooltip="This record is about this user" />
        )}
      </div>
    );
  };

  return (
    <UserCard
      user={userProfile}
      userId={userId}
      variant="default"
      color={color}
      content={renderAccessContent()}
      onDelete={onDelete}
      onCancel={onCancel}
      menuType={menuType}
      onViewUser={() => {}}
    />
  );
};
