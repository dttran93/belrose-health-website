// src/features/Credibility/components/ui/DisputeDetailModal.tsx

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  AlertTriangle,
  ExternalLink,
  Edit,
  Undo2,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BelroseUserProfile } from '@/types/core';
import UserCard from '@/features/Users/components/ui/UserCard';
import {
  DisputeWithVersion,
  getSeverityConfig,
  getCulpabilityConfig,
} from '../../services/disputeService';

// ============================================================
// TYPES
// ============================================================

interface DisputeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispute: DisputeWithVersion;
  userProfile?: BelroseUserProfile;
  isOwnDispute?: boolean;
  onModify?: () => void;
  onRetract?: () => void;
  onReact?: (disputerId: string, support: boolean) => void;
  reactionStats?: {
    supports: number;
    opposes: number;
  };
  isLoadingStats: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const CHAIN_STATUS_DISPLAY = {
  pending: { text: 'Pending confirmation', color: 'text-yellow-600' },
  confirmed: { text: 'Confirmed on-network', color: 'text-green-600' },
  failed: { text: 'Transaction failed', color: 'text-red-600' },
};

// ============================================================
// COMPONENT
// ============================================================

export const DisputeDetailModal: React.FC<DisputeDetailModalProps> = ({
  isOpen,
  onClose,
  dispute,
  userProfile,
  isOwnDispute = false,
  onModify,
  onRetract,
  onReact,
  reactionStats,
  isLoadingStats,
}) => {
  const severityInfo = getSeverityConfig(dispute.severity);
  const culpabilityInfo = getCulpabilityConfig(dispute.culpability);
  const chainStatus = CHAIN_STATUS_DISPLAY[dispute.chainStatus];

  const versionText =
    dispute.versionNumber === 1
      ? `Current (v1 of ${dispute.totalVersions})`
      : `v${dispute.versionNumber} of ${dispute.totalVersions} (outdated)`;

  // Color classes based on severity
  const severityColors = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      icon: 'text-blue-600',
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-700',
      icon: 'text-yellow-600',
    },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-600' },
  };
  const sevColors = severityColors[severityInfo.color as keyof typeof severityColors];

  const handleViewOnBlockchain = () => {
    if (dispute.txHash) {
      window.open(`https://sepolia.etherscan.io/tx/${dispute.txHash}`, '_blank');
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
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Dispute Details
              </Dialog.Title>
              <Dialog.Description />
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
                userId={dispute.disputerId}
                variant="default"
                color="yellow"
                menuType="none"
              />

              <hr className="border-gray-200" />

              {/* Severity Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Severity</h4>
                <div className={`${sevColors.bg} ${sevColors.border} border rounded-lg p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={`w-5 h-5 ${sevColors.icon}`} />
                    <span className={`font-semibold ${sevColors.text}`}>{severityInfo.name}</span>
                  </div>
                  <p className={`text-sm ${sevColors.text}`}>{severityInfo.description}</p>
                </div>
              </div>

              {/* Culpability Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Culpability</h4>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-purple-800">{culpabilityInfo.name}</span>
                  </div>
                  <p className="text-sm text-purple-700">{culpabilityInfo.description}</p>
                </div>
              </div>

              {/* Notes Section */}
              {dispute.notes && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    Notes
                  </h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{dispute.notes}</p>
                  </div>
                </div>
              )}

              <hr className="border-gray-200" />

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Version</h4>
                  <p
                    className={`text-sm font-medium ${dispute.versionNumber === 1 ? 'text-green-600' : 'text-yellow-600'}`}
                  >
                    {versionText}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Status</h4>
                  <div
                    className={`inline-flex items-center gap-1 text-sm font-medium ${chainStatus.color}`}
                  >
                    {dispute.chainStatus === 'confirmed' && <CheckCircle className="w-4 h-4" />}
                    {chainStatus.text}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Filed</h4>
                  <p className="text-sm text-gray-900">
                    {dispute.createdAt.toDate().toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                {/* Reactions Section */}
                {reactionStats && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Community Reactions</h4>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded-lg">
                        <ThumbsUp className="w-3 h-3 text-green-600" />
                        <span className="font-medium text-green-700">{reactionStats.supports}</span>
                        <span className="text-xs text-green-600">support</span>
                      </div>
                      <div className="flex items-center gap-2 bg-red-50 px-2 py-1 rounded-lg">
                        <ThumbsDown className="w-3 h-3 text-red-600" />
                        <span className="font-medium text-red-700">{reactionStats.opposes}</span>
                        <span className="text-xs text-red-600">oppose</span>
                      </div>
                    </div>
                  </div>
                )}

                {dispute.lastModified && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Last Modified</h4>
                    <p className="text-sm text-gray-900">
                      {dispute.lastModified.toDate().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Inactive Warning */}
              {!dispute.isActive && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700 font-medium">
                    This dispute has been retracted and is no longer active.
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
                disabled={!dispute.txHash}
                className="text-gray-600"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View on Network
              </Button>

              <div className="flex gap-2">
                {/* React buttons (only if not own dispute and dispute is active) */}
                {!isOwnDispute && dispute.isActive && onReact && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReact(dispute.disputerId, true)}
                      className="text-green-600 border-green-300 hover:bg-green-50"
                    >
                      <ThumbsUp className="w-4 h-4 mr-1" />
                      Support
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReact(dispute.disputerId, false)}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <ThumbsDown className="w-4 h-4 mr-1" />
                      Oppose
                    </Button>
                  </>
                )}

                {/* Modify/Retract buttons (only if own dispute and active) */}
                {isOwnDispute && dispute.isActive && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default DisputeDetailModal;
