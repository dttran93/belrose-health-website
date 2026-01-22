// src/features/Subject/components/SubjectAlertBanners.tsx

import { AlertBanner } from '@/components/ui/AlertBanner';
import { UserCheck, UserX, UserMinus } from 'lucide-react';

interface SubjectAlertConfig {
  type: 'pending_request' | 'rejection_response' | 'removal_request';
  isLoading?: boolean;
}

// Pending subject request - someone wants you to be a subject
export interface PendingRequestAlertProps {
  onAccept: () => void;
  onDecline: () => void;
  isLoading?: boolean;
}

export const PendingSubjectRequestAlert: React.FC<PendingRequestAlertProps> = ({
  onAccept,
  onDecline,
  isLoading,
}) => (
  <AlertBanner
    icon={UserCheck}
    title="Subject Request"
    description="You've been invited as the subject of this record. Please review and respond."
    variant="warning"
    actions={[
      { label: 'Decline', onClick: onDecline, variant: 'outline', disabled: isLoading },
      { label: 'Accept & Link', onClick: onAccept, disabled: isLoading },
    ]}
  />
);

// Creator needs to respond to a subject's rejection
export interface RejectionResponseAlertProps {
  subjectName?: string;
  onDrop: () => void;
  onEscalate: () => void;
  isLoading?: boolean;
}

export const RejectionResponseAlert: React.FC<RejectionResponseAlertProps> = ({
  subjectName = 'A subject',
  onDrop,
  onEscalate,
  isLoading,
}) => (
  <AlertBanner
    icon={UserX}
    title="Subject Removal"
    description={`${subjectName} has removed themselves as a subject. How would you like to respond?`}
    variant="error"
    actions={[
      { label: 'Drop It', onClick: onDrop, variant: 'outline', disabled: isLoading },
      { label: 'Escalate', onClick: onEscalate, disabled: isLoading },
    ]}
  />
);

// Subject has been asked to remove themselves
export interface RemovalRequestAlertProps {
  onRemove: () => void;
  onDispute: () => void;
  isLoading?: boolean;
}

export const RemovalRequestAlert: React.FC<RemovalRequestAlertProps> = ({
  onRemove,
  onDispute,
  isLoading,
}) => (
  <AlertBanner
    icon={UserMinus}
    title="Removal Request"
    description="The record owner has requested that you remove yourself as a subject."
    variant="warning"
    actions={[
      { label: 'Dispute', onClick: onDispute, variant: 'outline', disabled: isLoading },
      { label: 'Remove Myself', onClick: onRemove, disabled: isLoading },
    ]}
  />
);
