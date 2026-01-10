// src/features/ViewEditRecord/services/versionControlService.types.ts

import { Timestamp } from 'firebase/firestore';
import { CredibilityStats } from '../components/Edit/VersionReviewBadge';

// ==================== MAIN VERSION CONTROL TYPES ====================

export interface VersionControlRecord {
  currentVersion: string;
  documentId: string;
  metadata: {
    createdAt: string;
    createdBy: string;
    lastModified: string;
    lastModifiedBy: string;
    totalVersions: number;
    recordTitle?: string;
  };
}

// Encrypted snapshot structure
export interface EncryptedSnapshot {
  // Encrypted data (these are objects with {encrypted: string, iv: string})
  encryptedFileName?: {
    encrypted: string;
    iv: string;
  };
  encryptedExtractedText?: {
    encrypted: string;
    iv: string;
  };
  encryptedOriginalText?: {
    encrypted: string;
    iv: string;
  };
  encryptedContextText?: {
    encrypted: string;
    iv: string;
  };
  encryptedFhirData?: {
    encrypted: string;
    iv: string;
  };
  encryptedBelroseFields?: {
    encrypted: string;
    iv: string;
  };
  encryptedCustomData?: {
    encrypted: string;
    iv: string;
  };
  originalFileHash?: string | null;

  isEncrypted: true;
}

// Plain snapshot structure
export interface PlainSnapshot {
  // Plain data
  fileName?: string;
  extractedText?: string | null;
  originalText?: string | null;
  fhirData?: any;
  belroseFields?: any;

  // Flag for type discrimination
  isEncrypted: false;
}

export interface RecordVersion {
  id?: string; // Firestore document ID
  recordId: string; // Link to parent record
  versionNumber: number; // Sequential version number

  // Who and when
  editedBy: string; // User ID
  editedByName: string; // Display name
  editedAt: Timestamp; // Firestore timestamp

  // What changed
  changes?: Change[];
  encryptedChanges?: string;
  hasEncryptedChanges?: boolean;
  commitMessage?: string;

  // Integrity
  previousRecordHash?: string | undefined;
  recordHash: string;
  originalFileHash?: string | null;

  // Snapshot - can be either encrypted or plain
  recordSnapshot: EncryptedSnapshot | PlainSnapshot;
}

// Consolidated Change interface with all needed properties
export interface Change {
  operation: 'create' | 'update' | 'delete';
  path: string;
  oldValue?: any;
  newValue?: any;
  description?: string;
}

// Type alias for backward compatibility
export type ChangeSet = Change;

export interface VersionDiff {
  olderVersionId: string;
  newerVersionId: string;
  changes: Change[];
  summary: string;
  timestamp: string;
}

// ==================== HOOK RETURN TYPES ====================

export interface UseVersionControlReturn {
  versions: RecordVersion[];
  versionControlRecord: VersionControlRecord | null;
  loading: boolean;
  error: string | null;
  refreshVersions: () => Promise<void>;
  rollbackToVersion: (versionId: string) => Promise<void>;
  compareVersions: (versionId1: string, versionId2: string) => Promise<VersionDiff>;
  createVersionWithMessage: (commitMessage: string) => Promise<void>;
}

// ==================== COMPONENT PROP TYPES ====================

export interface VersionHistoryProps {
  documentId: string;
  onVersionSelect?: (version: RecordVersion) => void;
  onRollback?: (versionId: string) => void;
  onViewVersion?: (version: RecordVersion) => void;
  compact?: boolean;
  selectedVersions?: string[];
  onVersionsLoaded?: (loadedVersions: RecordVersion[]) => void;
  onBack?: () => void;
  getSelectionInfo?: (versionId: string) => {
    order: number;
    colorClass: string;
    bgClass: string;
    textClass: string;
    badgeClass: string;
  } | null;
  credibilityStats?: Map<string, CredibilityStats>;
  isLoadingCredibility?: boolean;
  onOpenCredibilityModal?: (recordHash: string) => void;
}

export interface VersionDiffViewerProps {
  diff: VersionDiff;
  onClose?: () => void;
}

export interface VersionControlPanelProps {
  documentId: string;
  className?: string;
  onRollback?: () => void;
  onBack?: () => void;
  onViewVersion?: (version: RecordVersion) => void;
}

// ==================== SERVICE CONFIGURATION TYPES ====================

export interface VersionControlOptions {
  createVersion?: boolean;
  skipVersioning?: boolean;
}

export interface RollbackResult {
  versionId: string;
  restoredData: any;
}

// ==================== MIGRATION TYPES ====================

export interface MigrationResult {
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}

// ==================== INTERNAL HELPER TYPES ====================

export interface JsonDiffEntry {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  key?: string;
  path?: string[];
  value?: any;
  oldValue?: any;
  changes?: JsonDiffEntry[];
}
