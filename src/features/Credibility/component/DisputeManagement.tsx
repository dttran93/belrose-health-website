// src/features/Credibility/components/DisputeManagement.tsx

import React, { useState, useEffect } from 'react';
import { AlertTriangle, HelpCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { FileObject, BelroseUserProfile } from '@/types/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import UserCard, { BadgeConfig } from '@/features/Users/components/ui/UserCard';
import { useAuth } from '@/features/Auth/hooks/useAuth';
import { buildHashVersionMap } from '../services/verificationService';
import {
  CULPABILITY_OPTIONS,
  DisputeWithVersion,
  getCulpabilityConfig,
  getDisputesByRecordId,
  getSeverityConfig,
  SEVERITY_OPTIONS,
} from '../services/disputeService';
import DisputeDetailModal from './ui/DisputeDetailModal';

interface DisputeManagementProps {
  record: FileObject;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
  onModify?: (dispute: DisputeWithVersion) => void;
  onRetract?: (dispute: DisputeWithVersion) => void;
  onReact?: (dispute: DisputeWithVersion, support: boolean) => void;
}

export const DisputeManagement: React.FC<DisputeManagementProps> = ({
  record,
  onBack,
  onAddMode,
  isAddMode,
  onModify,
  onRetract,
  onReact,
}) => {
  const { user } = useAuth();
  const [loadingDisputes, setLoadingDisputes] = useState(true);
  const [disputes, setDisputes] = useState<DisputeWithVersion[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal state
  const [selectedDispute, setSelectedDispute] = useState<DisputeWithVersion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch disputes and user profiles
  useEffect(() => {
    const fetchDisputes = async () => {
      const recordId = record.firestoreId || record.id;
      if (!recordId) return;

      setLoadingDisputes(true);
      try {
        // 1. Build hash-to-version map from record data
        const hashVersionMap = buildHashVersionMap(
          record.recordHash ?? undefined,
          record.previousRecordHash ?? undefined
        );

        // 2. Fetch all disputes for this record
        const allDisputes = await getDisputesByRecordId(recordId);

        // 3. Attach version info to each dispute
        const totalVersions = hashVersionMap.size;
        const disputesWithVersion: DisputeWithVersion[] = allDisputes.map(d => ({
          ...d,
          versionNumber: hashVersionMap.get(d.recordHash) ?? 0,
          totalVersions,
        }));

        // Sort: active first, then by version (newest first), then by createdAt
        disputesWithVersion.sort((a, b) => {
          // Active disputes first
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          // Then by version number (lower = newer)
          if (a.versionNumber !== b.versionNumber) return a.versionNumber - b.versionNumber;
          // Then by creation date (newest first)
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        });

        setDisputes(disputesWithVersion);

        // 4. Get unique disputer IDs and fetch their profiles
        const disputerIds = [...new Set(allDisputes.map(d => d.disputerId))];
        if (disputerIds.length > 0) {
          const profiles = await getUserProfiles(disputerIds);
          setUserProfiles(profiles);
        }
      } catch (error) {
        console.error('Error fetching disputes:', error);
      } finally {
        setLoadingDisputes(false);
      }
    };

    fetchDisputes();
  }, [record.firestoreId, record.id, record.recordHash, record.previousRecordHash, refreshTrigger]);

  // Handlers
  const handleCardClick = (dispute: DisputeWithVersion) => {
    setSelectedDispute(dispute);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDispute(null);
  };

  const handleModify = () => {
    if (selectedDispute && onModify) {
      handleCloseModal();
      onModify(selectedDispute);
    }
  };

  const handleRetract = () => {
    if (selectedDispute && onRetract) {
      handleCloseModal();
      onRetract(selectedDispute);
    }
  };

  const handleReact = (support: boolean) => {
    if (selectedDispute && onReact) {
      handleCloseModal();
      onReact(selectedDispute, support);
    }
  };

  // Count active disputes
  const activeCount = disputes.filter(d => d.isActive).length;

  return (
    <div>
      {/* Disputes Section */}
      <div className="mb-4 border border-gray-200 rounded-lg">
        {/* Header */}
        <div className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">Disputes</span>
            <span className="text-xs border border-red-500 bg-red-200 text-red-700 px-2 py-1 rounded-full">
              {activeCount} active
            </span>
          </div>

          {!isAddMode && (
            <div className="flex items-center gap-2">
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div className="bg-red-200 border border-red-700 text-red-700 rounded-full text-xs p-1 gap-1">
                      <button className="inline-flex items-center ml-1">
                        Disputes <HelpCircle className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
                      sideOffset={5}
                    >
                      <p className="font-semibold mb-2 text-sm">
                        Disputes flag concerns about the accuracy or authenticity of this record
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Disputes may be filed by anyone with access to the record</li>
                        <li>
                          Disputes are permanently stored on a secure digital network, but may be
                          modified or retracted
                        </li>
                        <li>
                          Each dispute includes severity (how serious) and culpability (who's
                          responsible)
                        </li>
                        <li>Others can react to disputes to support or oppose them</li>
                      </ol>
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>

              <button
                onClick={onAddMode}
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                aria-label="Add dispute"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 bg-white rounded-b-lg">
          {loadingDisputes ? (
            <div className="flex justify-center items-center py-8">
              <p className="text-gray-500">Loading disputes...</p>
            </div>
          ) : disputes.length > 0 ? (
            <div className="space-y-3">
              {disputes.map(dispute => {
                const disputerProfile = userProfiles.get(dispute.disputerId);
                const isInactive = !dispute.isActive;

                return (
                  <DisputeCard
                    key={dispute.id}
                    dispute={dispute}
                    userProfile={disputerProfile}
                    isInactive={isInactive}
                    onClick={() => handleCardClick(dispute)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <p className="text-gray-600">No disputes filed</p>
              <Button onClick={onAddMode} variant="outline" className="border-red-300 text-red-700">
                File a Dispute
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedDispute && (
        <DisputeDetailModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          dispute={selectedDispute}
          userProfile={userProfiles.get(selectedDispute.disputerId)}
          isOwnDispute={user?.uid === selectedDispute.disputerId}
          onModify={handleModify}
          onRetract={handleRetract}
          onReact={handleReact}
          // TODO: Fetch reaction stats
          // reactionStats={{ supports: 2, opposes: 1 }}
        />
      )}
    </div>
  );
};

// ============================================================
// DISPUTE CARD SUBCOMPONENT
// ============================================================

interface DisputeCardProps {
  dispute: DisputeWithVersion;
  userProfile: BelroseUserProfile | undefined;
  isInactive: boolean;
  onClick: () => void;
}

const DisputeCard: React.FC<DisputeCardProps> = ({ dispute, userProfile, isInactive, onClick }) => {
  const severityInfo = getSeverityConfig(dispute.severity);
  const culpabilityInfo = getCulpabilityConfig(dispute.culpability);

  if (!severityInfo || !culpabilityInfo) {
    throw new Error('Invalid severity or culpability level');
  }

  // Version badge - show "Current" for version 1, otherwise "v2", "v3", etc.
  const versionBadgeText = dispute.versionNumber === 1 ? 'Current' : `v${dispute.versionNumber}`;
  const versionBadgeColor = dispute.versionNumber === 1 ? 'green' : 'yellow';

  // Badge configs for the UserCard
  const badges: BadgeConfig[] = [
    {
      text: versionBadgeText,
      color: versionBadgeColor,
      tooltip:
        dispute.versionNumber === 1
          ? 'Disputed the current version'
          : `Disputed version ${dispute.versionNumber} of ${dispute.totalVersions}`,
    },
    {
      text: severityInfo.name,
      color: dispute.severity === 3 ? 'red' : dispute.severity === 2 ? 'yellow' : 'blue',
      tooltip: `Severity: ${severityInfo.name}`,
    },
    {
      text: culpabilityInfo.name,
      color: 'purple',
      tooltip: `Culpability: ${culpabilityInfo.name}`,
    },
  ];

  // Add status badge if inactive
  if (isInactive) {
    badges.push({
      text: 'Retracted',
      color: 'red',
      tooltip: 'This dispute has been retracted',
    });
  }

  // Chain status badge
  if (dispute.chainStatus === 'pending') {
    badges.push({
      text: 'Pending',
      color: 'yellow',
      tooltip: 'Awaiting blockchain confirmation',
    });
  } else if (dispute.chainStatus === 'failed') {
    badges.push({
      text: 'Failed',
      color: 'red',
      tooltip: 'Blockchain transaction failed',
    });
  }

  return (
    <div
      className={`cursor-pointer hover:bg-gray-50 rounded-lg transition-colors ${isInactive ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      <UserCard
        user={userProfile}
        userId={dispute.disputerId}
        variant="default"
        color={isInactive ? 'red' : 'yellow'}
        badges={badges}
        menuType="none"
        metadata={[
          {
            label: 'Filed',
            value: dispute.createdAt.toDate().toLocaleDateString(),
          },
        ]}
        onCardClick={onClick}
      />
    </div>
  );
};

export default DisputeManagement;
