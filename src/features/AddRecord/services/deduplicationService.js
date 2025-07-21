export class DeduplicationService {
    constructor() {
        this.processedFileHashes = new Set();
        this.firestoreDocIds = new Set();
        this.uploadAttempts = new Map();
        this.processingLocks = new Set();
    }

    async generateFileHash(file) {
        const buffer = await file.arrayBuffer();
        const hashData = `${file.name}-${file.size}-${file.lastModified}-${buffer.byteLength}`;
        
        let hash = 0;
        for (let i = 0; i < hashData.length; i++) {
            const char = hashData.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    isFileAlreadyProcessed(fileHash, fileId, firestoreData) {
        return this.processedFileHashes.has(fileHash) || 
               firestoreData.has(fileId) || 
               this.processingLocks.has(fileId);
    }

    markFileAsProcessing(fileHash, fileId) {
        this.processedFileHashes.add(fileHash);
        this.processingLocks.add(fileId);
    }

    releaseProcessingLock(fileId, fileHash) {
        this.processingLocks.delete(fileId);
        if (fileHash) {
            this.processedFileHashes.delete(fileHash);
        }
    }

    incrementUploadAttempt(fileId) {
        this.uploadAttempts.set(fileId, (this.uploadAttempts.get(fileId) || 0) + 1);
        return this.uploadAttempts.get(fileId);
    }

    addFirestoreDocId(docId) {
        this.firestoreDocIds.add(docId);
    }

    clear() {
        this.processedFileHashes.clear();
        this.firestoreDocIds.clear();
        this.uploadAttempts.clear();
        this.processingLocks.clear();
    }

    getStats() {
        return {
            totalHashesTracked: this.processedFileHashes.size,
            firestoreDocsTracked: this.firestoreDocIds.size,
            uploadRetries: Array.from(this.uploadAttempts.entries()),
            currentlyProcessing: this.processingLocks.size
        };
    }
}
