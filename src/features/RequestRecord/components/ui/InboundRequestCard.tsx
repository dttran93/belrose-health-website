// src/features/RecordRequest/components/InboundRequestCard.tsx

import { RecordRequest } from '../../services/fulfillRequestService';
import { formatTimestamp } from '@/utils/dataFormattingUtils';
import { ChevronDown, ChevronUp, FileText, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Timestamp } from 'firebase/firestore';
import { RequestNoteService } from '../../services/requestNoteService';
import { useEffect, useState } from 'react';
import { RequestNote } from '../Request/NewRequestForm';

interface InboundRequestCardProps {
  request: RecordRequest;
  onFulfill: (request: RecordRequest) => void;
}

function getDaysUntil(ts: Timestamp): number {
  const ms = ts.toMillis() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

const InboundRequestCard: React.FC<InboundRequestCardProps> = ({ request, onFulfill }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [note, setNote] = useState<RequestNote | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const isFulfilled = request.status === 'fulfilled';
  const daysLeft = request.deadline ? getDaysUntil(request.deadline) : null;
  const isUrgent = daysLeft !== null && daysLeft <= 7 && !isFulfilled;
  const isOverdue = daysLeft !== null && daysLeft < 0 && !isFulfilled;

  const initials = request.requesterName
    ? request.requesterName
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : request.requesterEmail.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!isExpanded || note || noteLoading || !request.encryptedRequestNote) return;

    setNoteLoading(true);
    setNoteError(null);

    console.log('🔐 Starting decryption...');
    RequestNoteService.decryptAsProvider(request)
      .then(result => {
        console.log('✅ Decrypt result:', result);
        setNote(result);
      })
      .catch(err => {
        console.error('❌ Decrypt error:', err);
        setNoteError(err.message ?? 'Failed to decrypt note.');
      })
      .finally(() => setNoteLoading(false));
  }, [isExpanded]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Urgency bar */}
      {!isFulfilled && daysLeft !== null && (
        <div
          className={`px-5 py-2 flex items-center justify-between ${
            isOverdue
              ? 'bg-red-50 border-b border-red-100'
              : isUrgent
                ? 'bg-amber-50 border-b border-amber-100'
                : 'bg-slate-50 border-b border-slate-100'
          }`}
        >
          <span
            className={`text-xs font-medium ${
              isOverdue ? 'text-red-700' : isUrgent ? 'text-amber-700' : 'text-slate-500'
            }`}
          >
            {isOverdue
              ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`
              : `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
          </span>
          <span
            className={`text-xs ${
              isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-slate-400'
            }`}
          >
            {request.deadline && formatTimestamp(request.deadline)}
          </span>
        </div>
      )}

      {/* Main row */}
      <div
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-xs font-semibold text-blue-700 flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{request.requesterName}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {request.requesterEmail} · Requested {formatTimestamp(request.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isFulfilled ? (
            <div className="flex items-center gap-1.5 text-green-700 text-xs font-medium">
              <FileText className="w-3.5 h-3.5" />
              Fulfilled
            </div>
          ) : (
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={e => {
                e.stopPropagation();
                onFulfill(request);
              }}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload records
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded section */}
      {isExpanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          {/* Patient note */}
          {request.encryptedRequestNote ? (
            <div className="bg-slate-50 border-l-4 border-slate-300 rounded-r-lg px-3 py-2.5">
              <p className="text-xs font-medium text-slate-500 mb-2">Patient note</p>
              {noteLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Decrypting...
                </div>
              )}
              {noteError && <p className="text-xs text-red-500">{noteError}</p>}
              {note && (
                <div className="space-y-1.5">
                  {note.practice && <NoteRow label="Practice" value={note.practice} />}
                  {note.provider && <NoteRow label="Provider" value={note.provider} />}
                  {note.dateOfBirth && <NoteRow label="Date of birth" value={note.dateOfBirth} />}
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
          ) : (
            <p className="text-xs text-slate-400">No additional note provided.</p>
          )}

          {/* Deadline detail */}
          {!isFulfilled && request.deadline && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Response deadline</span>
              <span
                className={`font-medium ${
                  isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-slate-700'
                }`}
              >
                {formatTimestamp(request.deadline)}
              </span>
            </div>
          )}

          {/* Upload CTA */}
          {!isFulfilled && (
            <div className="pt-2 border-t border-slate-100">
              <Button className="w-full gap-2 justify-center" onClick={() => onFulfill(request)}>
                <Upload className="w-4 h-4" />
                Upload records
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const NoteRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline gap-2">
    <span className="text-xs text-slate-400 w-24 flex-shrink-0">{label}</span>
    <span className="text-sm text-slate-700">{value}</span>
  </div>
);

export default InboundRequestCard;
