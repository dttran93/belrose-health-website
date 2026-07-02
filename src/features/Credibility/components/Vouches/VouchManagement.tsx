// src/features/Credibility/components/Vouches/VouchManagement.tsx

import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, ShieldOff, ShieldAlert, Loader2 } from 'lucide-react';
import { UserCard } from '@/features/Users/components/ui/UserCard';
import { VouchActionDialog } from './VouchActionDialog';
import { useVouchFlow } from '../../hooks/useVouchFlow';
import { getVouchesGiven, getVouchesReceived } from '../../services/vouchService';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { BelroseUserProfile } from '@/types/core';
import { VouchDoc } from '@belrose/shared';

// ============================================================================
// TYPES
// ============================================================================

interface VouchManagementProps {
  userId: string;
}

interface VouchWithProfile {
  vouch: VouchDoc;
  profile: BelroseUserProfile | null;
}

// ============================================================================
// VOUCH ROW (for given vouches — has rescind action)
// ============================================================================

const VouchGivenRow: React.FC<{
  vouchWithProfile: VouchWithProfile;
  onRetractSuccess: () => void;
}> = ({ vouchWithProfile, onRetractSuccess }) => {
  const { vouch, profile } = vouchWithProfile;
  const flow = useVouchFlow({
    targetUserId: vouch.voucheeId,
    targetDisplayName: profile?.displayName || vouch.voucheeId,
    onSuccess: onRetractSuccess,
  });

  const isRetracted = vouch.chainStatus === 'Retracted';

  return (
    <>
      <UserCard
        user={profile}
        userId={vouch.voucheeId}
        color={isRetracted ? 'red' : 'green'}
        showEmail={false}
        content={
          isRetracted ? (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <ShieldOff className="w-3 h-3" />
              Retracted
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-complement-3 font-medium">
              <ShieldCheck className="w-3 h-3" />
              Vouching
            </span>
          )
        }
        additionalItems={
          !isRetracted
            ? [
                {
                  key: 'retract-vouch',
                  label: 'Retract Vouch',
                  icon: ShieldOff,
                  onClick: flow.initiateRetract,
                  destructive: true,
                },
              ]
            : []
        }
      />
      <VouchActionDialog
        isOpen={flow.isDialogOpen}
        phase={flow.phase}
        operationType={flow.operationType}
        targetDisplayName={profile?.displayName || vouch.voucheeId}
        error={flow.error}
        onClose={flow.reset}
        onConfirmVouch={flow.confirmVouch}
        onConfirmRetract={flow.confirmRetract}
      />
    </>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const VouchManagement: React.FC<VouchManagementProps> = ({ userId }) => {
  const [givenVouches, setGivenVouches] = useState<VouchWithProfile[]>([]);
  const [receivedVouches, setReceivedVouches] = useState<VouchWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'given' | 'received'>('given');

  const loadVouches = useCallback(async () => {
    setIsLoading(true);
    try {
      const [given, received] = await Promise.all([
        getVouchesGiven(userId),
        getVouchesReceived(userId),
      ]);

      const givenIds = given.map(v => v.voucheeId);
      const receivedIds = received.map(v => v.voucherId);
      const allIds = [...new Set([...givenIds, ...receivedIds])];

      const profiles = allIds.length > 0 ? await getUserProfiles(allIds) : new Map();

      setGivenVouches(given.map(v => ({ vouch: v, profile: profiles.get(v.voucheeId) ?? null })));
      setReceivedVouches(
        received.map(v => ({ vouch: v, profile: profiles.get(v.voucherId) ?? null }))
      );
    } catch (error) {
      console.error('Error loading vouches:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadVouches();
  }, [loadVouches]);

  const activeGiven = givenVouches.filter(v => v.vouch.chainStatus === 'Active');
  const retractedGiven = givenVouches.filter(v => v.vouch.chainStatus === 'Retracted');
  const activeReceived = receivedVouches.filter(v => v.vouch.chainStatus === 'Active');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('given')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'given'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Vouches Given
          {activeGiven.length > 0 && (
            <span className="ml-2 bg-complement-3/20 text-complement-3 text-xs rounded-full px-2 py-0.5">
              {activeGiven.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('received')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'received'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Vouches Received
          {activeReceived.length > 0 && (
            <span className="ml-2 bg-complement-3/20 text-complement-3 text-xs rounded-full px-2 py-0.5">
              {activeReceived.length}
            </span>
          )}
        </button>
      </div>

      {/* Given tab */}
      {activeTab === 'given' && (
        <div className="space-y-6">
          {givenVouches.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="w-8 h-8 text-gray-300" />}
              message="You haven't vouched for anyone yet."
            />
          ) : (
            <>
              {activeGiven.length > 0 && (
                <Section title="Active">
                  {activeGiven.map(v => (
                    <VouchGivenRow
                      key={v.vouch.id}
                      vouchWithProfile={v}
                      onRetractSuccess={loadVouches}
                    />
                  ))}
                </Section>
              )}
              {retractedGiven.length > 0 && (
                <Section title="Retracted">
                  {retractedGiven.map(v => (
                    <VouchGivenRow
                      key={v.vouch.id}
                      vouchWithProfile={v}
                      onRetractSuccess={loadVouches}
                    />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      )}

      {/* Received tab */}
      {activeTab === 'received' && (
        <div className="space-y-4">
          {activeReceived.length === 0 ? (
            <EmptyState
              icon={<ShieldAlert className="w-8 h-8 text-gray-300" />}
              message="No one has vouched for you yet."
            />
          ) : (
            activeReceived.map(({ vouch, profile }) => (
              <UserCard
                key={vouch.id}
                user={profile}
                userId={vouch.voucherId}
                color="green"
                showEmail={false}
                content={
                  <span className="flex items-center gap-1 text-xs text-complement-3 font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    Vouched for you
                  </span>
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SMALL HELPERS
// ============================================================================

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
    {children}
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode; message: string }> = ({ icon, message }) => (
  <div className="flex flex-col items-center gap-3 py-10 text-gray-400">
    {icon}
    <p className="text-sm">{message}</p>
  </div>
);

export default VouchManagement;
