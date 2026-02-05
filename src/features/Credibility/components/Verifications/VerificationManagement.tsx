// src/features/Credibility/components/VerificationManagement.tsx

/**
 * Component for managing all the verifications on a recordId
 * including verifications across different hashes and made by different users
 *
 * This is in contrast to the Verification Form which contains details on the specific
 * user's review and options to create Verifications.
 *
 * Management View includes modal to see further details on each verification.
 */

import React, { useState, useEffect } from 'react';
import { HelpCircle, Plus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { FileObject, BelroseUserProfile } from '@/types/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useAuth } from '@/features/Auth/hooks/useAuth';
import { getVerificationsByRecordId, VerificationDoc } from '../../services/verificationService';
import VerificationDetailModal from './VerificationDetailModal';
import VerificationUserCard from './VerificationUserCard';

interface VerificationManagementProps {
  record: FileObject;
  onBack?: () => void;
  onAddMode?: () => void;
  isAddMode?: boolean;
  onModify?: () => void;
  onRetract?: (verification: VerificationDoc) => void;
}

export const VerificationManagement: React.FC<VerificationManagementProps> = ({
  record,
  onBack,
  onAddMode,
  isAddMode,
  onModify,
  onRetract,
}) => {
  const { user } = useAuth();
  const [loadingVerifications, setLoadingVerifications] = useState(true);
  const [verifications, setVerifications] = useState<VerificationDoc[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal state
  const [selectedVerification, setSelectedVerification] = useState<VerificationDoc | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch verifications and user profiles
  useEffect(() => {
    const fetchVerifications = async () => {
      const recordId = record.firestoreId || record.id;
      if (!recordId) return;

      setLoadingVerifications(true);
      try {
        // 1. Fetch all verifications for this record
        const allVerifications = await getVerificationsByRecordId(recordId);

        // 2. Sort: active first, then by whether it matches current hash, then by createdAt
        const sortedVerifications = [...allVerifications].sort((a, b) => {
          // Active verifications first
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          // Current hash verifications first
          const aIsCurrent = a.recordHash === record.recordHash;
          const bIsCurrent = b.recordHash === record.recordHash;
          if (aIsCurrent !== bIsCurrent) return aIsCurrent ? -1 : 1;
          // Then by creation date (newest first)
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        });

        setVerifications(sortedVerifications);

        // 3. Get unique verifier IDs and fetch their profiles
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

  // Handlers
  const handleCardClick = (verification: VerificationDoc) => {
    setSelectedVerification(verification);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedVerification(null);
  };

  const handleModify = () => {
    if (selectedVerification && onModify) {
      handleCloseModal();
      onModify();
    }
  };

  const handleRetract = () => {
    if (selectedVerification && onRetract) {
      handleCloseModal();
      onRetract(selectedVerification);
    }
  };

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
            <span className="text-xs border border-complement-3 bg-complement-3/20 text-complement-3 px-2 py-1 rounded-full">
              {activeCount} active
            </span>
          </div>

          {!isAddMode && (
            <div className="flex items-center gap-2">
              <Tooltip.Provider>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <div className="bg-complement-3/30 border border-complement-3 text-complement-3 rounded-full text-xs p-1 gap-1">
                      <button className="inline-flex items-center ml-1">
                        Verifications <HelpCircle className="w-4 h-4 ml-1 text-complement-3" />
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
                  <VerificationUserCard
                    key={verification.id}
                    verification={verification}
                    userProfile={verifierProfile}
                    isInactive={isInactive}
                    currentRecordHash={record.recordHash}
                    onViewUser={() => {}}
                    onViewDetails={() => handleCardClick(verification)}
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

      {/* Detail Modal */}
      {selectedVerification && (
        <VerificationDetailModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          verification={selectedVerification}
          record={record}
          userProfile={userProfiles.get(selectedVerification.verifierId)}
          isOwnVerification={user?.uid === selectedVerification.verifierId}
          onModify={handleModify}
          onRetract={handleRetract}
        />
      )}
    </div>
  );
};

export default VerificationManagement;
