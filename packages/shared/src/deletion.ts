import { TimestampLike } from './timestamp';

export interface RecordDeletionEvent {
  recordId: string;
  deletedBy: string;
  deletedAt: TimestampLike;
  affectedUsers: {
    owners: string[];
    administrators: string[];
    viewers: string[];
    sharers: string[];
    subjects: string[];
  };
  deletionComplete: boolean;
  chainCleanupStatus: string;
}
