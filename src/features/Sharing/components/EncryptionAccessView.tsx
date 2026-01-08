// src/features/Sharing/components/EncryptionAccessView.tsx

import React, { useState, useEffect } from 'react';
import {
  Key,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle,
  ArrowLeft,
  Plus,
  View,
} from 'lucide-react';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { FileObject, BelroseUserProfile } from '@/types/core';
import UserCard from '@/features/Users/components/ui/UserCard';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Button } from '@/components/ui/Button';
import { usePermissionFlow } from '@/features/Permissions/hooks/usePermissionFlow';
import { PermissionActionDialog } from '@/features/Permissions/component/ui/PermissionActionDialog';
import UserSearch from '@/features/Users/components/UserSearch';
import type { Role } from '@/features/Permissions/services/permissionsService';
import { UserBadge } from '@/features/Users/components/ui/UserBadge';

interface WrappedKeyInfo {
  userId: string;
  recordId: string;
  isActive: boolean;
  isCreator: boolean;
  createdAt: Date;
  revokedAt?: Date;
  reactivatedAt?: Date;
}

export interface AccessEntry {
  userId: string;
  profile: BelroseUserProfile | undefined;
  wrappedKey: WrappedKeyInfo | null;
  role: 'owner' | 'administrator' | 'viewer' | 'none';
  status: 'synced' | 'missing-key' | 'missing-role' | 'revoked';
}

interface EncryptionAccessViewProps {
  record: FileObject;
  onBack?: () => void;
}

export const EncryptionAccessView: React.FC<EncryptionAccessViewProps> = ({ record, onBack }) => {
  const [accessEntries, setAccessEntries] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the new permission flow hook
  const {
    dialogProps,
    initiateRevoke,
    initiateGrant,
    isLoading: isActionLoading,
  } = usePermissionFlow({
    recordId: record.id,
    onSuccess: () => {
      fetchEncryptionAccess();
    },
  });

  // State for user search/selection when granting access
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);
  const [selectedUserForGrant, setSelectedUserForGrant] = useState<BelroseUserProfile | null>(null);

  const renderAccessContent = (entry: AccessEntry) => {
    const isSubject = record.subjects?.includes(entry.userId);

    const roleConfigs: Record<AccessEntry['role'], { text: string; color: any }> = {
      owner: { text: 'Owner', color: 'red' },
      administrator: { text: 'Admin', color: 'blue' },
      viewer: { text: 'Viewer', color: 'yellow' },
      none: { text: 'No Role', color: 'primary' },
    };

    const statusConfigs: Record<
      AccessEntry['status'],
      { text: string; color: any; icon: any; tooltip: string }
    > = {
      synced: {
        text: 'Synced',
        color: 'green',
        icon: <CheckCircle className="w-3 h-3" />,
        tooltip: 'User has both a role and an active wrapped key. They can decrypt this record.',
      },
      'missing-key': {
        text: 'Missing Key',
        color: 'red',
        icon: <AlertTriangle className="w-3 h-3" />,
        tooltip: 'User has a role but no wrapped key. They cannot decrypt this record.',
      },
      'missing-role': {
        text: 'Orphaned Key',
        color: 'yellow',
        icon: <AlertTriangle className="w-3 h-3" />,
        tooltip: 'User has a wrapped key but no role. Security issue.',
      },
      revoked: {
        text: 'Revoked',
        color: 'primary',
        icon: <XCircle className="w-3 h-3" />,
        tooltip: 'Access was previously granted but has been revoked.',
      },
    };

    const role = roleConfigs[entry.role];
    const status = statusConfigs[entry.status];

    return (
      <div className="flex flex-wrap items-center gap-2">
        {isSubject && <UserBadge text="Subject" color="pink" />}
        {entry.wrappedKey?.isCreator && <UserBadge text="Creator" color="purple" />}
        <UserBadge text={role.text} color={role.color} />
        <UserBadge
          text={status.text}
          color={status.color}
          icon={status.icon}
          tooltip={status.tooltip}
        />
      </div>
    );
  };

  const fetchEncryptionAccess = async () => {
    if (!record.id) return;
    setLoading(true);
    try {
      const db = getFirestore();

      // 1. Fetch the LATEST record data to get updated roles
      const recordDocRef = doc(db, 'records', record.id);
      const recordSnap = await getDoc(recordDocRef);
      const latestRecord = recordSnap.exists() ? (recordSnap.data() as FileObject) : record;

      // 2. Fetch wrapped keys
      const wrappedKeysRef = collection(db, 'wrappedKeys');
      const q = query(wrappedKeysRef, where('recordId', '==', record.id));
      const querySnapshot = await getDocs(q);

      const wrappedKeys: WrappedKeyInfo[] = querySnapshot.docs.map(
        doc =>
          ({
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate(),
          }) as WrappedKeyInfo
      );

      // 3. Use latestRecord for calculating allUserIds
      const allUserIds = new Set<string>([
        ...wrappedKeys.map(wk => wk.userId),
        ...(latestRecord.owners || []),
        ...(latestRecord.administrators || []),
        ...(latestRecord.viewers || []),
        ...(latestRecord.subjects || []),
      ]);

      const profiles = await getUserProfiles(Array.from(allUserIds));

      // 4. Map entries using latestRecord roles
      const entries: AccessEntry[] = Array.from(allUserIds).map(userId => {
        const wrappedKey = wrappedKeys.find(wk => wk.userId === userId) ?? null;
        let role: AccessEntry['role'] = 'none';

        if (latestRecord.owners?.includes(userId)) role = 'owner';
        else if (latestRecord.administrators?.includes(userId)) role = 'administrator';
        else if (latestRecord.viewers?.includes(userId)) role = 'viewer';

        let status: AccessEntry['status'] = 'synced';
        if (wrappedKey && !wrappedKey.isActive) status = 'revoked';
        else if (wrappedKey && role === 'none') status = 'missing-role';
        else if (!wrappedKey && role !== 'none') status = 'missing-key';

        return { userId, profile: profiles.get(userId), wrappedKey, role, status };
      });

      setAccessEntries(entries.sort((a, b) => (a.status === 'synced' ? 1 : -1)));
    } catch (err) {
      console.error(err);
      setError('Failed to load access data. Only Owners and Administrators can Manage Access');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEncryptionAccess();
  }, [record.id, record.owners, record.administrators, record.viewers]);

  const issueCount = accessEntries.filter(
    e => e.status !== 'synced' && e.status !== 'revoked'
  ).length;
  const activeKeyCount = accessEntries.filter(e => e.wrappedKey?.isActive).length;

  /**
   * Handle delete/revoke button click on a user card
   * Initiates the revoke flow with the permission dialog
   */
  const handleRevokeClick = (entry: AccessEntry) => {
    // Only initiate revoke if user has a role and a profile
    if (entry.role === 'none' || !entry.profile) {
      return;
    }

    // Map AccessEntry role to Role type (excluding 'none')
    const role = entry.role as Role;
    initiateRevoke(entry.profile, role);
  };

  /**
   * Handle user selection from search
   */
  const handleUserSelect = (user: BelroseUserProfile) => {
    setSelectedUserForGrant(user);
  };

  /**
   * Handle grant button click - initiates grant with role selection
   */
  const handleGrantAccess = () => {
    if (!selectedUserForGrant) return;
    // Use 'select-role' variant so user can choose the role in the dialog
    initiateGrant(selectedUserForGrant, 'viewer', 'select-role');
    // Clear selection and close search
    setSelectedUserForGrant(null);
    setIsUserSearchOpen(false);
  };

  /**
   * Cancel adding a user
   */
  const handleCancelGrant = () => {
    setSelectedUserForGrant(null);
    setIsUserSearchOpen(false);
  };

  // Get list of user IDs to exclude from search (already have access)
  const excludeUserIds = accessEntries.map(entry => entry.userId);

  return (
    <div className="w-full mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <View className="w-5 h-5" />
          Manage Access
        </h3>
        <div className="flex items-center gap-2">
          <Button onClick={onBack} className="w-8 h-8 border-none bg-transparent hover:bg-gray-200">
            <ArrowLeft className="text-primary" />
          </Button>
        </div>
      </div>

      {/* Current Wrapped Keys Section */}
      <div className="mb-4 border border-gray-200 rounded-lg">
        <div className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">Encrypted Access</span>
            <span className="text-xs border border-primary bg-primary/20 text-primary px-2 py-1 rounded-full">
              {activeKeyCount}
            </span>
            {issueCount > 0 && (
              <span className="text-xs border border-red-700 bg-red-100 text-red-800 px-2 py-1 rounded-full">
                {issueCount} issue{issueCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2">
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button className="inline-flex items-center ml-1">
                      <span className="text-xs border border-primary bg-primary/20 text-primary px-2 py-1 rounded-full flex items-center">
                        Encrypted Access
                        <HelpCircle className="w-4 h-4 ml-1" />
                      </span>
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
                      sideOffset={5}
                    >
                      <p className="font-semibold mb-2 text-sm">Encryption Access Overview</p>
                      <p className="text-xs mb-3">
                        This view shows who has cryptographic access to decrypt this record,
                        cross-referenced with their permission roles.
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>
                          <strong>Synced:</strong> User has both a role and can decrypt
                        </li>
                        <li>
                          <strong>Missing Key:</strong> Has role but can't decrypt (re-grant to fix)
                        </li>
                        <li>
                          <strong>Orphaned Key:</strong> Can decrypt but has no role (security
                          issue)
                        </li>
                        <li>
                          <strong>Revoked:</strong> Previously had access, now revoked
                        </li>
                      </ol>
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            </div>
            <button
              className="rounded-full hover:bg-gray-300 p-1"
              onClick={() => setIsUserSearchOpen(!isUserSearchOpen)}
            >
              <Plus />
            </button>
          </div>
        </div>

        <div className="p-4 bg-white space-y-2 rounded-b-lg">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <p className="text-gray-500">Loading encryption access...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          ) : accessEntries.length > 0 ? (
            <div className="space-y-3">
              {accessEntries.map(entry => {
                const hasIssue = entry.status === 'missing-key' || entry.status === 'missing-role';
                const cardColor = hasIssue ? 'red' : 'primary';
                const canRevoke = entry.role !== 'none' && entry.profile;

                return (
                  <UserCard
                    key={entry.userId}
                    user={entry.profile}
                    userId={entry.userId}
                    onDelete={canRevoke ? () => handleRevokeClick(entry) : undefined}
                    color={cardColor}
                    variant="default"
                    content={renderAccessContent(entry)}
                    showEmail={true}
                    showUserId={true}
                    onViewUser={() => {}}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex justify-center items-center py-8">
              <p className="text-gray-600">No encryption access found</p>
            </div>
          )}
        </div>
      </div>

      {/* User Search for Granting Access */}
      {isUserSearchOpen && (
        <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Grant Access</h4>
            <button onClick={handleCancelGrant} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <UserSearch
            onUserSelect={handleUserSelect}
            excludeUserIds={excludeUserIds}
            placeholder="Search by name, email, or user ID..."
          />

          {/* Selected User Preview */}
          {selectedUserForGrant && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Grant access to this user:</p>
              <UserCard
                user={selectedUserForGrant}
                userId={selectedUserForGrant.uid}
                onViewUser={() => {}}
                variant="default"
                color="green"
                menuType="cancel"
                onCancel={() => setSelectedUserForGrant(null)}
              />
              <Button
                onClick={handleGrantAccess}
                disabled={isActionLoading}
                className="w-full mt-3"
              >
                {isActionLoading ? 'Processing...' : 'Select Role & Grant Access'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Permission Action Dialog - handles preparation, confirmation, and execution */}
      <PermissionActionDialog {...dialogProps} />
    </div>
  );
};

export default EncryptionAccessView;
