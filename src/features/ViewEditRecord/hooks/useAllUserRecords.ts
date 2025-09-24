import { useState, useEffect } from 'react';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { FileObject } from '@/types/core';
import mapFirestoreToFileObject from '@/features/ViewEditRecord/utils/firestoreMapping';

interface UseCompleteRecordsReturn {
  records: FileObject[];
  loading: boolean;
  error: Error | null;
}

export const useCompleteRecords = (userId?: string): UseCompleteRecordsReturn => {
  const [records, setRecords] = useState<FileObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    console.log('Setting up real-time listener for complete records');
    setLoading(true);
    setError(null);

    const db = getFirestore();

    // Query the complete documents from Firestore
    const q = query(collection(db, 'users', userId, 'files'), orderBy('uploadedAt', 'desc'));

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        console.log('Received', snapshot.docs.length, 'complete records from Firestore');

        const completeRecords: FileObject[] = snapshot.docs.map(doc => {
          const data = doc.data();

          // Use shared mapping function
          return mapFirestoreToFileObject(doc.id, data);
        });

        setRecords(completeRecords);
        setLoading(false);
      },
      err => {
        console.error('Error fetching complete records:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up complete records listener');
      unsubscribe();
    };
  }, [userId]);

  return { records, loading, error };
};
