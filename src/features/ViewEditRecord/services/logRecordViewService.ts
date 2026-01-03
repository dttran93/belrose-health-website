import { getFirestore, collection, addDoc, serverTimestamp, FieldValue } from 'firebase/firestore';

// 1. Update the Interface
// In the client SDK, the type for a timestamp pending write is FieldValue
export interface RecordViewDoc {
  recordId: string;
  recordHash: string;
  viewerId: string;
  viewedAt: FieldValue;
  viewerRole: 'owner' | 'administrator' | 'viewer';
}

/**
 * Logs a record view
 */
export async function logRecordView(
  recordId: string,
  recordHash: string,
  viewerId: string,
  viewerRole: string
) {
  const db = getFirestore();

  try {
    // 2. Use addDoc and collection() helper functions
    await addDoc(collection(db, 'recordViews'), {
      recordId,
      recordHash,
      viewerId,
      viewerRole,
      viewedAt: serverTimestamp(), // Records the time based on Google's servers
    });
  } catch (error) {
    console.error('Error logging record view: ', error);
    throw error;
  }
}
