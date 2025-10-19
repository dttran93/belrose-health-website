// src/features/Sharing/components/ShareRecordDialog.tsx

import React, { useState } from 'react';
import { Share2, Mail, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSharing } from '../hooks/useSharing';

interface ShareRecordDialogProps {
  recordId: string;
  recordName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ShareRecordDialog: React.FC<ShareRecordDialogProps> = ({
  recordId,
  recordName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [shareMethod, setShareMethod] = useState<'email' | 'wallet'>('email');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [receiverWallet, setReceiverWallet] = useState('');
  const { shareRecord, isSharing } = useSharing();

  const handleShare = async () => {
    try {
      if (shareMethod === 'email') {
        await shareRecord({
          recordId,
          receiverEmail,
        });
      } else {
        await shareRecord({
          recordId,
          receiverWalletAddress: receiverWallet,
        });
      }

      onSuccess?.();
      onClose();
      setReceiverEmail('');
      setReceiverWallet('');
    } catch (error) {
      // Error handled in hook
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Share2 className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Share Record</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Record Info */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-sm text-gray-600">Sharing:</p>
          <p className="font-medium">{recordName}</p>
        </div>

        {/* Share Method Tabs */}
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => setShareMethod('email')}
            className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center space-x-2 ${
              shareMethod === 'email'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email</span>
          </button>
          <button
            onClick={() => setShareMethod('wallet')}
            className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center space-x-2 ${
              shareMethod === 'wallet'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Wallet</span>
          </button>
        </div>

        {/* Input Field */}
        <div className="mb-6">
          {shareMethod === 'email' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider's Email
              </label>
              <input
                type="email"
                value={receiverEmail}
                onChange={e => setReceiverEmail(e.target.value)}
                placeholder="doctor@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider's Wallet Address
              </label>
              <input
                type="text"
                value={receiverWallet}
                onChange={e => setReceiverWallet(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <Button onClick={onClose} variant="outline" className="flex-1" disabled={isSharing}>
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            className="flex-1"
            disabled={
              isSharing ||
              (shareMethod === 'email' && !receiverEmail) ||
              (shareMethod === 'wallet' && !receiverWallet)
            }
          >
            {isSharing ? 'Sharing...' : 'Share Record'}
          </Button>
        </div>
      </div>
    </div>
  );
};
