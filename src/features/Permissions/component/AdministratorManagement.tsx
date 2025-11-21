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

interface AdminManagementProps {
  record: FileObject;
  currentAdmins: string[];
  onSuccess?: () => void;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
}

export const AdminManagement: React.FC<AdminManagementProps> = ({
  record,
  currentAdmins,
  onSuccess,
  onBack,
  onAddMode,
  isAddMode,
}) => {
  const [selectedUser, setSelectedUser] = useState<BelroseUserProfile | null>(null);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());
  const [refreshOwnersTrigger, setRefreshOWnersTrigger] = useState(0);

  const { addAdmin, removeAdmin, isLoading } = usePermissions({
    onSuccess: msg => {
      setSelectedUser(null);
      setRefreshOWnersTrigger(prev => prev + 1);
      onSuccess?.();
    },
  });

  const handleUserSelect = (user: BelroseUserProfile) => {
    setSelectedUser(user);
  };

  const handleAddAdmin = async () => {
    if (!selectedUser) return;
    await addAdmin(record.id, selectedUser.uid);
  };

  const handleDeleteAdmin = async (userIdToRemove: string) => {
    await removeAdmin(record.id, userIdToRemove);
  };

  // Fetch access permissions for this record
  useEffect(() => {
    const fetchAccessPermissions = async () => {
      if (!record.id) return;

      setLoadingAdmins(true);
      try {
        const db = getFirestore();
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
          console.error('No authenticated user');
          return;
        }

        // Fetch user profiles for all owners and administrators
        const userIds = new Set<string>();

        // Add owners
        record.administrators?.forEach(adminId => userIds.add(adminId));

        // Fetch all user profiles at once
        const profiles = await getUserProfiles(Array.from(userIds));
        setUserProfiles(profiles);
      } catch (error) {
        console.error('Error fetching access permissions:', error);
      } finally {
        setLoadingAdmins(false);
      }
    };

    fetchAccessPermissions();
  }, [record.id, record.owners, refreshOwnersTrigger]);

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
            <p className="font-semibold mb-2 text-sm">
              Administrators have full access to view, edit, share, verify, and dispute records
            </p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>If there is no Owner, Administrators may appoint an Owner</li>
              <li>If there is no Owner, Administrators can add and remove other Administrators</li>
              <li>
                If there is an Owner, Administrators can add other Administrators but may not remove
                other Administrators
              </li>
              <li>There must be at least one Administrator in every record</li>
            </ol>
          </div>
        </>
      )}

      {/* Current Administrators Section */}
      <div className="mb-4 border border-gray-200 rounded-lg">
        <div className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">Administrators</span>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
              {record.administrators.length}{' '}
            </span>
          </div>
          {!isAddMode && (
            <div className="flex items-center gap-2">
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button className="inline-flex items-center ml-1 text-blue-700 hover:text-red-800">
                      <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full flex items-center">
                        Administrative Access
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
                        Administrators have full access to view, edit, share, verify, and dispute
                        records
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>If there is no Owner, Administrators may appoint an Owner</li>
                        <li>
                          If there is no Owner, Administrators can add and remove other
                          Administrators
                        </li>
                        <li>
                          If there is an Owner, Administrators can add other Administrators but may
                          not remove other Administrators
                        </li>
                        <li>There must be at least one Administrator in every record</li>
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

        <div className="p-4 bg-white space-y-2 rounded-lg">
          {/* Revise the ! thing eventually when you split up the FileObject */}
          {loadingAdmins ? (
            <div className="flex justify-center items-center py-8">
              <p className="text-gray-500">Loading owners...</p>
            </div>
          ) : record.administrators && record.administrators.length > 0 ? (
            // Existing logic for displaying owners
            <div className="space-y-3 mt-4">
              {record.administrators.map(admin => {
                const adminProfile = userProfiles.get(admin);
                return (
                  <UserCard
                    key={admin}
                    user={adminProfile}
                    onView={handleAddAdmin}
                    onDelete={() => handleDeleteAdmin(admin)}
                    variant="default"
                    color="green"
                  />
                );
              })}
            </div>
          ) : (
            // Existing logic for "No owners assigned"
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
            excludeUserIds={currentAdmins}
            placeholder="Search by name, email, or ID..."
          />

          {/* Selected User - Confirm */}
          {selectedUser && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Ready to add this user as an owner:
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
              <Button onClick={handleAddAdmin} disabled={isLoading} className="w-full">
                {isLoading ? 'Adding Owner...' : 'Confirm & Add Owner'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminManagement;
