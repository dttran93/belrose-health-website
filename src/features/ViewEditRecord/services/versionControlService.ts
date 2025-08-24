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
  RollbackResult
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
        fhirData: fileObject.fhirData,
        belroseFields: fileObject.belroseFields,
        extractedText: fileObject.extractedText,
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

    // Get current version control record
    const versionControlRef = doc(this.db, `users/${this.userId}/recordVersions`, documentId);
    const versionControlDoc = await getDoc(versionControlRef);

    if (!versionControlDoc.exists()) {
      // If no version control exists yet, initialize it
      return this.initializeVersioning(documentId, updatedFileObject);
    }

    const versionControlData = versionControlDoc.data() as VersionControlRecord;
    
    // Get the current version to compare against
    const currentVersionRef = doc(
      this.db, 
      `users/${this.userId}/recordVersions/${documentId}/versions`, 
      versionControlData.currentVersion
    );
    const currentVersionDoc = await getDoc(currentVersionRef);

    if (!currentVersionDoc.exists()) {
      throw new Error("Current version not found");
    }

    const currentVersion = currentVersionDoc.data() as RecordVersion;
    
    // Calculate differences
    const changes = this.calculateDifferences(
      currentVersion.fileObjectSnapshot,
      {
        fhirData: updatedFileObject.fhirData,
        belroseFields: updatedFileObject.belroseFields,
        extractedText: updatedFileObject.extractedText,
      }
    );

    // Only create a new version if there are actual changes
    if (changes.length === 0) {
      console.log("No changes detected, skipping version creation");
      return versionControlData.currentVersion;
    }

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
        fhirData: updatedFileObject.fhirData,
        belroseFields: updatedFileObject.belroseFields,
        extractedText: updatedFileObject.extractedText,
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
    await setDoc(newVersionRef, newVersion);

    // Update version control record
    await updateDoc(versionControlRef, {
      currentVersion: newVersionId,
      'metadata.lastModified': timestamp,
      'metadata.lastModifiedBy': this.userId,
      'metadata.totalVersions': versionControlData.metadata.totalVersions + 1,
      'metadata.recordTitle': updatedFileObject.belroseFields?.title
    });

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
    const changes: ChangeSet[] = [];
    
    try {
      const diffResult = jsonDiff(oldData, newData);
      
      if (!diffResult || !Array.isArray(diffResult)) return changes;
      
      this.convertJsonDiffToChangeSets(diffResult, changes);
      return changes;
    } catch (error) {
      console.error('Error calculating differences:', error);
      return changes;
    }
  }

  private convertJsonDiffToChangeSets(diffResult: any[], changes: ChangeSet[]): void {
    diffResult.forEach((change: any) => {
      const timestamp = new Date().toISOString();
      
      // json-diff-ts returns objects with type, key, value, oldValue, etc.
      if (change.type === 'UPDATE') {
        changes.push({
          operation: 'update',
          path: change.path || change.key,
          oldValue: change.oldValue,
          newValue: change.value,
          fieldType: typeof change.value,
          timestamp,
          description: `Updated ${this.pathToHumanReadable(change.path || change.key)}`
        });
      } else if (change.type === 'ADD') {
        changes.push({
          operation: 'create',
          path: change.path || change.key,
          newValue: change.value,
          fieldType: typeof change.value,
          timestamp,
          description: `Added ${this.pathToHumanReadable(change.path || change.key)}`
        });
      } else if (change.type === 'REMOVE') {
        changes.push({
          operation: 'delete',
          path: change.path || change.key,
          oldValue: change.oldValue || change.value,
          fieldType: typeof (change.oldValue || change.value),
          timestamp,
          description: `Deleted ${this.pathToHumanReadable(change.path || change.key)}`
        });
      }
      
      // Handle nested changes
      if (change.changes && Array.isArray(change.changes)) {
        this.convertJsonDiffToChangeSets(change.changes, changes);
      }
    });
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
      fhirData: fileObject.fhirData,
      belroseFields: fileObject.belroseFields,
      extractedText: fileObject.extractedText
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

  /**
   * Compare two versions and return a detailed diff
   */
  async compareVersions(
    documentId: string, 
    versionId1: string, 
    versionId2: string
  ): Promise<VersionDiff> {
    const [version1, version2] = await Promise.all([
      this.getVersion(documentId, versionId1),
      this.getVersion(documentId, versionId2)
    ]);

    if (!version1 || !version2) {
      throw new Error("One or both versions not found");
    }

    const changes = this.calculateDifferences(
      version1.fileObjectSnapshot,
      version2.fileObjectSnapshot
    );

    return {
      versionId: versionId2,
      parentVersionId: versionId1,
      timestamp: version2.timestamp,
      changes,
      summary: this.generateAutoCommitMessage(changes)
    };
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