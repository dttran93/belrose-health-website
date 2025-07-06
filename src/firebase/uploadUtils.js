
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export async function uploadUserFile(file) {
  const storage = getStorage();
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error("User not authenticated");

  // Organize files by user ID
  const filePath = `users/${user.uid}/uploads/${Date.now()}_${file.name}`;
  const fileRef = ref(storage, filePath);

  // Add metadata (e.g., content type, custom fields)
  const metadata = {
    contentType: file.type,
    customMetadata: {
      uploadedBy: user.uid,
      originalFilename: file.name,
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

export async function saveFileMetadataToFirestore({ downloadURL, filePath, file }) {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error("User not authenticated");

  try {
    const docRef = await addDoc(collection(db, "users", user.uid, "files"), {
      fileName: file.name,
      downloadURL,
      storagePath: filePath,
      uploadedBy: user.uid,
      uploadedAt: new Date(),
      fileType: file.type,
      fileSize: file.size,
    });

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
export async function uploadFileComplete(file) {
  try {
    // Upload file to storage
    const { downloadURL, filePath } = await uploadUserFile(file);
    
    // Save metadata to Firestore
    const documentId = await saveFileMetadataToFirestore({
      downloadURL,
      filePath,
      file
    });

    return { documentId, downloadURL, filePath };
  } catch (error) {
    console.error("Error in complete file upload:", error);
    throw error;
  }
}