// src/features/Subject/components/ui/RequesterSuggestions.tsx

/**
 * RequesterSuggestions
 *
 * Shown in the SearchingContent phase of SubjectActionDialog.
 * Lists pending inbound record requests so the user can quickly select
 * the requester as the record subject — fulfilling the request in one flow.
 *
 * - Compact: name + relative time on one line, "show note" as a second text line
 * - Note is lazily decrypted only when the user expands it
 * - Hidden entirely if there are no pending requests
 */

import React, { useState } from 'react';
import { useInboundRequests } from '@/features/RequestRecord/hooks/usePendingInboundRequests';
import { RequestNoteService } from '@/features/RequestRecord/services/requestNoteService';
import { RequestNote } from '@/features/RequestRecord/components/Request/NewRequestForm';
import { BelroseUserProfile } from '@/types/core';
import { RecordRequest } from '@belrose/shared';
import { getUserProfiles } from '@/features/Users/services/userProfileService';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface RequesterSuggestionsProps {
  onSelectUser: (user: BelroseUserProfile) => void;
  excludeUserIds?: string[];
}

// ── Single suggestion row ─────────────────────────────────────────────────────

interface SuggestionRowProps {
  request: RecordRequest;
  profile: BelroseUserProfile;
  onSelect: (profile: BelroseUserProfile) => void;
}

function relativeTime(ts: { toMillis: () => number }): string {
  const diff = Date.now() - ts.toMillis();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

const SuggestionRow: React.FC<SuggestionRowProps> = ({ request, profile, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState<RequestNote | null>(null);
  const [loading, setLoading] = useState(false);

  const hasNote = !!request.encryptedRequestNote;

  const initials = profile.displayName
    ? profile.displayName
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : (profile.email?.slice(0, 2).toUpperCase() ?? '??');

  const handleToggleNote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (note || loading) return;
    setLoading(true);
    try {
      const decrypted = await RequestNoteService.decryptAsProvider(request);
      setNote(decrypted);
    } catch {
      // silently fail — note just won't show
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-blue-50 border border-blue-100 rounded-lg overflow-hidden">
      {/* Top Section: Identity & Action */}
      <div className="flex items-center px-3 py-2 gap-3">
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-medium text-blue-700 flex-shrink-0">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-900">{profile.displayName}</span>
            <span className="text-xs text-gray-400">· {relativeTime(request.createdAt)}</span>
          </div>

          {hasNote && (
            <button
              onClick={handleToggleNote}
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              {expanded ? 'hide note' : 'show note'}
            </button>
          )}
        </div>

        <button
          onClick={() => onSelect(profile)}
          className="text-xs text-blue-700 font-medium hover:text-blue-900 flex-shrink-0"
        >
          Select
        </button>
      </div>

      {/* Bottom Section: Expandable Note */}
      {expanded && (
        <div className="px-3 pb-3 ml-10 mr-3 border-t border-blue-100/50 pt-2">
          {loading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
          {note && !loading && (
            <div className="border-l-2 border-blue-200 pl-3 space-y-1">
              {note.practice && <NoteField label="Practice" value={note.practice} />}
              {note.provider && <NoteField label="Provider" value={note.provider} />}
              {note.dateOfBirth && <NoteField label="DOB" value={note.dateOfBirth} />}
              {note.patientIdNumber && <NoteField label="ID" value={note.patientIdNumber} />}
              {note.dateRange && (
                <NoteField
                  label="Dates"
                  value={[note.dateRange.from, note.dateRange.to].filter(Boolean).join(' – ')}
                />
              )}
              {note.freeText && <NoteField label="Note" value={note.freeText} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const NoteField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <p className="text-[11px] text-gray-500 leading-snug">
    <span className="text-gray-400">{label}: </span>
    {value}
  </p>
);

// ── Main component ────────────────────────────────────────────────────────────

const RequesterSuggestions: React.FC<RequesterSuggestionsProps> = ({
  onSelectUser,
  excludeUserIds = [],
}) => {
  const { requests, loading } = useInboundRequests();
  const [profiles, setProfiles] = useState<Map<string, BelroseUserProfile>>(new Map());

  const pendingWithUser = requests.filter(
    r => r.status === 'pending' && r.targetUserId && !excludeUserIds.includes(r.requesterId)
  );

  useEffect(() => {
    if (pendingWithUser.length === 0) return;
    const ids = pendingWithUser.map(r => r.requesterId).filter(Boolean);
    getUserProfiles(ids).then(setProfiles);
  }, [pendingWithUser.length]);

  if (loading || pendingWithUser.length === 0) return null;

  return (
    <div className="mb-3">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">
        Pending requests from
      </p>
      <div className="flex flex-col gap-1.5">
        {pendingWithUser.map(request => {
          const profile = profiles.get(request.requesterId);
          if (!profile) return null;
          return (
            <SuggestionRow
              key={request.inviteCode}
              request={request}
              profile={profile}
              onSelect={onSelectUser}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-3 mb-1">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-[11px] text-gray-300">or search</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
    </div>
  );
};

export default RequesterSuggestions;
