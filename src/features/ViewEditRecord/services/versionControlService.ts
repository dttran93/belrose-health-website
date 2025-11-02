// src/features/ViewEditRecord/services/versionControlService.ts

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { FileObject } from '@/types/core';
import { diff as jsonDiff, IChange } from 'json-diff-ts';
import { RecordVersion, VersionDiff, RollbackResult, Change } from './versionControlService.types';

// ==================== MAIN VERSION CONTROL SERVICE ====================

export class VersionControlService {
  private db = getFirestore();
  private auth = getAuth();

  private get currentUser() {
    return this.auth.currentUser;
  }

  private get userId() {
    if (!this.currentUser) throw new Error('User not authenticated');
    return this.currentUser.uid;
  }

  // ==================== CORE VERSION METHODS ====================

  /**
   * Create a new version in the GLOBAL version history
   */
  async createVersion(
    recordId: string,
    updatedRecord: FileObject,
    commitMessage?: string
  ): Promise<string> {
    if (!this.currentUser) throw new Error('User not authenticated');

    console.log('📝 Creating version for record:', recordId);

    try {
      const previousVersions = await this.getVersions(recordId, 1);
      const previousVersion = previousVersions[0];
      const versionNumber = previousVersion ? previousVersion.versionNumber + 1 : 1;

      // Calculate changes if there's a previous version
      let changes: Change[] = [];
      if (previousVersion) {
        changes = this.calculateDifferences(previousVersion.fileObjectSnapshot, {
          fhirData: updatedRecord.fhirData ?? null,
          belroseFields: updatedRecord.belroseFields ?? null,
          extractedText: updatedRecord.extractedText ?? null,
          originalText: updatedRecord.originalText ?? null,
          blockchainVerification: updatedRecord.blockchainVerification ?? null,
        });
      }

      const version: RecordVersion = {
        recordId,
        versionNumber,

        // Who and when
        editedBy: this.userId,
        editedByName: this.currentUser.displayName || this.currentUser.email || 'Unknown User',
        editedAt: Timestamp.now(),

        // Changes
        changes: changes,
        commitMessage: commitMessage || this.generateAutoCommitMessage(changes),

        // 🎯 Integrity at parent level
        recordHash: updatedRecord.recordHash || '',
        previousRecordHash: updatedRecord.previousRecordHash || undefined,
        originalFileHash: updatedRecord.originalFileHash || undefined,

        // Full snapshot (data only, no metadata)
        fileObjectSnapshot: {
          fhirData: updatedRecord.fhirData ?? null,
          belroseFields: updatedRecord.belroseFields ?? null,
          extractedText: updatedRecord.extractedText ?? null,
          originalText: updatedRecord.originalText ?? null,
          blockchainVerification: updatedRecord.blockchainVerification ?? null,
        },
      };

      const versionRef = await addDoc(collection(this.db, 'recordVersions'), version);

      console.log('✅ Version created:', versionRef.id);
      return versionRef.id;
    } catch (error: any) {
      console.error('❌ Failed to create version:', error);
      throw new Error(`Failed to create version: ${error.message}`);
    }
  }

  /**
   * Get all versions for a record
   */
  async getVersions(recordId: string, limitCount?: number): Promise<RecordVersion[]> {
    if (!this.currentUser) throw new Error('User not authenticated');

    try {
      // 🆕 Query GLOBAL recordVersions collection
      let q = query(
        collection(this.db, 'recordVersions'),
        where('recordId', '==', recordId),
        orderBy('versionNumber', 'desc')
      );

      if (limitCount) {
        q = query(q, limit(limitCount));
      }

      const snapshot = await getDocs(q);

      const versions: RecordVersion[] = snapshot.docs.map(
        doc =>
          ({
            id: doc.id,
            ...doc.data(),
          } as RecordVersion)
      );

      console.log(`📚 Found ${versions.length} versions for record ${recordId}`);
      return versions;
    } catch (error: any) {
      console.error('❌ Failed to get versions:', error);
      throw new Error(`Failed to get versions: ${error.message}`);
    }
  }

  /**
   * Get a specific version by ID
   */
  async getVersion(versionId: string): Promise<RecordVersion | null> {
    try {
      const versionRef = doc(this.db, 'recordVersions', versionId);
      const versionSnap = await getDoc(versionRef);

      if (!versionSnap.exists()) {
        return null;
      }

      return {
        id: versionSnap.id,
        ...versionSnap.data(),
      } as RecordVersion;
    } catch (error: any) {
      console.error('❌ Failed to get version:', error);
      throw new Error(`Failed to get version: ${error.message}`);
    }
  }

  /**
   * Get version history for display (with user verification)
   */
  async getVersionHistory(recordId: string): Promise<RecordVersion[]> {
    if (!this.currentUser) throw new Error('User not authenticated');

    // Verify user has access to this record
    const recordRef = doc(this.db, 'records', recordId);
    const recordSnap = await getDoc(recordRef);

    if (!recordSnap.exists()) {
      throw new Error('Record not found');
    }

    const recordData = recordSnap.data();
    const owners = recordData.owners || [recordData.uploadedBy];

    if (!owners.includes(this.userId)) {
      throw new Error("You do not have permission to view this record's history");
    }

    return this.getVersions(recordId);
  }

  /**
   * Restore a record to a previous version
   */
  async rollbackToVersion(
    recordId: string,
    versionId: string,
    updateMainRecord = true
  ): Promise<RollbackResult> {
    if (!this.currentUser) throw new Error('User not authenticated');

    console.log('♻️ Restoring record to version:', versionId);

    try {
      // Get the version
      const version = await this.getVersion(versionId);
      if (!version) {
        throw new Error('Version not found');
      }

      // Verify user owns the record
      const recordRef = doc(this.db, 'records', recordId);
      const recordSnap = await getDoc(recordRef);

      if (!recordSnap.exists()) {
        throw new Error('Record not found');
      }

      const recordData = recordSnap.data();
      const owners = recordData.owners || [recordData.uploadedBy];

      if (!owners.includes(this.userId)) {
        throw new Error('You do not have permission to restore this record');
      }

      // Create a new version before restoring (so we can undo the restore)
      await this.createVersion(
        recordId,
        recordData as FileObject,
        `Before restoring to version ${version.versionNumber}`
      );

      // Optionally update the main record
      if (updateMainRecord) {
        const { updateFirestoreRecord } = await import('@/firebase/uploadUtils');
        await updateFirestoreRecord(
          recordId,
          version.fileObjectSnapshot,
          `Restored to version ${version.versionNumber}`
        );
      }

      console.log('✅ Record restored to version:', version.versionNumber);

      return {
        versionId: versionId,
        restoredData: version.fileObjectSnapshot,
      };
    } catch (error: any) {
      console.error('❌ Failed to restore version:', error);
      throw new Error(`Failed to restore version: ${error.message}`);
    }
  }

  /**
   * Delete all versions for a record (called when record is deleted)
   */
  async deleteAllVersions(recordId: string): Promise<void> {
    if (!this.currentUser) throw new Error('User not authenticated');

    try {
      console.log('🗑️ Deleting all versions for record:', recordId);

      // Get all versions
      const q = query(collection(this.db, 'recordVersions'), where('recordId', '==', recordId));

      const snapshot = await getDocs(q);

      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      console.log(`✅ Deleted ${snapshot.docs.length} versions`);
    } catch (error: any) {
      console.error('❌ Failed to delete versions:', error);
      // Don't throw - versions are optional
      console.warn('⚠️ Continuing despite version deletion error');
    }
  }

  /**
   * Compare two versions
   */
  async compareVersions(versionId1: string, versionId2: string): Promise<VersionDiff> {
    const version1 = await this.getVersion(versionId1);
    const version2 = await this.getVersion(versionId2);

    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }

    // Ensure we're comparing the right order (older -> newer)
    const [olderVersion, newerVersion] =
      version1.versionNumber < version2.versionNumber ? [version1, version2] : [version2, version1];

    const changes = this.calculateDifferences(
      olderVersion.fileObjectSnapshot,
      newerVersion.fileObjectSnapshot
    );

    return {
      olderVersionId: olderVersion.id || '',
      newerVersionId: newerVersion.id || '',
      changes,
      summary: this.generateDiffSummary(changes),
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== UTILITY METHODS ====================

  private calculateDifferences(oldData: any, newData: any): Change[] {
    try {
      const diffResult: IChange[] = jsonDiff(oldData, newData);

      if (!diffResult || diffResult.length === 0) {
        return [];
      }

      return this.flattenDiffToChanges(diffResult);
    } catch (error) {
      console.error('Error calculating differences:', error);
      return [];
    }
  }

  private flattenDiffToChanges(diffEntries: IChange[], pathPrefix: string = ''): Change[] {
    const changes: Change[] = [];

    for (const entry of diffEntries) {
      const currentPath = pathPrefix ? `${pathPrefix}.${entry.key}` : entry.key || '';

      if (entry.type === 'UPDATE') {
        changes.push({
          operation: 'update',
          path: currentPath,
          oldValue: entry.oldValue,
          newValue: entry.value,
          description: `Updated ${currentPath}`,
        });
      } else if (entry.type === 'ADD') {
        changes.push({
          operation: 'create',
          path: currentPath,
          newValue: entry.value,
          description: `Added ${currentPath}`,
        });
      } else if (entry.type === 'REMOVE') {
        changes.push({
          operation: 'delete',
          path: currentPath,
          oldValue: entry.value,
          description: `Removed ${currentPath}`,
        });
      }

      // Recursively process nested changes
      if (entry.changes && entry.changes.length > 0) {
        const nestedChanges = this.flattenDiffToChanges(entry.changes, currentPath);
        changes.push(...nestedChanges);
      }
    }

    return changes;
  }

  private generateAutoCommitMessage(changes: Change[]): string {
    if (changes.length === 0) return 'No changes';
    if (changes.length === 1) return changes[0]?.description || 'Updated record';

    const operationCounts = changes.reduce((acc, change) => {
      acc[change.operation] = (acc[change.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const parts: string[] = [];
    if (operationCounts.create) parts.push(`${operationCounts.create} added`);
    if (operationCounts.update) parts.push(`${operationCounts.update} updated`);
    if (operationCounts.delete) parts.push(`${operationCounts.delete} removed`);

    return parts.join(', ');
  }

  private generateDiffSummary(changes: Change[]): string {
    const totalChanges = changes.length;
    if (totalChanges === 0) return 'No changes';

    const changedFields = new Set(changes.map(c => c.path.split('.')[0]));
    return `${totalChanges} change(s) across ${changedFields.size} field(s)`;
  }
}
