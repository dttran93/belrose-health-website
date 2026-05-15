// src/features/Permissions/services/permissionsService.ts

import { encryptNotificationTitle } from '@/features/Notifications/services/encryptNotificationTitle';
import { BlockchainRef, PermissionChange } from '@belrose/shared';
import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';

async function writePermissionChangeEvent(
  recordId: string,
  changedBy: string,
  changes: PermissionChange[],
  blockchainRef: BlockchainRef,
  recordTitle?: string
): Promise<void> {
  try {
    const db = getFirestore();

    // Encrypt the title client-side if available
    const titleData = recordTitle ? await encryptNotificationTitle(recordTitle, recordId) : null;

    await addDoc(collection(db, 'permissionChangeEvents'), {
      recordId,
      changedBy,
      changedAt: serverTimestamp(),
      changes,
      blockchainRef,
      ...(titleData ?? {}),
    });
  } catch (error) {
    // Non-fatal — don't block the permission change if logging fails
    console.warn('⚠️ Failed to write permission change event:', error);
  }
}

export default writePermissionChangeEvent;
