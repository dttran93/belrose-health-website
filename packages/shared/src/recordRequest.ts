import type { TimestampLike } from "./timestamp";

export interface RecordRequest {
  inviteCode: string;

  // Requester (the Belrose user who wants the records)
  requesterId: string;
  requesterEmail: string;
  requesterName: string;
  requesterPublicKey: string;

  // Target (the provider receiving the email)
  targetEmail: string;
  targetUserId: string | null;

  // Encrypted note — AES-256-GCM, key wrapped separately for each party
  encryptedRequestNote: string | null;
  encryptedNoteKeyForRequester: string | null;
  encryptedNoteKeyForProvider: string | null;
  encryptedNoteIv: string | null;

  // Lifecycle
  status: RecordRequestStatus;
  createdAt: TimestampLike;
  readAt: TimestampLike | null;
  lastRemindedAt: TimestampLike | null; // to prevent resend spam
  viewCount: number; //to track number of times opened
  deadline: TimestampLike;
  fulfilledRecordIds: string[];
  fulfilledAt?: TimestampLike;
  deniedAt?: TimestampLike;
  deniedReason?: DenyReasonValue;
  deniedNote?: string;
  cancelledAt?: TimestampLike;
}

export type RecordRequestStatus = 'pending' | 'fulfilled' | 'denied' | 'cancelled';

export const DENY_REASONS = [
  { value: 'wrong_recipient', label: 'Wrong recipient — I am not the stated provider' },
  { value: 'never_held', label: 'Never saw this patient, never held these records' },
  {
    value: 'retention_lapsed',
    label: 'Records were held but are no longer accessible',
  },
  {
    value: 'cannot_identify',
    label: 'I cannot confirm the identity of the patient and am withholding records',
  },
  { value: 'other', label: 'Other' },
] as const;

export type DenyReasonValue = (typeof DENY_REASONS)[number]['value'];