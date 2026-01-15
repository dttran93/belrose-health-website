// src/features/ViewEditRecord/services/recordService.ts

/**
 * Service for fetching records from Firestore
 * 2 versions:
 *   1 for full record fetch with decryption,
 *   Another for lightweight access check
 */

import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { FileObject } from '@/types/core';
import mapFirestoreToFileObject from '../utils/firestoreMapping';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';

/**
 * Fetch a single record by ID
 *
 * Handles:
 * - Permission checking (user must have some access)
 * - Decryption if record is encrypted
 *
 * @param recordId - The Firestore document ID
 * @returns The record as FileObject, or null if not found/no access
 */
export async function getRecord(recordId: string): Promise<FileObject | null> {
  const auth = getAuth();
  const db = getFirestore();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    const recordRef = doc(db, 'records', recordId);
    const recordSnap = await getDoc(recordRef);

    if (!recordSnap.exists()) {
      return null;
    }

    const data = recordSnap.data();

    // Check if user has access
    const hasAccess =
      data.uploadedBy === user.uid ||
      data.owners?.includes(user.uid) ||
      data.administrators?.includes(user.uid) ||
      data.viewers?.includes(user.uid) ||
      data.subjects?.includes(user.uid);

    if (!hasAccess) {
      const requestId = `${recordId}_${user.uid}`;
      const requestRef = doc(db, 'subjectConsentRequests', requestId);
      const requestSnap = await getDoc(requestRef);

      if (!requestSnap.exists() || requestSnap.data()?.status !== 'pending') {
        console.warn('User does not have access to record:', recordId);
        return null;
      }
    }

    // Map to FileObject
    let record = mapFirestoreToFileObject(recordSnap.id, data);

    // Handle decryption if needed
    if (record.isEncrypted) {
      const masterKey = EncryptionKeyManager.getSessionKey();

      if (!masterKey) {
        console.warn('Record is encrypted but no encryption session active');
        // Return the encrypted record - UI can prompt for unlock
        return record;
      }

      try {
        record = (await RecordDecryptionService.decryptRecord(record as any)) as FileObject;
      } catch (decryptError) {
        console.error('Failed to decrypt record:', decryptError);
        // Return encrypted version rather than failing completely
        return record;
      }
    }

    return record;
  } catch (error) {
    console.error('Error fetching record:', error);
    throw error;
  }
}

/**
 * Check if a record exists and user has access
 * Lighter weight than getRecord - doesn't decrypt
 */
export async function checkRecordAccess(recordId: string): Promise<{
  exists: boolean;
  hasAccess: boolean;
}> {
  const auth = getAuth();
  const db = getFirestore();
  const user = auth.currentUser;

  if (!user) {
    return { exists: false, hasAccess: false };
  }

  try {
    const recordRef = doc(db, 'records', recordId);
    const recordSnap = await getDoc(recordRef);

    if (!recordSnap.exists()) {
      return { exists: false, hasAccess: false };
    }

    const data = recordSnap.data();
    const hasAccess =
      data.uploadedBy === user.uid ||
      data.owners?.includes(user.uid) ||
      data.administrators?.includes(user.uid) ||
      data.viewers?.includes(user.uid) ||
      data.subjects?.includes(user.uid);

    return { exists: true, hasAccess };
  } catch (error) {
    console.error('Error checking record access:', error);
    return { exists: false, hasAccess: false };
  }
}
