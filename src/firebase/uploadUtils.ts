import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject 
} from "firebase/storage";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  updateDoc,
  deleteDoc,
  getDoc,
  DocumentReference,
  DocumentSnapshot
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { FileObject } from '@/types/core';
import { setDoc } from 'firebase/firestore';
import { VersionControlService } from '@/features/ViewEditRecord/services/versionControlService'

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

export interface FileMetadata {
  fileName: string;
  fileType: string;
  fileSize: number;
  downloadURL: string | null;
  storagePath: string | null;
  uploadedBy: string;
  uploadedAt: Date;
  extractedText?: string;
  wordCount?: number;
  documentType?: string;
  extractedAt?: string;
  processingStatus?: string;
  fileHash?: string;
  isVirtual?: boolean;
  virtualFileType?: string;
  fhirData?: any;
  originalText?: string;
  belroseFields?: {
    visitType?: string;
    title?: string;
    summary?: string;
    completedDate?: string;
    provider?: string;
    patient?: string;
    institution?: string;
    aiProcessedAt?: string;
    aiFailureReason?: string;
  };
  aiProcessingStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'not_needed';
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
}

// ==================== UPLOAD FUNCTIONS ====================

export async function uploadUserFile(fileObj: FileObject): Promise<UploadUserFileResult> {
  console.log('📄 uploadUserFile received:', {
    hasFile: !!fileObj.file,
    hasFileProperty: 'file' in fileObj,
    fileName: fileObj.name,
    isVirtual: fileObj.isVirtual,
    extractedText: !!fileObj.extractedText,
    allKeys: Object.keys(fileObj)
  });

  const storage = getStorage();
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error("User not authenticated");

  // Handle virtual files (no actual file to upload)
  if (fileObj.isVirtual) {
    console.log('🎯 Processing virtual file - skipping file upload');
    
    // For virtual files, we just save metadata without uploading to storage
    return {
      downloadURL: null, // No file was uploaded
      filePath: null,
      isVirtual: true
    };
  }

  // Handle regular files
  const file = fileObj.file;
  if (!file) {
    throw new Error("No file found in fileObj. Expected fileObj.file to contain the File object.");
  }

  // Organize files by user ID
  const fileName = fileObj.name || file.name;
  const filePath = `users/${user.uid}/uploads/${Date.now()}_${fileName}`;
  const fileRef = ref(storage, filePath);

  // Add metadata (e.g., content type, custom fields)
  const metadata = {
    contentType: file.type,
    customMetadata: {
      uploadedBy: user.uid,
      originalFilename: fileName,
      description: "User upload"
    }
  };

  try {
    // Upload file with metadata
    await uploadBytes(fileRef, file, metadata);
    
    // Get download URL
    const downloadURL = await getDownloadURL(fileRef);

    return { downloadURL, filePath };
  } catch (error: any) {
    console.error("Error uploading file:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

export async function saveFileMetadataToFirestore({ downloadURL, filePath, fileObj }: SaveMetadataParams): Promise<string> {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error("User not authenticated");

  try {
    // Handle both regular files and file wrapper objects
    const file = fileObj.file || fileObj; // Support both formats
    const fileName = fileObj.name || (file as File)?.name;
    const fileSize = fileObj.size || (file as File)?.size;
    const fileType = fileObj.type || (file as File)?.type;

    const documentData: Partial<FileMetadata> = {
      fileName: fileName,
      downloadURL,
      storagePath: filePath,
      uploadedBy: user.uid,
      uploadedAt: new Date(),
      fileType: fileType,
      fileSize: fileSize,
    };

    // Add additional metadata for processed files
    if (fileObj.extractedText) {
      documentData.extractedText = fileObj.extractedText;
    }
    if (fileObj.wordCount) {
      documentData.wordCount = fileObj.wordCount;
    }
    if (fileObj.documentType) {
      documentData.documentType = fileObj.documentType;
    }
    if (fileObj.extractedAt) {
      documentData.extractedAt = fileObj.extractedAt;
    }
    if (fileObj.processingStatus) {
      documentData.processingStatus = fileObj.processingStatus;
    }
    if (fileObj.fileHash) {
      documentData.fileHash = fileObj.fileHash;
    }
    if (fileObj.isVirtual) {
      documentData.isVirtual = fileObj.isVirtual;
      documentData.virtualFileType = 'fhir_input';
    }
    if (fileObj.fhirData) {
      documentData.fhirData = fileObj.fhirData;
    }
    if (fileObj.originalText) {
      documentData.originalText = fileObj.originalText;
    }
    if (fileObj.belroseFields) {
      documentData.belroseFields = fileObj.belroseFields;
      console.log('✅ Adding belroseFields to Firestore:', fileObj.belroseFields);
    }
    if (fileObj.aiProcessingStatus) {
      documentData.aiProcessingStatus = fileObj.aiProcessingStatus;
      console.log('✅ Adding aiProcessingStatus to Firestore:', fileObj.aiProcessingStatus);
    }

    const docRef: DocumentReference = await addDoc(collection(db, "users", user.uid, "files"), documentData);

    return docRef.id; // Return the document ID for reference

  } catch (error: any) {
    console.error("Error saving file metadata:", error);
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

  if (!user) throw new Error("User not authenticated");
  if (!documentId) throw new Error("Document ID is required");

  // Filter allowed fields
  const allowedFields = ['fhirData', 'belroseFields', 'extractedText', 'originalText', 'lastModified'];
  const filteredData = Object.keys(updateData)
    .filter(key => allowedFields.includes(key))
    .reduce((obj, key) => {
      obj[key] = updateData[key];
      return obj;
    }, {} as any);

  if (Object.keys(filteredData).length === 0) {
    throw new Error("No valid fields to update");
  }

  // Add timestamp if not already present
  if (!filteredData.lastModified) {
    filteredData.lastModified = new Date().toISOString();
  }

  console.log('🔄 Updating Firestore with filtered data:', filteredData);

  try {
    // Step 1: Get current document state for version control
    const docRef = doc(db, "users", user.uid, "files", documentId);
    const currentDoc = await getDoc(docRef);
    const currentFileObject = currentDoc.exists() ? currentDoc.data() : null;

    if (!currentFileObject) {
      throw new Error("Document not found");
    }

    // Step 2: Update the main document
    await updateDoc(docRef, filteredData);
    console.log('✅ Updated fields:', Object.keys(filteredData));

    // Step 3: Create version (always enabled)
      const {VersionControlService } = await import('@/features/ViewEditRecord/services/versionControlService');
      const versionControl = new VersionControlService();

      const updatedFileObject = {
        ...currentFileObject,
        ...filteredData,
        id: documentId
      };

      await versionControl.createVersion(
        documentId,
        updatedFileObject,
        commitMessage || `Record updated`
      );
        console.log(`✅ Version created for update`)

  } catch (error: any) {
    console.error("❌ Error updating document:", error);
    throw new Error(`Failed to update document: ${error.message}`);
  }
};


// ==================== DELETE FUNCTIONS ====================

/**
 * Delete a file from Firebase Storage
 */
export async function deleteFromStorage(filePath: string | null): Promise<void> {
  if (!filePath) {
    console.log('🎯 No storage path provided - skipping storage deletion (likely virtual file)');
    return; // Virtual files don't have storage files to delete
  }

  const storage = getStorage();
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error("User not authenticated");

  try {
    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);
    console.log('✅ File deleted from storage:', filePath);
  } catch (error: any) {
    // If file doesn't exist in storage, that's okay (might be virtual file)
    if (error.code === 'storage/object-not-found') {
      console.log('ℹ️ File not found in storage (likely virtual file):', filePath);
      return;
    }
    console.error("Error deleting file from storage:", error);
    throw new Error(`Failed to delete file from storage: ${error.message}`);
  }
}

/**
 * Delete a document from Firestore
 */
export async function deleteFromFirestore(documentId: string): Promise<void> {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error("User not authenticated");
  if (!documentId) throw new Error("Document ID is required");

  try {
    const docRef = doc(db, "users", user.uid, "files", documentId);
    await deleteDoc(docRef);
    console.log('✅ Document deleted from Firestore:', documentId);
  } catch (error: any) {
    console.error("Error deleting document from Firestore:", error);
    throw new Error(`Failed to delete document from Firestore: ${error.message}`);
  }
}

/**
 * Get file metadata to determine what needs to be deleted
 */
export async function getFileMetadata(documentId: string): Promise<FileMetadata> {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error("User not authenticated");
  if (!documentId) throw new Error("Document ID is required");

  try {
    const docRef = doc(db, "users", user.uid, "files", documentId);
    const docSnap: DocumentSnapshot = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as FileMetadata;
    } else {
      throw new Error("Document not found");
    }
  } catch (error: any) {
    console.error("Error getting file metadata:", error);
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
}

/**
 * Complete file deletion - removes both storage file and Firestore document
 */
export async function deleteFileComplete(documentId: string): Promise<DeleteResult> {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error("User not authenticated");
  if (!documentId) throw new Error("Document ID is required");

  try {
    // First, get the file metadata to find the storage path
    const fileMetadata = await getFileMetadata(documentId);
    const storagePath = fileMetadata.storagePath;
    
    console.log('🗑️ Starting complete file deletion for:', documentId);
    
    // Delete from storage (if it exists)
    let deletedFromStorage = false;
    if (storagePath) {
      await deleteFromStorage(storagePath);
      deletedFromStorage = true;
    } else {
      console.log('🎯 No storage path found - virtual file, skipping storage deletion');
    }
    
    // Delete from Firestore
    await deleteFromFirestore(documentId);
    
    console.log('✅ Complete file deletion successful:', documentId);
    
    return {
      success: true,
      deletedFromStorage,
      deletedFromFirestore: true
    };
    
  } catch (error: any) {
    console.error("Error in complete file deletion:", error);
    throw error;
  }
}

// ==================== COMBINED WORKFLOWS ====================

/**
 * Combined function for complete file upload workflow
 */
export async function uploadFileComplete(fileObj: FileObject): Promise<UploadFileCompleteResult> {
  try {
    // Upload file to storage (or handle virtual files)
    const { downloadURL, filePath } = await uploadUserFile(fileObj);
    
    // Save metadata to Firestore
    const documentId = await saveFileMetadataToFirestore({
      downloadURL,
      filePath,
      fileObj // Pass the whole fileObj instead of just file
    });

    return { documentId, downloadURL, filePath };
  } catch (error: any) {
    console.error("Error in complete file upload:", error);
    throw error;
  }
}