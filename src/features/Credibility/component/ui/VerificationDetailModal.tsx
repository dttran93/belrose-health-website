// src/features/Credibility/components/ui/VerificationDetailModal.tsx

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, CheckCircle, ExternalLink, Edit, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BelroseUserProfile } from '@/types/core';
import UserCard from '@/features/Users/components/ui/UserCard';
import { VerificationWithVersion, getVerificationConfig } from '../../services/verificationService';

// ============================================================
// TYPES
// ============================================================

interface VerificationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  verification: VerificationWithVersion;
  userProfile?: BelroseUserProfile;
  isOwnVerification?: boolean;
  onModify?: () => void;
  onRetract?: () => void;
}

// ============================================================
// CONSTANTS
// ============================================================

const CHAIN_STATUS_DISPLAY = {
  pending: { text: 'Pending confirmation', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  confirmed: { text: 'Confirmed on-chain', color: 'text-green-600', bg: 'bg-green-50' },
  failed: { text: 'Transaction failed', color: 'text-red-600', bg: 'bg-red-50' },
};

// ============================================================
// COMPONENT
// ============================================================

export const VerificationDetailModal: React.FC<VerificationDetailModalProps> = ({
  isOpen,
  onClose,
  verification,
  userProfile,
  isOwnVerification = false,
  onModify,
  onRetract,
}) => {
  const verificationInfo = getVerificationConfig(verification.level);
  const levelDescription = verificationInfo.description;
  const levelName = verificationInfo.name;
  const chainStatus = CHAIN_STATUS_DISPLAY[verification.chainStatus];

  const versionText =
    verification.versionNumber === 1
      ? `Current (v1 of ${verification.totalVersions})`
      : `v${verification.versionNumber} of ${verification.totalVersions} (outdated)`;

  const handleViewOnBlockchain = () => {
    if (verification.txHash) {
      // Assuming Sepolia testnet - adjust URL for mainnet
      window.open(`https://sepolia.etherscan.io/tx/${verification.txHash}`, '_blank');
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl z-50 w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="p-2">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Verification Details
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </Dialog.Close>
            </div>

            {/* Content */}
            <div className="p-4 space-y-5">
              {/* User Card */}
              <UserCard
                user={userProfile}
                userId={verification.verifierId}
                variant="default"
                color="green"
                menuType="none"
              />

              <hr className="border-gray-200" />

              {/* Level Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Verification Level</h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800">{levelName}</span>
                  </div>
                  <p className="text-sm text-green-700">{levelDescription}</p>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Version</h4>
                  <p
                    className={`text-sm font-medium ${verification.versionNumber === 1 ? 'text-green-600' : 'text-yellow-600'}`}
                  >
                    {versionText}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Status</h4>
                  <div
                    className={`inline-flex items-center gap-1 text-sm font-medium ${chainStatus.color}`}
                  >
                    {verification.chainStatus === 'confirmed' && (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {chainStatus.text}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Verified</h4>
                  <p className="text-sm text-gray-900">
                    {verification.createdAt.toDate().toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                {verification.lastModified && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Last Modified</h4>
                    <p className="text-sm text-gray-900">
                      {verification.lastModified.toDate().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Inactive Warning */}
              {!verification.isActive && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700 font-medium">
                    This verification has been retracted and is no longer active.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between p-4 border-t bg-gray-50 rounded-b-xl">
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewOnBlockchain}
                disabled={!verification.txHash}
                className="text-gray-600"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View on Blockchain
              </Button>

              {isOwnVerification && verification.isActive && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onModify}>
                    <Edit className="w-4 h-4 mr-1" />
                    Modify
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetract}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Undo2 className="w-4 h-4 mr-1" />
                    Retract
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default VerificationDetailModal;
