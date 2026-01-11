// src/features/ViewEditRecord/components/VersionDetailPage.tsx

/**
 * Detail page for a specific version (recordHash).
 * Shows:
 * 1. VersionHistoryCard at the top
 * 2. VerificationManagement filtered to this hash only
 * 3. DisputeManagement filtered to this hash only
 *
 * Reuses existing credibility components and their modals.
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FileObject, BelroseUserProfile } from '@/types/core';
import { RecordVersion } from '../../services/versionControlService.types';
import { VersionReviewBadge, CredibilityStats } from './VersionReviewBadge';
import { useAuth } from '@/features/Auth/hooks/useAuth';
import { getUserProfiles } from '@/features/Users/services/userProfileService';

// Verification imports
import {
  VerificationWithVersion,
  getVerificationsByRecordId,
} from '@/features/Credibility/services/verificationService';
import VerificationDetailModal from '@/features/Credibility/components/Verifications/VerificationDetailModal';
import VerificationUserCard from '@/features/Credibility/components/Verifications/VerificationUserCard';

// Dispute imports
import {
  DisputeWithVersion,
  getDisputesByRecordId,
  getDisputeReactionStats,
} from '@/features/Credibility/services/disputeService';
import DisputeDetailModal from '@/features/Credibility/components/Disputes/DisputeDetailModal';
import DisputeUserCard from '@/features/Credibility/components/Disputes/DisputeUserCard';
import { ReactionType } from '@/components/ui/ReactionButtons';

// Credibility flow hook for actions
import { useCredibilityFlow } from '@/features/Credibility/hooks/useCredibilityFlow';
import CredibilityActionDialog from '@/features/Credibility/components/ui/CredibilityActionDialog';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

// ============================================================
// TYPES
// ============================================================

interface VersionDetailPageProps {
  record: FileObject;
  version: RecordVersion;
  credibilityStats?: CredibilityStats | null;
  onBack: () => void;
}

interface ReactionStatsWithUser {
  supports: number;
  opposes: number;
  userReaction: ReactionType;
}

// ============================================================
// COMPONENT
// ============================================================

export const VersionDetailPage: React.FC<VersionDetailPageProps> = ({
  record,
  version,
  credibilityStats,
  onBack,
}) => {
  const { user } = useAuth();
  const recordId = record.firestoreId || record.id;
  const recordHash = version.recordHash;

  // Verification state
  const [verifications, setVerifications] = useState<VerificationWithVersion[]>([]);
  const [loadingVerifications, setLoadingVerifications] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<VerificationWithVersion | null>(
    null
  );
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

  // Dispute state
  const [disputes, setDisputes] = useState<DisputeWithVersion[]>([]);
  const [loadingDisputes, setLoadingDisputes] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<DisputeWithVersion | null>(null);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [reactionStats, setReactionStats] = useState<Record<string, ReactionStatsWithUser>>({});
  const [reactingDisputes, setReactingDisputes] = useState<Set<string>>(new Set());

  // User profiles
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());

  // Credibility flow hook for actions (verify, dispute, react, etc.)
  const {
    dialogProps,
    verification: userVerification,
    dispute: userDispute,
    initiateVerification,
    initiateRetractVerification,
    initiateModifyVerification,
    initiateDispute,
    initiateRetractDispute,
    initiateModifyDispute,
    initiateReaction,
    isLoading,
    refetch,
  } = useCredibilityFlow({
    recordId,
    recordHash,
    onSuccess: handleOperationSuccess,
  });

  // ============================================================
  // DATA FETCHING
  // ============================================================

  async function handleOperationSuccess() {
    await refetch();
    await fetchVerifications();
    await fetchDisputes();
  }

  const getReactionType = (value: boolean | null | undefined): ReactionType => {
    if (value === true) return 'support';
    if (value === false) return 'oppose';
    return null;
  };

  const fetchVerifications = async () => {
    if (!recordId) return;

    setLoadingVerifications(true);
    try {
      const allVerifications = await getVerificationsByRecordId(recordId);

      // Filter to only this hash and add version info
      const filtered: VerificationWithVersion[] = allVerifications
        .filter(v => v.recordHash === recordHash)
        .map(v => ({
          ...v,
          versionNumber: version.versionNumber,
          totalVersions: 1, // We're showing just this version
        }));

      // Sort: active first, then by createdAt
      filtered.sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });

      setVerifications(filtered);

      // Collect user IDs for profile fetching
      const userIds = filtered.map(v => v.verifierId);
      return userIds;
    } catch (error) {
      console.error('Error fetching verifications:', error);
      return [];
    } finally {
      setLoadingVerifications(false);
    }
  };

  const fetchDisputes = async () => {
    if (!recordId) return;

    setLoadingDisputes(true);
    try {
      const allDisputes = await getDisputesByRecordId(recordId);

      // Filter to only this hash and add version info
      const filtered: DisputeWithVersion[] = allDisputes
        .filter(d => d.recordHash === recordHash)
        .map(d => ({
          ...d,
          versionNumber: version.versionNumber,
          totalVersions: 1,
        }));

      // Sort: active first, then by createdAt
      filtered.sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });

      setDisputes(filtered);

      // Fetch reaction stats for each dispute
      const statsMap: Record<string, ReactionStatsWithUser> = {};
      await Promise.all(
        filtered.map(async d => {
          const stats = await getDisputeReactionStats(
            recordId,
            d.recordHash,
            d.disputerId,
            user?.uid
          );
          statsMap[`${d.recordHash}_${d.disputerId}`] = {
            supports: stats.supports ?? 0,
            opposes: stats.opposes ?? 0,
            userReaction: getReactionType(stats.userReaction),
          };
        })
      );
      setReactionStats(statsMap);

      // Collect user IDs for profile fetching
      const userIds = filtered.map(d => d.disputerId);
      return userIds;
    } catch (error) {
      console.error('Error fetching disputes:', error);
      return [];
    } finally {
      setLoadingDisputes(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const fetchAll = async () => {
      const [verifierIds, disputerIds] = await Promise.all([fetchVerifications(), fetchDisputes()]);

      // Fetch all user profiles
      const allUserIds = [...new Set([...(verifierIds || []), ...(disputerIds || [])])];
      if (allUserIds.length > 0) {
        const profiles = await getUserProfiles(allUserIds);
        setUserProfiles(profiles);
      }
    };

    fetchAll();
  }, [recordId, recordHash]);

  // ============================================================
  // HANDLERS
  // ============================================================

  // Verification handlers
  const handleVerificationClick = (verification: VerificationWithVersion) => {
    setSelectedVerification(verification);
    setIsVerificationModalOpen(true);
  };

  const handleCloseVerificationModal = () => {
    setIsVerificationModalOpen(false);
    setSelectedVerification(null);
  };

  // Dispute handlers
  const handleDisputeClick = (dispute: DisputeWithVersion) => {
    setSelectedDispute(dispute);
    setIsDisputeModalOpen(true);
  };

  const handleCloseDisputeModal = () => {
    setIsDisputeModalOpen(false);
    setSelectedDispute(null);
  };

  const handleReaction = async (dispute: DisputeWithVersion, support: boolean) => {
    const statsKey = `${dispute.recordHash}_${dispute.disputerId}`;
    const currentStats = reactionStats[statsKey] || { supports: 0, opposes: 0, userReaction: null };

    // Optimistic update
    const newStats = { ...currentStats };
    if (currentStats.userReaction === (support ? 'support' : 'oppose')) {
      // Toggle off
      if (support) {
        newStats.supports = Math.max(0, newStats.supports - 1);
      } else {
        newStats.opposes = Math.max(0, newStats.opposes - 1);
      }
      newStats.userReaction = null;
    } else if (currentStats.userReaction !== null) {
      // Switch reaction
      if (support) {
        newStats.supports += 1;
        newStats.opposes = Math.max(0, newStats.opposes - 1);
      } else {
        newStats.opposes += 1;
        newStats.supports = Math.max(0, newStats.supports - 1);
      }
      newStats.userReaction = support ? 'support' : 'oppose';
    } else {
      // New reaction
      if (support) {
        newStats.supports += 1;
      } else {
        newStats.opposes += 1;
      }
      newStats.userReaction = support ? 'support' : 'oppose';
    }

    setReactionStats(prev => ({ ...prev, [statsKey]: newStats }));
    setReactingDisputes(prev => new Set(prev).add(statsKey));

    try {
      await initiateReaction(dispute.recordHash, dispute.disputerId, support);
    } catch (error) {
      // Rollback on error
      setReactionStats(prev => ({ ...prev, [statsKey]: currentStats }));
    } finally {
      setReactingDisputes(prev => {
        const next = new Set(prev);
        next.delete(statsKey);
        return next;
      });
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  const activeVerifications = verifications.filter(v => v.isActive).length;
  const activeDisputes = disputes.filter(d => d.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-1">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Version {version.versionNumber} Details
          </h2>
        </div>
        <div>
          <Button
            className="text-primary w-8 h-8 border-none bg-transparent hover:bg-gray-200"
            size="sm"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Version Info Card */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-800">
                v{version.versionNumber}
              </span>
              {version.commitMessage && (
                <span className="text-sm font-medium">{version.commitMessage}</span>
              )}
            </div>
            <div className="text-xs text-gray-600 mb-2">
              <span className="font-medium">Record Hash:</span>{' '}
              <code className="bg-white px-1 py-0.5 rounded font-mono">{version.recordHash}</code>
            </div>
            <div className="text-xs text-left text-gray-500">
              Edited by {version.editedByName || 'Unknown'} •{' '}
              {formatTimestamp(version.editedAt, 'short') || 'Unknown time'} •{' '}
              {formatTimestamp(version.editedAt, 'relative')}
            </div>
          </div>
        </div>
      </div>

      {/* Verifications Section */}
      <div className="border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Verifications</h3>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
              {activeVerifications} active
            </span>
          </div>
        </div>

        <div className="p-4">
          {loadingVerifications ? (
            <div className="flex justify-center items-center py-8">
              <p className="text-gray-500">Loading verifications...</p>
            </div>
          ) : verifications.length > 0 ? (
            <div className="space-y-3">
              {verifications.map(verification => {
                const verifierProfile = userProfiles.get(verification.verifierId);
                const isInactive = !verification.isActive;

                return (
                  <VerificationUserCard
                    key={verification.id}
                    verification={verification}
                    userProfile={verifierProfile}
                    isInactive={isInactive}
                    onViewUser={() => {}}
                    onViewDetails={() => handleVerificationClick(verification)}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No verifications for this version</p>
          )}
        </div>
      </div>

      {/* Disputes Section */}
      <div className="border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Disputes</h3>
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {activeDisputes} active
            </span>
          </div>
        </div>

        <div className="p-4">
          {loadingDisputes ? (
            <div className="flex justify-center items-center py-8">
              <p className="text-gray-500">Loading disputes...</p>
            </div>
          ) : disputes.length > 0 ? (
            <div className="space-y-3">
              {disputes.map(dispute => {
                const disputerProfile = userProfiles.get(dispute.disputerId);
                const isInactive = !dispute.isActive;
                const statsKey = `${dispute.recordHash}_${dispute.disputerId}`;
                const stats = reactionStats[statsKey] || {
                  supports: 0,
                  opposes: 0,
                  userReaction: null,
                };
                const isReacting = reactingDisputes.has(statsKey);
                const isOwnDispute = user?.uid === dispute.disputerId;

                return (
                  <DisputeUserCard
                    key={dispute.id}
                    dispute={dispute}
                    userProfile={disputerProfile}
                    isInactive={isInactive}
                    onViewUser={() => {}}
                    onViewDetails={() => handleDisputeClick(dispute)}
                    reactionStats={stats}
                    onReact={support => handleReaction(dispute, support)}
                    isLoadingReaction={isReacting}
                    isOwnDispute={isOwnDispute}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No disputes for this version</p>
          )}
        </div>
      </div>

      {/* Verification Detail Modal */}
      {selectedVerification && (
        <VerificationDetailModal
          isOpen={isVerificationModalOpen}
          onClose={handleCloseVerificationModal}
          verification={selectedVerification}
          userProfile={userProfiles.get(selectedVerification.verifierId)}
          isOwnVerification={user?.uid === selectedVerification.verifierId}
          onModify={() => {
            handleCloseVerificationModal();
            // Could navigate to modify flow
          }}
          onRetract={() => {
            handleCloseVerificationModal();
            initiateRetractVerification(selectedVerification.recordHash);
          }}
        />
      )}

      {/* Dispute Detail Modal */}
      {selectedDispute && (
        <DisputeDetailModal
          isOpen={isDisputeModalOpen}
          onClose={handleCloseDisputeModal}
          dispute={selectedDispute}
          userProfile={userProfiles.get(selectedDispute.disputerId)}
          isOwnDispute={user?.uid === selectedDispute.disputerId}
          onModify={() => {
            handleCloseDisputeModal();
            // Could navigate to modify flow
          }}
          onRetract={() => {
            handleCloseDisputeModal();
            initiateRetractDispute(selectedDispute.recordHash);
          }}
          onReact={(disputerId, support) => {
            handleCloseDisputeModal();
            initiateReaction(selectedDispute.recordHash, disputerId, support);
          }}
          reactionStats={
            reactionStats[`${selectedDispute.recordHash}_${selectedDispute.disputerId}`] || {
              supports: 0,
              opposes: 0,
              userReaction: null,
            }
          }
          isLoadingStats={false}
        />
      )}

      {/* Credibility Action Dialog (for confirmations, etc.) */}
      <CredibilityActionDialog {...dialogProps} />
    </div>
  );
};

export default VersionDetailPage;
