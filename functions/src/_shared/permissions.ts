// src/_shared/permissions.ts

import { BlockchainRef } from './blockchainAddresses';
import { TimestampLike } from './timestamp';

export type PermissionAction = 'granted' | 'revoked' | 'upgraded' | 'downgraded';
export type RecordRole = 'owner' | 'administrator' | 'viewer';

export type PermissionChange =
  | { action: 'granted'; userId: string; previousRole: null; newRole: RecordRole }
  | { action: 'upgraded'; userId: string; previousRole: RecordRole; newRole: RecordRole }
  | { action: 'downgraded'; userId: string; previousRole: RecordRole; newRole: RecordRole }
  | { action: 'revoked'; userId: string; previousRole: RecordRole; newRole: null };

export interface PermissionChangeEvent {
  recordId: string;
  encryptedRecordTitle?: string;
  encryptedRecordTitleIv?: string;
  changedBy: string;
  changedAt: TimestampLike;
  changes: PermissionChange[];
  blockchainRef: BlockchainRef;
  context?: 'trustee_grant' | 'trustee_revoke' | 'direct';
  batchId?: string;
}
