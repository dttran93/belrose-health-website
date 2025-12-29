import React, { useState, useEffect } from 'react';
import { Users, ArrowLeft, HelpCircle, Plus, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { usePermissionFlow } from '@/features/Permissions/hooks/usePermissionFlow';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import UserSearch from '@/features/Users/components/UserSearch';
import { FileObject, BelroseUserProfile } from '@/types/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import UserCard from '@/features/Users/components/ui/UserCard';
import PermissionActionDialog from './ui/PermissionActionDialog';

interface ViewerManagementProps {
  record: FileObject;
  currentViewers: string[] | undefined;
  onSuccess?: () => void;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
}

export const ViewerManagement: React.FC<ViewerManagementProps> = ({
  record,
  currentViewers,
  onSuccess,
  onBack,
  onAddMode,
  isAddMode,
}) => {
  const [selectedUser, setSelectedUser] = useState<BelroseUserProfile | null>(null);
  const [loadingViewers, setLoadingViewers] = useState(true);
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

  const handleAddViewer = () => {
    if (!selectedUser) return;
    initiateGrant(selectedUser, 'viewer');
  };

  const handleDeleteViewer = (userId: string) => {
    const profile = userProfiles.get(userId);
    if (!profile) return;
    initiateRevoke(profile, 'viewer');
  };

  useEffect(() => {
    const fetchViewerProfiles = async () => {
      if (!record.id) return;

      setLoadingViewers(true);
      try {
        const userIds = new Set<string>();
        record.viewers?.forEach(viewerId => userIds.add(viewerId));

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

  return (
    <div>
      {isAddMode && (
        <>
          {/* Header */}
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Manage Viewers
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
            <p className="font-semibold mb-2 text-sm">
              Viewers can view, verify, and dispute records.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Viewers are granted access by Owners or Administrators</li>
              <li>They may not edit, share, or delete records.</li>
              <li>Their access may be revoked at any time by Owners or Administrators.</li>
              <li>
                Once granted, Belrose cannot prevent analog replication by viewers (e.g.,
                screenshots or photos of the screen)
              </li>
            </ol>
          </div>
        </>
      )}

      {/* Current Viewers Section */}
      <div className="mb-4 border border-gray-200 rounded-lg">
        <div className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">Viewers</span>
            <span className="text-xs border border-yellow-700 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
              {record.viewers?.length}{' '}
            </span>
          </div>
          {!isAddMode && (
            <div className="flex items-center gap-2">
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button className="inline-flex items-center ml-1 text-blue-700 hover:text-red-800">
                      <span className="text-xs border border-yellow-700 bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full flex items-center">
                        View Access
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
                        Viewers are granted record access by Owners or Administrators:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Viewers can view, verify, or dispute records.</li>
                        <li>They may not edit, share, or delete records.</li>
                        <li>
                          Their access may be revoked at any time by Owners or Administrators.
                        </li>
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

        <div className="p-4 bg-white rounded-b-lg">
          {loadingViewers ? (
            <div className="flex justify-center items-center py-8">
              <p className="text-gray-500">Loading viewers...</p>
            </div>
          ) : record.viewers && record.viewers.length > 0 ? (
            <div className="space-y-3">
              {record.viewers.map(viewerId => {
                const profile = userProfiles.get(viewerId);
                return (
                  <UserCard
                    key={viewerId}
                    user={profile}
                    onView={() => {}}
                    onDelete={() => handleDeleteViewer(viewerId)}
                    variant="default"
                    color="yellow"
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex justify-between items-center mt-4">
              <p className="text-gray-600">No viewers assigned</p>
              {!isAddMode && <Button onClick={onAddMode}>Add Viewer</Button>}
            </div>
          )}
        </div>
      </div>
      {isAddMode && (
        <>
          {/* User Search Component */}
          <UserSearch
            onUserSelect={handleUserSelect}
            excludeUserIds={currentViewers || []}
            placeholder="Search by name, email, or ID..."
          />

          {/* Selected User - Confirm */}
          {selectedUser && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Ready to add this user as a Viewer:
              </p>
              <div className="py-3">
                <UserCard
                  user={selectedUser}
                  onView={() => {}}
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

      {/* 6. Unified Dialog */}
      <PermissionActionDialog {...dialogProps} />
    </div>
  );
};

export default ViewerManagement;
