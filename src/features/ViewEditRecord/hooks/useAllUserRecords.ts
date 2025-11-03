// src/features/ViewEditRecord/hooks/useAllUserRecords.ts

import { useState, useEffect } from 'react';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  where,
  or,
} from 'firebase/firestore';
import { FileObject } from '@/types/core';
import mapFirestoreToFileObject from '@/features/ViewEditRecord/utils/firestoreMapping';

interface UseAllUserRecordsReturn {
  records: FileObject[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch all records accessible to the current user
 *
 * This includes:
 * - Records uploaded by the user (uploadedBy === userId)
 * - Records where the user is in the owners array
 * - Records where the user is the subject (subjectId === userId)
 *
 * Now queries from the GLOBAL 'records' collection instead of user-specific subcollections
 */
export const useAllUserRecords = (userId?: string): UseAllUserRecordsReturn => {
  const [records, setRecords] = useState<FileObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    console.log('🔍 Setting up real-time listener for records accessible to user:', userId);
    setLoading(true);
    setError(null);

    const db = getFirestore();

    // Query the GLOBAL records collection
    // Get records where the user is:
    // 1. The uploader (uploadedBy)
    // 2. In the owners array
    // 3. The subject (subjectId)
    const recordsRef = collection(db, 'records');

    const q = query(
      recordsRef,
      or(
        where('uploadedBy', '==', userId),
        where('owners', 'array-contains', userId),
        where('subjectId', '==', userId)
      ),
      orderBy('uploadedAt', 'desc')
    );

    console.log('📡 Query created for global records collection with composite ownership filter');

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        console.log(`📦 Received ${snapshot.docs.length} records from global collection`);

        const accessibleRecords: FileObject[] = snapshot.docs.map(doc => {
          const data = doc.data();

          // Log ownership info for debugging
          console.log(`📄 Record ${doc.id}:`, {
            fileName: data.fileName,
            uploadedBy: data.uploadedBy,
            owners: data.owners,
            subjectId: data.subjectId,
            userIsOwner: data.owners?.includes(userId),
            userIsSubject: data.subjectId === userId,
            userIsUploader: data.uploadedBy === userId,
          });

          // Use shared mapping function
          const mapped = mapFirestoreToFileObject(doc.id, data);

          // 🔍 DEBUG: Check if mapping preserves uploadedBy
          console.log(`🔍 Mapped record ${doc.id}:`, {
            hasUploadedBy: !!mapped.uploadedBy,
            uploadedByValue: mapped.uploadedBy,
            hasOwners: !!mapped.owners,
            ownersValue: mapped.owners,
          });

          return mapped;
        });

        // Additional filtering in memory (belt and suspenders approach)
        const filteredRecords = accessibleRecords.filter(record => {
          const hasAccess =
            record.uploadedBy === userId ||
            record.owners?.includes(userId) ||
            (record.subjectId && record.subjectId === userId); // Only check subjectId if it exists

          if (!hasAccess) {
            console.warn('⚠️ Record slipped through query filter:', record.id);
          }

          return hasAccess;
        });

        console.log(`✅ Processed ${filteredRecords.length} accessible records`);

        setRecords(filteredRecords);
        setLoading(false);
      },
      err => {
        console.error('❌ Error fetching records from global collection:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      console.log('🧹 Cleaning up records listener');
      unsubscribe();
    };
  }, [userId]);

  return { records, loading, error };
};
