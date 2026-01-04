// src/features/Credibility/components/VerificationManagement.tsx

import React, { useState, useEffect } from 'react';
import { HelpCircle, Plus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { FileObject, BelroseUserProfile } from '@/types/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import UserCard, { BadgeConfig } from '@/features/Users/components/ui/UserCard';
import {
  VerificationDoc,
  VerificationWithVersion,
  getVerificationsByRecordId,
  buildHashVersionMap,
  LEVEL_NAMES,
} from '../services/verificationService';

interface VerificationManagementProps {
  record: FileObject;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
}

export const VerificationManagement: React.FC<VerificationManagementProps> = ({
  record,
  onBack,
  onAddMode,
  isAddMode,
}) => {
  const [loadingVerifications, setLoadingVerifications] = useState(true);
  const [verifications, setVerifications] = useState<VerificationWithVersion[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch verifications and user profiles
  useEffect(() => {
    const fetchVerifications = async () => {
      const recordId = record.firestoreId || record.id;
      if (!recordId) return;

      setLoadingVerifications(true);
      try {
        // 1. Build hash-to-version map from record data
        const hashVersionMap = buildHashVersionMap(
          record.recordHash ?? undefined,
          record.previousRecordHash ?? undefined
        );

        // 2. Fetch all verifications for this record
        const allVerifications = await getVerificationsByRecordId(recordId);

        // 3. Attach version info to each verification
        const totalVersions = hashVersionMap.size;
        const verificationsWithVersion: VerificationWithVersion[] = allVerifications.map(v => ({
          ...v,
          versionNumber: hashVersionMap.get(v.recordHash) ?? 0,
          totalVersions,
        }));

        // Sort: active first, then by version (newest first), then by createdAt
        verificationsWithVersion.sort((a, b) => {
          // Active verifications first
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          // Then by version number (lower = newer)
          if (a.versionNumber !== b.versionNumber) return a.versionNumber - b.versionNumber;
          // Then by creation date (newest first)
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        });

        setVerifications(verificationsWithVersion);

        // 4. Get unique verifier IDs and fetch their profiles
        const verifierIds = [...new Set(allVerifications.map(v => v.verifierId))];
        if (verifierIds.length > 0) {
          const profiles = await getUserProfiles(verifierIds);
          setUserProfiles(profiles);
        }
      } catch (error) {
        console.error('Error fetching verifications:', error);
      } finally {
        setLoadingVerifications(false);
      }
    };

    fetchVerifications();
  }, [record.firestoreId, record.id, record.recordHash, record.previousRecordHash, refreshTrigger]);

  // Count active verifications
  const activeCount = verifications.filter(v => v.isActive).length;

  return (
    <div>
      {/* Verifications Section */}
      <div className="mb-4 border border-gray-200 rounded-lg">
        {/* Header */}
        <div className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">Verifications</span>
            <span className="text-xs border border-chart-3 bg-chart-3/20 text-chart-3 px-2 py-1 rounded-full">
              {activeCount} active
            </span>
          </div>

          {!isAddMode && (
            <div className="flex items-center gap-2">
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div className="bg-chart-3/30 border border-chart-3 text-chart-3 rounded-full text-xs p-1 gap-1">
                      <button className="inline-flex items-center ml-1">
                        Verifications <HelpCircle className="w-4 h-4 ml-1 text-chart-3" />
                      </button>
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
                      sideOffset={5}
                    >
                      <p className="font-semibold mb-2 text-sm">
                        Verifications represent the support of 2nd and 3rd parties for the content
                        or origin of this record
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Verifications may be given by anyone with access to the record</li>
                        <li>
                          Verifications are permanently stored on a secure digital network, but may
                          be modified or retracted
                        </li>
                        <li>
                          A record's credibility score is calculated based on the number and quality
                          of verifications and disputes
                        </li>
                      </ol>
                      <Tooltip.Arrow className="fill-gray-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>

              <button
                onClick={onAddMode}
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                aria-label="Add verification"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 bg-white rounded-b-lg">
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
                  <VerificationCard
                    key={verification.id}
                    verification={verification}
                    userProfile={verifierProfile}
                    isInactive={isInactive}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex justify-between items-center">
              <p className="text-gray-600">No verifications yet</p>
              <Button onClick={onAddMode}>Add a Verification</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// VERIFICATION CARD SUBCOMPONENT
// ============================================================

interface VerificationCardProps {
  verification: VerificationWithVersion;
  userProfile: BelroseUserProfile | undefined;
  isInactive: boolean;
}

const VerificationCard: React.FC<VerificationCardProps> = ({
  verification,
  userProfile,
  isInactive,
}) => {
  const levelName = LEVEL_NAMES[verification.level];
  const versionBadgeText =
    verification.versionNumber === 1 ? 'Current' : `v${verification.versionNumber}`;

  // Badge configs for the UserCard
  const badges: BadgeConfig[] = [
    {
      text: versionBadgeText,
      color: verification.versionNumber === 1 ? 'green' : 'yellow',
      tooltip: `Verified version ${verification.versionNumber} of ${verification.totalVersions}`,
    },
    {
      text: levelName,
      color: 'purple',
      tooltip: `Verification level: ${levelName}`,
    },
  ];

  // Add status badge if inactive
  if (isInactive) {
    badges.push({
      text: 'Retracted',
      color: 'red' as const,
      tooltip: 'This verification has been retracted',
    });
  }

  // Chain status badge
  if (verification.chainStatus === 'pending') {
    badges.push({
      text: 'Pending',
      color: 'yellow' as const,
      tooltip: 'Awaiting blockchain confirmation',
    });
  } else if (verification.chainStatus === 'failed') {
    badges.push({
      text: 'Failed',
      color: 'red' as const,
      tooltip: 'Blockchain transaction failed',
    });
  }

  return (
    <div className={isInactive ? 'opacity-50' : ''}>
      <UserCard
        user={userProfile}
        userId={verification.verifierId}
        variant="default"
        color={isInactive ? 'red' : 'green'}
        badges={badges}
        menuType="none"
        metadata={[
          {
            label: 'Verified',
            value: verification.createdAt.toDate().toLocaleDateString(),
          },
        ]}
      />
    </div>
  );
};

export default VerificationManagement;
