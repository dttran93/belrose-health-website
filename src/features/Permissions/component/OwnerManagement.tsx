import React, { useState, useEffect } from 'react';
import { ArrowLeft, HelpCircle, Plus, CircleUser, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePermissionFlow } from '@/features/Permissions/hooks/usePermissionFlow';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import UserSearch from '@/features/Users/components/UserSearch';
import { FileObject, BelroseUserProfile } from '@/types/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import UserCard from '@/features/Users/components/ui/UserCard';
import PermissionActionDialog from './ui/PermissionActionDialog';
import { PermissionUserCard } from './ui/PermissionUserCard';

interface OwnerManagementProps {
  record: FileObject;
  currentOwners: string[] | undefined;
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
  const [loadingOwners, setLoadingOwners] = useState(true);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 3. Initialize the flow hook
  const { dialogProps, initiateGrant, initiateRevoke, isLoading } = usePermissionFlow({
    recordId: record.id,
    onSuccess: () => {
      setSelectedUser(null);
      setRefreshTrigger(prev => prev + 1);
      onSuccess?.();
    },
  });

  const handleUserSelect = (user: BelroseUserProfile) => {
    setSelectedUser(user);
  };

  const handleAddOwner = () => {
    if (!selectedUser) return;
    initiateGrant(selectedUser, 'owner');
  };

  const handleDeleteOwner = (userId: string) => {
    const profile = userProfiles.get(userId);
    if (!profile) return;
    // 5. Use initiateRevoke - the hook handles the 'demote' logic internally
    initiateRevoke(profile, 'owner');
  };

  // Fetch access permissions for this record
  useEffect(() => {
    const fetchOwnerProfiles = async () => {
      if (!record.id) return;

      setLoadingOwners(true);
      try {
        const userIds = new Set<string>();
        record.owners?.forEach(ownerId => userIds.add(ownerId));

        const profiles = await getUserProfiles(Array.from(userIds));
        setUserProfiles(profiles);
      } catch (error) {
        console.error('Error fetching owner profiles:', error);
      } finally {
        setLoadingOwners(false);
      }
    };

    fetchOwnerProfiles();
  }, [record.id, record.owners, refreshTrigger]);

  return (
    <div>
      {isAddMode && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-2 border-b">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <CircleUser className="w-5 h-5" />
              Manage Record Owners
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

          {/* Info */}
          <div className="bg-red-300 border border-red-700 rounded-lg p-4 mb-6 flex flex-col items-center">
            <div className="flex items-center gap-2 text-red-900 m-2">
              <TriangleAlert />
              <p className="text-sm text-red-900 font-medium">
                CAUTION: ONCE SET, OWNERS CANNOT BE REMOVED
              </p>
              <TriangleAlert />
            </div>
            <p className="font-semibold mb-2 text-sm">Record Owners have special permissions:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>
                Owners have full access to view, edit, share, verify, dispute, and delete records
              </li>
              <li>Only an Owner can add another Owner</li>
              <li>Only an Owner can remove other Administrators</li>
              <li>Owners are the ONLY users allowed a delete the record</li>
            </ol>
          </div>
        </>
      )}

      {/* Current Owners Listing Section */}
      <div className="mb-4 border border-accent rounded-lg">
        <div className="w-full px-4 py-3 bg-accent flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <CircleUser className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">Owners</span>
            {record.owners ? (
              <span className="text-xs border border-red-800 bg-red-100 text-red-800 px-2 py-1 rounded-full">
                {record.owners.length}
              </span>
            ) : null}
          </div>

          {!isAddMode && (
            <div className="flex items-center gap-2">
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button className="inline-flex items-center ml-1">
                      <span className="text-xs border border-red-800 bg-red-200 text-red-800 px-2 py-1 rounded-full flex items-center">
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
                        Record Owners have special permissions:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>
                          Owners have full access to view, edit, share, verify, dispute, and delete
                          records
                        </li>
                        <li>Only an Owner can add another Owner</li>
                        <li>Only an Owner can remove other Administrators</li>
                        <li>Owners are the ONLY users allowed a delete the record</li>
                      </ol>
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
              <button onClick={onAddMode} className="rounded-full hover:bg-gray-300">
                <Plus />
              </button>
            </div>
          )}
        </div>

        <div className="p-4 bg-secondary space-y-2 rounded-lg">
          {loadingOwners ? (
            <div className="flex justify-center items-center py-8">
              <p className="text-gray-500">Loading owners...</p>
            </div>
          ) : record.owners && record.owners.length > 0 ? (
            <div className="space-y-3 mt-4">
              {record.owners.map(ownerId => {
                const profile = userProfiles.get(ownerId);
                return (
                  <PermissionUserCard
                    key={ownerId}
                    userId={ownerId}
                    userProfile={profile}
                    record={record}
                    onDelete={() => handleDeleteOwner(ownerId)}
                    color="red"
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <p className="text-gray-600">No owners assigned</p>
              {!isAddMode && <Button onClick={onAddMode}>Set Record Owner</Button>}
            </div>
          )}
        </div>
      </div>

      {isAddMode && (
        <>
          {/* User Search Component */}
          <UserSearch
            onUserSelect={handleUserSelect}
            excludeUserIds={currentOwners || []}
            placeholder="Search by name, email, or ID..."
          />

          {/* Selected User - Confirm */}
          {selectedUser && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Ready to add this user as the Record Owner:
              </p>
              <div className="py-3">
                <UserCard
                  user={selectedUser}
                  onViewUser={() => {}}
                  variant="default"
                  color="green"
                  menuType="cancel"
                  onCancel={() => setSelectedUser(null)}
                />
              </div>
              <Button onClick={handleAddOwner} disabled={isLoading} className="w-full">
                {isLoading ? 'Adding Owner...' : 'Confirm & Add Owner'}
              </Button>
            </div>
          )}
        </>
      )}

      <PermissionActionDialog {...dialogProps} />
    </div>
  );
};

export default OwnerManagement;
