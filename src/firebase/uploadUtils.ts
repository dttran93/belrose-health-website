// src/firebase/uploadUtils.ts

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { auth } from './config';
import type { FileObject } from '@/types/core';
import { RecordHashService } from '@/features/ViewEditRecord/services/generateRecordHash';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import {
  removeUndefinedValues,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '@/utils/dataFormattingUtils';
import { SharingKeyManagementService } from '@/features/Sharing/services/sharingKeyManagementService';

// ==================== TYPE DEFINITIONS ====================

export interface UploadUserFileResult {
  downloadURL: string | null;
  filePath: string | null;
  isVirtual?: boolean;
}

export interface SaveMetadataParams {
  downloadURL: string | null;
  filePath: string | null;
  fileObj: FileObject;
}

export interface UploadFileCompleteResult {
  documentId: string;
  downloadURL: string | null;
  filePath: string | null;
}

export interface DeleteResult {
  success: boolean;
  deletedFromStorage: boolean;
  deletedFromFirestore: boolean;
  deletedVersions: boolean;
  deletedWrappedKeys: boolean;
}

// ==================== UPLOAD FUNCTIONS ====================

export async function uploadUserFile(
  fileObj: FileObject,
  documentId: string
): Promise<UploadUserFileResult> {
  console.log('📄 uploadUserFile received:', {
    hasFile: !!fileObj.file,
    fileName: fileObj.fileName,
    isVirtual: fileObj.isVirtual,
    hasEncryptedData: !!fileObj.encryptedData,
  });

  const storage = getStorage();
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  // Handle virtual files (no actual file to upload)
  if (fileObj.isVirtual) {
    console.log('🎯 Processing virtual file - skipping file upload');
    return {
      downloadURL: null,
      filePath: null,
      isVirtual: true,
    };
  }

  // --- Validate encryption ---
  const encryptedFile = fileObj.encryptedData?.file?.encrypted;
  if (!encryptedFile) {
    throw new Error(
      '🔒 Encryption required: fileObj must be fully encrypted before uploadUserFile is called.'
    );
  }
  console.log('🚀 Uploading encrypted file to Firebase Storage...');

  // Prepare encrypted blob
  const encryptedBlob = new Blob([encryptedFile], {
    type: 'application/octet-stream',
  });

  //Set for storage
  const uniqueId = fileObj.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const finalPath = `records/${documentId}/${uniqueId}.encrypted`;
  const fileRef = ref(storage, finalPath);

  const metadata = {
    contentType: 'application/octet-stream',
    customMetadata: {
      uploadedBy: user.uid,
      encrypted: 'true',
      uploadedAt: new Date().toISOString(),
      recordId: documentId,
      localFileId: fileObj.id || uniqueId,
    },
  };

  //Upload encrypted Blob
  try {
    await uploadBytes(fileRef, encryptedBlob, metadata);
    const downloadURL = await getDownloadURL(fileRef);
    console.log('✅ Encrypted file uploaded directly to final storage:', finalPath);

    return {
      downloadURL,
      filePath: finalPath,
    };
  } catch (error: any) {
    console.error('❌ Error uploading encrypted file:', error);
    throw new Error(`Failed to upload encrypted file: ${error.message}`);
  }
}

export async function createFirestoreRecord({
  downloadURL,
  filePath,
  fileObj,
}: SaveMetadataParams): Promise<string> {
  const user = auth.currentUser;

  if (!user) throw new Error('User not authenticated');

  // Must be encrypted
  if (!fileObj.encryptedData) {
    throw new Error('File must be encrypted before saving metadata.');
  }

  //Administrators default to uploader if not specified
  let administrators =
    fileObj.administrators && fileObj.administrators.length > 0
      ? fileObj.administrators
      : [user.uid];

  // If there are owners, ensure they're all included in administrators
  if (fileObj.owners && fileObj.owners.length > 0) {
    // Add any owners that aren't already in administrators
    const ownersToAdd = fileObj.owners.filter(owner => !administrators.includes(owner));
    administrators = [...administrators, ...ownersToAdd];
  }

  const documentData: any = {
    fileSize: fileObj.fileSize,
    fileType: fileObj.fileType,
    downloadURL,
    storagePath: filePath,

    // OWNERSHIP FIELDS
    uploadedBy: user.uid,
    owners: fileObj.owners || [],
    administrators: administrators,

    isEncrypted: true,
    isVirtual: fileObj.isVirtual,

    encryptedFileName: fileObj.encryptedData.fileName
      ? {
          encrypted: fileObj.encryptedData.fileName.encrypted,
          iv: fileObj.encryptedData.fileName.iv,
        }
      : undefined,

    encryptedExtractedText: fileObj.encryptedData.extractedText
      ? {
          encrypted: fileObj.encryptedData.extractedText.encrypted,
          iv: fileObj.encryptedData.extractedText.iv,
        }
      : undefined,

    encryptedOriginalText: fileObj.encryptedData.originalText
      ? {
          encrypted: fileObj.encryptedData.originalText.encrypted,
          iv: fileObj.encryptedData.originalText.iv,
        }
      : undefined,

    encryptedContextText: fileObj.encryptedData.contextText
      ? {
          encrypted: fileObj.encryptedData.contextText.encrypted,
          iv: fileObj.encryptedData.contextText.iv,
        }
      : undefined,

    encryptedFhirData: fileObj.encryptedData.fhirData
      ? {
          encrypted: fileObj.encryptedData.fhirData.encrypted,
          iv: fileObj.encryptedData.fhirData.iv,
        }
      : undefined,

    encryptedBelroseFields: fileObj.encryptedData.belroseFields
      ? {
          encrypted: fileObj.encryptedData.belroseFields.encrypted,
          iv: fileObj.encryptedData.belroseFields.iv,
        }
      : undefined,

    encryptedCustomData: fileObj.encryptedData.customData
      ? {
          encrypted: fileObj.encryptedData.customData.encrypted,
          iv: fileObj.encryptedData.customData.iv,
        }
      : undefined,

    encryptedFileIV: fileObj.encryptedData.file?.iv,

    // File Metadata
    sourceType: fileObj.sourceType,
    wordCount: fileObj.wordCount,
    aiProcessingStatus: fileObj.aiProcessingStatus,
    recordHash: fileObj.recordHash,
    originalFileHash: fileObj.originalFileHash,
    blockchainVerification: fileObj.blockchainVerification,

    // TIMESTAMPS
    uploadedAt: fileObj.uploadedAt || Timestamp.now(),
    createdAt: Timestamp.now(),
  };

  // Save to GLOBAL records collection
  console.log('📄 Saving documentData:', documentData);
  const docRef = await addDoc(collection(db, 'records'), removeUndefinedValues(documentData));

  // Create wrappedKey entry for the creator
  const wrappedKeyId = `${docRef.id}_${user.uid}`;
  await setDoc(doc(db, 'wrappedKeys', wrappedKeyId), {
    recordId: docRef.id,
    userId: user.uid,
    wrappedKey: fileObj.encryptedData.encryptedKey, // Store the AES key encrypted with creator's master key
    isCreator: true, // Flag to indicate this is the original creator (uses master key, not RSA)
    createdAt: new Date(),
    isActive: true,
  });
  console.log('✅ Creator wrappedKey entry created:', wrappedKeyId);

  return docRef.id;
}

export const updateFirestoreRecord = async (
  documentId: string,
  updateData: any,
  commitMessage?: string
): Promise<void> => {
  const user = auth.currentUser;

  if (!user) throw new Error('User not authenticated');
  if (!documentId) throw new Error('Document ID is required');
  console.log('🔄 Starting record update...', { documentId });

  try {
    // Get current document
    const docRef = doc(db, 'records', documentId);
    console.log('📖 Attempting to read document...', {
      collection: 'records',
      docId: documentId,
      userId: user.uid,
    });

    const currentDoc = await getDoc(docRef);

    if (!currentDoc.exists()) throw new Error('Document not found');
    const currentData = currentDoc.data();

    // Verify user is an owner or administrator
    const owners: string[] = currentData.owners || [currentData.uploadedBy];
    const administrators: string[] = currentData.administrators || [];
    const isOwner = owners.includes(user.uid);
    const isAdmin = administrators.includes(user.uid);

    if (!isOwner && !isAdmin) {
      throw new Error('You do not have permission to update this record');
    }

    // Check if Encrypted, if not throw error
    if (!currentData.isEncrypted) {
      throw new Error('Cannot update a non-encrypted record. All updates must be encrypted.');
    }

    console.log('🔐 Processing encrypted record update...');
    // Get the user's master key from session
    const masterKey = EncryptionKeyManager.getSessionKey();
    if (!masterKey) {
      throw new Error('Please unlock your encryption to save changes.');
    }

    // Get encryption key from wrappedKeys collection
    const wrappedKeyId = `${documentId}_${user.uid}`;
    const wrappedKeyRef = doc(db, 'wrappedKeys', wrappedKeyId);
    const wrappedKeyDoc = await getDoc(wrappedKeyRef);

    if (!wrappedKeyDoc.exists() || !wrappedKeyDoc.data().isActive) {
      throw new Error('You do not have access to this record');
    }

    const wrappedKeyData = wrappedKeyDoc.data();
    const isCreator = wrappedKeyData.isCreator === true;

    let fileKey: CryptoKey;

    if (isCreator) {
      // Creator: key is encrypted with their master key (AES)
      const encryptedKeyData = base64ToArrayBuffer(wrappedKeyData.wrappedKey);
      const fileKeyData = await EncryptionService.decryptKeyWithMasterKey(
        encryptedKeyData,
        masterKey
      );
      fileKey = await EncryptionService.importKey(fileKeyData);
    } else {
      // Shared user: key is wrapped with their RSA public key
      // Get user's RSA private key
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();

      if (!userData) {
        throw new Error('RSA private key not found');
      }

      const encryptedPrivateKeyData = base64ToArrayBuffer(userData.encryption.encryptedPrivateKey);
      const privateKeyIv = base64ToArrayBuffer(userData.encryption.encryptedPrivateKeyIV);

      const privateKeyBytes = await EncryptionService.decryptFile(
        encryptedPrivateKeyData,
        masterKey,
        privateKeyIv
      );

      const rsaPrivateKey = await SharingKeyManagementService.importPrivateKey(
        arrayBufferToBase64(privateKeyBytes)
      );

      fileKey = await SharingKeyManagementService.unwrapKey(
        wrappedKeyData.wrappedKey,
        rsaPrivateKey
      );
    }
    console.log('✓ File key decrypted');

    // Encrypt updated Fields
    const fieldsToEncrypt: any = {};
    for (const key of ['fileName', 'fhirData', 'belroseFields', 'extractedText', 'originalText']) {
      if (updateData[key] !== undefined) {
        const encrypted =
          key === 'fileName' || key === 'extractedText' || key === 'originalText'
            ? await EncryptionService.encryptText(updateData[key], fileKey)
            : await EncryptionService.encryptJSON(updateData[key], fileKey);
        fieldsToEncrypt[`encrypted${key.charAt(0).toUpperCase() + key.slice(1)}`] = {
          encrypted: arrayBufferToBase64(encrypted.encrypted),
          iv: arrayBufferToBase64(encrypted.iv),
        };
      }
    }

    // FilteredData will be what's ultimately passed to Firestore function
    const filteredData: any = {
      ...fieldsToEncrypt,
      lastModified: serverTimestamp(),
    };

    console.log('✅ Encrypted fields prepared for update:', Object.keys(fieldsToEncrypt));

    // Prepare data for version control
    const updatedFileObject = { ...currentData, ...updateData, id: documentId };

    // Generate new record hash
    try {
      const newRecordHash = await RecordHashService.generateRecordHash(updatedFileObject);
      filteredData.recordHash = newRecordHash;
      const currentHash = currentData.recordHash; //Hash of the record before this update
      //Get existing previousRecordHash array from current document data
      let previousHashes: string[] = currentData.previousRecordHash || [];
      if (currentHash) {
        previousHashes.push(currentHash);
      }

      filteredData.previousRecordHash = previousHashes;

      console.log('🔗 Record hash updated. New history length:', previousHashes.length);
    } catch (hashError) {
      console.warn('⚠️ Failed to generate record hash:', hashError);
    }

    // Create version history
    const encryptedUpdatedFileObject = {
      ...currentData,
      ...filteredData,
      id: documentId,
      isEncrypted: true,
    };
    try {
      const { VersionControlService } = await import(
        '@/features/ViewEditRecord/services/versionControlService'
      );
      const versionService = new VersionControlService();
      await versionService.createVersion(documentId, encryptedUpdatedFileObject, commitMessage);
      console.log('✅ Version history created');
    } catch (versionError) {
      console.warn('⚠️ Failed to create version history:', versionError);
    }

    // Update Firestore
    console.log('🔍 FINAL DATA BEING SENT TO FIRESTORE:', removeUndefinedValues(filteredData));
    await updateDoc(docRef, removeUndefinedValues(filteredData));
    console.log('✅ Firestore record updated successfully');
  } catch (error: any) {
    console.error('❌ Error updating Firestore record:', error);
    throw new Error(`Failed to update record: ${error.message}`);
  }
};

// ==================== DELETE FUNCTIONS ====================

async function deleteFromStorage(storagePath: string): Promise<void> {
  const storage = getStorage();
  const fileRef = ref(storage, storagePath);

  try {
    await deleteObject(fileRef);
    console.log('✅ File deleted from storage:', storagePath);
  } catch (error: any) {
    console.error('Error deleting from storage:', error);
    throw new Error(`Failed to delete from storage: ${error.message}`);
  }
}

async function deleteFromFirestore(documentId: string): Promise<void> {
  const user = auth.currentUser;

  if (!user) throw new Error('User not authenticated');

  try {
    // Delete from global records collection
    const docRef = doc(db, 'records', documentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Document not found');
    }

    const docData = docSnap.data();

    // Verify user is an owner or the subject
    const owners = docData.owners || [docData.uploadedBy];
    const administrators = docData.administrators || [];
    const isOwner = owners.includes(user.uid);
    const isAdmin = administrators.includes(user.uid);

    if (!isOwner && !isAdmin) {
      throw new Error('You do not have permission to delete this record');
    }

    await deleteDoc(docRef);
    console.log('✅ Document deleted from Firestore:', documentId);
  } catch (error: any) {
    console.error('Error deleting from Firestore:', error);
    throw new Error(`Failed to delete from Firestore: ${error.message}`);
  }
}

async function getFileMetadata(documentId: string): Promise<any> {
  const user = auth.currentUser;

  if (!user) throw new Error('User not authenticated');

  try {
    // 🆕 Get from global records collection
    const docRef = doc(db, 'records', documentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Document not found');
    }

    return docSnap.data();
  } catch (error: any) {
    console.error('Error getting file metadata:', error);
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
}

export async function deleteRecordVersions(documentId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  if (!documentId) throw new Error('Document ID is required');

  try {
    console.log('🗑️ Deleting all versions for document:', documentId);

    // 🆕 Delete from GLOBAL recordVersions collection
    const q = query(collection(db, 'recordVersions'), where('recordId', '==', documentId));

    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    console.log(`✅ Deleted ${snapshot.docs.length} version documents`);
  } catch (error: any) {
    console.error('❌ Error deleting versions:', error);
    console.warn('⚠️ Continuing despite version deletion error');
  }
}

// Delete wrapped keys for a record
export async function deleteWrappedKeys(documentId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  if (!documentId) throw new Error('Document ID is required');

  try {
    console.log('🗑️ Deleting wrapped keys for document:', documentId);

    // Query all wrapped keys where recordId matches
    const q = query(collection(db, 'wrappedKeys'), where('recordId', '==', documentId));

    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    console.log(`✅ Deleted ${snapshot.docs.length} wrapped key documents`);
  } catch (error: any) {
    console.error('❌ Error deleting wrapped keys:', error);
    console.warn('⚠️ Continuing despite wrapped key deletion error');
  }
}

export async function deleteFileComplete(documentId: string): Promise<DeleteResult> {
  const user = auth.currentUser;

  if (!user) throw new Error('User not authenticated');
  if (!documentId) throw new Error('Document ID is required');

  try {
    const fileMetadata = await getFileMetadata(documentId);
    const storagePath = fileMetadata.storagePath;

    console.log('🗑️ Starting complete file deletion for:', documentId);

    // Delete from storage (if it exists)
    let deletedFromStorage = false;
    if (storagePath) {
      try {
        await deleteFromStorage(storagePath);
        deletedFromStorage = true;
      } catch (storageError) {
        console.warn('⚠️ Failed to delete from storage, continuing...', storageError);
        // Continue even if storage deletion fails
      }
    } else {
      console.log('🎯 No storage path found - virtual file, skipping storage deletion');
    }

    // Delete versions (best effort - don't fail if this fails)
    let deletedVersions = false;
    try {
      await deleteRecordVersions(documentId);
      deletedVersions = true;
    } catch (versionError) {
      console.warn('⚠️ Failed to delete versions, continuing...', versionError);
      // Continue even if version deletion fails
    }

    // Delete wrapped keys (best effort)
    let deletedWrappedKeys = false;
    try {
      await deleteWrappedKeys(documentId);
      deletedWrappedKeys = true;
    } catch (keyError) {
      console.warn('⚠️ Failed to delete wrapped keys, continuing...', keyError);
    }

    // Delete from Firestore (this is the critical operation)
    await deleteFromFirestore(documentId);

    console.log('✅ Complete file deletion successful:', documentId);

    return {
      success: true,
      deletedFromStorage,
      deletedFromFirestore: true,
      deletedVersions,
      deletedWrappedKeys,
    };
  } catch (error: any) {
    console.error('Error in complete file deletion:', error);
    throw error;
  }
}

/**
 * Helper function to update Firestore document with storage information.
 * Needed because we want to organize storage by Firestore document ID (records/{docId}/...).
 * But we don't have documentID until we create the firestore doc
 * So uploadFileComplete starts with creating file, then upload to path,
 * finally updating the doc with storage details using this function.
 */
export async function updateFirestoreStorageInfo(
  documentId: string,
  downloadURL: string | null,
  filePath: string | null
): Promise<void> {
  const user = auth.currentUser;

  if (!user) throw new Error('User not authenticated');
  if (!documentId) throw new Error('Document ID is required');

  try {
    const docRef = doc(db, 'records', documentId);
    await updateDoc(docRef, {
      downloadURL,
      storagePath: filePath,
      lastModified: serverTimestamp(),
    });

    console.log('✅ Firestore storage info updated:', documentId);
  } catch (error: any) {
    console.error('❌ Error updating Firestore storage info:', error);
    throw new Error(`Failed to update storage info: ${error.message}`);
  }
}

// ==================== COMBINED WORKFLOWS ====================

/**
 * Complete file upload workflow:
 * 1. Create Firestore document (gets permanent ID)
 * 2. Upload file to storage (organized by Firestore ID)
 * 3. Update Firestore with storage details
 *
 * This ensures the global record repository structure where records
 * exist independently and can be accessed by multiple users (multi-tenant)
 */
export async function uploadFileComplete(fileObj: FileObject): Promise<UploadFileCompleteResult> {
  try {
    console.log('🚀 Starting complete file upload workflow...');

    // STEP 1: Create Firestore document FIRST to get permanent ID
    const documentId = await createFirestoreRecord({
      downloadURL: null, // Will be updated after upload
      filePath: null, // Will be updated after upload
      fileObj,
    });

    console.log('✅ Firestore document created:', documentId);

    // STEP 2: Upload file to storage using the Firestore document ID
    const { downloadURL, filePath, isVirtual } = await uploadUserFile(fileObj, documentId);

    // STEP 3: Update Firestore with storage details (if not virtual)
    if (!isVirtual && downloadURL && filePath) {
      await updateFirestoreStorageInfo(documentId, downloadURL, filePath);
    }

    console.log('✅ Complete upload workflow finished:', documentId);

    return { documentId, downloadURL, filePath };
  } catch (error: any) {
    console.error('❌ Error in complete file upload:', error);
    throw error;
  }
}
