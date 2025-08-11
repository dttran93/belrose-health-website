// src/features/EditRecord/hooks/useFHIREditor.ts
import { useState, useEffect } from 'react';
import { 
  doc, 
  updateDoc, 
  onSnapshot,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  DocumentSnapshot,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { FHIRBundle } from '@/types/fhir';
import { FileObject } from '@/types/core';
import { UseFhirEditorReturn, UseFhirEditSaverReturn, UseFhirRecordsListReturn, UserId, FileId } from './useFHIREditor.types'

/**
 * Utility function to map Firestore data to FileObject
 * This is where we handle the data boundary conversion
 */
const mapFirestoreToFileObject = (docId: string, data: DocumentData): FileObject => {
  return {
    id: docId,
    name: data.fileName || data.name || 'Unknown File',
    size: data.fileSize || 0,
    type: data.fileType || 'unknown',
    status: 'completed', // Files with FHIR data are completed
    lastModified: data.createdAt?.toMillis() || data.uploadedAt?.toMillis() || Date.now(),
    
    // Copy over all the app-specific fields
    fhirData: data.fhirData,
    documentType: data.documentType,
    extractedText: data.extractedText,
    wordCount: data.wordCount,
    fileHash: data.fileHash,
    isVirtual: data.isVirtual,
    
    // Edit tracking (extend FileObject as needed)
    editedByUser: data.editedByUser || false,
    lastEditedAt: data.lastEditedAt,
    lastEditDescription: data.lastEditDescription
  } as FileObject;
};

/**
 * Hook to read and edit existing FHIR data from Firestore
 */
export const useFhirEditor = (userId: UserId, fileId: FileId): UseFhirEditorReturn => {
  const [fhirData, setFhirData] = useState<FHIRBundle | null>(null);
  const [originalFhir, setOriginalFhir] = useState<FHIRBundle | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId || !fileId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'users', userId, 'files', fileId);
    
    const unsubscribe = onSnapshot(
      docRef, 
      (docSnapshot: DocumentSnapshot<DocumentData>) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          
          // Use the FHIR data directly from Firestore
          const currentFhir = data?.fhirData || null;
          const originalData = data?.fhirData || null;
          
          setFhirData(currentFhir);
          setOriginalFhir(originalData);
          setError(null);
        } else {
          setError(new Error(`FHIR record ${fileId} not found`));
        }
        setLoading(false);
      },
      (err: Error) => {
        console.error('❌ Error listening to FHIR document:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, fileId]);

  const hasChanges = fhirData && originalFhir && 
    JSON.stringify(fhirData) !== JSON.stringify(originalFhir);

  return { 
    fhirData, 
    originalFhir, 
    loading, 
    error,
    hasChanges: Boolean(hasChanges)
  };
};

/**
 * Hook to save FHIR edits back to Firestore
 */
export const useFhirEditSaver = (): UseFhirEditSaverReturn => {
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const saveFhirEdits = async (
    userId: string, 
    fileId: string, 
    updatedFhir: FHIRBundle, 
    changeDescription: string = 'Manual edit'
  ): Promise<void> => {
    setSaving(true);
    setError(null);

    try {
      const docRef = doc(db, 'users', userId, 'files', fileId);
      
      await updateDoc(docRef, {
        fhirData: updatedFhir,
        lastEditedAt: serverTimestamp(),
        lastEditDescription: changeDescription,
        editedByUser: true
      });

      console.log('✅ FHIR edits saved successfully');
    } catch (err) {
      console.error('❌ Error saving FHIR edits:', err);
      const error = err instanceof Error ? err : new Error('Unknown error saving FHIR edits');
      setError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return { saveFhirEdits, saving, error };
};

/**
 * Hook to list all FHIR records for a user
 * Returns FileObject[] - same format as all other file hooks
 */
export const useFhirRecordsList = (userId: UserId): UseFhirRecordsListReturn => {
  const [records, setRecords] = useState<FileObject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchRecords = async (): Promise<void> => {
      try {
        const filesRef = collection(db, 'users', userId, 'files');
        const q = query(filesRef, where('fhirData', '!=', null));
        
        const snapshot: QuerySnapshot<DocumentData> = await getDocs(q);
        
        // Map each Firestore document to FileObject format
        const recordsList: FileObject[] = snapshot.docs.map(doc => 
          mapFirestoreToFileObject(doc.id, doc.data())
        );

        setRecords(recordsList);
        setError(null);
      } catch (err) {
        console.error('❌ Error fetching FHIR records:', err);
        const error = err instanceof Error ? err : new Error('Unknown error fetching records');
        setError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [userId]);

  return { records, loading, error };
};