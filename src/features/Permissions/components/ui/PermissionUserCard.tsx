// src/features/Permissions/components/ui/PermissionUserCard.tsx

import React, { useState } from 'react';
import UserCard from '@/features/Users/components/ui/UserCard';
import { UserBadge } from '@/features/Users/components/ui/UserBadge';
import { BelroseUserProfile, FileObject } from '@/types/core';
import { TrusteeEntry } from '@/features/Trustee/hooks/useRecordTrustees';
import * as Tooltip from '@radix-ui/react-tooltip';
import { AlertCircle, ChevronDown, ChevronUp, ShieldCheck, ShieldOff } from 'lucide-react';
import { TrustLevel } from '@/features/Trustee/services/trusteeRelationshipService';

// ============================================================================
// TRUST LEVEL CONFIG
// ============================================================================

const TRUST_LEVEL_CONFIG: Record<TrustLevel, { label: string; badgeClass: string }> = {
  observer: { label: 'Observer', badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-400' },
  custodian: { label: 'Custodian', badgeClass: 'bg-blue-100 text-blue-800 border-blue-400' },
  controller: { label: 'Controller', badgeClass: 'bg-red-100 text-red-800 border-red-400' },
};

// ============================================================================
// HELPERS
// ============================================================================

function hasTrusteeRecordAccess(trusteeId: string, record: FileObject): boolean {
  return (
    record.owners?.includes(trusteeId) ||
    record.administrators?.includes(trusteeId) ||
    record.viewers?.includes(trusteeId) ||
    false
  );
}

// ============================================================================
// TRUSTEE MINI CARD (inside the expand panel)
// ============================================================================

interface TrusteeMiniCardProps {
  entry: TrusteeEntry;
  record: FileObject;
}

const TrusteeMiniCard: React.FC<TrusteeMiniCardProps> = ({ entry, record }) => {
  const config = TRUST_LEVEL_CONFIG[entry.trustLevel];
  const profile = entry.trusteeProfile;
  const displayName = profile?.displayName ?? profile?.email ?? entry.trusteeId;
  const hasAccess = hasTrusteeRecordAccess(entry.trusteeId, record);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
        hasAccess ? 'bg-white border-blue-100' : 'bg-amber-50 border-amber-200'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
          hasAccess ? 'bg-teal-500' : 'bg-amber-400'
        }`}
      >
        {displayName.slice(0, 2).toUpperCase()}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate ${!hasAccess ? 'text-amber-900' : ''}`}>
          {displayName}
        </p>
        {profile?.email && <p className="text-xs text-gray-400 truncate">{profile.email}</p>}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {!hasAccess && (
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-400">
                  <ShieldOff className="w-3 h-3" />
                  Access Missing
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-white rounded-lg px-3 py-2 text-xs max-w-xs shadow-xl z-50"
                  sideOffset={5}
                >
                  This trustee relationship is active but access to this specific record is missing.
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        )}
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
            hasAccess ? config.badgeClass : 'bg-gray-100 text-gray-500 border-gray-300'
          }`}
        >
          {config.label}
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface PermissionUserCardProps {
  userId: string;
  userProfile: BelroseUserProfile | undefined;
  record: FileObject;
  color: 'blue' | 'red' | 'yellow' | 'green';
  onDelete?: () => void;
  onCancel?: () => void;
  menuType?: 'default' | 'cancel';
  trusteeEntry?: TrusteeEntry;
  trusteeList?: TrusteeEntry[];
}

export const PermissionUserCard: React.FC<PermissionUserCardProps> = ({
  userId,
  userProfile,
  record,
  color,
  onDelete,
  onCancel,
  menuType = 'default',
  trusteeEntry,
  trusteeList = [],
}) => {
  const [expanded, setExpanded] = useState(false);

  const isTrustee = !!trusteeEntry;
  const hasTrustees = trusteeList.length > 0;

  // Count how many trustees in the list are missing record access — used in the toggle badge
  const missingAccessCount = trusteeList.filter(
    e => !hasTrusteeRecordAccess(e.trusteeId, record)
  ).length;

  // ── Content slot: identity badges + trustee shield badge ──────────────────

  const renderAccessContent = () => {
    const isCreator = record.uploadedBy === userId;
    const isSubject = record.subjects?.includes(userId);
    const trustorName =
      trusteeEntry?.trustorProfile?.displayName ??
      trusteeEntry?.trustorProfile?.email ??
      trusteeEntry?.trustorId ??
      '';
    const trustLevelLabel = trusteeEntry ? TRUST_LEVEL_CONFIG[trusteeEntry.trustLevel].label : '';

    return (
      <div className="flex flex-wrap items-center gap-2">
        {isCreator && (
          <UserBadge text="Creator" color="purple" tooltip="Original uploader of this record" />
        )}
        {isSubject && (
          <UserBadge text="Subject" color="pink" tooltip="This record is about this user" />
        )}

        {/* Shield badge — only shown when this card is a trustee */}
        {isTrustee && (
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border bg-complement-3/50 text-primary border-complement-3">
                  <ShieldCheck className="w-3 h-3" />
                  Trustee
                </span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="bg-gray-900 text-white rounded-lg px-3 py-2 text-xs max-w-xs shadow-xl z-50"
                  sideOffset={5}
                >
                  Trustee of <span className="font-semibold">{trustorName}</span>
                  {' · '}
                  {trustLevelLabel} level
                  <Tooltip.Arrow className="fill-gray-900" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        )}

        {/* Expand toggle — only shown when this card is a trustor */}
        {hasTrustees && (
          <button
            onClick={e => {
              e.stopPropagation();
              setExpanded(prev => !prev);
            }}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border transition-colors ${
              missingAccessCount > 0
                ? 'bg-amber-100 text-amber-800 border-amber-400 hover:bg-amber-200'
                : 'bg-complement-3/50 text-primary border-complement-3 hover:bg-complement-3/30'
            }`}
          >
            {missingAccessCount > 0 ? (
              <AlertCircle className="w-3 h-3" />
            ) : (
              <ShieldCheck className="w-3 h-3" />
            )}
            {trusteeList.length} {trusteeList.length === 1 ? 'Trustee' : 'Trustees'}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`rounded-lg ${isTrustee ? 'bg-complement-3/30' : ''}`}>
      <UserCard
        user={userProfile}
        userId={userId}
        variant="default"
        color={color}
        content={renderAccessContent()}
        onDelete={onDelete}
        onCancel={onCancel}
        menuType={menuType}
        onViewUser={() => {}}
      />

      {/* Expand panel — trustees of this trustor */}
      {hasTrustees && expanded && (
        <div className="bg-gray-50 px-3 py-2 space-y-2">
          <p className="text-xs font-semibold mb-1">Trustees (via {userProfile?.firstName}):</p>
          {trusteeList.map(entry => (
            <TrusteeMiniCard key={entry.trusteeId} entry={entry} record={record} />
          ))}
        </div>
      )}
    </div>
  );
};
