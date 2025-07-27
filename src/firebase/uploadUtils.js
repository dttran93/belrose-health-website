import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export async function uploadUserFile(fileObj) {
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
  } catch (error) {
    console.error("Error uploading file:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

export async function saveFileMetadataToFirestore({ downloadURL, filePath, fileObj }) {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error("User not authenticated");

  try {
    // Handle both regular files and file wrapper objects
    const file = fileObj.file || fileObj; // Support both formats
    const fileName = fileObj.name || file.name;
    const fileSize = fileObj.size || file.size;
    const fileType = fileObj.type || file.type;

    const documentData = {
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

    const docRef = await addDoc(collection(db, "users", user.uid, "files"), documentData);

    return docRef.id; // Return the document ID for reference
  } catch (error) {
    console.error("Error saving file metadata:", error);
    throw new Error(`Failed to save file metadata: ${error.message}`);
  }
}

export const updateFirestoreWithFHIR = async (documentId, fhirData) => {
  console.log("documentID received:", documentId, "type:", typeof documentId);

  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;

  if(!user) throw new Error ("User not authenticated");

  if (!documentId) {
    console.error("Document ID is undefined, null, or empty");
    throw new Error("Document ID is required");
  }
  
  try {
    const docRef = doc(db, "users", user.uid, "files", documentId);
    await updateDoc(docRef, {
      fhirData: fhirData,
      fhirConvertedAt: new Date().toISOString(),
      processingStatus: 'fhir_converted'
    });
  } catch (error) {
    console.error("Error updating document with FHIR data:", error);
    throw new Error(`Failed to update document: ${error.message}`);
  }
};

// Combined function for complete file upload workflow
export async function uploadFileComplete(fileObj) {
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
  } catch (error) {
    console.error("Error in complete file upload:", error);
    throw error;
  }
}