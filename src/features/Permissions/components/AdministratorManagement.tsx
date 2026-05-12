// src/features/Permissions/components/AdministratorManagement.tsx

import React, { useState, useEffect } from 'react';
import { Users, ArrowLeft } from 'lucide-react';
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

interface AdminManagementProps {
  record: FileObject;
  currentAdmins: string[];
  onSuccess?: () => void;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
  trusteeMap: TrusteeByIdMap;
  trustorMap: TrustorByIdMap;
}

export const AdminManagement: React.FC<AdminManagementProps> = ({
  record,
  currentAdmins,
  onSuccess,
  onBack,
  onAddMode,
  isAddMode,
  trusteeMap,
  trustorMap,
}) => {
  const [selectedUser, setSelectedUser] = useState<BelroseUserProfile | null>(null);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Use the new permission flow hook
  const { dialogProps, initiateGrant, initiateRevoke, isLoading } = usePermissionFlow({
    recordId: record.id,
    onSuccess: () => {
      setSelectedUser(null);
      setRefreshTrigger(prev => prev + 1);
      onSuccess?.();
    },
  });

  // Handle user selection from search
  const handleUserSelect = (user: BelroseUserProfile) => {
    setSelectedUser(user);
  };

  // Handle "Add Administrator" button click
  const handleAddAdmin = () => {
    if (!selectedUser) return;
    initiateGrant(selectedUser, 'administrator');
  };

  // Handle delete button click on an admin
  const handleDeleteAdmin = (userId: string) => {
    const profile = userProfiles.get(userId);
    if (!profile) return;
    initiateRevoke(profile, 'administrator');
  };

  // Fetch user profiles for all administrators
  useEffect(() => {
    const fetchAdminProfiles = async () => {
      if (!record.id) return;

      setLoadingAdmins(true);
      try {
        const userIds = new Set<string>();
        record.administrators?.forEach(adminId => userIds.add(adminId));

        const profiles = await getUserProfiles(Array.from(userIds));
        setUserProfiles(profiles);
      } catch (error) {
        console.error('Error fetching admin profiles:', error);
      } finally {
        setLoadingAdmins(false);
      }
    };

    fetchAdminProfiles();
  }, [record.id, record.administrators, refreshTrigger]);

  const tooltipContent = (
    <>
      <p className="font-semibold mb-2 text-sm">
        Administrators have full access to view, edit, share, verify, and dispute records
      </p>
      <ol className="list-decimal list-inside space-y-1 text-xs">
        <li>If there is no Owner, Administrators may appoint an Owner</li>
        <li>If there is no Owner, Administrators can add and remove other Administrators</li>
        <li>
          If there is an Owner, Administrators can add other Administrators but may not remove other
          Administrators
        </li>
        <li>There must be at least one Administrator or Owner in every record</li>
      </ol>
    </>
  );

  return (
    <div>
      {/* Add mode page header */}
      {isAddMode && (
        <>
          <div className="flex items-center justify-between mb-4 pb-2 border-b">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Manage Administrators
            </h3>
            <Button
              onClick={onBack}
              className="w-8 h-8 border-none bg-transparent hover:bg-gray-200"
            >
              <ArrowLeft className="text-primary" />
            </Button>
          </div>
          <div className="bg-complement-2/20 border border-complement-2 rounded-lg p-4 mb-6">
            {tooltipContent}
          </div>
        </>
      )}

      <RecordSectionPanel
        icon={<Users className="w-5 h-5 text-gray-700" />}
        title="Administrators"
        badges={[
          {
            label: String(record.administrators.length),
            className: 'border border-complement-2 bg-complement-2/20 text-complement-2',
          },
        ]}
        showActions={!isAddMode}
        tooltipLabel="Administrative Access"
        tooltipClassName="border border-complement-2 bg-complement-2/20 text-complement-2"
        tooltipContent={tooltipContent}
        onAdd={onAddMode}
        isLoading={loadingAdmins}
        loadingLabel="Loading administrators..."
        isEmpty={!record.administrators || record.administrators.length === 0}
        emptyState={
          <div className="flex justify-between items-center mt-4">
            <p className="text-gray-600">No administrators assigned</p>
            <Button onClick={onAddMode}>Manage Administrators</Button>
          </div>
        }
      >
        {record.administrators.map(admin => (
          <PermissionUserCard
            key={admin}
            userId={admin}
            userProfile={userProfiles.get(admin)}
            record={record}
            color="blue"
            onDelete={() => handleDeleteAdmin(admin)}
            trusteeEntry={trusteeMap.get(admin)}
            trusteeList={trustorMap.get(admin) ?? []}
          />
        ))}
      </RecordSectionPanel>

      {/* Add mode: search + confirm */}
      {isAddMode && (
        <>
          <UserSearch
            onUserSelect={handleUserSelect}
            excludeUserIds={currentAdmins}
            placeholder="Search by name, email, or ID..."
          />
          {selectedUser && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Ready to add this user as an administrator:
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
              <Button onClick={handleAddAdmin} disabled={isLoading} className="w-full">
                {isLoading ? 'Processing...' : 'Add Administrator'}
              </Button>
            </div>
          )}
        </>
      )}

      <PermissionActionDialog {...dialogProps} />
    </div>
  );
};

export default AdminManagement;
