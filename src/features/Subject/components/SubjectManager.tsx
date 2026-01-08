// features/Subject/components/SubjectManager.tsx

/**
 * SubjectManager Component
 *
 * Manages record subjects with blockchain integration:
 * - Lists current subjects
 * - Lists pending subject requests
 * - Allows adding/removing subjects
 * - Uses SubjectActionDialog for self-removal with blockchain unanchoring
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, FileUser, HelpCircle, PersonStanding, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { FileObject, BelroseUserProfile } from '@/types/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import UserCard from '@/features/Users/components/ui/UserCard';
import { SubjectService, SubjectConsentRequest } from '../services/subjectService';
import { useSubjectFlow } from '../hooks/useSubjectFlow';
import { SubjectActionDialog } from './ui/SubjectActionDialog';
import { useAuthContext } from '@/features/Auth/AuthContext';
import { SubjectCard } from './ui/SubjectCard';

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
      const requests = await SubjectService.getPendingRequestsForRecord(record.id);
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
    const confirmCancel = window.confirm(
      'Are you sure you want to cancel this pending subject request?'
    );
    if (!confirmCancel) return;

    try {
      await SubjectService.cancelPendingRequest(record.id, subjectId);
      fetchPendingRequests();
      onSuccess?.();
    } catch (error) {
      console.error('Error canceling pending request:', error);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const currentSubjects = record.subjects || [];

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
