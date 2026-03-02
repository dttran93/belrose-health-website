// src/pages/RecordDetail.tsx

/**
 * RecordDetail
 *
 * Standalone page for viewing a single record at /app/records/:recordId.
 * Fetches the record by ID, then renders RecordFull with the full action
 * surface (save, delete, download, etc.).
 *
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { toast } from 'sonner';
import { FileObject } from '@/types/core';
import { useAuthContext } from '@/features/Auth/AuthContext';
import RecordFull from '@/features/ViewEditRecord/components/RecordFull';
import RecordDeletionDialog from '@/features/ViewEditRecord/components/RecordDeletionDialog';
import { useRecordFileActions } from '@/features/ViewEditRecord/hooks/useRecordFileActions';
import { useRecordDeletion } from '@/features/ViewEditRecord/hooks/useRecordDeletion';
import useFileManager from '@/features/AddRecord/hooks/useFileManager';
import mapFirestoreToFileObject from '@/features/ViewEditRecord/utils/firestoreMapping';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';

// ============================================================================
// LOADING STATE
// ============================================================================

const LoadingState: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
      <p className="text-muted-foreground text-sm">Loading record...</p>
    </div>
  </div>
);

// ============================================================================
// ERROR STATE
// ============================================================================

const ErrorState: React.FC<{ message: string }> = ({ message }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md text-center">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
        <h3 className="font-medium text-card-foreground mb-1">Could not load record</h3>
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-sm font-medium text-primary hover:underline"
        >
          Go back
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// PAGE
// ============================================================================

const RecordDetail: React.FC = () => {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { updateFirestoreRecord } = useFileManager();
  const { handleDownloadRecord, handleCopyRecord } = useRecordFileActions();

  const [record, setRecord] = useState<FileObject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =========================================================================
  // FETCH SINGLE RECORD
  // =========================================================================

  useEffect(() => {
    if (!recordId) {
      setError('No record ID in URL.');
      setIsLoading(false);
      return;
    }

    const fetchRecord = async () => {
      try {
        const db = getFirestore();
        const docRef = doc(db, 'records', recordId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('Record not found. It may have been deleted or you may not have access.');
          setIsLoading(false);
          return;
        }

        // Map Firestore doc → FileObject (same util used by useUserRecords)
        const mapped = mapFirestoreToFileObject(docSnap.id, docSnap.data());

        // Decrypt if needed (same path as useUserRecords)
        const [decrypted] = await RecordDecryptionService.decryptRecords([mapped as any]);
        setRecord(decrypted as FileObject);
      } catch (err) {
        console.error('❌ Error loading record:', err);
        setError(err instanceof Error ? err.message : 'Failed to load record.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecord();
  }, [recordId]);

  // =========================================================================
  // SAVE HANDLER
  // =========================================================================

  const handleSave = async (updatedRecord: FileObject) => {
    try {
      if (!updatedRecord.id) throw new Error('No document ID found');

      await updateFirestoreRecord(updatedRecord.id, {
        fhirData: updatedRecord.fhirData,
        belroseFields: updatedRecord.belroseFields,
        lastModified: new Date().toISOString(),
      });

      setRecord(updatedRecord);
      toast.success(`💾 Record saved`, { description: 'Changes saved to cloud storage.' });
    } catch (err) {
      toast.error('Failed to save record', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  // =========================================================================
  // DELETE HANDLER
  // =========================================================================

  const [recordToDelete, setRecordToDelete] = useState<FileObject | null>(null);

  const deletion = useRecordDeletion(recordToDelete || ({} as FileObject), () => {
    setRecordToDelete(null);
    // After deletion, go back — there's nothing to show here anymore
    navigate(-1);
  });

  const handleDelete = (rec: FileObject) => {
    setRecordToDelete(rec);
  };

  useEffect(() => {
    if (recordToDelete) deletion.initiateDeletion();
  }, [recordToDelete?.id]);

  // =========================================================================
  // RENDER
  // =========================================================================

  if (isLoading) return <LoadingState />;
  if (error || !record) return <ErrorState message={error ?? 'Record could not be loaded.'} />;

  return (
    <div className="p-4">
      <RecordFull
        record={record}
        onSave={handleSave}
        onDelete={handleDelete}
        onDownload={handleDownloadRecord}
        onCopy={handleCopyRecord}
        onBack={() => navigate(-1)}
        onRefreshRecord={() => {
          // Re-fetch the record to pick up any external changes
          setIsLoading(true);
          setRecord(null);
        }}
      />

      {recordToDelete && (
        <RecordDeletionDialog
          {...deletion.dialogProps}
          closeDialog={() => {
            setRecordToDelete(null);
            deletion.dialogProps.closeDialog();
          }}
        />
      )}
    </div>
  );
};

export default RecordDetail;
