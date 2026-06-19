// src/features/Permissions/components/SharerManagement.tsx

import React, { useState, useEffect } from 'react';
import { Share2, ArrowLeft } from 'lucide-react';
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

interface SharerManagementProps {
  record: FileObject;
  currentSharers: string[] | undefined;
  onSuccess?: () => void;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
  trusteeMap: TrusteeByIdMap;
  trustorMap: TrustorByIdMap;
}

export const SharerManagement: React.FC<SharerManagementProps> = ({
  record,
  currentSharers,
  onSuccess,
  onBack,
  onAddMode,
  isAddMode,
  trusteeMap,
  trustorMap,
}) => {
  const [selectedUser, setSelectedUser] = useState<BelroseUserProfile | null>(null);
  const [loadingSharers, setLoadingSharers] = useState(true);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { dialogProps, initiateGrant, initiateRevoke, isLoading } = usePermissionFlow({
    recordId: record.id,
    recordTitle: (record.belroseFields?.title || record.fileName) ?? undefined,
    onSuccess: () => {
      setSelectedUser(null);
      setRefreshTrigger(prev => prev + 1);
      onSuccess?.();
    },
  });

  const handleUserSelect = (user: BelroseUserProfile) => setSelectedUser(user);

  const handleAddSharer = () => {
    if (selectedUser) initiateGrant(selectedUser, 'sharer');
  };

  const handleDeleteSharer = (userId: string) => {
    const profile = userProfiles.get(userId);
    if (profile) initiateRevoke(profile, 'sharer');
  };

  useEffect(() => {
    const fetchSharerProfiles = async () => {
      if (!record.id) return;
      setLoadingSharers(true);
      try {
        const userIds = new Set<string>();
        record.sharers?.forEach(id => userIds.add(id));
        const profiles = await getUserProfiles(Array.from(userIds));
        setUserProfiles(profiles);
      } catch (error) {
        console.error('Error fetching sharer profiles:', error);
      } finally {
        setLoadingSharers(false);
      }
    };
    fetchSharerProfiles();
  }, [record.id, record.sharers, refreshTrigger]);

  const tooltipContent = (
    <>
      <p className="font-semibold mb-2 text-sm">
        Sharers can view and share the record with others:
      </p>
      <ol className="list-decimal list-inside space-y-1 text-xs">
        <li>Sharers can view, verify, or dispute records.</li>
        <li>Sharers can grant Viewer or Sharer access to others.</li>
        <li>They may not edit the record content or add Administrators.</li>
        <li>Their access may be revoked at any time by Owners or Administrators.</li>
      </ol>
    </>
  );

  return (
    <div>
      {isAddMode && (
        <>
          <div className="flex items-center justify-between mb-4 pb-2 border-b">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Manage Sharers
            </h3>
            <Button
              onClick={onBack}
              className="w-8 h-8 border-none bg-transparent hover:bg-gray-200"
            >
              <ArrowLeft className="text-primary" />
            </Button>
          </div>
          <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-6">
            {tooltipContent}
          </div>
        </>
      )}

      <RecordSectionPanel
        icon={<Share2 className="w-5 h-5 text-gray-700" />}
        title="Sharers"
        badges={[
          {
            label: String(record.sharers?.length ?? 0),
            className: 'border border-green-700 bg-green-100 text-green-800',
          },
        ]}
        showActions={!isAddMode}
        tooltipLabel="Share Access"
        tooltipClassName="border border-green-700 bg-green-200 text-green-800"
        tooltipContent={tooltipContent}
        onAdd={onAddMode}
        isLoading={loadingSharers}
        loadingLabel="Loading sharers..."
        isEmpty={!record.sharers || record.sharers.length === 0}
        emptyState={
          <div className="flex justify-between items-center mt-4">
            <p className="text-gray-600">No sharers assigned</p>
            {!isAddMode && <Button onClick={onAddMode}>Add Sharer</Button>}
          </div>
        }
      >
        {record.sharers?.map(sharerId => (
          <PermissionUserCard
            key={sharerId}
            userId={sharerId}
            userProfile={userProfiles.get(sharerId)}
            record={record}
            color="green"
            onDelete={() => handleDeleteSharer(sharerId)}
            trusteeEntry={trusteeMap.get(sharerId)}
            trusteeList={trustorMap.get(sharerId) ?? []}
          />
        ))}
      </RecordSectionPanel>

      {isAddMode && (
        <>
          <UserSearch
            onUserSelect={handleUserSelect}
            excludeUserIds={currentSharers || []}
            placeholder="Search by name, email, or ID..."
          />
          {selectedUser && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Ready to add this user as a Sharer:
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
              <Button onClick={handleAddSharer} disabled={isLoading} className="w-full">
                {isLoading ? 'Adding Sharer...' : 'Confirm & Add Sharer'}
              </Button>
            </div>
          )}
        </>
      )}

      <PermissionActionDialog {...dialogProps} />
    </div>
  );
};

export default SharerManagement;
