// src/features/HealthProfile/components/identity/IdentityTab.tsx

import React, { useState } from 'react';
import { Edit2, IdCard } from 'lucide-react';
import { UserIdentity } from '../../utils/parseUserIdentity';
import { UserIdentityForm } from './UserIdentityForm';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { FileObject } from '@/types/core';
import { useSubjectFlow } from '@/features/Subject/hooks/useSubjectFlow';
import SubjectActionDialog from '@/features/Subject/components/ui/SubjectActionDialog';

interface IdentityTabProps {
  userId: string;
  userIdentity: UserIdentity | null;
  hasIdentityRecord: boolean;
  isOwnProfile: boolean;
  onSaved?: () => void;
}

// Simple key/value row for the read view
const DetailRow: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-4 py-2.5 border-b border-border/40 last:border-0">
      <dt className="text-xs font-medium text-muted-foreground w-36 flex-shrink-0">{label}</dt>
      <dd className="text-sm text-card-foreground">{value}</dd>
    </div>
  );
};

export const IdentityTab: React.FC<IdentityTabProps> = ({
  userId,
  userIdentity,
  hasIdentityRecord,
  isOwnProfile,
  onSaved,
}) => {
  const [editing, setEditing] = useState(!hasIdentityRecord && isOwnProfile);
  const [savedRecord, setSavedRecord] = useState<FileObject | null>(null);

  // Update useSubjectFlow — only active once we have a record
  const subjectFlow = useSubjectFlow({
    record: savedRecord ?? ({} as FileObject), // fallback to empty object when no record yet
    onSuccess: () => {
      setSavedRecord(null); // close dialog after anchoring
      onSaved?.();
    },
  });

  const handleSaved = (record: FileObject) => {
    setEditing(false);

    // Only prompt blockchain anchoring on first save (not edits)
    if (!hasIdentityRecord) {
      setSavedRecord(record);
      subjectFlow.initiateAddSubject?.(); // opens the dialog at 'selecting' phase
    } else {
      onSaved?.();
    }
  };

  // ── Empty state for non-owners ─────────────────────────────────────────────
  if (!hasIdentityRecord && !isOwnProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
          <IdCard className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          No identity information has been shared for this profile.
        </p>
      </div>
    );
  }

  // ── Edit form ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="max-w-2xl m-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col m-auto items-center">
            <h2 className="text-base font-semibold text-card-foreground">
              {hasIdentityRecord ? 'Edit Identity' : 'Set Up Your Identity'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              This is your authoritative identity record. It is encrypted and only shared with
              people you choose.
            </p>
          </div>
          {hasIdentityRecord && (
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:text-card-foreground transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
        <UserIdentityForm userId={userId} initial={userIdentity ?? {}} onSaved={handleSaved} />
      </div>
    );
  }

  // ── Read view ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-card-foreground">Identity</h2>
        {isOwnProfile && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-card-foreground transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Core Identity
          </p>
        </div>
        <dl className="px-4">
          <DetailRow label="Full Name" value={userIdentity?.fullName} />
          <DetailRow
            label="Date of Birth"
            value={
              userIdentity?.dateOfBirth
                ? `${formatTimestamp(userIdentity.dateOfBirth, 'date-short')}`
                : undefined
            }
          />
          <DetailRow label="Gender" value={userIdentity?.gender} />
        </dl>

        <div className="px-4 py-3 border-t border-b border-border bg-muted/30 mt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Location
          </p>
        </div>
        <dl className="px-4">
          <DetailRow label="Address" value={userIdentity?.address} />
          <DetailRow label="City" value={userIdentity?.city} />
          <DetailRow label="Country" value={userIdentity?.country} />
        </dl>

        <div className="px-4 py-3 border-t border-b border-border bg-muted/30 mt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Contact
          </p>
        </div>
        <dl className="px-4">
          <DetailRow label="Phone" value={userIdentity?.phone} />
          <DetailRow label="Email" value={userIdentity?.email} />
          <DetailRow label="Emergency Contact" value={userIdentity?.emergencyContact} />
        </dl>

        <div className="px-4 py-3 border-t border-b border-border bg-muted/30 mt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Additional Context
          </p>
        </div>
        <dl className="px-4 pb-2">
          <DetailRow label="Marital Status" value={userIdentity?.maritalStatus} />
          <DetailRow label="Occupation" value={userIdentity?.occupation} />
          <DetailRow label="Languages" value={userIdentity?.languages?.join(', ')} />
        </dl>
      </div>

      {savedRecord && <SubjectActionDialog {...subjectFlow.dialogProps} />}
    </div>
  );
};
