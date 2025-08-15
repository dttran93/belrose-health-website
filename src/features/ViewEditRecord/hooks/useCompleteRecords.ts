// src/features/ViewEditRecord/hooks/useCompleteRecords.ts
import { useState, useEffect } from 'react';
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  QuerySnapshot,
  DocumentData 
} from 'firebase/firestore';
import { FileObject, BelroseFields } from '@/types/core';

// No need for a separate interface since FileObject already has optional belroseFields
interface UseCompleteRecordsReturn {
  records: FileObject[]; // Use FileObject directly
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

    console.log('🔍 Setting up real-time listener for complete records');
    setLoading(true);
    setError(null);

    const db = getFirestore();
    
    // Query the complete documents from Firestore
    const q = query(
      collection(db, 'users', userId, 'files'),
      orderBy('uploadedAt', 'desc') // or 'createdAt' depending on your preference
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        console.log('📄 Received', snapshot.docs.length, 'complete records from Firestore');
        
        const completeRecords: FileObject[] = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Log each record to debug belroseFields
          console.log('📋 Record:', doc.id, {
            name: data.fileName || data.name,
            hasBelroseFields: !!data.belroseFields,
            belroseFields: data.belroseFields,
            aiProcessingStatus: data.aiProcessingStatus
          });

          // Convert Firestore document to your FileObject format
          const record: FileObject = {
            id: doc.id,
            name: data.fileName || data.name || 'Unknown Document',
            size: data.fileSize || 0,
            type: data.fileType || data.type || 'application/octet-stream', // Ensure type is never undefined
            status: 'completed', // Assume completed if it's in Firestore
            
            // Include all the extra fields
            extractedText: data.extractedText,
            wordCount: data.wordCount,
            documentType: data.documentType,
            lastModified: data.uploadedAt?.toMillis?.() || data.createdAt?.toMillis?.() || Date.now(),
            isVirtual: data.isVirtual,
            fhirData: data.fhirData,
            
            // 🔥 MOST IMPORTANT: Include belroseFields (handle undefined gracefully)
            belroseFields: data.belroseFields || undefined, // Explicitly handle undefined
            aiProcessingStatus: data.aiProcessingStatus || undefined,
            
            // Add any other fields you need
            createdAt: data.createdAt,
            uploadedAt: data.uploadedAt,
            originalText: data.originalText,
            fileHash: data.fileHash
          };

          return record;
        });

        setRecords(completeRecords);
        setLoading(false);
      },
      (err) => {
        console.error('❌ Error fetching complete records:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      console.log('🧹 Cleaning up complete records listener');
      unsubscribe();
    };
  }, [userId]);

  return { records, loading, error };
};