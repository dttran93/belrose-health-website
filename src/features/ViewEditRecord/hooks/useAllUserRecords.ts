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
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { toast } from 'sonner';

interface UseAllUserRecordsReturn {
  records: FileObject[];
  loading: boolean;
  error: Error | null;
  refetchRecords: () => void;
}

/**
 * Hook to fetch all records accessible to the current user
 *
 * This includes:
 * - Records uploaded by the user (uploadedBy === userId)
 * - Records where the user is in the owners array
 * - Records where the user is the administrators array
 *
 * Now queries from the GLOBAL 'records' collection instead of user-specific subcollections
 * Also handles decryption of encrypted records
 */
export const useAllUserRecords = (userId?: string): UseAllUserRecordsReturn => {
  const [records, setRecords] = useState<FileObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refetchRecords = () => {
    setRefreshTrigger(prev => prev + 1);
  };

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
    const recordsRef = collection(db, 'records');

    const q = query(
      recordsRef,
      or(
        where('uploadedBy', '==', userId),
        where('owners', 'array-contains', userId),
        where('administrators', 'array-contains', userId),
        where('viewers', 'array-contains', userId),
        where('subjects', 'array-contains', userId)
      ),
      orderBy('uploadedAt', 'desc')
    );

    console.log('📡 Query created for global records collection with composite ownership filter');

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      async (snapshot: QuerySnapshot<DocumentData>) => {
        console.log(`📦 Received ${snapshot.docs.length} records from global collection`);

        try {
          const accessibleRecords: FileObject[] = snapshot.docs.map(doc => {
            const data = doc.data();

            // Use shared mapping function
            const mapped = mapFirestoreToFileObject(doc.id, data);

            return mapped;
          });

          // Additional filtering in memory
          const filteredRecords = accessibleRecords.filter(record => {
            const hasAccess =
              record.uploadedBy === userId ||
              record.owners?.includes(userId) ||
              record.administrators.includes(userId) ||
              record.viewers?.includes(userId) ||
              record.subjects?.includes(userId);

            if (!hasAccess) {
              console.warn('⚠️ Record slipped through query filter:', record.id);
            }

            return hasAccess;
          });

          console.log(`✅ Processed ${filteredRecords.length} accessible records`);

          // ✨ NEW: Decrypt encrypted records
          const hasEncryptedRecords = filteredRecords.some((record: any) => record.isEncrypted);

          if (hasEncryptedRecords) {
            console.log('🔓 Decrypting encrypted records...');

            // Check if encryption session is active
            const masterKey = await EncryptionKeyManager.getSessionKey();
            if (!masterKey) {
              console.warn('⚠️ Encrypted records found but no encryption session active');
              toast.warning(
                'Some records are encrypted. Please unlock your encryption to view them.'
              );
              // Still show the records, but they'll have encrypted data
              setRecords(filteredRecords);
              setLoading(false);
              return;
            }

            try {
              // Decrypt all records (will skip unencrypted ones automatically)
              const decryptedRecords = await RecordDecryptionService.decryptRecords(
                filteredRecords as any
              );

              console.log(`✅ Successfully decrypted ${decryptedRecords.length} records`);
              setRecords(decryptedRecords as FileObject[]);
            } catch (decryptError) {
              console.error('❌ Failed to decrypt records:', decryptError);
              toast.error(
                'Failed to decrypt some records. Please try unlocking your encryption again.'
              );

              // Still show the records even if decryption fails
              setRecords(filteredRecords);
            }
          } else {
            console.log('📄 No encrypted records found, using records as-is');
            setRecords(filteredRecords);
          }

          setLoading(false);
        } catch (processingError) {
          console.error('❌ Error processing records:', processingError);
          setError(processingError as Error);
          setLoading(false);
        }
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
  }, [userId, refreshTrigger]);

  return { records, loading, error, refetchRecords };
};
