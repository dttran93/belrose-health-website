// hooks/useFhirEditor.js - Simplified for editing only
import { useState, useEffect } from 'react';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/firebase/config';

/**
 * Hook to read and edit existing FHIR data from Firestore
 * Assumes data is already uploaded via AddRecord workflow
 */
export const useFhirEditor = (userId, fileId) => {
  const [fhirData, setFhirData] = useState(null);
  const [originalFhir, setOriginalFhir] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId || !fileId) {
      setLoading(false);
      return;
    }

    // Listen to the existing document structure from AddRecord
    const docRef = doc(db, 'users', userId, 'files', fileId);
    
    const unsubscribe = onSnapshot(docRef, 
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          
          // Use your existing Firestore structure
          const currentFhir = data.fhirData; // Your existing field name
          const originalData = data.fhirData; // Store original for comparison
          
          setFhirData(currentFhir);
          setOriginalFhir(originalData);
          setError(null);
        } else {
          setError(new Error(`FHIR record ${fileId} not found`));
        }
        setLoading(false);
      },
      (err) => {
        console.error('❌ Error listening to FHIR document:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, fileId]);

  return { 
    fhirData, 
    originalFhir, 
    loading, 
    error,
    hasChanges: fhirData && originalFhir && JSON.stringify(fhirData) !== JSON.stringify(originalFhir)
  };
};

/**
 * Hook to save FHIR edits back to existing Firestore structure
 */
export const useFhirEditSaver = () => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const saveFhirEdits = async (userId, fileId, updatedFhir, changeDescription = 'Manual edit') => {
    setSaving(true);
    setError(null);

    try {
      const docRef = doc(db, 'users', userId, 'files', fileId);
      
      // Update existing document structure (don't change AddRecord format)
      await updateDoc(docRef, {
        fhirData: updatedFhir,  // Update main FHIR data
        lastEditedAt: serverTimestamp(),
        lastEditDescription: changeDescription,
        editedByUser: true  // Flag to show it's been manually edited
      });

      console.log('✅ FHIR edits saved to existing Firestore document');
    } catch (err) {
      console.error('❌ Error saving FHIR edits:', err);
      setError(err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return { saveFhirEdits, saving, error };
};

/**
 * Hook to list all FHIR records for a user (for browsing/selecting)
 */
export const useFhirRecordsList = (userId) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    const fetchRecords = async () => {
      try {
        // Query existing files collection from AddRecord
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        
        const filesRef = collection(db, 'users', userId, 'files');
        const q = query(filesRef, where('fhirData', '!=', null));
        
        const snapshot = await getDocs(q);
        const recordsList = snapshot.docs.map(doc => ({
          id: doc.id,
          fileName: doc.data().fileName || doc.data().name || 'Unknown',
          resourceType: doc.data().fhirData?.resourceType || 'Unknown',
          createdAt: doc.data().createdAt || doc.data().uploadedAt,
          lastEditedAt: doc.data().lastEditedAt,
          hasBeenEdited: doc.data().editedByUser || false
        }));

        setRecords(recordsList);
        setError(null);
      } catch (err) {
        console.error('❌ Error fetching FHIR records:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [userId]);

  return { records, loading, error };
};