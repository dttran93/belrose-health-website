import { saveFileMetadataToFirestore, uploadUserFile } from '@/firebase/uploadUtils';

export class FileUploadService {
    async uploadSingleFile(fileObj) {
        // Pass the entire fileObj to uploadUserFile
        const { downloadURL, filePath } = await uploadUserFile(fileObj);
        
        const firestoreDoc = await saveFileMetadataToFirestore({
            downloadURL,
            filePath,
            fileObj: fileObj // Pass the entire fileObj
        });

        return {
            firestoreId: firestoreDoc,
            downloadURL,
            filePath,
            savedAt: new Date().toISOString(),
            fileHash: fileObj.fileHash
        };
    }

    async uploadWithRetry(fileObj, maxRetries = 3, onProgress) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                onProgress?.('uploading', attempt + 1);
                const result = await this.uploadSingleFile(fileObj);
                onProgress?.('success', result);
                return result;
            } catch (error) {
                console.error(`Upload attempt ${attempt + 1} failed for ${fileObj.name}:`, error);
                
                if (attempt === maxRetries) {
                    onProgress?.('error', error);
                    throw new Error(`Failed to upload ${fileObj.name} after ${maxRetries + 1} attempts: ${error.message}`);
                }
                
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}