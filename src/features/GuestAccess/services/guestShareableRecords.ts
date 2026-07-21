//src/features/GuestAccess/services/guestShareableRecords.ts

import { db } from '@/firebase/config';
import { FileObject } from '@/types/core';
import { collection, getDocs, query, where } from 'firebase/firestore';

/**
 * Fetch all records the current user can guest-share — i.e. holds a RecordRole of sharer or
 * above on (owner/administrator/sharer; see permissions.ts's ROLE_HIERARCHY). Deliberately
 * excludes uploadedBy (upload-time defaults already add the uploader to administrators, so it's
 * not an independent permission tier) and subjects (record-is-about-them, not a granted role —
 * subject-driven actions go through SubjectConsentRequests/SubjectRemovalRequests instead).
 */
export async function getShareableRecords(userId: string): Promise<FileObject[]> {
  try {
    const recordsRef = collection(db, 'records');

    // Note: Firestore doesn't support OR queries directly, so we need multiple queries
    const queries = [
      query(recordsRef, where('owners', 'array-contains', userId)),
      query(recordsRef, where('administrators', 'array-contains', userId)),
      query(recordsRef, where('sharers', 'array-contains', userId)),
    ];

    const snapshots = await Promise.all(queries.map(q => getDocs(q)));

    // Combine and deduplicate results
    const recordsMap = new Map<string, FileObject>();

    snapshots.forEach(snapshot => {
      snapshot.forEach(doc => {
        if (!recordsMap.has(doc.id)) {
          recordsMap.set(doc.id, {
            id: doc.id,
            ...doc.data(),
          } as FileObject);
        }
      });
    });

    return Array.from(recordsMap.values());
  } catch (error) {
    console.error('Error fetching accessible records:', error);
    throw error;
  }
}
