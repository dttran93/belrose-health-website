//src/features/GuestAccess/services/guestShareableRecords.ts

import { db } from '@/firebase/config';
import { FileObject } from '@/types/core';
import { collection, getDocs, query, where } from 'firebase/firestore';

/**
 * Fetch all records the current user has access to
 */
export async function getShareableRecords(userId: string): Promise<FileObject[]> {
  try {
    const recordsRef = collection(db, 'records');

    // Query for records where user is owner, viewer, or administrator
    // Note: Firestore doesn't support OR queries directly, so we need multiple queries
    const queries = [
      query(recordsRef, where('owners', 'array-contains', userId)),
      query(recordsRef, where('administrators', 'array-contains', userId)),
      query(recordsRef, where('subjects', 'array-contains', userId)),
      query(recordsRef, where('uploadedBy', '==', userId)),
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
