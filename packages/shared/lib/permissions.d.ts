import { BlockchainRef } from './blockchain';
import { TimestampLike } from './timestamp';
export type PermissionAction = 'granted' | 'revoked' | 'upgraded' | 'downgraded';
export type RecordRole = 'owner' | 'administrator' | 'viewer';
export interface PermissionChange {
    userId: string;
    action: PermissionAction;
    previousRole: RecordRole | null;
    newRole: RecordRole | null;
}
export interface PermissionChangeEvent {
    recordId: string;
    encryptedRecordTitle?: string;
    encryptedRecordTitleIv?: string;
    changedBy: string;
    changedAt: TimestampLike;
    changes: PermissionChange[];
    blockchainRef: BlockchainRef;
}
//# sourceMappingURL=permissions.d.ts.map