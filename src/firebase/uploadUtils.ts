// src/firebase/uploadUtils.ts

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  getMetadata,
} from 'firebase/storage';
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
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';

// ==================== TYPE DEFINITIONS ====================

export interface UploadUserFileResult {
  downloadURL: string | null;
  filePath: string | null;
  isVirtual?: boolean;
  needsMove?: boolean;
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
    fileName: fileObj.fileName,
    isVirtual: fileObj.isVirtual,
    hasEncryptedData: !!fileObj.encryptedData,
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

  // Check for encrypted file data
  if (fileObj.encryptedData?.file?.encrypted) {
    console.log('🔒 Uploading ENCRYPTED file to temp storage');

    const encryptedBlob = new Blob([fileObj.encryptedData.file.encrypted], {
      type: 'application/octet-stream',
    });

    // Upload to temp location first (will move after getting recordId)
    const tempId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempPath = `temp/${user.uid}/${tempId}.encrypted`;
    const fileRef = ref(storage, tempPath);

    const metadata = {
      contentType: 'application/octet-stream',
      customMetadata: {
        uploadedBy: user.uid,
        encrypted: 'true',
        tempUpload: 'true',
        uploadedAt: new Date().toISOString(),
      },
    };

    try {
      await uploadBytes(fileRef, encryptedBlob, metadata);
      const downloadURL = await getDownloadURL(fileRef);
      console.log('✅ Encrypted file uploaded to temp location');

      return {
        downloadURL,
        filePath: tempPath,
        needsMove: true, // ✨ Flag that this needs to be moved
      };
    } catch (error: any) {
      console.error('❌ Error uploading encrypted file:', error);
      throw new Error(`Failed to upload encrypted file: ${error.message}`);
    }
  }

  // Handle regular unencrypted files (also to temp location)
  const file = fileObj.file;
  if (!file) {
    throw new Error('No file found in fileObj.');
  }

  console.log('📁 Uploading regular file to temp storage');

  const tempId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const extension = file.name.split('.').pop() || 'file';
  const tempPath = `temp/${user.uid}/${tempId}.${extension}`;
  const fileRef = ref(storage, tempPath);

  const metadata = {
    contentType: file.type,
    customMetadata: {
      uploadedBy: user.uid,
      originalFilename: fileObj.fileName || file.name,
      tempUpload: 'true',
      uploadedAt: new Date().toISOString(),
    },
  };

  try {
    await uploadBytes(fileRef, file, metadata);
    const downloadURL = await getDownloadURL(fileRef);

    return {
      downloadURL,
      filePath: tempPath,
      needsMove: true,
    };
  } catch (error: any) {
    console.error('Error uploading file:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Move file from temp location to final record-based location
 */
export async function moveFileToFinalLocation(
  tempPath: string,
  recordId: string
): Promise<{ downloadURL: string; filePath: string }> {
  const storage = getStorage();

  const tempRef = ref(storage, tempPath);

  // Determine final file name
  const tempFileName = tempPath.split('/').pop() || 'file';
  const finalPath = `records/${recordId}/${tempFileName}`;
  const finalRef = ref(storage, finalPath);

  console.log(`📦 Moving file from temp to final location:`, {
    from: tempPath,
    to: finalPath,
    recordId,
  });

  try {
    // Get the temp file's download URL and fetch it
    const tempDownloadURL = await getDownloadURL(tempRef);
    const response = await fetch(tempDownloadURL);
    const blob = await response.blob();

    // Get original metadata
    const tempMetadata = await getMetadata(tempRef);
    const { tempUpload, ...cleanedMetadata } = tempMetadata.customMetadata || {};

    // Upload to final location with updated metadata
    await uploadBytes(finalRef, blob, {
      contentType: tempMetadata.contentType,
      customMetadata: {
        ...cleanedMetadata, // Spread the cleaned metadata (without tempUpload)
        movedAt: new Date().toISOString(),
        finalLocation: 'true',
      },
    });

    // Delete temp file
    await deleteObject(tempRef);
    console.log('✅ File moved successfully, temp file deleted');

    // Get final download URL
    const finalDownloadURL = await getDownloadURL(finalRef);

    return {
      downloadURL: finalDownloadURL,
      filePath: finalPath,
    };
  } catch (error: any) {
    console.error('❌ Error moving file to final location:', error);
    throw new Error(`Failed to move file: ${error.message}`);
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

    const isEncrypted = !!fileObj.encryptedData || !!fileObj.isEncrypted;

    const documentData: any = {
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
        isEncrypted: true,
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
      }),

      // ✨ PLAINTEXT METADATA (only if NOT encrypted)
      ...(!isEncrypted && {
        fileName: fileObj.fileName,
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
      fileName: documentData.fileName || '[ENCRYPTED]',
      uploadedBy: documentData.uploadedBy,
      isEncrypted: !!documentData.isEncrypted,
      hasEncryptedKey: !!documentData.encryptedKey,
    });

    // Save to GLOBAL records collection
    const docRef = await addDoc(collection(db, 'records'), documentData);
    const recordId = docRef.id;

    console.log('✅ Record saved to global collection with ID:', recordId);

    //If file was uploaded to temp location, move to final location
    if (filePath && filePath.startsWith('temp/')) {
      console.log('📦 File is in temp location, moving to final location...');

      try {
        const { downloadURL: finalURL, filePath: finalPath } = await moveFileToFinalLocation(
          filePath,
          recordId
        );

        // Update the document with final paths
        await updateDoc(doc(db, 'records', recordId), {
          downloadURL: finalURL,
          storagePath: finalPath,
        });

        console.log('✅ File moved to final location and document updated:', {
          finalPath,
          recordId,
        });
      } catch (moveError) {
        console.error('⚠️ Failed to move file to final location:', moveError);
        // Don't fail the whole operation - file is still accessible at temp location
        // You could add a background job to retry failed moves later
      }
    }

    return recordId;
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

  console.log('🔄 Starting record update...', { documentId, isEncrypted: updateData.isEncrypted });

  try {
    // Get current document
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

    // 🔒 Check if this is an encrypted record
    const isEncryptedRecord = !!currentData.isEncrypted;

    let filteredData: any = {};

    if (isEncryptedRecord) {
      console.log('🔐 Processing encrypted record update...');

      // Get the user's master key from session
      const masterKey = EncryptionKeyManager.getSessionKey();
      if (!masterKey) {
        throw new Error('Please unlock your encryption to save changes.');
      }

      // Get the record's encrypted file key and decrypt it
      const encryptedKeyData = EncryptionService.base64ToArrayBuffer(currentData.encryptedKey);
      const fileKeyData = await EncryptionService.decryptKeyWithMasterKey(
        encryptedKeyData,
        masterKey
      );
      const fileKey = await EncryptionService.importKey(fileKeyData);

      console.log('✓ File key decrypted');

      // Re-encrypt the updated fields
      const fieldsToEncrypt: any = {};

      // Encrypt fileName if it changed
      if (updateData.fileName !== undefined) {
        const encrypted = await EncryptionService.encryptText(updateData.fileName, fileKey);
        fieldsToEncrypt.encryptedFileName = {
          encrypted: EncryptionService.arrayBufferToBase64(encrypted.encrypted),
          iv: EncryptionService.arrayBufferToBase64(encrypted.iv),
        };
      }

      // Encrypt fhirData if it changed
      if (updateData.fhirData !== undefined) {
        const encrypted = await EncryptionService.encryptJSON(updateData.fhirData, fileKey);
        fieldsToEncrypt.encryptedFhirData = {
          encrypted: EncryptionService.arrayBufferToBase64(encrypted.encrypted),
          iv: EncryptionService.arrayBufferToBase64(encrypted.iv),
        };
      }

      // Encrypt belroseFields if it changed
      if (updateData.belroseFields !== undefined) {
        const encrypted = await EncryptionService.encryptJSON(updateData.belroseFields, fileKey);
        fieldsToEncrypt.encryptedBelroseFields = {
          encrypted: EncryptionService.arrayBufferToBase64(encrypted.encrypted),
          iv: EncryptionService.arrayBufferToBase64(encrypted.iv),
        };
      }

      // Encrypt extractedText if it changed
      if (updateData.extractedText !== undefined) {
        const encrypted = await EncryptionService.encryptText(updateData.extractedText, fileKey);
        fieldsToEncrypt.encryptedExtractedText = {
          encrypted: EncryptionService.arrayBufferToBase64(encrypted.encrypted),
          iv: EncryptionService.arrayBufferToBase64(encrypted.iv),
        };
      }

      // Encrypt originalText if it changed
      if (updateData.originalText !== undefined) {
        const encrypted = await EncryptionService.encryptText(updateData.originalText, fileKey);
        fieldsToEncrypt.encryptedOriginalText = {
          encrypted: EncryptionService.arrayBufferToBase64(encrypted.encrypted),
          iv: EncryptionService.arrayBufferToBase64(encrypted.iv),
        };
      }

      // Add encrypted fields to update
      filteredData = {
        ...fieldsToEncrypt,
        lastModified: new Date().toISOString(),
      };

      console.log('✅ Encrypted fields prepared for update:', Object.keys(fieldsToEncrypt));
    } else {
      console.log('📝 Processing plaintext record update...');

      // For plaintext records, use the old logic
      const allowedFields = [
        'fileName',
        'fhirData',
        'belroseFields',
        'extractedText',
        'originalText',
        'lastModified',
        'blockchainVerification',
        'recordHash',
        'previousRecordHash',
      ];

      filteredData = Object.keys(updateData)
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
    }

    // Prepare data for version control (includes the NEW data)
    const updatedFileObject = {
      ...currentData,
      ...updateData, // Use plaintext for version control (will be encrypted in createVersion)
      id: documentId,
    };

    // Generate new record hash
    try {
      const newRecordHash = await RecordHashService.generateRecordHash(updatedFileObject);
      const previousHash = currentData.recordHash;

      console.log('🔗 Generated new record hash:', {
        newHash: newRecordHash.substring(0, 12) + '...',
        previousHash: previousHash ? previousHash.substring(0, 12) + '...' : 'none',
      });

      filteredData.recordHash = newRecordHash;
      filteredData.previousRecordHash = previousHash;

      // Also add to updatedFileObject for version control
      updatedFileObject.recordHash = newRecordHash;
      updatedFileObject.previousRecordHash = previousHash;
    } catch (hashError) {
      console.warn('⚠️ Failed to generate record hash:', hashError);
    }

    // CREATE VERSION HISTORY FIRST (before updating Firestore)

    //Merge the newly encrypted fields into the updatedSnapshot
    const encryptedUpdatedFileObject = {
      ...currentData,
      ...filteredData, // contains freshly encrypted ciphertexts
      id: documentId,
      isEncrypted: true,
    };

    try {
      console.log(
        '📸 Creating version snapshot AFTER Encryption, but BEFORE updating Firestore...'
      );
      const { VersionControlService } = await import(
        '@/features/ViewEditRecord/services/versionControlService'
      );
      const versionService = new VersionControlService();
      await versionService.createVersion(documentId, encryptedUpdatedFileObject, commitMessage);
      console.log('✅ Version history created');
    } catch (versionError) {
      console.warn('⚠️ Failed to create version history:', versionError);
      // Don't throw - we still want to update the record
    }

    // Update Firestore (after version is created)
    console.log('🔄 Updating Firestore with filtered data:', {
      fields: Object.keys(filteredData),
      isEncrypted: isEncryptedRecord,
    });

    await updateDoc(docRef, filteredData);

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
