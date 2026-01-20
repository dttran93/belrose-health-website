// src/features/Subject/components/ui/PendingRequestDetails.tsx

/**
 * PendingRequestDetails Component
 *
 * Shows detailed information about a pending or rejected subject consent request.
 * Used by record owners/admins to view request status and take action.
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
  X,
  UserX,
  XCircle,
  FileUser,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UserCard } from '@/features/Users/components/ui/UserCard';
import { UserBadge } from '@/features/Users/components/ui/UserBadge';
import { BelroseUserProfile, FileObject } from '@/types/core';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { SubjectConsentRequest } from '../../services/subjectConsentService';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { RejectionResponseDialog } from './RejectionResponseDialog';

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
  onSuccess?: () => void;
  isRejected?: boolean;
}

export const PendingRequestDetails: React.FC<PendingRequestDetailsProps> = ({
  request,
  record,
  subjectProfile,
  onBack,
  onCancelRequest,
  onSuccess,
  isRejected = false,
}) => {
  const [requesterProfile, setRequesterProfile] = useState<BelroseUserProfile | null>(null);
  const [loadingRequester, setLoadingRequester] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResponseDialog, setShowResponseDialog] = useState(false);

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

  // Handler for canceling pending request (non-rejected)
  const handleCancelPending = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this pending subject request?\n\nThe invited user will no longer be able to accept.'
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await onCancelRequest();
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler for responding to rejected request
  const handleRespondToRejection = () => {
    setShowResponseDialog(true);
  };

  const handleResponseSuccess = () => {
    setShowResponseDialog(false);
    onSuccess?.();
    onBack();
  };

  const roleConfig = ROLE_CONFIG[request.requestedSubjectRole];
  const RoleIcon = roleConfig.icon;

  const requestDate = request.createdAt ? formatTimestamp(request.createdAt) : 'Unknown date';
  const respondedDate = request.respondedAt ? formatTimestamp(request.respondedAt) : null;

  // Check if creator has already responded to rejection
  const hasCreatorResponded =
    isRejected &&
    request.rejection?.creatorResponse?.status &&
    request.rejection.creatorResponse.status !== 'pending_creator_decision';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <FileUser className="w-5 h-5" />
          {isRejected ? 'Declined Request' : 'Pending Subject Request'}
        </h3>
        <Button onClick={onBack} className="w-8 h-8 border-none bg-transparent hover:bg-gray-200">
          <ArrowLeft className="text-primary" />
        </Button>
      </div>

      {/* Status Banner */}
      {isRejected ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col gap-1">
          <p className="font-medium text-red-900">Request Declined</p>
          <p className="text-sm text-red-700 mt-1">
            This user has declined to be linked as a subject of this record.
            {hasCreatorResponded
              ? ` This request has been ${request.rejection?.creatorResponse?.status}.`
              : ' You can drop or escalate this request.'}
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col gap-1">
          <p className="font-medium text-amber-900">Awaiting Response</p>
          <p className="text-sm text-amber-700 mt-1">
            This user has been invited to confirm they are the subject of this record. They will
            review the record and accept or decline the request.
          </p>
        </div>
      )}

      {/* Invited Subject Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          {isRejected ? <UserX className="w-4 h-4" /> : <User className="w-4 h-4" />}
          {isRejected ? 'Declined By' : 'Invited Subject'}
        </h4>
        <UserCard
          user={subjectProfile}
          userId={request.subjectId}
          variant="default"
          color={isRejected ? 'red' : 'yellow'}
          menuType="none"
          content={
            <UserBadge
              text={isRejected ? 'Declined' : 'Pending Subject'}
              color={isRejected ? 'red' : 'yellow'}
            />
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

        {/* Response Date (only for rejected) */}
        {isRejected && respondedDate && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              Declined Date
            </span>
            <span className="text-sm">{respondedDate}</span>
          </div>
        )}

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

        {/* Reason (only for rejected) */}
        {isRejected && request.rejection?.reason && (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-gray-500">Reason for Declining</span>
            <div className="bg-red-50 border border-red-100 rounded p-2">
              <span className="text-sm text-red-800 italic">"{request.rejection.reason}"</span>
            </div>
          </div>
        )}

        {/* Creator Response Status (if already responded) */}
        {hasCreatorResponded && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Response Status</span>
            <UserBadge
              text={
                request.rejection?.creatorResponse?.status === 'dropped' ? 'Dropped' : 'Escalated'
              }
              color={
                request.rejection?.creatorResponse?.status === 'dropped' ? 'primary' : 'yellow'
              }
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-4 border-t flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>

        {isRejected ? (
          // Rejected request - show Respond button (if not already responded)
          !hasCreatorResponded && (
            <Button onClick={handleRespondToRejection} disabled={isProcessing} className="flex-1">
              Respond
            </Button>
          )
        ) : (
          // Pending request - show Cancel button
          <Button
            variant="destructive"
            onClick={handleCancelPending}
            disabled={isProcessing}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Canceling...
              </>
            ) : (
              'Cancel Request'
            )}
          </Button>
        )}
      </div>

      {/* Rejection Response Dialog */}
      <RejectionResponseDialog
        isOpen={showResponseDialog}
        onClose={() => setShowResponseDialog(false)}
        request={request}
        record={record}
        subjectProfile={subjectProfile}
        onSuccess={handleResponseSuccess}
      />
    </div>
  );
};

export default PendingRequestDetails;
