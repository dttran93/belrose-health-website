// src/features/Permissions/components/OwnerManagement.tsx

import React, { useState, useEffect } from 'react';
import { ArrowLeft, CircleUser, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePermissionFlow } from '@/features/Permissions/hooks/usePermissionFlow';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import UserSearch from '@/features/Users/components/UserSearch';
import { FileObject, BelroseUserProfile } from '@/types/core';
import UserCard from '@/features/Users/components/ui/UserCard';
import PermissionActionDialog from './ui/PermissionActionDialog';
import { PermissionUserCard } from './ui/PermissionUserCard';
import { TrusteeByIdMap, TrustorByIdMap } from '@/features/Trustee/hooks/useRecordTrustees';
import RecordSectionPanel from '@/components/ui/RecordSectionPanel';

interface OwnerManagementProps {
  record: FileObject;
  currentOwners: string[] | undefined;
  onSuccess?: () => void;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
  trusteeMap: TrusteeByIdMap;
  trustorMap: TrustorByIdMap;
}

export const OwnerManagement: React.FC<OwnerManagementProps> = ({
  record,
  currentOwners,
  onSuccess,
  onBack,
  onAddMode,
  isAddMode,
  trusteeMap,
  trustorMap,
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

  const tooltipContent = (
    <>
      <p className="font-semibold mb-2 text-sm">Record Owners have special permissions:</p>
      <ol className="list-decimal list-inside space-y-1 text-xs">
        <li>Owners have full access to view, edit, share, verify, dispute, and delete records</li>
        <li>Only an Owner can add another Owner</li>
        <li>Only an Owner can remove other Administrators</li>
        <li>Owners are the ONLY users allowed to delete the record</li>
      </ol>
    </>
  );

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
            <Button
              onClick={onBack}
              className="w-8 h-8 border-none bg-transparent hover:bg-gray-200"
            >
              <ArrowLeft className="text-primary" />
            </Button>
          </div>
          <div className="bg-red-300 border border-red-700 rounded-lg p-4 mb-6 flex flex-col items-center">
            <div className="flex items-center gap-2 text-red-900 m-2">
              <TriangleAlert />
              <p className="text-sm text-red-900 font-medium">
                CAUTION: ONCE SET, OWNERS CANNOT BE REMOVED
              </p>
              <TriangleAlert />
            </div>
            {tooltipContent}
          </div>
        </>
      )}

      <RecordSectionPanel
        variant="accent"
        icon={<CircleUser className="w-5 h-5 text-gray-700" />}
        title="Owners"
        badges={
          record.owners
            ? [
                {
                  label: String(record.owners.length),
                  className: 'border border-red-800 bg-red-100 text-red-800',
                },
              ]
            : []
        }
        showActions={!isAddMode}
        tooltipLabel="Ultimate Access"
        tooltipClassName="border border-red-800 bg-red-200 text-red-800"
        tooltipContent={tooltipContent}
        onAdd={onAddMode}
        isLoading={loadingOwners}
        loadingLabel="Loading owners..."
        isEmpty={!record.owners || record.owners.length === 0}
        emptyState={
          <div className="flex justify-between items-center">
            <p className="text-gray-600">No owners assigned</p>
            {!isAddMode && <Button onClick={onAddMode}>Set Record Owner</Button>}
          </div>
        }
      >
        {record.owners?.map(ownerId => (
          <PermissionUserCard
            key={ownerId}
            userId={ownerId}
            userProfile={userProfiles.get(ownerId)}
            record={record}
            color="red"
            onDelete={() => handleDeleteOwner(ownerId)}
            trusteeEntry={trusteeMap.get(ownerId)}
            trusteeList={trustorMap.get(ownerId) ?? []}
          />
        ))}
      </RecordSectionPanel>

      {isAddMode && (
        <>
          <UserSearch
            onUserSelect={handleUserSelect}
            excludeUserIds={currentOwners || []}
            placeholder="Search by name, email, or ID..."
          />
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
