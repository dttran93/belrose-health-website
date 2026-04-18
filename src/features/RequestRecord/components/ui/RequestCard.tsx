// src/features/RequestRecord/components/ui/RequestCard.tsx

import { useEffect, useState } from 'react';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RequestNoteService } from '../../services/requestNoteService';
import { RecordRequest } from '@belrose/shared';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequestNote {
  practice?: string;
  provider?: string;
  dateOfBirth?: string;
  patientIdNumber?: string;
  dateRange?: { from?: string; to?: string };
  freeText?: string;
}

interface RequestCardProps {
  request: RecordRequest;
  isExpanded: boolean;
  onToggle: () => void;
  onCancel: (id: string) => Promise<void>;
  onResend: (id: string) => Promise<void>;
  onViewRecord: (recordIds: string[]) => void;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  pending_unread: {
    label: 'Not opened',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
  },
  pending_read: {
    label: 'Opened',
    dotClass: 'bg-blue-500',
    badgeClass: 'bg-blue-50 text-blue-800 border border-blue-200',
  },
  fulfilled: {
    label: 'Fulfilled',
    dotClass: 'bg-green-600',
    badgeClass: 'bg-green-50 text-green-800 border border-green-200',
  },
  cancelled: {
    label: 'Cancelled',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
  denied: {
    label: 'Denied',
    dotClass: 'bg-red-500',
    badgeClass: 'bg-red-50 text-red-800 border border-red-200',
  },
};

function getStatusKey(r: RecordRequest): string {
  if (r.status === 'fulfilled') return 'fulfilled';
  if (r.status === 'cancelled') return 'cancelled';
  if (r.status === 'denied') return 'denied';
  return r.readAt ? 'pending_read' : 'pending_unread';
}

// ── Component ─────────────────────────────────────────────────────────────────

const RequestCard: React.FC<RequestCardProps> = ({
  request,
  isExpanded,
  onToggle,
  onCancel,
  onResend,
  onViewRecord,
}) => {
  const [cancelling, setCancelling] = useState(false);
  const [resending, setResending] = useState(false);
  const [note, setNote] = useState<RequestNote | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [targetProfile, setTargetProfile] = useState<{
    displayName: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null>(null);

  useEffect(() => {
    if (!request.targetUserId) return;
    getDoc(doc(getFirestore(), 'users', request.targetUserId))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setTargetProfile({
            displayName: data.displayName,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
          });
        }
      })
      .catch(() => {}); // fail silently, fall back to email
  }, [request.targetUserId]);

  useEffect(() => {
    if (!isExpanded || note || noteLoading || !request.encryptedRequestNote) return;

    setNoteLoading(true);
    setNoteError(null);
    RequestNoteService.decryptAsRequester(request)
      .then(setNote)
      .catch(err => setNoteError(err.message ?? 'Failed to decrypt note.'))
      .finally(() => setNoteLoading(false));
  }, [isExpanded]);

  const statusKey = getStatusKey(request);
  const config = STATUS_CONFIG[statusKey];
  if (!config) throw new Error('Status Config Missing');

  const isPending = request.status === 'pending';
  const isFulfilled = request.status === 'fulfilled';
  const isDenied = request.status === 'denied';

  //Display info
  const displayDetail = targetProfile
    ? `${targetProfile.displayName} (${targetProfile.email})`
    : request.targetEmail;
  const initials =
    targetProfile?.firstName && targetProfile?.lastName
      ? `${targetProfile.firstName[0]}${targetProfile.lastName[0]}`.toUpperCase()
      : request.targetEmail.slice(0, 2).toUpperCase();

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCancelling(true);
    await onCancel(request.inviteCode);
    setCancelling(false);
  };

  const handleResend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setResending(true);
    await onResend(request.inviteCode);
    setResending(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{displayDetail}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Requested {formatTimestamp(request.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${config.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dotClass}`} />
              {config.label}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>

        {isPending && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${request.readAt ? 'w-2/3 bg-blue-400' : 'w-1/3 bg-amber-400'}`}
              />
            </div>
            <span className="text-xs text-slate-400 flex-shrink-0">
              {request.readAt ? 'Opened · awaiting upload' : 'Sent · not yet opened'}
            </span>
          </div>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          {/* Decrypted note */}
          {request.encryptedRequestNote && (
            <div className="bg-slate-50 border-l-4 border-slate-300 rounded-r-lg px-3 py-2.5">
              <p className="text-xs font-medium text-slate-500 mb-2">Request Notes</p>
              {noteLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Decrypting...
                </div>
              )}
              {noteError && <p className="text-xs text-red-500">{noteError}</p>}
              {note && (
                <div className="space-y-1.5 text-left">
                  {note.practice && <NoteRow label="Practice" value={note.practice} />}
                  {note.provider && <NoteRow label="Provider" value={note.provider} />}
                  {note.dateOfBirth && <NoteRow label="Date of Birth" value={note.dateOfBirth} />}
                  {note.patientIdNumber && (
                    <NoteRow label="ID number" value={note.patientIdNumber} />
                  )}
                  {note.dateRange && (
                    <NoteRow
                      label="Date range"
                      value={[note.dateRange.from, note.dateRange.to].filter(Boolean).join(' – ')}
                    />
                  )}
                  {note.freeText && <NoteRow label="Note" value={note.freeText} />}
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center w-4 pt-0.5">
              <TimelineDot done />
              <TimelineLine />
              <TimelineDot done={!!request.readAt} />
              <TimelineLine />
              <TimelineDot done={isFulfilled || isDenied} />
            </div>
            <div className="flex-1 space-y-5 pb-1">
              <TimelineStep
                label="Sent"
                detail={`${formatTimestamp(request.createdAt)} · Email delivered to ${request.targetEmail}`}
                done
              />
              <TimelineStep
                label="Opened"
                detail={
                  request.readAt
                    ? `${formatTimestamp(request.readAt)} · Provider viewed the link`
                    : 'Waiting for provider to open the link'
                }
                done={!!request.readAt}
              />
              <TimelineStep
                label={isFulfilled ? 'Fulfilled' : isDenied ? 'Denied' : 'Awaiting upload'}
                detail={
                  isFulfilled && request.fulfilledAt
                    ? `${formatTimestamp(request.fulfilledAt)} · Record uploaded and in your library`
                    : isDenied
                      ? `${formatTimestamp(request.deniedAt)} · Provider denied the request`
                      : 'Waiting for provider to upload records'
                }
                done={isFulfilled}
                note={request.deniedReason}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
            {isFulfilled && request.fulfilledRecordIds && request.fulfilledRecordIds.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Received Records
                </p>
                <div>
                  {request.fulfilledRecordIds.map((id, index) => (
                    <Button
                      key={id}
                      variant="secondary"
                      size="sm"
                      className="justify-between text-xs bg-slate-50 hover:bg-slate-100 border-slate-200 h-9 w-full"
                      onClick={() => onViewRecord([id])}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span className="truncate">Record {index + 1}</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {isPending && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={handleResend}
                  disabled={resending}
                >
                  {resending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Resend reminder
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleCancel}
                  disabled={cancelling}
                >
                  {cancelling ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Note row ──────────────────────────────────────────────────────────────────

const NoteRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline gap-2">
    <span className="text-xs text-slate-400 w-24 flex-shrink-0">{label}</span>
    <span className="text-sm text-slate-700">{value}</span>
  </div>
);

// ── Timeline ──────────────────────────────────────────────────────────────────

const TimelineDot: React.FC<{ done: boolean }> = ({ done }) => (
  <div
    className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-slate-700' : 'border border-slate-300 bg-white'}`}
  />
);

const TimelineLine: React.FC = () => (
  <div className="w-px bg-slate-200 my-1" style={{ flex: 1, minHeight: 20 }} />
);

const TimelineStep: React.FC<{
  label: string;
  detail: string;
  done: boolean;
  note?: string;
}> = ({ label, detail, done, note }) => (
  <div>
    <p className={`text-sm font-medium ${done ? 'text-slate-900' : 'text-slate-400'}`}>{label}</p>
    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{detail}</p>
    {note && <p className="text-xs text-red-400 mt-1 italic">"{note}"</p>}
  </div>
);

export default RequestCard;
