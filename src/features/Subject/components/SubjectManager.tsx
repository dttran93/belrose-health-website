// features/Subject/components/SubjectManager.tsx

/**
 * SubjectManager Component
 *
 * Manages record subjects with blockchain integration:
 * - Lists current subjects
 * - Lists pending subject requests
 * - Allows adding/removing subjects
 * - Shows pending request details when clicked (for owners/admins)
 * - Shows inline SubjectRequestReview when current user is the pending subject
 * - Uses SubjectActionDialog for self-removal with blockchain unanchoring
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, FileUser, HelpCircle, PersonStanding, Plus, Loader2 } from 'lucide-react';
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
import { SubjectRequestReview } from './SubjectRequestReview';

// View modes for SubjectManager
type SubjectViewMode = 'list' | 'pending-details' | 'subject-review';

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
  const [selectedPendingRequest, setSelectedPendingRequest] =
    useState<SubjectConsentRequest | null>(null);

  // Local UI state
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingPendingRequests, setLoadingPendingRequests] = useState(true);
  const [subjectProfiles, setSubjectProfiles] = useState<Map<string, BelroseUserProfile>>(
    new Map()
  );
  const [pendingRequests, setPendingRequests] = useState<SubjectConsentRequest[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<Map<string, BelroseUserProfile>>(
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
      fetchPendingRequests();
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

  const fetchPendingRequests = useCallback(async () => {
    if (!record.id) return;

    setLoadingPendingRequests(true);
    try {
      const requests = await SubjectQueryService.getPendingConsentRequestsForRecord(record.id);
      setPendingRequests(requests);

      // Fetch profiles for pending subjects
      if (requests.length > 0) {
        const pendingSubjectIds = requests.map(req => req.subjectId);
        const profiles = await getUserProfiles(pendingSubjectIds);
        setPendingProfiles(profiles);
      } else {
        setPendingProfiles(new Map());
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    } finally {
      setLoadingPendingRequests(false);
    }
  }, [record.id]);

  // Fetch on mount and when record changes
  useEffect(() => {
    fetchSubjectProfiles();
    fetchPendingRequests();
  }, [fetchSubjectProfiles, fetchPendingRequests]);

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
    const isCurrentUserTheSubject = user?.uid === request.subjectId;
    setSelectedPendingRequest(request);

    if (isCurrentUserTheSubject) {
      setViewMode('subject-review');
    } else {
      setViewMode('pending-details');
    }
  };

  /**
   * Handle going back from any detail view to list view
   */
  const handleBackToList = () => {
    setViewMode('list');
    setSelectedPendingRequest(null);
  };

  /**
   * Handle successful accept/decline of subject request
   */
  const handleReviewComplete = () => {
    fetchSubjectProfiles();
    fetchPendingRequests();
    handleBackToList();
    onSuccess?.();
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
        'Are you sure you want to remove this subject from the record?\n\n' +
          'Note: This removes them from the record in our system, but their blockchain anchor ' +
          'will remain until they choose to remove it themselves.'
      );
      if (!confirmRemove) return;

      try {
        await SubjectService.removeSubjectByOwner(record.id, subjectId);
        fetchSubjectProfiles();
        onSuccess?.();
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
      fetchPendingRequests();
      // Return to list view if we were viewing this request's details
      if (selectedPendingRequest?.subjectId === subjectId) {
        handleBackToList();
      }
      onSuccess?.();
    } catch (error) {
      console.error('Error canceling pending request:', error);
      throw error; // Re-throw so the details component can handle it
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const currentSubjects = record.subjects || [];

  // Render inline subject review (for when current user is the pending subject)
  if (viewMode === 'subject-review' && selectedPendingRequest) {
    return (
      <SubjectRequestReview
        record={record}
        request={selectedPendingRequest}
        onBack={handleBackToList}
        onComplete={handleReviewComplete}
      />
    );
  }

  // Render pending request details view (for owners/admins)
  if (viewMode === 'pending-details' && selectedPendingRequest) {
    const pendingProfile = pendingProfiles.get(selectedPendingRequest.subjectId);

    return (
      <div className="w-full mx-auto p-8">
        <PendingRequestDetails
          request={selectedPendingRequest}
          record={record}
          subjectProfile={pendingProfile}
          onBack={handleBackToList}
          onCancelRequest={() => handleCancelPendingRequest(selectedPendingRequest.subjectId)}
        />

        {/* Subject Action Dialog (for any flows triggered from details) */}
        <SubjectActionDialog {...dialogProps} />
      </div>
    );
  }

  // Render main list view
  return (
    <div className="w-full mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <FileUser className="w-5 h-5" />
          Subject
        </h3>
        <div className="flex items-center gap-2">
          <Button onClick={onBack} className="w-8 h-8 border-none bg-transparent hover:bg-gray-200">
            <ArrowLeft className="text-primary" />
          </Button>
        </div>
      </div>

      {/* Main Content (when not in add mode) */}
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
                  {currentSubjects.map(subjectId => {
                    const subjectProfile = subjectProfiles.get(subjectId);
                    return (
                      <SubjectCard
                        key={subjectId}
                        userId={subjectId}
                        userProfile={subjectProfile}
                        onDelete={() => handleRemoveSubject(subjectId)}
                        record={record}
                      />
                    );
                  })}
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
          <div className="mb-4 border border-foreground rounded-lg">
            <div className="w-full px-4 py-3 bg-gray-300 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center gap-2">
                <PersonStanding className="w-5 h-5 text-gray-700" />
                <span className="font-semibold text-gray-900">Pending Subjects</span>
                {pendingRequests.length > 0 && (
                  <span className="text-xs border border-foreground bg-gray-500 text-gray-800 px-2 py-1 rounded-full">
                    {pendingRequests.length}
                  </span>
                )}
              </div>

              {/* Help tooltip for pending section */}
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button className="inline-flex items-center">
                      <HelpCircle className="w-4 h-4 text-gray-500" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-900 text-white rounded-lg p-3 max-w-xs shadow-xl z-50"
                      sideOffset={5}
                    >
                      <p className="text-xs">
                        Click on a pending request to view details or cancel it.
                      </p>
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            </div>

            {/* Pending Requests List */}
            <div className="p-4 bg-gray-100 space-y-2 rounded-b-lg">
              {loadingPendingRequests ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <p className="text-gray-500">Loading pending requests...</p>
                </div>
              ) : pendingRequests.length > 0 ? (
                <div className="space-y-3">
                  {pendingRequests.map(request => {
                    const pendingProfile = pendingProfiles.get(request.subjectId);

                    return (
                      <SubjectCard
                        key={request.subjectId}
                        userId={request.subjectId}
                        userProfile={pendingProfile}
                        record={record}
                        isPending={true}
                        onDelete={() => handleCancelPendingRequest(request.subjectId)}
                        onClick={() => handlePendingRequestClick(request)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <p className="text-gray-500">No pending subject requests</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Subject Action Dialog (for preparation/confirmation flows) */}
      <SubjectActionDialog {...dialogProps} />
    </div>
  );
};

export default SubjectManager;
