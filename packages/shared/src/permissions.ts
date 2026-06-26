// src/_shared/permissions.ts

import { BlockchainRef } from './blockchainAddresses';
import { TimestampLike } from './timestamp';

export type PermissionAction = 'granted' | 'revoked' | 'upgraded' | 'downgraded';
export type RecordRole = 'owner' | 'administrator' | 'sharer' | 'viewer';

export const ROLE_HIERARCHY: Record<RecordRole, number> = {
  viewer: 1,
  sharer: 2,
  administrator: 3,
  owner: 4,
};

export type PermissionChange =
  | { action: 'granted'; userId: string; previousRole: null; newRole: RecordRole }
  | { action: 'upgraded'; userId: string; previousRole: RecordRole; newRole: RecordRole }
  | { action: 'downgraded'; userId: string; previousRole: RecordRole; newRole: RecordRole }
  | { action: 'revoked'; userId: string; previousRole: RecordRole; newRole: null };

export interface PermissionChangeEvent {
  recordId: string;
  recordIdHash: string;
  encryptedRecordTitle?: string;
  encryptedRecordTitleIv?: string;
  changedBy: string;
  changedByIdHash: string;
  changedAt: TimestampLike;
  changes: PermissionChange[];
  affectedUserIds?: string[];
  blockchainRef: BlockchainRef;
  context?: 'trustee_grant' | 'trustee_revoke' | 'direct';
  batchId?: string;
}
