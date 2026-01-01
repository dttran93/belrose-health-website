import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Firestore collection: recordViews
export interface RecordViewDoc {
  recordId: string;
  recordHash: string;
  viewerId: string;
  viewedAt: Timestamp;
  viewerRole: 'owner' | 'administrator' | 'viewer';
}

// When a provider views a record in your app:
export async function logRecordView(
  recordId: string,
  recordHash: string,
  viewerId: string,
  viewerRole: string
) {
  const db = getFirestore();
  await db.collection('recordViews').add({
    recordId,
    recordHash,
    viewerId,
    viewerRole,
    viewedAt: Timestamp.now(),
  });
}
