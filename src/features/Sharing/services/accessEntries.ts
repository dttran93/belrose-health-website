// src/features/Sharing/services/accessEntries.ts
//
// Pure derivation of per-user encryption-access status for EncryptionAccessView: cross-references
// a record's role arrays against its wrappedKeys docs to classify each user as synced/missing-key/
// missing-role/inactive. Extracted out of the component so it can be unit-tested directly, without
// mocking Firestore or user-profile lookups.

import { FileObject, BelroseUserProfile } from '@/types/core';

export interface WrappedKeyInfo {
  userId: string;
  recordId: string;
  isActive: boolean;
  isCreator: boolean;
  isGuest: boolean;
  createdAt: Date;
  revokedAt?: Date;
  reactivatedAt?: Date;
}

export interface AccessEntry {
  userId: string;
  profile: BelroseUserProfile | undefined;
  wrappedKey: WrappedKeyInfo | null;
  role: 'owner' | 'administrator' | 'sharer' | 'viewer' | 'none';
  status: 'synced' | 'missing-key' | 'missing-role' | 'inactive';
}

type RecordRoleArrays = Pick<FileObject, 'owners' | 'administrators' | 'sharers' | 'viewers' | 'subjects'>;

export function deriveAccessEntries(
  wrappedKeys: WrappedKeyInfo[],
  record: RecordRoleArrays,
  profiles: Map<string, BelroseUserProfile>
): AccessEntry[] {
  const allUserIds = new Set<string>([
    ...wrappedKeys.map(wk => wk.userId),
    ...(record.owners || []),
    ...(record.administrators || []),
    ...(record.sharers || []),
    ...(record.viewers || []),
    ...(record.subjects || []),
  ]);

  const entries: AccessEntry[] = Array.from(allUserIds).map(userId => {
    const wrappedKey = wrappedKeys.find(wk => wk.userId === userId) ?? null;

    let role: AccessEntry['role'] = 'none';
    if (record.owners?.includes(userId)) role = 'owner';
    else if (record.administrators?.includes(userId)) role = 'administrator';
    else if (record.sharers?.includes(userId)) role = 'sharer';
    else if (record.viewers?.includes(userId)) role = 'viewer';

    let status: AccessEntry['status'] = 'synced';
    if (wrappedKey && !wrappedKey.isActive) status = 'inactive';
    else if (wrappedKey && role === 'none') status = 'missing-role';
    else if (!wrappedKey && role !== 'none') status = 'missing-key';

    return { userId, profile: profiles.get(userId), wrappedKey, role, status };
  });

  // Non-synced entries (the ones needing attention) sort to the front.
  return entries.sort((a, b) => (a.status === 'synced' ? 1 : 0) - (b.status === 'synced' ? 1 : 0));
}
