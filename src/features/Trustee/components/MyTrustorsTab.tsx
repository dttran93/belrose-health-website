// src/features/Trustee/components/MyTrustorsTab.tsx
//
// Trustee's view: people who have appointed me as their trustee.
// Active trustors shown at top (accounts I manage), pending invites below.
// Active: resign via additionalItems in UserMenu.
// Pending: accept/decline via UserCard menuType="acceptOrCancel".

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Loader2, HelpCircle, Eye, ShieldAlert, LogOut } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { UserCard } from '@/features/Users/components/ui/UserCard';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { BelroseUserProfile } from '@/types/core';
import { TrustLevel } from '../services/trusteeRelationshipService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrusteeRelationshipRow {
  id: string;
  trustorId: string;
  trusteeId: string;
  trustLevel: TrustLevel;
  status: 'pending' | 'active' | 'revoked' | 'declined';
  isActive: boolean;
  createdAt: any;
}

// ─── Trust level badge ────────────────────────────────────────────────────────

const trustLevelConfig: Record<
  TrustLevel,
  { label: string; icon: React.ReactNode; color: string }
> = {
  observer: {
    label: 'Observer',
    icon: <Eye className="w-3 h-3" />,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  custodian: {
    label: 'Custodian',
    icon: <ShieldCheck className="w-3 h-3" />,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  controller: {
    label: 'Controller',
    icon: <ShieldAlert className="w-3 h-3" />,
    color: 'bg-red-100 text-red-700 border-red-200',
  },
};

const TrustLevelBadge: React.FC<{ level: TrustLevel }> = ({ level }) => {
  const config = trustLevelConfig[level];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${config.color}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const MyTrustorsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TrusteeRelationshipRow[]>([]);
  const [pending, setPending] = useState<TrusteeRelationshipRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchRelationships = useCallback(async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setLoading(true);
    try {
      const db = getFirestore();
      const q = query(
        collection(db, 'trusteeRelationships'),
        where('trusteeId', '==', currentUser.uid),
        where('status', 'in', ['active', 'pending'])
      );

      const snap = await getDocs(q);
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }) as TrusteeRelationshipRow);

      setActive(rows.filter(r => r.status === 'active'));
      setPending(rows.filter(r => r.status === 'pending'));

      const allIds = [...new Set(rows.map(r => r.trustorId))];
      if (allIds.length > 0) {
        const profileMap = await getUserProfiles(allIds);
        setProfiles(profileMap);
      }
    } catch (error) {
      console.error('Error fetching trustor relationships:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  // ── Handlers (stubs — modals come next) ───────────────────────────────────

  const handleAccept = (row: TrusteeRelationshipRow) => {
    // TODO: open AcceptTrusteeInviteModal (blockchain tx)
    console.log('Accept invite from', row.trustorId);
  };

  const handleDecline = (row: TrusteeRelationshipRow) => {
    // TODO: open DeclineTrusteeInviteModal
    console.log('Decline invite from', row.trustorId);
  };

  const handleResign = (row: TrusteeRelationshipRow) => {
    // TODO: open ResignAsTrusteeModal (blockchain tx)
    console.log('Resign from', row.trustorId);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Active — Accounts I Manage */}
      <div className="border border-accent rounded-lg">
        <div className="px-4 py-3 bg-accent flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">Accounts I Manage</span>
            {active.length > 0 && (
              <span className="text-xs border border-primary/40 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {active.length}
              </span>
            )}
          </div>
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button>
                  <HelpCircle className="w-4 h-4 text-gray-500" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
                  sideOffset={5}
                >
                  <p className="font-semibold mb-2 text-sm">Accounts you manage as a trustee:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>As Observer you can view their records</li>
                    <li>As Custodian you can manage records up to your own role level</li>
                    <li>As Controller you have full access on their behalf</li>
                    <li>You can resign at any time</li>
                  </ol>
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>

        <div className="p-4 bg-secondary space-y-2 rounded-b-lg">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : active.length > 0 ? (
            <div className="space-y-2">
              {active.map(row => (
                <UserCard
                  key={row.id}
                  user={profiles.get(row.trustorId) ?? null}
                  userId={row.trustorId}
                  color="primary"
                  showAffiliations={false}
                  content={<TrustLevelBadge level={row.trustLevel} />}
                  menuType="default"
                  additionalItems={[
                    {
                      key: 'resign',
                      label: 'Resign as Trustee',
                      icon: LogOut,
                      onClick: () => handleResign(row),
                      destructive: true,
                    },
                  ]}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm py-2">
              You are not currently managing any accounts
            </p>
          )}
        </div>
      </div>

      {/* Pending — Invites Received */}
      <div className="border border-gray-300 rounded-lg">
        <div className="px-4 py-3 bg-gray-200 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-gray-600" />
            <span className="font-semibold text-gray-700">Pending Invites</span>
            {pending.length > 0 && (
              <span className="text-xs border border-gray-500 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </div>
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <button>
                  <HelpCircle className="w-4 h-4 text-gray-500" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-white rounded-lg p-3 max-w-xs shadow-xl z-50"
                  sideOffset={5}
                >
                  <p className="text-xs">
                    Users who have invited you to be their trustee. Accepting requires a blockchain
                    transaction to confirm.
                  </p>
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>

        <div className="p-4 bg-gray-50 space-y-2 rounded-b-lg">
          {loading ? (
            <div className="flex justify-center items-center py-6">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <p className="text-gray-500 text-sm">Loading...</p>
            </div>
          ) : pending.length > 0 ? (
            <div className="space-y-2">
              {pending.map(row => (
                <UserCard
                  key={row.id}
                  user={profiles.get(row.trustorId) ?? null}
                  userId={row.trustorId}
                  color="primary"
                  showAffiliations={false}
                  content={<TrustLevelBadge level={row.trustLevel} />}
                  menuType="acceptOrCancel"
                  className="opacity-80"
                  onAccept={() => handleAccept(row)}
                  onCancel={() => handleDecline(row)}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-2">No pending invites</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyTrustorsTab;
