// src/features/Subject/components/ui/PendingRequestDetails.tsx

/**
 * PendingRequestDetails Component
 *
 * Shows detailed information about a pending subject consent request.
 * Two modes:
 * 1. Owner/Admin view: Shows request status, who was invited, when, etc.
 * 2. Subject view: Shows the SubjectRequestReview flow for accepting/declining
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Clock,
  User,
  Calendar,
  Shield,
  ShieldCheck,
  Crown,
  Loader2,
  AlertTriangle,
  X,
  FileUser,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UserCard } from '@/features/Users/components/ui/UserCard';
import { UserBadge } from '@/features/Users/components/ui/UserBadge';
import { BelroseUserProfile, FileObject } from '@/types/core';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { SubjectConsentRequest } from '../../services/subjectConsentService';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

// Role configuration for display
const ROLE_CONFIG: Record<
  'viewer' | 'administrator' | 'owner',
  {
    label: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
  }
> = {
  viewer: {
    label: 'Viewer',
    description: 'Can view the record but cannot edit or manage it',
    icon: Shield,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  administrator: {
    label: 'Administrator',
    description: 'Can view, edit, share, and manage the record',
    icon: ShieldCheck,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  owner: {
    label: 'Owner',
    description: 'Full control including deletion and adding other owners',
    icon: Crown,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
};

interface PendingRequestDetailsProps {
  request: SubjectConsentRequest;
  record: FileObject;
  subjectProfile?: BelroseUserProfile;
  onBack: () => void;
  onCancelRequest: () => void;
  isCurrentUserTheSubject?: boolean;
}

export const PendingRequestDetails: React.FC<PendingRequestDetailsProps> = ({
  request,
  record,
  subjectProfile,
  onBack,
  onCancelRequest,
}) => {
  const [requesterProfile, setRequesterProfile] = useState<BelroseUserProfile | null>(null);
  const [loadingRequester, setLoadingRequester] = useState(true);
  const [isCanceling, setIsCanceling] = useState(false);

  // Fetch the requester's profile
  useEffect(() => {
    const fetchRequesterProfile = async () => {
      if (!request.requestedBy) return;

      setLoadingRequester(true);
      try {
        const profiles = await getUserProfiles([request.requestedBy]);
        const profile = profiles.get(request.requestedBy);
        setRequesterProfile(profile || null);
      } catch (error) {
        console.error('Error fetching requester profile:', error);
      } finally {
        setLoadingRequester(false);
      }
    };

    fetchRequesterProfile();
  }, [request.requestedBy]);

  const handleCancelRequest = async () => {
    const confirmCancel = window.confirm(
      'Are you sure you want to cancel this pending subject request?\n\n' +
        'The invited user will no longer be able to accept.'
    );
    if (!confirmCancel) return;

    setIsCanceling(true);
    try {
      await onCancelRequest();
    } finally {
      setIsCanceling(false);
    }
  };

  const roleConfig = ROLE_CONFIG[request.requestedSubjectRole];
  const RoleIcon = roleConfig.icon;

  // Format the request date
  const requestDate = request.createdAt ? formatTimestamp(request.createdAt) : 'Unknown date';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <FileUser className="w-5 h-5" />
          Pending Subject Request
        </h3>
        <div className="flex items-center gap-2">
          <Button onClick={onBack} className="w-8 h-8 border-none bg-transparent hover:bg-gray-200">
            <ArrowLeft className="text-primary" />
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col items-center gap-2">
        <p className="font-medium text-amber-900">Awaiting Response</p>
        <p className="text-sm text-amber-700">
          This user has been invited to confirm they are the subject of this record. They will need
          to review the record and accept or decline the request. If the subject declines, the
          requester has the option to escalate the request.
        </p>
      </div>

      {/* Invited Subject Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <User className="w-4 h-4" />
          Invited Subject
        </h4>
        <UserCard
          user={subjectProfile}
          userId={request.subjectId}
          variant="default"
          color="yellow"
          menuType="none"
          content={
            <div className="flex items-center gap-2">
              <UserBadge text="Pending Subject" color="yellow" />
            </div>
          }
        />
      </div>

      {/* Request Details Section */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-medium text-gray-700">Request Details</h4>

        {/* Requested By */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Requested By</span>
          <div className="text-right">
            {loadingRequester ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="text-sm font-medium">
                {requesterProfile?.displayName || 'Unknown User'}
              </span>
            )}
          </div>
        </div>

        {/* Request Date */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Request Date
          </span>
          <span className="text-sm">{requestDate}</span>
        </div>

        {/* Requested Role */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Requested Role</span>
          <div className={`flex items-center gap-2 px-2 py-1 rounded ${roleConfig.bgColor}`}>
            <RoleIcon className={`w-4 h-4 ${roleConfig.color}`} />
            <span className={`text-sm font-medium ${roleConfig.color}`}>{roleConfig.label}</span>
          </div>
        </div>

        {/* Record Info */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Record</span>
          <span className="text-sm font-medium truncate max-w-[200px]">
            {request.recordTitle || record.belroseFields?.title || record.fileName || 'Untitled'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          variant="destructive"
          onClick={handleCancelRequest}
          disabled={isCanceling}
          className="flex-1"
        >
          {isCanceling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Canceling...
            </>
          ) : (
            <>Cancel Request</>
          )}
        </Button>
      </div>
    </div>
  );
};

export default PendingRequestDetails;
