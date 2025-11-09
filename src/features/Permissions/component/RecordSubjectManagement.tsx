import React, { useState, useEffect } from 'react';
import {
  Users,
  ArrowLeft,
  HelpCircle,
  Plus,
  CircleUser,
  Sparkle,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/features/Permissions/hooks/usePermissions';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import UserSearch from '@/features/Users/components/UserSearch';
import { FileObject, BelroseUserProfile } from '@/types/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

interface SubjectManagementProps {
  record: FileObject;
  subject: string | null | undefined;
  onSuccess?: () => void;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
}

export const RecordSubjectManagement: React.FC<SubjectManagementProps> = ({
  record,
  subject,
  onSuccess,
  onBack,
  onAddMode,
  isAddMode,
}) => {
  const [selectedUser, setSelectedUser] = useState<BelroseUserProfile | null>(null);
  const [loadingShared, setLoadingShared] = useState(true);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());

  const { addOwner, isLoading } = usePermissions({
    onSuccess: msg => {
      setSelectedUser(null);
      onSuccess?.();
    },
  });

  const handleUserSelect = (user: BelroseUserProfile) => {
    setSelectedUser(user);
  };

  const handleAddOwner = async () => {
    if (!selectedUser) return;
    await addOwner(record.id, selectedUser.uid);
  };

  // Fetch access permissions for this record
  useEffect(() => {
    const fetchAccessPermissions = async () => {
      if (!record.id) return;

      setLoadingShared(true);
      try {
        const db = getFirestore();
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
          console.error('No authenticated user');
          return;
        }

        const accessPermissionsRef = collection(db, 'accessPermissions');

        // Query by ownerId (current user) instead of recordId
        // Then filter client-side for this specific record
        const q = query(
          accessPermissionsRef,
          where('ownerId', '==', currentUser.uid),
          where('isActive', '==', true)
        );

        const querySnapshot = await getDocs(q);

        // Fetch user profiles for all owners and receivers
        const userIds = new Set<string>();

        // Add owners
        record.owners?.forEach(ownerId => userIds.add(ownerId));

        // Add subject if exists
        if (record.subjectId) {
          userIds.add(record.subjectId);
        }

        // Fetch all user profiles at once
        const profiles = await getUserProfiles(Array.from(userIds));
        setUserProfiles(profiles);
      } catch (error) {
        console.error('Error fetching access permissions:', error);
      } finally {
        setLoadingShared(false);
      }
    };

    fetchAccessPermissions();
  }, [record.id, record.owners]);

  return (
    <div>
      {isAddMode && (
        <>
          {/* Header */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <CircleUser className="w-5 h-5" />
                Manage Record Subject
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  onClick={onBack}
                  className="w-8 h-8 border-none bg-transparent hover:bg-gray-200"
                >
                  <ArrowLeft className="text-primary" />
                </Button>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-red-300 border border-red-700 rounded-lg p-4 mb-6 flex flex-col items-center">
            <div className="flex items-center gap-2 text-red-900 m-2">
              <TriangleAlert />
              <p className="text-sm text-red-900 font-medium">
                CAUTION: ONCE SET, THE RECORD SUBJECT CANNOT BE CHANGED
              </p>
              <TriangleAlert />
            </div>
            <p className="text-sm text-primary font-medium mb-2">
              The Record Subject is the person this record is about; they have special permissions:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-foreground">
              <li>Automatically an Owner of the record and can do anything with the record</li>
              <li>Becomes the ONLY person allowed to delete the record</li>
              <li>
                If a mistake is made in setting the Record Subject, you will have to re-upload the
                record
              </li>
            </ol>
          </div>
        </>
      )}

      {/* Owners Section */}
      <div className="mb-4 border border-accent rounded-lg">
        <div className="w-full px-4 py-3 bg-accent flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleUser className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">Record Subject</span>
            {record.subjectId ? (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                {record.subjectId}
              </span>
            ) : null}
          </div>

          {!isAddMode && (
            <div className="flex items-center gap-2">
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button className="inline-flex items-center ml-1 text-blue-700 hover:text-red-800">
                      <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full flex items-center">
                        Ultimate Access
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
                        Record Subject is the person this record is about. The Subject has special
                        permissions. Once set, the record subject:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>
                          Is automatically an owner of the record and can do anything with the
                          record
                        </li>
                        <li>Becomes the ONLY person allowed to delete the record</li>
                        <li>CANNOT be changed once set</li>
                        <li>
                          If a mistake is made in setting the subject, you will have to re-upload
                          the record
                        </li>
                      </ol>
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
              <button className="rounded-full hover:bg-gray-300">
                <Plus onClick={onAddMode} />
              </button>
            </div>
          )}
        </div>

        <div className="p-4 bg-secondary space-y-2">
          {record.subjectId ? (
            <>
              <div className="flex items-center justify-between p-4 bg-red-200 rounded-lg border border-red-700 hover:shadow-sm transition-shadow">
                <p className="text-xl font-bold text-gray-900">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-300 rounded-full flex items-center justify-center">
                      <Sparkle className="w-5 h-5 text-red-700" />
                    </div>
                    <div className="text-left">
                      <p className="text-base font-semibold text-gray-900">
                        {userProfiles.get(record.subjectId)?.displayName || record.subjectId}
                      </p>
                      <p className="text-xs text-gray-500">
                        {userProfiles.get(record.subjectId)?.email || record.subjectId}
                      </p>
                    </div>
                  </div>
                </p>
                <p className="text-xs text-gray-500 mt-1">{record.subjectId}</p>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <p>No record subject</p>
              {!isAddMode && <Button onClick={onAddMode}>Set Record Subject</Button>}
            </div>
          )}
        </div>
      </div>

      {isAddMode && (
        <>
          {/* User Search Component */}
          <UserSearch
            onUserSelect={handleUserSelect}
            excludeUserIds={subject ? [subject] : []}
            placeholder="Search by name, email, or ID..."
          />

          {/* Selected User - Confirm */}
          {selectedUser && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Ready to add this user as an owner:
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {selectedUser.displayName || 'No name'}
                    </p>
                    <p className="text-sm text-gray-600">{selectedUser.email}</p>
                  </div>
                </div>
              </div>
              <Button onClick={handleAddOwner} disabled={isLoading} className="w-full">
                {isLoading ? 'Adding Owner...' : 'Confirm & Add Owner'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RecordSubjectManagement;
