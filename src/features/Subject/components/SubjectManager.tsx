// features/Subject/components/SubjectManager.tsx

import React, { useState, useEffect } from 'react';
import { ArrowLeft, FileUser, HelpCircle, PersonStanding, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { FileObject, BelroseUserProfile } from '@/types/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import UserCard from '@/features/Users/components/ui/UserCard';
import SetSubject from './setSubject';
import { useSetSubject } from '../hooks/useSetSubject';
import { SubjectService, SubjectConsentRequest } from '../services/subjectService';

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
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingPendingRequests, setLoadingPendingRequests] = useState(true);
  const [subjectProfiles, setSubjectProfiles] = useState<Map<string, BelroseUserProfile>>(
    new Map()
  );
  const [pendingRequests, setPendingRequests] = useState<SubjectConsentRequest[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<Map<string, BelroseUserProfile>>(
    new Map()
  );
  const [showSetSubjectModal, setShowSetSubjectModal] = useState(false);

  const { removeSubjectAsOwner, isLoading: isRemoving } = useSetSubject({
    onSuccess: () => {
      onSuccess?.();
    },
  });

  // Fetch subject profiles
  useEffect(() => {
    const fetchSubjectProfiles = async () => {
      if (!record.id) return;

      setLoadingSubjects(true);
      try {
        const subjects = record.subjects || [];

        if (subjects.length > 0) {
          const profiles = await getUserProfiles(subjects);
          setSubjectProfiles(profiles);
        }
      } catch (error) {
        console.error('Error fetching subject profiles:', error);
      } finally {
        setLoadingSubjects(false);
      }
    };

    fetchSubjectProfiles();
  }, [record.id, record.subjects]);

  // Fetch pending consent requests
  useEffect(() => {
    const fetchPendingRequests = async () => {
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
        }
      } catch (error) {
        console.error('Error fetching pending requests:', error);
      } finally {
        setLoadingPendingRequests(false);
      }
    };

    fetchPendingRequests();
  }, [record.id]);

  const handleOpenModal = () => {
    setShowSetSubjectModal(true);
  };

  const handleCloseModal = () => {
    setShowSetSubjectModal(false);
  };

  const handleSuccess = () => {
    setShowSetSubjectModal(false);
    onSuccess?.();
  };

  const handleRemoveSubject = async (subjectId: string) => {
    const confirmRemove = window.confirm(
      'Are you sure you want to remove this subject from the record?'
    );
    if (!confirmRemove) return;
    await removeSubjectAsOwner(record, subjectId);
  };

  const handleCancelPendingRequest = async (subjectId: string) => {
    const confirmCancel = window.confirm(
      'Are you sure you want to cancel this pending subject request?'
    );
    if (!confirmCancel) return;
    await SubjectService.cancelPendingRequest(record.id, subjectId);
  };

  const currentSubjects = record.subjects || [];

  return (
    <div className="w-full mx-auto p-8 space-y-6">
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

      {/* Current Subjects Listing Section */}
      {!isAddMode && (
        <>
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
                        </ol>
                        <Tooltip.Arrow className="fill-gray-900" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
                <button className="rounded-full hover:bg-gray-300 p-1" onClick={handleOpenModal}>
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-secondary space-y-2 rounded-b-lg">
              {loadingSubjects ? (
                <div className="flex justify-center items-center py-8">
                  <p className="text-gray-500">Loading subjects...</p>
                </div>
              ) : currentSubjects.length > 0 ? (
                <div className="space-y-3">
                  {currentSubjects.map(subjectId => {
                    const subjectProfile = subjectProfiles.get(subjectId);
                    return (
                      <UserCard
                        key={subjectId}
                        user={subjectProfile}
                        userId={subjectId}
                        onDelete={() => handleRemoveSubject(subjectId)}
                        variant="default"
                        color="red"
                        onView={() => {}}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <p className="text-gray-500">No subject set for this record</p>
                  <Button onClick={handleOpenModal}>Set Record Subject</Button>
                </div>
              )}
            </div>
          </div>

          {/* Pending Record Subjects Listing Section */}
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

            <div className="p-4 bg-gray-100 space-y-2 rounded-b-lg">
              {loadingPendingRequests ? (
                <div className="flex justify-center items-center py-8">
                  <p className="text-gray-500">Loading pending requests...</p>
                </div>
              ) : pendingRequests.length > 0 ? (
                <div className="space-y-3">
                  {pendingRequests.map(request => {
                    const pendingProfile = pendingProfiles.get(request.subjectId);
                    return (
                      <UserCard
                        key={request.subjectId}
                        user={pendingProfile}
                        userId={request.subjectId}
                        onDelete={() => handleCancelPendingRequest(request.subjectId)}
                        variant="default"
                        color="primary"
                        onView={() => {}}
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

      {/* SetSubject Modal (triggered from list view) */}
      <SetSubject
        record={record}
        onSuccess={handleSuccess}
        asModal={true}
        isOpen={showSetSubjectModal}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default SubjectManager;
