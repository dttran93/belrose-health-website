// features/Subject/components/SubjectManager.tsx

/**
 * SubjectManager Component
 *
 * Manages record subjects with blockchain integration:
 * - Lists current subjects
 * - Lists pending subject requests
 * - Lists rejected subject requests
 * - Allows adding/removing subjects
 * - Shows pending/rejected request details when clicked
 * - Uses SubjectActionDialog for self-removal with blockchain unanchoring
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  FileUser,
  HelpCircle,
  PersonStanding,
  Plus,
  Loader2,
  UserX,
  UserMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { FileObject, BelroseUserProfile } from '@/types/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import { SubjectService } from '../services/subjectService';
import { useSubjectFlow } from '../hooks/useSubjectFlow';
import { SubjectActionDialog } from './ui/SubjectActionDialog';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { SubjectCard } from './ui/SubjectCard';
import { SubjectConsentRequest } from '../services/subjectConsentService';
import SubjectQueryService from '../services/subjectQueryService';
import { PendingRequestDetails } from './ui/PendingRequestDetails';
import SubjectRemovalService, { SubjectRemovalRequest } from '../services/subjectRemovalService';
import { toast } from 'sonner';

// View modes for SubjectManager
type SubjectViewMode = 'list' | 'pending-details' | 'rejected-details';

interface SubjectManagerProps {
  record: FileObject;
  onSuccess?: () => void;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
}

export const SubjectManager: React.FC<SubjectManagerProps> = ({
  record,
  onSuccess,
  onBack,
  isAddMode,
}) => {
  const { user } = useAuthContext();

  // View mode state
  const [viewMode, setViewMode] = useState<SubjectViewMode>('list');
  const [selectedRequest, setSelectedRequest] = useState<SubjectConsentRequest | null>(null);

  // Local UI state
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [subjectProfiles, setSubjectProfiles] = useState<Map<string, BelroseUserProfile>>(
    new Map()
  );
  const [pendingRequests, setPendingRequests] = useState<SubjectConsentRequest[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<SubjectConsentRequest[]>([]);
  const [removalRequests, setRemovalRequests] = useState<SubjectRemovalRequest[]>([]);

  // Combined profiles for both pending and rejected requests
  const [requestProfiles, setRequestProfiles] = useState<Map<string, BelroseUserProfile>>(
    new Map()
  );

  // Subject flow hook - used for self-removal with blockchain unanchoring
  const {
    dialogProps,
    isLoading: isSubjectFlowLoading,
    initiateRemoveSubjectStatus,
    initiateAddSubject,
  } = useSubjectFlow({
    record,
    onSuccess: () => {
      // Refetch local data when subject operations succeed
      fetchSubjectProfiles();
      fetchRequests();
      onSuccess?.();
    },
  });

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  const fetchSubjectProfiles = useCallback(async () => {
    if (!record.id) return;

    setLoadingSubjects(true);
    try {
      const subjects = record.subjects || [];

      if (subjects.length > 0) {
        const profiles = await getUserProfiles(subjects);
        setSubjectProfiles(profiles);
      } else {
        setSubjectProfiles(new Map());
      }
    } catch (error) {
      console.error('Error fetching subject profiles:', error);
    } finally {
      setLoadingSubjects(false);
    }
  }, [record.id, record.subjects]);

  const fetchRequests = useCallback(async () => {
    if (!record.id) return;

    setLoadingRequests(true);
    try {
      // Fetch both pending and rejected requests in parallel
      const [pending, rejected, removals] = await Promise.all([
        SubjectQueryService.getPendingConsentRequestsForRecord(record.id),
        SubjectQueryService.getRejectedConsentRequestsForRecord(record.id),
        SubjectQueryService.getOutgoingRemovalRequests(),
      ]);

      setPendingRequests(pending);
      setRejectedRequests(rejected);

      const recordRemovalRequests = removals.filter(
        r => r.recordId === record.id && r.status === 'pending'
      );
      setRemovalRequests(recordRemovalRequests);

      // Combine all subject IDs and fetch profiles in one call
      const allSubjectIds = [
        ...pending.map(req => req.subjectId),
        ...rejected.map(req => req.subjectId),
        ...recordRemovalRequests.map(req => req.subjectId),
      ];

      // Deduplicate IDs
      const uniqueSubjectIds = [...new Set(allSubjectIds)];

      if (uniqueSubjectIds.length > 0) {
        const profiles = await getUserProfiles(uniqueSubjectIds);
        setRequestProfiles(profiles);
      } else {
        setRequestProfiles(new Map());
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  }, [record.id]);

  // Fetch on mount and when record changes
  useEffect(() => {
    fetchSubjectProfiles();
    fetchRequests();
  }, [fetchSubjectProfiles, fetchRequests]);

  console.log('Removal Requests', removalRequests);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleAddSubjectClick = () => {
    initiateAddSubject();
  };

  /**
   * Handle clicking on a pending request
   * - If the current user IS the pending subject: show inline review
   * - Otherwise: show PendingRequestDetails
   */
  const handlePendingRequestClick = (request: SubjectConsentRequest) => {
    setSelectedRequest(request);
    setViewMode('pending-details');
  };

  const handleRejectedRequestClick = (request: SubjectConsentRequest) => {
    setSelectedRequest(request);
    setViewMode('rejected-details');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedRequest(null);
  };

  /**
   * Handle removing a subject
   * - If removing self: Use the blockchain flow with dialog
   * - If owner removing someone else: Use simple confirm + service call
   */
  const handleRemoveSubject = async (subjectId: string) => {
    const isSelfRemoval = user?.uid === subjectId;

    if (isSelfRemoval) {
      // Use the blockchain flow with preparation dialog
      await initiateRemoveSubjectStatus();
    } else {
      // Owner/admin removing someone else - simple confirm
      const confirmRemove = window.confirm(
        'Are you sure you want to request the subject to remove themselves from the record? \n\n' +
          'Note: Once added, only the subject can remove themselves from the record. If they do not comply, we recommend disputing the record and recreating it with the correct subject '
      );
      if (!confirmRemove) return;

      try {
        const title = record.belroseFields?.title || record.fileName;
        await SubjectService.requestSubjectRemoval(record.id, subjectId, undefined, title);
        fetchSubjectProfiles();
        onSuccess?.();
        toast.success('Subject Removal Request Sent!');
      } catch (error) {
        console.error('Error removing subject:', error);
      }
    }
  };

  /**
   * Handle canceling a pending subject request
   */
  const handleCancelPendingRequest = async (subjectId: string) => {
    try {
      await SubjectService.cancelSubjectConsentRequest(record.id, subjectId);
      fetchRequests();
      if (selectedRequest?.subjectId === subjectId) {
        handleBackToList();
      }
      onSuccess?.();
    } catch (error) {
      console.error('Error canceling pending request:', error);
      throw error;
    }
  };

  /**
   * Handle canceling a pending removal request
   */
  const handleCancelRemovalRequest = async (subjectId: string) => {
    try {
      await SubjectRemovalService.cancelRequest(record.id, subjectId);
      fetchRequests();
      onSuccess?.();
      toast.success('Subject Removal Request Canceled');
    } catch (error) {
      console.error('Error canceling removal request:', error);
      throw error;
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const currentSubjects = record.subjects || [];

  // Pending details view
  if (viewMode === 'pending-details' && selectedRequest) {
    const profile = requestProfiles.get(selectedRequest.subjectId);
    return (
      <div className="w-full mx-auto p-8">
        <PendingRequestDetails
          request={selectedRequest}
          record={record}
          subjectProfile={profile}
          onBack={handleBackToList}
          onCancelRequest={() => handleCancelPendingRequest(selectedRequest.subjectId)}
        />
        <SubjectActionDialog {...dialogProps} />
      </div>
    );
  }

  // Rejected details view
  if (viewMode === 'rejected-details' && selectedRequest) {
    const profile = requestProfiles.get(selectedRequest.subjectId);
    return (
      <div className="w-full mx-auto p-8">
        <PendingRequestDetails
          request={selectedRequest}
          record={record}
          subjectProfile={profile}
          onBack={handleBackToList}
          onCancelRequest={() => {}}
          isRejected={true}
        />
        <SubjectActionDialog {...dialogProps} />
      </div>
    );
  }

  // Main list view
  return (
    <div className="w-full mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <FileUser className="w-5 h-5" />
          Subject
        </h3>
        <Button onClick={onBack} className="w-8 h-8 border-none bg-transparent hover:bg-gray-200">
          <ArrowLeft className="text-primary" />
        </Button>
      </div>

      {!isAddMode && (
        <>
          {/* Current Subjects Section */}
          <div className="mb-4 border border-accent rounded-lg">
            <div className="w-full px-4 py-3 bg-accent flex items-center justify-between rounded-t-lg">
              <div className="flex items-center gap-2">
                <PersonStanding className="w-5 h-5 text-gray-700" />
                <span className="font-semibold text-gray-900">Subjects</span>
                {currentSubjects.length > 0 && (
                  <span className="text-xs border border-red-800 bg-red-100 text-red-800 px-2 py-1 rounded-full">
                    {currentSubjects.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Help Tooltip */}
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button className="inline-flex items-center ml-1">
                        <span className="text-xs border border-red-800 bg-red-200 text-red-800 px-2 py-1 rounded-full flex items-center">
                          Record Subject
                          <HelpCircle className="w-4 h-4 ml-1" />
                        </span>
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
                        sideOffset={5}
                      >
                        <p className="font-semibold mb-2 text-sm">
                          The Subject is the person this health record is about:
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                          <li>Setting a subject helps organize records by person</li>
                          <li>Subjects must be either record viewers, administrators, or owners</li>
                          <li>Adding someone else as a subject requires their consent</li>
                          <li>A record can have multiple subjects (e.g., for family records)</li>
                          <li>Subject links are recorded on the blockchain for verification</li>
                        </ol>
                        <Tooltip.Arrow className="fill-gray-900" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>

                {/* Add Subject Button */}
                <button
                  className="rounded-full hover:bg-gray-300 p-1"
                  onClick={handleAddSubjectClick}
                  disabled={isSubjectFlowLoading}
                >
                  {isSubjectFlowLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Subjects List */}
            <div className="p-4 bg-secondary space-y-2 rounded-b-lg">
              {loadingSubjects ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <p className="text-gray-500">Loading subjects...</p>
                </div>
              ) : currentSubjects.length > 0 ? (
                <div className="space-y-3">
                  {currentSubjects.map(subjectId => (
                    <SubjectCard
                      key={subjectId}
                      userId={subjectId}
                      userProfile={subjectProfiles.get(subjectId)}
                      onDelete={() => handleRemoveSubject(subjectId)}
                      record={record}
                      subjectRequest={{} as any} //No open requests for confirmed
                    />
                  ))}
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <p className="text-gray-500">No subject set for this record</p>
                  <Button onClick={handleAddSubjectClick} disabled={isSubjectFlowLoading}>
                    Set Record Subject
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Pending Requests Section */}
          <div className="mb-4 border border-gray-300 rounded-lg">
            <div className="w-full px-4 py-3 bg-gray-300 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center gap-2">
                <PersonStanding className="w-5 h-5" />
                <span className="font-semibold text-foreground">Pending Requests</span>
                {pendingRequests.length > 0 && (
                  <span className="text-xs border border-gray-600 bg-gray-200 text-gray-800 px-2 py-1 rounded-full">
                    {pendingRequests.length}
                  </span>
                )}
              </div>

              {/* Help tooltip for pending section */}
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button className="inline-flex items-center">
                      <HelpCircle className="w-4 h-4 text-gray-600" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-900 text-white rounded-lg p-3 max-w-xs shadow-xl z-50"
                      sideOffset={5}
                    >
                      <p className="text-xs">
                        Users invited as subjects who haven't responded yet. Click to view details
                        or cancel.
                      </p>
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            </div>

            <div className="p-4 bg-gray-50 space-y-2 rounded-b-lg">
              {loadingRequests ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <p className="text-gray-500">Loading requests...</p>
                </div>
              ) : pendingRequests.length > 0 ? (
                <div className="space-y-3">
                  {pendingRequests.map(request => (
                    <SubjectCard
                      key={request.subjectId}
                      userId={request.subjectId}
                      userProfile={requestProfiles.get(request.subjectId)}
                      record={record}
                      isPending={true}
                      onDelete={() => handleCancelPendingRequest(request.subjectId)}
                      onClick={() => handlePendingRequestClick(request)}
                      subjectRequest={request}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-2">No pending requests</p>
              )}
            </div>
          </div>

          {/* Rejected Requests Section */}
          {rejectedRequests.length > 0 && (
            <div className="mb-4 border border-chart-4 rounded-lg">
              <div className="w-full px-4 py-3 bg-chart-4/50 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center gap-2">
                  <UserX className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-primary">Declined Requests</span>
                  <span className="text-xs border border-chart-4 text-primary px-2 py-1 rounded-full">
                    {rejectedRequests.length}
                  </span>
                </div>

                {/* Help tooltip for pending section */}
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button className="inline-flex items-center">
                        <HelpCircle className="w-4 h-4 text-red-600" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-gray-900 text-white rounded-lg p-3 max-w-xs shadow-xl z-50"
                        sideOffset={5}
                      >
                        <p className="text-xs">
                          Users who declined the subject request. Click to view details or dismiss.
                        </p>
                        <Tooltip.Arrow className="fill-gray-900" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </div>

              <div className="p-4 bg-chart-4/10 space-y-2 rounded-b-lg">
                {rejectedRequests.map(request => (
                  <SubjectCard
                    key={request.subjectId}
                    userId={request.subjectId}
                    userProfile={requestProfiles.get(request.subjectId)}
                    record={record}
                    isRejected={true}
                    onDelete={() => {}}
                    onClick={() => handleRejectedRequestClick(request)}
                    subjectRequest={request}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending Removal Requests Section */}
          {removalRequests.length > 0 && (
            <div className="mb-4 border border-gray-300 rounded-lg">
              <div className="w-full px-4 py-3 bg-gray-300 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center gap-2">
                  <UserMinus className="w-5 h-5" />
                  <span className="font-semibold text-foreground">Pending Removal Requests</span>
                  <span className="text-xs border border-gray-900 bg-gray-200 text-gray-800 px-2 py-1 rounded-full">
                    {removalRequests.length}
                  </span>
                </div>

                {/* Help tooltip */}
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button className="inline-flex items-center">
                        <HelpCircle className="w-4 h-4 text-gray-600" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="bg-gray-900 text-white rounded-lg p-3 max-w-xs shadow-xl z-50"
                        sideOffset={5}
                      >
                        <p className="text-xs">
                          Requests you've sent asking subjects to remove themselves from this
                          record. Only the subject can complete the removal.
                        </p>
                        <Tooltip.Arrow className="fill-gray-900" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </div>

              <div className="p-4 bg-gray-50 space-y-2 rounded-b-lg">
                {loadingRequests ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <p className="text-gray-500">Loading removal requests...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {removalRequests.map(request => (
                      <SubjectCard
                        key={request.subjectId}
                        userId={request.subjectId}
                        userProfile={requestProfiles.get(request.subjectId)}
                        record={record}
                        isPending={true}
                        onDelete={() => handleCancelRemovalRequest(request.subjectId)}
                        subjectRequest={{} as any}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Subject Action Dialog (for preparation/confirmation flows) */}
      <SubjectActionDialog {...dialogProps} />
    </div>
  );
};

export default SubjectManager;
