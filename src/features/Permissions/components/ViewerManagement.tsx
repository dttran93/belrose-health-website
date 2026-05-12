// src/features/Permissions/components/ViewerManagement.tsx

import React, { useState, useEffect } from 'react';
import { Users, ArrowLeft, Share2 } from 'lucide-react';
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

interface ViewerManagementProps {
  record: FileObject;
  currentViewers: string[] | undefined;
  onSuccess?: () => void;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
  trusteeMap: TrusteeByIdMap;
  trustorMap: TrustorByIdMap;
}

export const ViewerManagement: React.FC<ViewerManagementProps> = ({
  record,
  currentViewers,
  onSuccess,
  onBack,
  onAddMode,
  isAddMode,
  trusteeMap,
  trustorMap,
}) => {
  const [selectedUser, setSelectedUser] = useState<BelroseUserProfile | null>(null);
  const [loadingViewers, setLoadingViewers] = useState(true);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { dialogProps, initiateGrant, initiateRevoke, isLoading } = usePermissionFlow({
    recordId: record.id,
    onSuccess: () => {
      setSelectedUser(null);
      setRefreshTrigger(prev => prev + 1);
      onSuccess?.();
    },
  });

  const handleUserSelect = (user: BelroseUserProfile) => setSelectedUser(user);

  const handleAddViewer = () => {
    if (selectedUser) initiateGrant(selectedUser, 'viewer');
  };

  const handleDeleteViewer = (userId: string) => {
    const profile = userProfiles.get(userId);
    if (profile) initiateRevoke(profile, 'viewer');
  };

  useEffect(() => {
    const fetchViewerProfiles = async () => {
      if (!record.id) return;
      setLoadingViewers(true);
      try {
        const userIds = new Set<string>();
        record.viewers?.forEach(id => userIds.add(id));
        const profiles = await getUserProfiles(Array.from(userIds));
        setUserProfiles(profiles);
      } catch (error) {
        console.error('Error fetching viewer profiles:', error);
      } finally {
        setLoadingViewers(false);
      }
    };
    fetchViewerProfiles();
  }, [record.id, record.viewers, refreshTrigger]);

  const tooltipContent = (
    <>
      <p className="font-semibold mb-2 text-sm">
        Viewers are granted record access by Owners or Administrators:
      </p>
      <ol className="list-decimal list-inside space-y-1 text-xs">
        <li>Viewers can view, verify, or dispute records.</li>
        <li>They may not edit, share, or delete records.</li>
        <li>Their access may be revoked at any time by Owners or Administrators.</li>
        <li>
          Once granted, Belrose cannot prevent analog replication by viewers (e.g., screenshots)
        </li>
      </ol>
    </>
  );

  return (
    <div>
      {isAddMode && (
        <>
          <div className="flex items-center justify-between mb-4 pb-2 border-b">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Manage Viewers
            </h3>
            <Button
              onClick={onBack}
              className="w-8 h-8 border-none bg-transparent hover:bg-gray-200"
            >
              <ArrowLeft className="text-primary" />
            </Button>
          </div>
          <div className="bg-complement-4/20 border border-complement-4 rounded-lg p-4 mb-6">
            {tooltipContent}
          </div>
        </>
      )}

      <RecordSectionPanel
        icon={<Share2 className="w-5 h-5 text-gray-700" />}
        title="Viewers"
        badges={[
          {
            label: String(record.viewers?.length ?? 0),
            className: 'border border-yellow-700 bg-yellow-100 text-yellow-800',
          },
        ]}
        showActions={!isAddMode}
        tooltipLabel="View Access"
        tooltipClassName="border border-yellow-700 bg-yellow-200 text-yellow-800"
        tooltipContent={tooltipContent}
        onAdd={onAddMode}
        isLoading={loadingViewers}
        loadingLabel="Loading viewers..."
        isEmpty={!record.viewers || record.viewers.length === 0}
        emptyState={
          <div className="flex justify-between items-center mt-4">
            <p className="text-gray-600">No viewers assigned</p>
            {!isAddMode && <Button onClick={onAddMode}>Add Viewer</Button>}
          </div>
        }
      >
        {record.viewers?.map(viewerId => (
          <PermissionUserCard
            key={viewerId}
            userId={viewerId}
            userProfile={userProfiles.get(viewerId)}
            record={record}
            color="yellow"
            onDelete={() => handleDeleteViewer(viewerId)}
            trusteeEntry={trusteeMap.get(viewerId)}
            trusteeList={trustorMap.get(viewerId) ?? []}
          />
        ))}
      </RecordSectionPanel>

      {isAddMode && (
        <>
          <UserSearch
            onUserSelect={handleUserSelect}
            excludeUserIds={currentViewers || []}
            placeholder="Search by name, email, or ID..."
          />
          {selectedUser && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Ready to add this user as a Viewer:
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
              <Button onClick={handleAddViewer} disabled={isLoading} className="w-full">
                {isLoading ? 'Adding Viewer...' : 'Confirm & Add Viewer'}
              </Button>
            </div>
          )}
        </>
      )}

      <PermissionActionDialog {...dialogProps} />
    </div>
  );
};

export default ViewerManagement;
