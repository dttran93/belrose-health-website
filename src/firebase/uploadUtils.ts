// src/firebase/uploadUtils.ts

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  DocumentReference,
  query,
  where,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { FileObject } from '@/types/core';
import { RecordHashService } from '@/features/ViewEditRecord/services/generateRecordHash';

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
}

// ==================== UPLOAD FUNCTIONS ====================

export async function uploadUserFile(fileObj: FileObject): Promise<UploadUserFileResult> {
  console.log('📄 uploadUserFile received:', {
    hasFile: !!fileObj.file,
    hasFileProperty: 'file' in fileObj,
    fileName: fileObj.fileName,
    isVirtual: fileObj.isVirtual,
    extractedText: !!fileObj.extractedText,
    allKeys: Object.keys(fileObj),
  });

  const storage = getStorage();
  const auth = getAuth();
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

  //Check for encrypted file data
  if (fileObj.encryptedData?.file?.encrypted) {
    console.log('🔒 Uploading ENCRYPTED file to storage');

    //Convert encryptedArrayBuffer to Blob for upload
    const encryptedBlob = new Blob([fileObj.encryptedData.file.encrypted], {
      type: 'application/octet-stream', // Generic binary type for encrypted data
    });

    // Upload encrypted Blob to storage
    const fileName = fileObj.fileName || 'encrypted_file';
    const filePath = `users/${user.uid}/encrypted_files/${Date.now()}_${fileName}.encrypted`;
    const fileRef = ref(storage, filePath);
    const metadata = {
      contentType: 'application/octet-stream',
      customMetadata: {
        uploadedBy: user.uid,
        originalFilename: fileName,
        description: 'Encrypted user upload',
        encrypted: 'true',
      },
    };

    try {
      await uploadBytes(fileRef, encryptedBlob, metadata);
      const downloadURL = await getDownloadURL(fileRef);
      console.log('✅ Encrypted file uploaded successfully');
      return { downloadURL, filePath };
    } catch (error: any) {
      console.error('❌ Error uploading encrypted file:', error);
      throw new Error(`Failed to upload encrypted file: ${error.message}`);
    }
  }

  // Handle regular, unencrypted files
  const file = fileObj.file;
  if (!file) {
    throw new Error('No file found in fileObj. Expected fileObj.file to contain the File object.');
  }

  // Organize files by user ID
  const fileName = fileObj.fileName || file.name;
  const filePath = `users/${user.uid}/uploads/${Date.now()}_${fileName}`;
  const fileRef = ref(storage, filePath);

  // Add metadata
  const metadata = {
    contentType: file.type,
    customMetadata: {
      uploadedBy: user.uid,
      originalFilename: fileName,
      description: 'User upload',
    },
  };

  try {
    await uploadBytes(fileRef, file, metadata);
    const downloadURL = await getDownloadURL(fileRef);
    return { downloadURL, filePath };
  } catch (error: any) {
    console.error('Error uploading file:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

export async function saveFileMetadataToFirestore({
  downloadURL,
  filePath,
  fileObj,
}: SaveMetadataParams): Promise<string> {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error('User not authenticated');

  try {
    // SubjectId is OPTIONAL initially
    const subjectId = fileObj.subjectId;

    // Owners default to just the uploader if not specified
    let owners = fileObj.owners;

    if (!owners || owners.length === 0) {
      owners = [user.uid];
      console.log('📋 No owners specified, defaulting to uploader:', owners);
    }

    // If subjectId IS provided, ensure they're in owners
    if (subjectId && !owners.includes(subjectId)) {
      console.warn('⚠️ Subject was not in owners array, adding them automatically');
      owners.push(subjectId);
    }

    const documentData: any = {
      fileName: fileObj.fileName,
      fileSize: fileObj.fileSize,
      fileType: fileObj.fileType,
      downloadURL,
      storagePath: filePath,

      // OWNERSHIP FIELDS
      uploadedBy: user.uid,
      uploadedByName: user.displayName || user.email || 'Unknown User',
      subjectId: subjectId || null,
      ...(subjectId && {
        subjectName: fileObj.subjectName || 'Unknown Subject',
      }),
      owners: owners,

      // ✨ ENCRYPTION METADATA (if encrypted)
      ...(fileObj.encryptedData && {
        // The wrapped AES key that encrypted everything
        encryptedKey: fileObj.encryptedData.encryptedKey,

        // Encrypted file name (so we can display it when decrypted)
        encryptedFileName: fileObj.encryptedData.fileName
          ? {
              encrypted: fileObj.encryptedData.fileName.encrypted, // base64
              iv: fileObj.encryptedData.fileName.iv, // base64
            }
          : undefined,

        // IV for the encrypted file in Storage (needed to decrypt it later)
        encryptedFileIV: fileObj.encryptedData.file?.iv,

        // Encrypted extracted text
        encryptedExtractedText: fileObj.encryptedData.extractedText
          ? {
              encrypted: fileObj.encryptedData.extractedText.encrypted, // base64
              iv: fileObj.encryptedData.extractedText.iv, // base64
            }
          : undefined,

        // Encrypted original text
        encryptedOriginalText: fileObj.encryptedData.originalText
          ? {
              encrypted: fileObj.encryptedData.originalText.encrypted, // base64
              iv: fileObj.encryptedData.originalText.iv, // base64
            }
          : undefined,

        // Encrypted FHIR data
        encryptedFhirData: fileObj.encryptedData.fhirData
          ? {
              encrypted: fileObj.encryptedData.fhirData.encrypted, // base64
              iv: fileObj.encryptedData.fhirData.iv, // base64
            }
          : undefined,

        // Encrypted Belrose fields
        encryptedBelroseFields: fileObj.encryptedData.belroseFields
          ? {
              encrypted: fileObj.encryptedData.belroseFields.encrypted, // base64
              iv: fileObj.encryptedData.belroseFields.iv, // base64
            }
          : undefined,

        // Mark as encrypted
        isEncrypted: true,
      }),

      // ✨ PLAINTEXT METADATA (only if NOT encrypted)
      ...(!fileObj.encryptedData && {
        extractedText: fileObj.extractedText,
        wordCount: fileObj.wordCount,
        fhirData: fileObj.fhirData,
        belroseFields: fileObj.belroseFields,
        originalText: fileObj.originalText,
      }),

      // OTHER FIELDS (always included)
      status: fileObj.status,
      sourceType: fileObj.sourceType,
      isVirtual: fileObj.isVirtual,
      aiProcessingStatus: fileObj.aiProcessingStatus,
      recordHash: fileObj.recordHash,
      originalFileHash: fileObj.originalFileHash,
      blockchainVerification: fileObj.blockchainVerification,

      // TIMESTAMPS
      uploadedAt: new Date(),
      createdAt: new Date(),
    };

    // Clean undefined fields
    Object.keys(documentData).forEach(key => {
      if (documentData[key] === undefined) {
        delete documentData[key];
      }
    });

    console.log('📄 Saving to global records collection:', {
      fileName: documentData.fileName,
      uploadedBy: documentData.uploadedBy,
      subjectId: documentData.subjectId || null,
      owners: documentData.owners,
      isEncrypted: !!documentData.isEncrypted,
      hasEncryptedKey: !!documentData.encryptedKey,
      hasBlockchainVerification: !!documentData.blockchainVerification,
    });

    // Save to GLOBAL records collection
    const docRef = await addDoc(collection(db, 'records'), documentData);

    console.log('✅ Record saved to global collection with ID:', docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('Error saving file metadata:', error);
    throw new Error(`Failed to save file metadata: ${error.message}`);
  }
}

export const updateFirestoreRecord = async (
  documentId: string,
  updateData: any,
  commitMessage?: string
): Promise<void> => {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error('User not authenticated');
  if (!documentId) throw new Error('Document ID is required');

  // Filter allowed fields
  const allowedFields = [
    'fhirData',
    'belroseFields',
    'extractedText',
    'originalText',
    'lastModified',
    'blockchainVerification',
    'recordHash',
    'previousRecordHash',
  ];

  const filteredData = Object.keys(updateData)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = updateData[key];
      return obj;
    }, {} as any);

  if (Object.keys(filteredData).length === 0) {
    throw new Error('No valid fields to update');
  }

  // Add timestamp
  if (!filteredData.lastModified) {
    filteredData.lastModified = new Date().toISOString();
  }

  console.log('🔄 Updating Firestore with filtered data:', filteredData);

  try {
    // Update in global records collection
    const docRef = doc(db, 'records', documentId);
    const currentDoc = await getDoc(docRef);

    if (!currentDoc.exists()) {
      throw new Error('Document not found');
    }

    const currentData = currentDoc.data();

    // Verify user is an owner
    const owners = currentData.owners || [currentData.uploadedBy];
    if (!owners.includes(user.uid)) {
      throw new Error('You do not have permission to update this record');
    }

    const originalFileObjectForVersioning = JSON.parse(
      JSON.stringify({
        ...currentData,
        id: documentId,
      })
    );

    const updatedFileObject = {
      ...currentData,
      ...filteredData,
      id: documentId,
    };

    // Generate new record hash
    let newRecordHash: string | undefined;
    let previousHash: string | undefined;

    try {
      newRecordHash = await RecordHashService.generateRecordHash(updatedFileObject);
      previousHash = currentData.recordHash;

      console.log('🔗 Generated new record hash:', {
        newHash: newRecordHash.substring(0, 12) + '...',
        previousHash: previousHash ? previousHash.substring(0, 12) + '...' : 'none',
      });

      filteredData.recordHash = newRecordHash;
      filteredData.previousRecordHash = previousHash;
    } catch (hashError) {
      console.warn('⚠️ Failed to generate record hash:', hashError);
    }

    // Update the document
    await updateDoc(docRef, filteredData);

    // Create version history (if using version control)
    try {
      const { VersionControlService } = await import(
        '@/features/ViewEditRecord/services/versionControlService'
      );
      const versionService = new VersionControlService();
      await versionService.createVersion(documentId, updatedFileObject, commitMessage);
      console.log('✅ Version history created');
    } catch (versionError) {
      console.warn('⚠️ Failed to create version history:', versionError);
    }

    console.log('✅ Firestore record updated successfully');
  } catch (error: any) {
    console.error('Error updating Firestore record:', error);
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
  const db = getFirestore();
  const auth = getAuth();
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
    const isOwner = owners.includes(user.uid);
    const isSubject = docData.subjectId === user.uid;

    if (!isOwner && !isSubject) {
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
  const db = getFirestore();
  const auth = getAuth();
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
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  if (!documentId) throw new Error('Document ID is required');

  const db = getFirestore();

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

export async function deleteFileComplete(documentId: string): Promise<DeleteResult> {
  const auth = getAuth();
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

    // Delete from Firestore (this is the critical operation)
    await deleteFromFirestore(documentId);

    console.log('✅ Complete file deletion successful:', documentId);

    return {
      success: true,
      deletedFromStorage,
      deletedFromFirestore: true,
      deletedVersions,
    };
  } catch (error: any) {
    console.error('Error in complete file deletion:', error);
    throw error;
  }
}

// ==================== COMBINED WORKFLOWS ====================

export async function uploadFileComplete(fileObj: FileObject): Promise<UploadFileCompleteResult> {
  try {
    const { downloadURL, filePath } = await uploadUserFile(fileObj);
    const documentId = await saveFileMetadataToFirestore({
      downloadURL,
      filePath,
      fileObj,
    });

    return { documentId, downloadURL, filePath };
  } catch (error: any) {
    console.error('Error in complete file upload:', error);
    throw error;
  }
}
