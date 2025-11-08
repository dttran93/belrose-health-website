import React, { useState, useEffect } from 'react';
import {
  UserLock,
  ArrowLeft,
  CircleUser,
  HelpCircle,
  Users,
  Plus,
  Share2,
  Key,
  X,
  UserCog,
  Sparkle,
} from 'lucide-react';
import { FileObject } from '@/types/core';
import { Button } from '@/components/ui/Button';
import * as Tooltip from '@radix-ui/react-tooltip';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getUserProfiles, UserProfile } from '@/components/auth/services/userProfileService';
import SetRecordSubject from './SetRecordSubject';
import { usePermissions } from '../hooks/usePermissions';
import AddOwner from './AddOwner';

interface PermissionsManagerProps {
  record: FileObject;
  onBack: () => void;
}

// Type for access permission data from Firestore
interface AccessPermissionData {
  id: string; // The document ID (permissionHash)
  recordId: string;
  ownerId: string;
  receiverId: string;
  receiverWalletAddress: string;
  isActive: boolean;
  grantedAt: any; // Firestore Timestamp
  revokedAt?: any;
  blockchainTxHash?: string;
  onChain?: boolean;
}

type PermissionViewMode = 'manager' | 'add-subject' | 'add-owner' | 'share';

export const PermissionsManager: React.FC<PermissionsManagerProps> = ({ record, onBack }) => {
  const [viewMode, setViewMode] = useState<PermissionViewMode>('manager');
  const [accessPermissions, setAccessPermissions] = useState<AccessPermissionData[]>([]);
  const [loadingShared, setLoadingShared] = useState(true);
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());

  const handleAddSubject = () => {
    setViewMode('add-subject');
  };

  const handleAddOwner = () => {
    setViewMode('add-owner');
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

        // Filter client-side for this specific record
        const permissions: AccessPermissionData[] = querySnapshot.docs
          .map(
            doc =>
              ({
                id: doc.id,
                ...doc.data(),
              } as AccessPermissionData)
          )
          .filter(permission => permission.recordId === record.id);

        setAccessPermissions(permissions);

        // Fetch user profiles for all owners and receivers
        const userIds = new Set<string>();

        // Add owners
        record.owners?.forEach(ownerId => userIds.add(ownerId));

        // Add subject if exists
        if (record.subjectId) {
          userIds.add(record.subjectId);
        }

        // Add receivers from permissions
        permissions.forEach(permission => userIds.add(permission.receiverId));

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
  }, [record.id, record.owners, record.subjectId]);

  return (
    <div className="w-full mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <UserLock className="w-5 h-5" />
            Permissions
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

      {viewMode === 'manager' && (
        <>
          {/* Record Subject Section */}
          <div className="mb-4 border border-accent rounded-lg overflow-hidden">
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
                  <Plus />
                </button>
              </div>
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
                  <Button onClick={handleAddSubject}>Set Record Subject</Button>
                </div>
              )}
            </div>
          </div>

          {/* Owners Section */}
          <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-700" />
                <span className="font-semibold text-gray-900">Owners</span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  {record.owners!.length}{' '}
                  {/* Revise this eventually when you split up the FileObject */}
                </span>
              </div>
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
                  <Plus onClick={handleAddOwner} />
                </button>
              </div>
            </div>

            <div className="p-4 bg-white space-y-2">
              {/* Revise the ! thing eventually when you split up the FileObject */}
              {record.owners && record.owners.length > 0 ? (
                <div className="space-y-3 mt-4">
                  {record.owners.map((owner, idx) => {
                    const ownerProfile = userProfiles.get(owner);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 bg-chart-3/20 rounded-lg border border-chart-3 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-chart-3/20 rounded-full flex items-center justify-center">
                            <UserCog className="w-5 h-5 text-chart-3" />
                          </div>
                          <div className="text-left">
                            <p className="text-base font-semibold text-gray-900">
                              {ownerProfile?.displayName || owner}
                            </p>
                            <p className="text-xs text-gray-500">{ownerProfile?.email || owner}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:text-red-600 hover:bg-chart-3/30 items-center"
                          >
                            <X className="x-4 y-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
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

          {/* Viewers Section */}
          <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
            <div className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-gray-700" />
                <span className="font-semibold text-gray-900">Viewers</span>
                <span className="text-xs bg-chart-4/20 text-chart-4 px-2 py-1 rounded-full">
                  {accessPermissions.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button className="inline-flex items-center ml-1">
                        <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full flex items-center">
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
                          Viewers are granted record access by Owners or Record Subjects:
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                          <li>Viewers can view, verify, or dispute records.</li>
                          <li>They may not edit, share, or delete records.</li>
                          <li>
                            Their access may be revoked at any time by Owners or Record Subjects.
                          </li>
                        </ol>
                        <Tooltip.Arrow className="fill-gray-900" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
                <button className="rounded-full hover:bg-gray-300">
                  <Plus />
                </button>
              </div>
            </div>

            <div className="p-4">
              {loadingShared ? (
                <div className="flex justify-center items-center py-8">
                  <p className="text-gray-500">Loading shared access...</p>
                </div>
              ) : accessPermissions.length > 0 ? (
                <div className="space-y-3 mt-4">
                  {accessPermissions.map(permission => {
                    const receiverProfile = userProfiles.get(permission.receiverId);
                    return (
                      <div
                        key={permission.id}
                        className="flex items-center justify-between p-4 bg-chart-4/10 rounded-lg border border-chart-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-chart-4/30 rounded-full flex items-center justify-center">
                            <Key className="w-5 h-5 text-chart-4" />
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <p className="text-base font-semibold text-gray-900">
                                {receiverProfile?.displayName || permission.receiverId}
                              </p>
                              <p className="text-sm text-gray-500">
                                {receiverProfile?.email || permission.receiverId}
                              </p>
                              <p className="text-sm text-gray-500">
                                {receiverProfile?.uid || permission.receiverId}
                              </p>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              Granted:{' '}
                              {permission.grantedAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                            </p>
                            {permission.onChain && (
                              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                Verified on blockchain
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:text-red-600 hover:bg-chart-4/30 items-center"
                          >
                            <X className="x-4 y-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex justify-between items-center mt-4">
                  <p className="text-gray-600">Record Has Not Been Shared</p>
                  <Button>Share Record</Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {viewMode === 'add-subject' && (
        <>
          <SetRecordSubject
            recordId={record.id}
            currentSubjectId={record.subjectId || undefined}
            onSuccess={() => {}}
          />
        </>
      )}
      {viewMode === 'add-owner' && (
        <>
          <AddOwner recordId={record.id} currentOwners={[]} onSuccess={() => {}} />
        </>
      )}
    </div>
  );
};

export default PermissionsManager;
