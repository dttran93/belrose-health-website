// src/features/Settings/components/GuestInvitesSettings.tsx

import React, { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { Loader2, Mail, UserRound } from 'lucide-react';
import { UserCard } from '@/features/Users/components/ui/UserCard';
import type { BelroseUserProfile } from '@/types/core';
import { formatTimestamp } from '@/utils/dataFormattingUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GuestInvite {
  id: string;
  guestEmail: string;
  guestUserId: string;
  context: 'sharing' | 'record_request';
  status: 'pending' | 'accepted';
  createdAt: Timestamp | null;
  expiresAt: Timestamp | null;
  recordIds: string[];
}

type ComputedStatus = 'accepted' | 'pending' | 'expired';

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeStatus(invite: GuestInvite): ComputedStatus {
  if (invite.status === 'accepted') return 'accepted';
  if (invite.expiresAt && invite.expiresAt.toDate() < new Date()) return 'expired';
  return 'pending';
}

function buildMockProfile(invite: GuestInvite): BelroseUserProfile {
  return {
    uid: invite.guestUserId,
    email: invite.guestEmail,
    displayName: invite.guestEmail,
  } as BelroseUserProfile;
}

// ── Badge components ──────────────────────────────────────────────────────────

const ContextBadge: React.FC<{ context: GuestInvite['context'] }> = ({ context }) =>
  context === 'record_request' ? (
    <span className="text-xs bg-complement-5/10 text-complement-5 border border-complement-5/30 px-2 py-0.5 rounded-full">
      Record request
    </span>
  ) : (
    <span className="text-xs bg-complement-2/10 text-complement-2 border border-complement-2/30 px-2 py-0.5 rounded-full">
      Shared records
    </span>
  );

const StatusBadge: React.FC<{ status: ComputedStatus }> = ({ status }) => {
  if (status === 'accepted')
    return (
      <span className="text-xs bg-complement-3/10 text-complement-3 border border-complement-3/30 px-2 py-0.5 rounded-full">
        Accepted
      </span>
    );
  if (status === 'expired')
    return (
      <span className="text-xs bg-gray-100 text-gray-500 border border-gray-300 px-2 py-0.5 rounded-full">
        Expired
      </span>
    );
  return (
    <span className="text-xs bg-complement-4/10 text-complement-4 border border-complement-4/30 px-2 py-0.5 rounded-full">
      Pending
    </span>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const GuestInvitesSettings: React.FC = () => {
  const [invites, setInvites] = useState<GuestInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return;

    const db = getFirestore();
    getDocs(
      query(
        collection(db, 'guestInvites'),
        where('invitedBy', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      )
    )
      .then(snap => {
        const docs = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            guestEmail: data.guestEmail ?? '',
            guestUserId: data.guestUserId ?? '',
            context: data.context ?? 'sharing',
            status: data.status ?? 'pending',
            createdAt: data.createdAt ?? null,
            expiresAt: data.expiresAt ?? null,
            recordIds: data.recordIds ?? [],
          } as GuestInvite;
        });
        setInvites(docs);
      })
      .catch(err => console.error('Failed to load guest invites:', err))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div className="flex flex-col items-center w-full">
          <h1 className="text-xl font-semibold text-gray-900">Guest Invites</h1>
          <p className="text-sm text-gray-500">
            People you've shared records with or sent record requests to via one-time invite links.
          </p>
        </div>
      </div>

      {/* Container */}
      <div className="border border-accent rounded-lg">
        <div className="px-4 py-3 bg-accent flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <UserRound className="w-5 h-5 text-gray-700" />
            <span className="font-semibold text-gray-900">Guest Invites</span>
            {invites.length > 0 && (
              <span className="text-xs border border-primary/40 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {invites.length}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 bg-secondary space-y-2 rounded-b-lg">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <p className="text-gray-500">Loading guest invites...</p>
            </div>
          ) : invites.length === 0 ? (
            <div className="py-8 text-center">
              <UserRound className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">No guest invites yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Invite someone to view records or submit a record request and they'll appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {invites.map(invite => {
                const computedStatus = computeStatus(invite);
                const recordCount = invite.recordIds.length;
                const metaLine = [
                  `Sent ${formatTimestamp(invite.createdAt, 'date-short')}`,
                  invite.expiresAt
                    ? `Expires ${formatTimestamp(invite.expiresAt, 'date-short')}`
                    : null,
                  recordCount > 0 ? `${recordCount} record${recordCount !== 1 ? 's' : ''}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <UserCard
                    key={invite.id}
                    user={buildMockProfile(invite)}
                    showAffiliations={false}
                    menuType="none"
                    color={invite.context === 'record_request' ? 'purple' : 'blue'}
                    content={
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5">
                          <ContextBadge context={invite.context} />
                          <StatusBadge status={computedStatus} />
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{metaLine}</span>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuestInvitesSettings;
