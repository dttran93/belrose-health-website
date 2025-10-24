// src/features/Sharing/components/ShareRecordView.tsx

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Share2, Mail, Wallet, Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileObject } from '@/types/core';
import { useSharing } from '../hooks/useSharing';
import { SharedRecord } from '../services/sharingService';
import { toast } from 'sonner';

interface ShareRecordViewProps {
  record: FileObject;
  onBack: () => void;
}

export const ShareRecordView: React.FC<ShareRecordViewProps> = ({ record, onBack }) => {
  const [shareMethod, setShareMethod] = useState<'email' | 'wallet'>('email');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [receiverWallet, setReceiverWallet] = useState('');
  const [sharedWith, setSharedWith] = useState<SharedRecord[]>([]);
  const [isLoadingShared, setIsLoadingShared] = useState(true);

  const { shareRecord, revokeAccess, getSharedRecords, isSharing, isRevoking } = useSharing();

  // Load who this record is already shared with
  useEffect(() => {
    loadSharedWith();
  }, []);

  const loadSharedWith = async () => {
    setIsLoadingShared(true);
    try {
      const allShared = await getSharedRecords();
      // Filter to only this record
      const thisRecordShared = allShared.filter(s => s.recordId === record.id);
      setSharedWith(thisRecordShared);
    } catch (error) {
      console.error('Failed to load shared records:', error);
    } finally {
      setIsLoadingShared(false);
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
      await loadSharedWith();
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
      await loadSharedWith();
    } catch (error) {
      console.error('Failed to revoke access:', error);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Share2 className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Share Record</h2>
            <p className="text-sm text-gray-600">Share with family, doctors, or researchers</p>
          </div>
        </div>
        <Button onClick={onBack} className="w-8 h-8 border-none bg-transparent hover:bg-gray-200">
          <ArrowLeft className="w-4 h-4 text-primary" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Share Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
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

        {/* Right Column: Currently Shared With */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Currently Shared With</h3>
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
              {sharedWith.length} {sharedWith.length === 1 ? 'person' : 'people'}
            </span>
          </div>

          {isLoadingShared ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : sharedWith.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">Not shared with anyone yet</p>
              <p className="text-sm text-gray-500 mt-1">Share this record to give someone access</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sharedWith.map(shared => (
                <div
                  key={shared.receiverId}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {shared.receiverWalletAddress.slice(2, 4).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {shared.receiverWalletAddress.slice(0, 6)}...
                            {shared.receiverWalletAddress.slice(-4)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(shared.grantedAt).toLocaleDateString()}</span>
                        </div>

                        {shared.isActive ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            <span className="font-medium">Active</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="w-3 h-3" />
                            <span className="font-medium">Revoked</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {shared.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevoke(shared.receiverId)}
                        disabled={isRevoking}
                        className="text-red-600 border-red-300 hover:bg-red-50 text-xs"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
