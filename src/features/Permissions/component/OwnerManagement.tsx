import React, { useState, useEffect } from 'react';
import { Users, ArrowLeft, HelpCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/features/Permissions/hooks/usePermissions';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import UserSearch from '@/features/Users/components/UserSearch';
import { FileObject, BelroseUserProfile } from '@/types/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import UserCard from '@/features/Users/components/ui/UserCard';

interface OwnerManagementProps {
  record: FileObject;
  currentOwners: string[];
  onSuccess?: () => void;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
}

export const OwnerManagement: React.FC<OwnerManagementProps> = ({
  record,
  currentOwners,
  onSuccess,
  onBack,
  onAddMode,
  isAddMode,
}) => {
  const [selectedUser, setSelectedUser] = useState<BelroseUserProfile | null>(null);
  const [loadingShared, setLoadingShared] = useState(true);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());

  const { addOwner, removeOwner, isLoading } = usePermissions({
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

  const handleDeleteOwner = async (userIdToRemove: string) => {
    await removeOwner(record.id, userIdToRemove);
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
                <Users className="w-5 h-5" />
                Manage Ownership
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
          <div className="bg-chart-4/20 border border-chart-4 rounded-lg p-4 mb-6">
            <p className="text-sm text-primary font-medium mb-2">
              Owners have full access to view, edit, share, verify, and dispute records
            </p>
            <ol className="list-decimal list-inside text-xs text-foreground space-y-1">
              <li>Record Subjects are automatically Owners</li>
              <li>Owners can add and remove other Owners</li>
              <li>
                Owners can add a Record Subject if no one has been listed, but they cannot remove a
                Subject
              </li>
              <li>There must be at least one Owner in every record</li>
            </ol>
          </div>
        </>
      )}

      {/* Owners Section */}
      <div className="mb-4 border border-gray-200 rounded-lg">
        <div className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">Owners</span>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
              {record.owners!.length}{' '}
              {/* Revise this eventually when you split up the FileObject */}
            </span>
          </div>
          {!isAddMode && (
            <div className="flex items-center gap-2">
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button className="inline-flex items-center ml-1 text-blue-700 hover:text-red-800">
                      <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full flex items-center">
                        Full Administrative Access
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
                        Owners have full access to view, edit, share, verify, or dispute records:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Record subjects are automatically owners.</li>
                        <li>Owners can add and remove other owners.</li>
                        <li>
                          Owners can add the record subject if there is none, but cannot remove a
                          subject.
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

        <div className="p-4 bg-white space-y-2">
          {/* Revise the ! thing eventually when you split up the FileObject */}
          {record.owners && record.owners.length > 0 ? (
            <div className="space-y-3 mt-4">
              {record.owners.map((owner, idx) => {
                const ownerProfile = userProfiles.get(owner);
                return (
                  <UserCard
                    user={ownerProfile}
                    onView={handleAddOwner}
                    onDelete={() => handleDeleteOwner(owner)}
                    variant="default"
                    color="green"
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex justify-between items-center mt-4">
              <p className="text-gray-600">No owners assigned</p>
              <Button>Manage Owners</Button>
            </div>
          )}
        </div>
      </div>
      {isAddMode && (
        <>
          {/* User Search Component */}
          <UserSearch
            onUserSelect={handleUserSelect}
            excludeUserIds={currentOwners}
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

export default OwnerManagement;
