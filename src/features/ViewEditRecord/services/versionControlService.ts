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
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';

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
    console.log('  - Is encrypted:', !!updatedRecord.isEncrypted);

    try {
      const previousVersions = await this.getVersions(recordId);
      const previousVersion = previousVersions[0];
      const versionNumber = previousVersion ? previousVersion.versionNumber + 1 : 1;

      if (previousVersions.length === 0) {
        console.log('📦 No previous versions found — creating initial version first...');
        await this.initializeVersioning(recordId, updatedRecord);
      }

      // Calculate changes if there's a previous version
      let changes: Change[] = [];
      if (previousVersion) {
        const previousSnapshot = await this.decryptVersionSnapshot(previousVersion);
        const currentSnapshot = {
          fileName: updatedRecord.fileName,
          fhirData: updatedRecord.fhirData ?? null,
          belroseFields: updatedRecord.belroseFields ?? null,
          extractedText: updatedRecord.extractedText ?? null,
          originalText: updatedRecord.originalText ?? null,
        };

        changes = this.calculateDifferences(previousSnapshot, currentSnapshot);
        changes = this.cleanUndefinedValues(changes);
      }

      const version: any = {
        recordId,
        versionNumber,
        editedBy: this.userId,
        editedByName: this.currentUser.displayName || this.currentUser.email || 'Unknown User',
        editedAt: Timestamp.now(),
        recordHash: updatedRecord.recordHash || '',
      };

      // Handle changes encryption
      if (updatedRecord.isEncrypted && changes.length > 0) {
        console.log('  🔐 Encrypting changes array...');

        // Encrypt the changes using the record's DEK
        version.encryptedChanges = await this.encryptChanges(changes, updatedRecord.encryptedKey!);
        version.hasEncryptedChanges = true;

        // Generate commit message BEFORE encrypting (we still have the changes array)
        version.commitMessage = commitMessage || this.generateAutoCommitMessage(changes);

        console.log('  ✅ Changes encrypted');
      } else if (changes.length > 0) {
        console.log('  📝 Storing plain changes...');

        // For unencrypted records, store changes in plain text
        version.changes = changes;
        version.hasEncryptedChanges = false;
        version.commitMessage = commitMessage || this.generateAutoCommitMessage(changes);
      } else {
        // No changes (initial version or no diff)
        version.changes = [];
        version.hasEncryptedChanges = false;
        version.commitMessage = commitMessage || 'No changes';
      }

      // Store encrypted or plain snapshot
      if (updatedRecord.isEncrypted) {
        console.log('  🔐 Storing encrypted snapshot...');
        version.recordSnapshot = {
          encryptedFileName: updatedRecord.encryptedFileName,
          encryptedExtractedText: updatedRecord.encryptedExtractedText,
          encryptedOriginalText: updatedRecord.encryptedOriginalText,
          encryptedFhirData: updatedRecord.encryptedFhirData,
          encryptedBelroseFields: updatedRecord.encryptedBelroseFields,
          encryptedKey: updatedRecord.encryptedKey,
          isEncrypted: true,
        };
      } else {
        console.log('  📝 Storing plain snapshot...');
        version.recordSnapshot = {
          fileName: updatedRecord.fileName,
          extractedText: updatedRecord.extractedText ?? null,
          originalText: updatedRecord.originalText ?? null,
          fhirData: updatedRecord.fhirData ?? null,
          belroseFields: updatedRecord.belroseFields ?? null,
          isEncrypted: false,
          fileType: updatedRecord.fileType,
          fileSize: updatedRecord.fileSize,
        };
      }

      // Add optional fields
      if (updatedRecord.previousRecordHash) {
        version.previousRecordHash = updatedRecord.previousRecordHash;
      }
      if (updatedRecord.originalFileHash) {
        version.originalFileHash = updatedRecord.originalFileHash;
      }

      const cleanedVersion = this.cleanUndefinedValues(version);
      const versionRef = await addDoc(collection(this.db, 'recordVersions'), cleanedVersion);

      console.log('✅ Version created:', versionRef.id);
      return versionRef.id;
    } catch (error: any) {
      console.error('❌ Failed to create version:', error);
      throw new Error(`Failed to create version: ${error.message}`);
    }
  }

  /**
   * Create an initial version snapshot when none exist yet
   */
  private async initializeVersioning(recordId: string, recordData: FileObject): Promise<string> {
    if (!this.currentUser) throw new Error('User not authenticated');

    const version: any = {
      recordId,
      versionNumber: 1,
      editedBy: this.userId,
      editedByName: this.currentUser.displayName || this.currentUser.email || 'Unknown User',
      editedAt: Timestamp.now(),
      commitMessage: 'Initial version (auto-created)',
      recordHash: recordData.recordHash || '',
      changes: [],
    };

    // Store a snapshot of the record (encrypted or not)
    if (recordData.isEncrypted) {
      version.recordSnapshot = {
        encryptedFileName: recordData.encryptedFileName ?? null,
        encryptedExtractedText: recordData.encryptedExtractedText ?? null,
        encryptedOriginalText: recordData.encryptedOriginalText ?? null,
        encryptedFhirData: recordData.encryptedFhirData ?? null,
        encryptedBelroseFields: recordData.encryptedBelroseFields ?? null,
        encryptedKey: recordData.encryptedKey ?? null,
        isEncrypted: true,
        fileType: recordData.fileType ?? null,
        fileSize: recordData.fileSize ?? null,
      };
    } else {
      version.recordSnapshot = {
        fileName: recordData.fileName ?? null,
        extractedText: recordData.extractedText ?? null,
        originalText: recordData.originalText ?? null,
        fhirData: recordData.fhirData ?? null,
        belroseFields: recordData.belroseFields ?? null,
        isEncrypted: false,
        fileType: recordData.fileType ?? null,
        fileSize: recordData.fileSize ?? null,
      };
    }

    const cleaned = this.cleanUndefinedValues(version);
    const docRef = await addDoc(collection(this.db, 'recordVersions'), cleaned);
    console.log('🆕 Initial version created:', docRef.id);
    return docRef.id;
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
   * Get changes for a version, decrypting if necessary
   * Returns the actual Change[] array that can be displayed
   */
  async getVersionChanges(version: RecordVersion): Promise<Change[]> {
    // If changes are encrypted, decrypt them
    if (version.hasEncryptedChanges && version.encryptedChanges) {
      // Type guard: ensure we have an encrypted snapshot
      if (!version.recordSnapshot.isEncrypted) {
        throw new Error('Cannot decrypt changes: Version has encrypted changes but plain snapshot');
      }

      if (!version.recordSnapshot.encryptedKey) {
        throw new Error('Cannot decrypt changes: Missing encryption key');
      }

      // ✅ TypeScript now knows this is an EncryptedSnapshot
      return await this.decryptChanges(
        version.encryptedChanges,
        version.recordSnapshot.encryptedKey
      );
    }

    // Otherwise return plain changes (unencrypted records or legacy versions)
    return version.changes || [];
  }

  /**
   * Decrypt a version's snapshot for viewing or comparison
   * Returns plaintext data whether version is encrypted or not
   */
  private async decryptVersionSnapshot(version: RecordVersion): Promise<any> {
    // If the version isn't encrypted, return the plain data
    if (!version.recordSnapshot.isEncrypted) {
      console.log('✓ Version is not encrypted, using plain data');

      return {
        fileName: version.recordSnapshot.fileName ?? null,
        fhirData: version.recordSnapshot.fhirData ?? null,
        belroseFields: version.recordSnapshot.belroseFields ?? null,
        extractedText: version.recordSnapshot.extractedText ?? null,
        originalText: version.recordSnapshot.originalText ?? null,
      };
    }

    console.log(`🔓 Decrypting version ${version.versionNumber}...`);

    // Check if encryption session is active
    const masterKey = EncryptionKeyManager.getSessionKey();
    if (!masterKey) {
      throw new Error(
        'Cannot decrypt version: No active encryption session. Please unlock your encryption.'
      );
    }

    try {
      // Build an encrypted record object from the version snapshot
      const encryptedRecord = {
        encryptedFileName: version.recordSnapshot.encryptedFileName,
        encryptedExtractedText: version.recordSnapshot.encryptedExtractedText,
        encryptedOriginalText: version.recordSnapshot.encryptedOriginalText,
        encryptedFhirData: version.recordSnapshot.encryptedFhirData,
        encryptedBelroseFields: version.recordSnapshot.encryptedBelroseFields,
        encryptedKey: version.recordSnapshot.encryptedKey,
        isEncrypted: true,
      };

      // Use your existing decryption service
      const decryptedData = await RecordDecryptionService.decryptRecord(encryptedRecord);

      console.log(`✅ Version ${version.versionNumber} decrypted successfully`);

      // Return in the format expected by diff/display
      return {
        fileName: decryptedData.fileName ?? null,
        fhirData: decryptedData.fhirData ?? null,
        belroseFields: decryptedData.belroseFields ?? null,
        extractedText: decryptedData.extractedText ?? null,
        originalText: decryptedData.originalText ?? null,
      };
    } catch (error: any) {
      console.error(`❌ Failed to decrypt version ${version.versionNumber}:`, error);
      throw new Error(`Failed to decrypt version: ${error.message}`);
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

      // Decrypt the version snapshot if needed
      const restoredData = await this.decryptVersionSnapshot(version);

      // Optionally update the main record
      if (updateMainRecord) {
        const { updateFirestoreRecord } = await import('@/firebase/uploadUtils');
        await updateFirestoreRecord(
          recordId,
          restoredData,
          `Restored to version ${version.versionNumber}`
        );
      }

      console.log('✅ Record restored to version:', version.versionNumber);

      return {
        versionId: versionId,
        restoredData: restoredData,
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
  async compareVersions(
    recordId: string,
    versionId1: string,
    versionId2: string
  ): Promise<VersionDiff> {
    const version1 = await this.getVersion(versionId1);
    const version2 = await this.getVersion(versionId2);

    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }

    console.log('🔍 Comparing versions:', {
      v1: version1.versionNumber,
      v2: version2.versionNumber,
      v1Encrypted: version1.recordSnapshot?.isEncrypted,
      v2Encrypted: version2.recordSnapshot?.isEncrypted,
    });

    // Decrypt both versions before comparing
    const decryptedSnapshot1 = await this.decryptVersionSnapshot(version1);
    const decryptedSnapshot2 = await this.decryptVersionSnapshot(version2);

    // Ensure we're comparing the right order (older -> newer)
    const [olderVersion, newerVersion] =
      version1.versionNumber < version2.versionNumber ? [version1, version2] : [version2, version1];

    const [olderSnapshot, newerSnapshot] =
      version1.versionNumber < version2.versionNumber
        ? [decryptedSnapshot1, decryptedSnapshot2]
        : [decryptedSnapshot2, decryptedSnapshot1];

    // Now compare the DECRYPTED data
    const changes = this.calculateDifferences(olderSnapshot, newerSnapshot);

    return {
      olderVersionId: olderVersion.id || '',
      newerVersionId: newerVersion.id || '',
      changes,
      summary: this.generateDiffSummary(changes),
      timestamp: new Date().toISOString(),
    };
  }

  /*=============================================================
ENCRYPTION/DECRYPTION HELPERS
===============================================================*/
  /**
   * Encrypt changes array using the record's data encryption key
   */
  private async encryptChanges(changes: Change[], encryptedRecordKey: string): Promise<string> {
    console.log('🔐 Encrypting changes array...');

    // Get master key from session
    const masterKey = EncryptionKeyManager.getSessionKey();
    if (!masterKey) {
      throw new Error('Cannot encrypt changes: No active encryption session');
    }

    // Unwrap the record's DEK using EncryptionService
    const keyData = EncryptionService.base64ToArrayBuffer(encryptedRecordKey);
    const recordDEKData = await EncryptionService.decryptKeyWithMasterKey(keyData, masterKey);
    const recordDEK = await EncryptionService.importKey(recordDEKData);

    // Serialize changes to JSON string
    const changesJson = JSON.stringify(changes);

    // Encrypt using your EncryptionService
    const { encrypted, iv } = await EncryptionService.encryptText(changesJson, recordDEK);

    // Combine encrypted data and IV into a single base64 string
    // Format: [IV][encrypted data] - same pattern you use for other encrypted fields
    const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
    combined.set(new Uint8Array(iv), 0);
    combined.set(new Uint8Array(encrypted), iv.byteLength);

    const encryptedChanges = EncryptionService.arrayBufferToBase64(combined.buffer);

    console.log('✅ Changes encrypted successfully');
    return encryptedChanges;
  }

  /**
   * Decrypt changes array for viewing
   */
  private async decryptChanges(
    encryptedChanges: string,
    encryptedRecordKey: string
  ): Promise<Change[]> {
    console.log('🔓 Decrypting changes array...');

    // Get master key from session
    const masterKey = EncryptionKeyManager.getSessionKey();
    if (!masterKey) {
      throw new Error(
        'Cannot decrypt changes: No active encryption session. Please unlock your encryption.'
      );
    }

    // Unwrap the record's DEK
    const keyData = EncryptionService.base64ToArrayBuffer(encryptedRecordKey);
    const recordDEKData = await EncryptionService.decryptKeyWithMasterKey(keyData, masterKey);
    const recordDEK = await EncryptionService.importKey(recordDEKData);

    // Decode the combined base64 string
    const combined = EncryptionService.base64ToArrayBuffer(encryptedChanges);

    // Split into IV and encrypted data (IV is first 12 bytes for GCM)
    const ivLength = 12; // ENCRYPTION_CONFIG.ivLength
    const iv = combined.slice(0, ivLength);
    const encrypted = combined.slice(ivLength);

    // Decrypt using your EncryptionService
    const changesJson = await EncryptionService.decryptText(encrypted, recordDEK, iv);

    // Parse back to Change array
    const changes: Change[] = JSON.parse(changesJson);

    console.log(`✅ Decrypted ${changes.length} changes`);
    return changes;
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

  /**
   * Clean undefined values from objects recursively
   * Firestore doesn't allow undefined - must be null or omitted
   */
  private cleanUndefinedValues(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.cleanUndefinedValues(item));
    }

    if (data !== null && typeof data === 'object') {
      const cleaned: any = {};
      for (const key in data) {
        if (data[key] !== undefined) {
          cleaned[key] = this.cleanUndefinedValues(data[key]);
        }
      }
      return cleaned;
    }

    return data === undefined ? null : data;
  }
}
