// src/features/Credibility/components/DisputeManagement.tsx

import React, { useState, useEffect } from 'react';
import { AlertTriangle, HelpCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { FileObject, BelroseUserProfile } from '@/types/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import UserCard, { BadgeConfig } from '@/features/Users/components/ui/UserCard';
import { buildHashVersionMap } from '../services/verificationService';
import {
  CULPABILITY_MAPPING,
  DisputeWithVersion,
  getDisputesByRecordId,
  SEVERITY_MAPPING,
} from '../services/disputeService';

interface DisputeManagementProps {
  record: FileObject;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
}

export const DisputeManagement: React.FC<DisputeManagementProps> = ({
  record,
  onBack,
  onAddMode,
  isAddMode,
}) => {
  const [loadingDisputes, setLoadingDisputes] = useState(true);
  const [disputes, setDisputes] = useState<DisputeWithVersion[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <p className="text-gray-600">No disputes filed</p>
              <Button onClick={onAddMode}>File a Dispute</Button>
            </div>
          )}
        </div>
      </div>
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
}

const DisputeCard: React.FC<DisputeCardProps> = ({ dispute, userProfile, isInactive }) => {
  const severityName = SEVERITY_MAPPING[dispute.severity];
  const culpabilityName = CULPABILITY_MAPPING[dispute.culpability];

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
      text: severityName,
      color: dispute.severity === 3 ? 'red' : dispute.severity === 2 ? 'yellow' : 'blue',
      tooltip: `Severity: ${severityName}`,
    },
    {
      text: culpabilityName,
      color: 'purple',
      tooltip: `Culpability: ${culpabilityName}`,
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
    <div className={isInactive ? 'opacity-50' : ''}>
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
      />
      {/* Show notes if present */}
      {dispute.notes && (
        <div className="ml-14 mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border-l-2 border-red-300">
          <span className="font-medium text-gray-500">Notes: </span>
          {dispute.notes}
        </div>
      )}
    </div>
  );
};

export default DisputeManagement;
