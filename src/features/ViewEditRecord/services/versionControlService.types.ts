// src/features/ViewEditRecord/services/VersionControlService.types.ts

import { FileObject } from '@/types/core';

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

export interface RecordVersion {
  versionId: string;
  parentVersion?: string;
  timestamp: string;
  author: string;
  authorName?: string;
  commitMessage?: string;
  changes: Change[]; // Updated to use Change instead of ChangeSet
  
  fileObjectSnapshot: {
    fhirData?: any;
    belroseFields?: any;
    extractedText?: string | null;
    originalText?: string | null;
    blockchainVerification?: any;
  };
  
  checksum: string;
  isInitialVersion: boolean;
}

// Consolidated Change interface with all needed properties
export interface Change {
  operation: 'create' | 'update' | 'delete';
  path: string;
  oldValue?: any;
  newValue?: any;
  description?: string;
  fieldType?: string; // Optional for backward compatibility
  timestamp?: string; // Optional for backward compatibility
}

// Type alias for backward compatibility
export type ChangeSet = Change;

export interface VersionDiff {
  olderVersionId: string;
  newerVersionId: string;
  changes: Change[]; // Updated to use Change
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