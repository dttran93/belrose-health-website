// src/features/ViewEditRecord/services/VersionControlService.ts

import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  updateDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  setDoc
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { FileObject } from '@/types/core';
import { diff as jsonDiff } from 'json-diff-ts';
import {
  VersionControlRecord,
  RecordVersion,
  ChangeSet,
  VersionDiff,
  RollbackResult,
  JsonDiffEntry,
  Change,
} from './versionControlService.types';

// ==================== MAIN VERSION CONTROL SERVICE ====================

export class VersionControlService {
  private db = getFirestore();
  private auth = getAuth();

  private get currentUser() {
    return this.auth.currentUser;
  }

  private get userId() {
    if (!this.currentUser) throw new Error("User not authenticated");
    return this.currentUser.uid;
  }

  // ==================== CORE VERSION METHODS ====================

  /**
   * Create the first version when a record is initially saved
   */
  async initializeVersioning(documentId: string, fileObject: FileObject): Promise<string> {
    if (!this.currentUser) throw new Error("User not authenticated");

    const versionId = this.generateVersionId();
    const timestamp = new Date().toISOString();

    // Create initial version
    const initialVersion: RecordVersion = {
      versionId,
      timestamp,
      author: this.userId,
      authorName: this.currentUser.displayName || this.currentUser.email || 'Unknown',
      commitMessage: 'Initial version',
      changes: [], // No changes for initial version
      fileObjectSnapshot: {
        fhirData: fileObject.fhirData || null,
        belroseFields: fileObject.belroseFields || null,
        extractedText: fileObject.extractedText || null,
        originalText: fileObject.originalText || null,
      },
      checksum: this.calculateChecksum(fileObject),
      isInitialVersion: true
    };

    // Create version control record
    const versionControlRecord: VersionControlRecord = {
      currentVersion: versionId,
      documentId,
      metadata: {
        createdAt: timestamp,
        createdBy: this.userId,
        lastModified: timestamp,
        lastModifiedBy: this.userId,
        totalVersions: 1,
        recordTitle: fileObject.belroseFields?.title
      }
    };

    // Save to Firestore
    const versionControlRef = doc(this.db, `users/${this.userId}/recordVersions`, documentId);
    const versionRef = doc(this.db, `users/${this.userId}/recordVersions/${documentId}/versions`, versionId);

    await setDoc(versionControlRef, versionControlRecord);
    await setDoc(versionRef, initialVersion);

    return versionId;
  }

  /**
   * Create a new version when the record is updated
   */
async createVersion(
  documentId: string, 
  updatedFileObject: FileObject, 
  commitMessage?: string
): Promise<string> {
  if (!this.currentUser) throw new Error("User not authenticated");

  console.log(`🔍 Creating version for document: ${documentId}`);

  // Get current version control record
  const versionControlRef = doc(this.db, `users/${this.userId}/recordVersions`, documentId);
  const versionControlDoc = await getDoc(versionControlRef);

  if (!versionControlDoc.exists()) {
    console.log(`📝 No version control exists for ${documentId}, initializing...`);
    // If no version control exists yet, initialize it
    return this.initializeVersioning(documentId, updatedFileObject);
  }

  const versionControlData = versionControlDoc.data() as VersionControlRecord;
  console.log(`📊 Found version control record:`, versionControlData);
  
  // Get the current version to compare against
  const currentVersionRef = doc(
    this.db, 
    `users/${this.userId}/recordVersions/${documentId}/versions`, 
    versionControlData.currentVersion
  );
  const currentVersionDoc = await getDoc(currentVersionRef);

  if (!currentVersionDoc.exists()) {
    console.error(`❌ Current version ${versionControlData.currentVersion} not found for document ${documentId}`);
    console.log(`🔍 Attempting to reinitialize version control...`);
    // Current version is missing, reinitialize
    return this.initializeVersioning(documentId, updatedFileObject);
  }

  const currentVersion = currentVersionDoc.data() as RecordVersion;
  //DEBUGGING
  const newSnapshot = {
  fhirData: updatedFileObject.fhirData ?? null,
  belroseFields: updatedFileObject.belroseFields ?? null,
  extractedText: updatedFileObject.extractedText ?? null,
  originalText: updatedFileObject.originalText ?? null,
    };

  console.log(`✅ Found current version: ${currentVersion.versionId}`);
  console.log("Current version fileObjectSnapshot:", JSON.stringify(currentVersion.fileObjectSnapshot, null, 2));
  console.log("Updated version:", JSON.stringify(currentVersion.fileObjectSnapshot, null, 2));
  console.log("New updated file object snapshot for comparison:", JSON.stringify(newSnapshot, null, 2));

  // Calculate differences
  const changes = this.deepDiff(
    currentVersion.fileObjectSnapshot,
    {
      fhirData: updatedFileObject.fhirData ?? null,
      belroseFields: updatedFileObject.belroseFields ?? null,
      extractedText: updatedFileObject.extractedText ?? null,
      originalText: updatedFileObject.originalText ?? null,
    }
  );

    console.log('Changes Array Content:', changes )

  // Only create a new version if there are actual changes
  if (changes.length === 0) {
    console.log("🔄 No changes detected, skipping version creation");
    return versionControlData.currentVersion;
  }

  console.log(`📝 Creating new version with ${changes.length} changes`);

  const newVersionId = this.generateVersionId();
  const timestamp = new Date().toISOString();

  // Create new version
  const newVersion: RecordVersion = {
    versionId: newVersionId,
    parentVersion: versionControlData.currentVersion,
    timestamp,
    author: this.userId,
    authorName: this.currentUser.displayName || this.currentUser.email || 'Unknown',
    commitMessage: commitMessage || this.generateAutoCommitMessage(changes),
    changes,
    fileObjectSnapshot: {
      fhirData: updatedFileObject.fhirData ?? null,
      belroseFields: updatedFileObject.belroseFields ?? null,
      extractedText: updatedFileObject.extractedText ?? null,
      originalText: updatedFileObject.originalText ?? null,
    },
    checksum: this.calculateChecksum(updatedFileObject),
    isInitialVersion: false
  };

  // Save new version
  const newVersionRef = doc(
    this.db, 
    `users/${this.userId}/recordVersions/${documentId}/versions`, 
    newVersionId
  );

console.log('🔍 About to save version with data:', {
  versionId: newVersion.versionId,
  timestamp: newVersion.timestamp,
  author: newVersion.author,
  authorName: newVersion.authorName,
  commitMessage: newVersion.commitMessage,
  changes: newVersion.changes,
  fileObjectSnapshot: newVersion.fileObjectSnapshot,
  checksum: newVersion.checksum,
  isInitialVersion: newVersion.isInitialVersion
});

// Check for undefined values in the changes array
newVersion.changes.forEach((change, index) => {
  // Type-safe way to check each property
  if (change.operation === undefined) console.error(`🚨 Found undefined operation in change[${index}]`);
  if (change.path === undefined) console.error(`🚨 Found undefined path in change[${index}]`);
  if (change.fieldType === undefined) console.error(`🚨 Found undefined fieldType in change[${index}]`);
  if (change.timestamp === undefined) console.error(`🚨 Found undefined timestamp in change[${index}]`);
  if (change.description === undefined) console.error(`🚨 Found undefined description in change[${index}]`);
  // oldValue and newValue can be undefined/null legitimately, but let's check anyway
  if (change.operation === 'update' && change.oldValue === undefined) {
    console.error(`🚨 Found undefined oldValue in UPDATE change[${index}]:`, change);
  }
  if ((change.operation === 'update' || change.operation === 'create') && change.newValue === undefined) {
    console.error(`🚨 Found undefined newValue in ${change.operation} change[${index}]:`, change);
  }
});

// Check fileObjectSnapshot
const snapshot = newVersion.fileObjectSnapshot;
if (snapshot.fhirData === undefined) console.error(`🚨 Found undefined fhirData in snapshot`);
if (snapshot.belroseFields === undefined) console.error(`🚨 Found undefined belroseFields in snapshot`);
if (snapshot.extractedText === undefined) console.error(`🚨 Found undefined extractedText in snapshot`);
if (snapshot.originalText === undefined) console.error(`🚨 Found undefined originalText in snapshot`);

// Also check top-level properties
const topLevelChecks = {
  versionId: newVersion.versionId,
  timestamp: newVersion.timestamp,
  author: newVersion.author,
  authorName: newVersion.authorName,
  commitMessage: newVersion.commitMessage,
  checksum: newVersion.checksum,
  isInitialVersion: newVersion.isInitialVersion,
  parentVersion: newVersion.parentVersion
};

Object.entries(topLevelChecks).forEach(([key, value]) => {
  if (value === undefined) {
    console.error(`🚨 Found undefined ${key} in newVersion`);
  }
});

  await setDoc(newVersionRef, newVersion);
  console.log(`✅ Created new version: ${newVersionId}`);

  // Update version control record
  await updateDoc(versionControlRef, {
    currentVersion: newVersionId,
    'metadata.lastModified': timestamp,
    'metadata.lastModifiedBy': this.userId,
    'metadata.totalVersions': versionControlData.metadata.totalVersions + 1,
    'metadata.recordTitle': updatedFileObject.belroseFields?.title
  });
  console.log(`✅ Updated version control record`);

  return newVersionId;
}

  // ==================== RETRIEVAL METHODS ====================

  /**
   * Get all versions for a record
   */
  async getVersionHistory(documentId: string): Promise<RecordVersion[]> {
    const versionsRef = collection(
      this.db, 
      `users/${this.userId}/recordVersions/${documentId}/versions`
    );
    const versionsQuery = query(versionsRef, orderBy('timestamp', 'desc'));
    const versionsSnapshot = await getDocs(versionsQuery);
    
    return versionsSnapshot.docs.map(doc => doc.data() as RecordVersion);
  }

  /**
   * Get a specific version
   */
  async getVersion(documentId: string, versionId: string): Promise<RecordVersion | null> {
    const versionRef = doc(
      this.db, 
      `users/${this.userId}/recordVersions/${documentId}/versions`, 
      versionId
    );
    const versionDoc = await getDoc(versionRef);
    
    return versionDoc.exists() ? versionDoc.data() as RecordVersion : null;
  }

  /**
   * Get version control metadata
   */
  async getVersionControlRecord(documentId: string): Promise<VersionControlRecord | null> {
    const versionControlRef = doc(this.db, `users/${this.userId}/recordVersions`, documentId);
    const docSnap = await getDoc(versionControlRef);
    
    return docSnap.exists() ? docSnap.data() as VersionControlRecord : null;
  }

  // ==================== ROLLBACK FUNCTIONALITY ====================

  /**
   * Rollback to a specific version (creates a new version with old data)
   */
  async rollbackToVersion(
    documentId: string, 
    targetVersionId: string, 
    updateMainRecord = true
  ): Promise<RollbackResult> {
    const targetVersion = await this.getVersion(documentId, targetVersionId);
    if (!targetVersion) {
      throw new Error(`Version ${targetVersionId} not found`);
    }

    // Create a new version with the old data
    const restoredFileObject: Partial<FileObject> = {
      id: documentId,
      fhirData: targetVersion.fileObjectSnapshot.fhirData,
      belroseFields: targetVersion.fileObjectSnapshot.belroseFields,
      extractedText: targetVersion.fileObjectSnapshot.extractedText,
    };

    const newVersionId = await this.createVersion(
      documentId,
      restoredFileObject as FileObject,
      `Rollback to version from ${new Date(targetVersion.timestamp).toLocaleString()}`
    );

    // Optionally update the main record
    if (updateMainRecord) {
      const { updateFirestoreRecord } = await import('@/firebase/uploadUtils');
      await updateFirestoreRecord(documentId, {
        fhirData: targetVersion.fileObjectSnapshot.fhirData,
        belroseFields: targetVersion.fileObjectSnapshot.belroseFields,
        lastModified: new Date().toISOString()
      });
    }

    return {
      versionId: newVersionId,
      restoredData: targetVersion.fileObjectSnapshot
    };
  }

  // ==================== UTILITY METHODS ====================

  private calculateDifferences(oldData: any, newData: any): ChangeSet[] {
  try {
    const diffResult = jsonDiff(oldData, newData);
    
    console.log('🔍 Raw diff result:', diffResult);
    console.log('🔍 Diff result type:', typeof diffResult);
    console.log('🔍 Is array:', Array.isArray(diffResult));
    
    if (!diffResult || !Array.isArray(diffResult)) {
      console.log('No changes detected');
      return [];
    }
    
    const timestamp = new Date().toISOString();
    const changes = this.convertJsonDiffToChangeSets(diffResult, timestamp);
    console.log('🔍 Final changes:', changes);
    return changes;
  } catch (error) {
    console.error('Error calculating differences:', error);
    return [];
  }
}

private convertJsonDiffToChangeSets(differences: any[], timestamp: string): ChangeSet[] {
  const changes: ChangeSet[] = [];
  
  differences.forEach((change, index) => {
    console.log(`🔍 Processing change ${index}:`, change);
    
    // Handle based on json-diff-ts actual format
    if (change.type === 'UPDATE') {
      changes.push({
        operation: 'update',
        path: change.key || change.path || `change_${index}`,
        oldValue: change.oldValue ?? null,
        newValue: change.value ?? null,
        fieldType: typeof (change.value ?? 'unknown'),
        timestamp,
        description: `Updated ${this.pathToHumanReadable(change.key || change.path || `change_${index}`)}`
      });
    } else if (change.type === 'ADD') {
      changes.push({
        operation: 'create',
        path: change.key || change.path || `change_${index}`,
        oldValue: null,
        newValue: change.value ?? null,
        fieldType: typeof (change.value ?? 'unknown'),
        timestamp,
        description: `Added ${this.pathToHumanReadable(change.key || change.path || `change_${index}`)}`
      });
    } else if (change.type === 'REMOVE') {
      changes.push({
        operation: 'delete',
        path: change.key || change.path || `change_${index}`,
        oldValue: change.oldValue ?? change.value ?? null,
        newValue: null,
        fieldType: typeof (change.oldValue ?? change.value ?? 'unknown'),
        timestamp,
        description: `Deleted ${this.pathToHumanReadable(change.key || change.path || `change_${index}`)}`
      });
    }
    
    console.log(`🔍 Changes array now has ${changes.length} items`);
  });
  
  return changes;
}

  private pathToHumanReadable(path: string): string {
    // Convert JSON paths to human-readable descriptions
    return path
      .replace(/^fhirData\./, 'FHIR ')
      .replace(/^belroseFields\./, '')
      .replace(/\./g, ' > ')
      .replace(/\[(\d+)\]/g, ' #$1')
      .toLowerCase();
  }

  private generateAutoCommitMessage(changes: ChangeSet[]): string {
    const operations = {
      create: changes.filter(c => c.operation === 'create').length,
      update: changes.filter(c => c.operation === 'update').length,
      delete: changes.filter(c => c.operation === 'delete').length
    };

    const parts: string[] = [];
    if (operations.update > 0) parts.push(`${operations.update} field${operations.update > 1 ? 's' : ''} updated`);
    if (operations.create > 0) parts.push(`${operations.create} field${operations.create > 1 ? 's' : ''} added`);
    if (operations.delete > 0) parts.push(`${operations.delete} field${operations.delete > 1 ? 's' : ''} removed`);

    return parts.length > 0 ? parts.join(', ') : 'Record updated';
  }

  private generateVersionId(): string {
    return `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

    private calculateChecksum(fileObject: FileObject | Partial<FileObject>): string {
        // Create a deterministic string representation for checksumming
        const data = {
            fhirData: fileObject.fhirData ?? null,
            belroseFields: fileObject.belroseFields ?? null,
            extractedText: fileObject.extractedText ?? null,
            originalText: fileObject.originalText ?? null
        };
        
        const dataString = JSON.stringify(data, Object.keys(data).sort());
        
        // Simple hash function (you could use crypto for better hashing)
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(16);
    }

  // ==================== COMPARISON UTILITIES ====================

private deepDiff(oldObj: any, newObj: any, path: string = ''): Change[] {
  const changes: Change[] = [];

  // Handle null/undefined cases
  if (oldObj === null || oldObj === undefined) {
    if (newObj !== null && newObj !== undefined) {
      changes.push({
        operation: 'create',
        path: path || 'root',
        oldValue: oldObj,
        newValue: newObj,
        description: `Added new value at ${path || 'root'}`
      });
    }
    return changes;
  }

  if (newObj === null || newObj === undefined) {
    changes.push({
      operation: 'delete',
      path: path || 'root',
      oldValue: oldObj,
      newValue: newObj,
      description: `Removed value from ${path || 'root'}`
    });
    return changes;
  }

  // Handle primitive types
  if (typeof oldObj !== 'object' || typeof newObj !== 'object') {
    if (oldObj !== newObj) {
      changes.push({
        operation: 'update',
        path: path || 'root',
        oldValue: oldObj,
        newValue: newObj,
        description: `Updated ${path || 'root'} from "${oldObj}" to "${newObj}"`
      });
    }
    return changes;
  }

  // Handle arrays
  if (Array.isArray(oldObj) || Array.isArray(newObj)) {
    const oldArray = Array.isArray(oldObj) ? oldObj : [];
    const newArray = Array.isArray(newObj) ? newObj : [];
    
    const maxLength = Math.max(oldArray.length, newArray.length);
    
    for (let i = 0; i < maxLength; i++) {
      const arrayPath = path ? `${path}[${i}]` : `[${i}]`;
      
      if (i >= oldArray.length) {
        // New item added
        changes.push({
          operation: 'create',
          path: arrayPath,
          oldValue: undefined,
          newValue: newArray[i],
          description: `Added new array item at index ${i}`
        });
      } else if (i >= newArray.length) {
        // Item removed
        changes.push({
          operation: 'delete',
          path: arrayPath,
          oldValue: oldArray[i],
          newValue: undefined,
          description: `Removed array item at index ${i}`
        });
      } else {
        // Recursively compare array items
        changes.push(...this.deepDiff(oldArray[i], newArray[i], arrayPath));
      }
    }
    
    return changes;
  }

  // Handle objects
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  
  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    
    if (!(key in oldObj)) {
      // New property added
      changes.push({
        operation: 'create',
        path: newPath,
        oldValue: undefined,
        newValue: newObj[key],
        description: `Added new property "${key}"`
      });
    } else if (!(key in newObj)) {
      // Property removed
      changes.push({
        operation: 'delete',
        path: newPath,
        oldValue: oldObj[key],
        newValue: undefined,
        description: `Removed property "${key}"`
      });
    } else {
      // Property exists in both - recursively compare
      changes.push(...this.deepDiff(oldObj[key], newObj[key], newPath));
    }
  }

  return changes;
}

private generateDiffSummary(changes: Change[], olderVersion: any, newerVersion: any): string {
  if (changes.length === 0) {
    return 'No changes between versions';
  }

  const operations = {
    create: changes.filter(c => c.operation === 'create').length,
    update: changes.filter(c => c.operation === 'update').length,
    delete: changes.filter(c => c.operation === 'delete').length
  };

  const parts: string[] = [];
  if (operations.update > 0) parts.push(`${operations.update} updated`);
  if (operations.create > 0) parts.push(`${operations.create} added`);
  if (operations.delete > 0) parts.push(`${operations.delete} removed`);

  const olderDate = new Date(olderVersion.timestamp).toLocaleDateString();
  const newerDate = new Date(newerVersion.timestamp).toLocaleDateString();
  
  return `${parts.join(', ')} between ${olderDate} and ${newerDate}`;
}

private async getVersionData(documentId: string, versionId: string): Promise<{data: any, timestamp: string} | null> {
  const version = await this.getVersion(documentId, versionId);
  if (!version) return null;
  
  return {
    data: version.fileObjectSnapshot,
    timestamp: version.timestamp
  };
}
  /**
   * Compare two versions and return a detailed diff
   */
async compareVersions(documentId: string, olderVersionId: string, newerVersionId: string): Promise<VersionDiff> {
  try {
    // Fetch both versions
    const [olderVersion, newerVersion] = await Promise.all([
      this.getVersionData(documentId, olderVersionId),
      this.getVersionData(documentId, newerVersionId)
    ]);

    if (!olderVersion || !newerVersion) {
      throw new Error('One or both versions not found');
    }

    // Perform deep diff
    const changes = this.deepDiff(olderVersion.data, newerVersion.data);

    // Create summary
    const summary = this.generateDiffSummary(changes, olderVersion, newerVersion);

    return {
      olderVersionId,
      newerVersionId,
      changes,
      summary,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error comparing versions:', error);
    throw new Error(`Failed to compare versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

  /**
   * Get recent versions (for quick access)
   */
  async getRecentVersions(documentId: string, limitCount = 10): Promise<RecordVersion[]> {
    const versionsRef = collection(
      this.db, 
      `users/${this.userId}/recordVersions/${documentId}/versions`
    );
    const recentQuery = query(
      versionsRef, 
      orderBy('timestamp', 'desc'), 
      limit(limitCount)
    );
    
    const snapshot = await getDocs(recentQuery);
    return snapshot.docs.map(doc => doc.data() as RecordVersion);
  }
}
