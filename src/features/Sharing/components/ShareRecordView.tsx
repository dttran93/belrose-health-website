// src/features/Sharing/components/ShareRecordView.tsx

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Share2, Mail, Wallet, X, Key, HelpCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileObject, BelroseUserProfile } from '@/types/core';
import { useSharing } from '../hooks/useSharing';
import { toast } from 'sonner';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import * as Tooltip from '@radix-ui/react-tooltip';
import UserCard from '@/features/Users/components/ui/UserCard';

interface ShareRecordViewProps {
  record: FileObject;
  onBack: () => void;
  onAddMode?: () => void;
  isAddMode: boolean;
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

export const ShareRecordView: React.FC<ShareRecordViewProps> = ({
  record,
  onBack,
  onAddMode,
  isAddMode,
}) => {
  const [shareMethod, setShareMethod] = useState<'email' | 'wallet'>('email');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [receiverWallet, setReceiverWallet] = useState('');
  const [loadingShared, setLoadingShared] = useState(true);
  const [accessPermissions, setAccessPermissions] = useState<AccessPermissionData[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());

  const { shareRecord, revokeAccess, getSharedRecords, isSharing, isRevoking } = useSharing();

  // Fetch access permissions for this record
  useEffect(() => {
    fetchAccessPermissions();
  }, [record.id]);

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

  const handleShare = async () => {
    try {
      if (shareMethod === 'email') {
        await shareRecord({
          recordId: record.id,
          receiverEmail,
        });

        // Success! Record was shared
        toast.success('Record shared successfully!', {
          description: `${receiverEmail} can now access this record.`,
        });
      } else {
        await shareRecord({
          recordId: record.id,
          receiverWalletAddress: receiverWallet,
        });

        toast.success('Record shared successfully!');
      }

      // Clear inputs and reload
      setReceiverEmail('');
      setReceiverWallet('');
      await fetchAccessPermissions();
    } catch (error) {
      const err = error as Error;

      // Check if this is an invitation scenario
      if (err.message.includes('sent an invitation') || err.message.includes('sent a reminder')) {
        // This is actually a "success" - we sent an invitation
        toast.info('Invitation Sent', {
          description: err.message,
          duration: 7000,
        });

        // Still clear the input since we took action
        setReceiverEmail('');
        setReceiverWallet('');
      } else {
        // This is a real error
        toast.error('Unable to Share', {
          description: err.message,
          duration: 6000,
        });
      }
    }
  };

  const handleRevoke = async (receiverId: string) => {
    if (!confirm('Are you sure you want to revoke access to this record?')) {
      return;
    }

    try {
      await revokeAccess(record.id, receiverId);
      await fetchAccessPermissions();
    } catch (error) {
      console.error('Failed to revoke access:', error);
    }
  };

  return (
    <div>
      {isAddMode && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-2 border-b">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Share Record
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
        </>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {isAddMode && (
          <>
            {/* Left Column: Share Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 flex-1 lg:basis-1/2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Share with Someone</h3>

              {/* Record Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-1">Sharing:</p>
                <p className="font-medium text-gray-900">{record.fileName || 'Unknown Record'}</p>
                <p className="text-xs text-gray-500 mt-1">Record ID: {record.id}</p>
              </div>

              {/* Share Method Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setShareMethod('email')}
                  className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${
                    shareMethod === 'email'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Mail className="w-5 h-5" />
                  <span>Email</span>
                </button>
                <button
                  onClick={() => setShareMethod('wallet')}
                  className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${
                    shareMethod === 'wallet'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Wallet className="w-5 h-5" />
                  <span>Wallet</span>
                </button>
              </div>

              {/* Input Field */}
              <div className="mb-6">
                {shareMethod === 'email' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Receiver's Email Address
                    </label>
                    <input
                      type="email"
                      value={receiverEmail}
                      onChange={e => setReceiverEmail(e.target.value)}
                      placeholder="doctor@example.com"
                      className="w-full px-4 py-3 bg-background border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Receiver's Wallet Address
                    </label>
                    <input
                      type="text"
                      value={receiverWallet}
                      onChange={e => setReceiverWallet(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-4 py-3 bg-background border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Share Button */}
              <Button
                onClick={handleShare}
                disabled={
                  isSharing ||
                  (shareMethod === 'email' && !receiverEmail) ||
                  (shareMethod === 'wallet' && !receiverWallet)
                }
                className="w-full py-3"
              >
                {isSharing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sharing...
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Record
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* Right Column: Currently Shared With */}
        <div className="mb-4 border border-gray-200 rounded-lg flex-1 lg:basis-1/2">
          <div className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-gray-700" />
              <span className="font-semibold text-gray-900">Viewers</span>
              <span className="text-xs bg-chart-4/20 text-chart-4 px-2 py-1 rounded-full">
                {accessPermissions.length}
              </span>
            </div>
            {!isAddMode && (
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
                <button className="rounded-full hover:bg-gray-300">
                  <Plus onClick={onAddMode} />
                </button>
              </div>
            )}
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
                    <UserCard
                      key={permission.receiverId}
                      user={receiverProfile}
                      onView={() => {}}
                      onDelete={() => handleRevoke(receiverProfile!.uid)}
                      variant="default"
                      color="amber"
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <p className="text-gray-600">Record Has Not Been Shared</p>
                {!isAddMode && <Button onClick={onAddMode}>Share Record</Button>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
