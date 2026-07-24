// src/features/Permissions/services/permissionsService.ts

import { encryptNotificationTitle } from '@/features/Notifications/services/encryptNotificationTitle';
import { removeUndefinedValues } from '@/utils/dataFormattingUtils';
import { BlockchainRef, PermissionChange } from '@belrose/shared';
import { id } from 'ethers';
import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';

async function writePermissionChangeEvent(
  recordId: string,
  changedBy: string,
  changes: PermissionChange[],
  // null when there's no new on-chain transaction to cite (e.g. the chain was already in the
  // target state from an earlier attempt — see TrusteeBlockchainService's self-heal paths) —
  // the record of who changed what and when is still worth keeping even without a tx to point to.
  blockchainRef: BlockchainRef | null,
  recordTitle?: string,
  context?: 'trustee_grant' | 'trustee_revoke' | 'direct',
  batchId?: string
): Promise<void> {
  try {
    const db = getFirestore();

    const titleData = recordTitle ? await encryptNotificationTitle(recordTitle, recordId) : null;
    const affectedUserIds = changes.map(c => c.userId);

    await addDoc(
      collection(db, 'records', recordId, 'permissionHistory'),
      removeUndefinedValues({
        recordId,
        recordIdHash: id(recordId),
        changedBy,
        changedByIdHash: id(changedBy),
        changedAt: serverTimestamp(),
        changes,
        blockchainRef,
        affectedUserIds,
        ...(titleData ?? {}),
        context,
        batchId,
      })
    );
  } catch (error) {
    // Non-fatal — don't block the permission change if logging fails
    console.warn('⚠️ Failed to write permission change event:', error);
  }
}

export default writePermissionChangeEvent;
