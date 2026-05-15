// src/features/Permissions/services/permissionsService.ts

import { encryptNotificationTitle } from '@/features/Notifications/services/encryptNotificationTitle';
import { removeUndefinedValues } from '@/utils/dataFormattingUtils';
import { BlockchainRef, PermissionChange } from '@belrose/shared';
import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';

async function writePermissionChangeEvent(
  recordId: string,
  changedBy: string,
  changes: PermissionChange[],
  blockchainRef: BlockchainRef,
  recordTitle?: string,
  context?: 'trustee_grant' | 'trustee_revoke' | 'direct',
  batchId?: string
): Promise<void> {
  try {
    const db = getFirestore();

    // Encrypt the title client-side if available
    const titleData = recordTitle ? await encryptNotificationTitle(recordTitle, recordId) : null;

    await addDoc(
      collection(db, 'permissionChangeEvents'),
      removeUndefinedValues({
        recordId,
        changedBy,
        changedAt: serverTimestamp(),
        changes,
        blockchainRef,
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
