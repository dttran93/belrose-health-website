// src/features/Trustee/components/MyTrusteesTab.tsx
//
// Trustor's view: people I have invited or appointed as trustees.
// Active trustees shown at top, pending invites below.
// Actions (edit level, revoke, cancel invite) via UserMenu additionalItems.

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  UserPlus,
  Loader2,
  HelpCircle,
  Pencil,
  UserMinus,
  Eye,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
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

export const MyTrusteesTab: React.FC = () => {
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
        where('trustorId', '==', currentUser.uid),
        where('status', 'in', ['active', 'pending'])
      );

      const snap = await getDocs(q);
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }) as TrusteeRelationshipRow);

      setActive(rows.filter(r => r.status === 'active'));
      setPending(rows.filter(r => r.status === 'pending'));

      const allIds = [...new Set(rows.map(r => r.trusteeId))];
      if (allIds.length > 0) {
        const profileMap = await getUserProfiles(allIds);
        setProfiles(profileMap);
      }
    } catch (error) {
      console.error('Error fetching trustee relationships:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  // ── Handlers (stubs — modals come next) ───────────────────────────────────

  const handleEditLevel = (row: TrusteeRelationshipRow) => {
    // TODO: open EditTrustLevelModal
    console.log('Edit level for', row.trusteeId);
  };

  const handleRevoke = (row: TrusteeRelationshipRow) => {
    // TODO: open RevokeTrusteeModal
    console.log('Revoke', row.trusteeId);
  };

  const handleCancelInvite = (row: TrusteeRelationshipRow) => {
    // TODO: open CancelInviteModal
    console.log('Cancel invite for', row.trusteeId);
  };

  const handleInviteTrustee = () => {
    // TODO: open InviteTrusteeModal
    console.log('Invite trustee');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Active Trustees Section */}
      <div className="border border-accent rounded-lg">
        <div className="px-4 py-3 bg-accent flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">Active Trustees</span>
            {active.length > 0 && (
              <span className="text-xs border border-primary/40 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {active.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button className="inline-flex items-center">
                    <HelpCircle className="w-4 h-4 text-gray-500" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="bg-gray-900 text-white rounded-lg p-4 max-w-sm shadow-xl z-50"
                    sideOffset={5}
                  >
                    <p className="font-semibold mb-2 text-sm">Trustees act on your behalf:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Observers can view your records</li>
                      <li>Custodians can manage your records up to their own role level</li>
                      <li>Controllers have full access including ownership actions</li>
                    </ol>
                    <Tooltip.Arrow className="fill-gray-900" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
            <button
              onClick={handleInviteTrustee}
              className="rounded-full hover:bg-gray-300 p-1 transition-colors"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-secondary space-y-2 rounded-b-lg">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <p className="text-gray-500">Loading trustees...</p>
            </div>
          ) : active.length > 0 ? (
            <div className="space-y-2">
              {active.map(row => (
                <UserCard
                  key={row.id}
                  user={profiles.get(row.trusteeId) ?? null}
                  userId={row.trusteeId}
                  color="primary"
                  showAffiliations={false}
                  content={<TrustLevelBadge level={row.trustLevel} />}
                  menuType="default"
                  additionalItems={[
                    {
                      key: 'edit-level',
                      label: 'Edit Trust Level',
                      icon: Pencil,
                      onClick: () => handleEditLevel(row),
                    },
                    { type: 'divider', key: 'divider-trustee' },
                    {
                      key: 'revoke',
                      label: 'Revoke Trustee',
                      icon: UserMinus,
                      onClick: () => handleRevoke(row),
                      destructive: true,
                    },
                  ]}
                />
              ))}
            </div>
          ) : (
            <div className="flex justify-between items-center py-2">
              <p className="text-gray-500 text-sm">No active trustees</p>
              <button
                onClick={handleInviteTrustee}
                className="text-sm text-primary font-medium hover:underline"
              >
                Invite a trustee
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pending Invites Section */}
      <div className="border border-gray-300 rounded-lg">
        <div className="px-4 py-3 bg-gray-200 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-gray-600" />
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
                    Invites you've sent that haven't been accepted yet. You can cancel them at any
                    time.
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
                  user={profiles.get(row.trusteeId) ?? null}
                  userId={row.trusteeId}
                  color="primary"
                  showAffiliations={false}
                  content={<TrustLevelBadge level={row.trustLevel} />}
                  menuType="default"
                  className="opacity-75"
                  additionalItems={[
                    {
                      key: 'cancel-invite',
                      label: 'Cancel Invite',
                      icon: UserMinus,
                      onClick: () => handleCancelInvite(row),
                      destructive: true,
                    },
                  ]}
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

export default MyTrusteesTab;
