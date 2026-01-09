// src/features/Sharing/components/ui/AccessEntryCard.tsx

import React from 'react';
import UserCard from '@/features/Users/components/ui/UserCard';
import { UserBadge } from '@/features/Users/components/ui/UserBadge';
import { AccessEntry } from '../EncryptionAccessView';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { FileObject } from '@/types/core';

interface AccessUserCardProps {
  entry: AccessEntry;
  record: FileObject;
  onDelete?: () => void;
  onCancel?: () => void;
  menuType?: 'default' | 'cancel';
}

const AccessUserCard: React.FC<AccessUserCardProps> = ({
  entry,
  record,
  onDelete,
  onCancel,
  menuType = 'default',
}) => {
  const renderBadges = () => {
    const isSubject = record.subjects?.includes(entry.userId);
    const isCreator = entry.wrappedKey?.isCreator;

    // Role Mapping
    const roleConfigs = {
      owner: { text: 'Owner', color: 'red' },
      administrator: { text: 'Admin', color: 'blue' },
      viewer: { text: 'Viewer', color: 'yellow' },
      none: { text: 'No Role', color: 'primary' },
    };

    // Security Status Mapping
    const statusConfigs = {
      synced: {
        text: 'Synced',
        color: 'green',
        icon: <CheckCircle className="w-3 h-3" />,
        tooltip: 'User has both a role and an active key.',
      },
      'missing-key': {
        text: 'Missing Key',
        color: 'red',
        icon: <AlertTriangle className="w-3 h-3" />,
        tooltip: 'User has a role but cannot decrypt. Re-grant access to fix.',
      },
      'missing-role': {
        text: 'Orphaned Key',
        color: 'yellow',
        icon: <AlertTriangle className="w-3 h-3" />,
        tooltip: 'User can decrypt but has no permission role. Security risk.',
      },
      revoked: {
        text: 'Revoked',
        color: 'primary',
        icon: <XCircle className="w-3 h-3" />,
        tooltip: 'Access previously granted but now disabled.',
      },
    };

    const role = roleConfigs[entry.role];
    const status = statusConfigs[entry.status];

    return (
      <div className="flex flex-wrap items-center gap-2">
        {isSubject && <UserBadge text="Subject" color="pink" />}
        {isCreator && <UserBadge text="Creator" color="purple" />}
        <UserBadge text={role.text} color={role.color as any} />
        <UserBadge
          text={status.text}
          color={status.color as any}
          icon={status.icon}
          tooltip={status.tooltip}
        />
      </div>
    );
  };

  const hasIssue = entry.status === 'missing-key' || entry.status === 'missing-role';

  return (
    <UserCard
      user={entry.profile}
      userId={entry.userId}
      variant="default"
      color={hasIssue ? 'red' : 'primary'}
      content={renderBadges()}
      onDelete={onDelete}
      onCancel={onCancel}
      menuType={menuType}
      showEmail
      showUserId
      onViewUser={() => {}}
    />
  );
};

export default AccessUserCard;
