// src/features/ViewEditRecord/services/VersionControlService.types.ts

import { FileObject } from '@/types/core';

// ==================== MAIN VERSION CONTROL TYPES ====================

export interface VersionControlRecord {
  // Keep your existing FileObject structure
  currentVersion: string;
  documentId: string; // This is the main document ID in your files collection
  metadata: {
    createdAt: string;
    createdBy: string;
    lastModified: string;
    lastModifiedBy: string;
    totalVersions: number;
    recordTitle?: string; // From belroseFields.title
  };
}

export interface RecordVersion {
  versionId: string;
  parentVersion?: string;
  timestamp: string;
  author: string;
  authorName?: string;
  commitMessage?: string;
  changes: ChangeSet[];
  
  // Store the complete FileObject state at this version
  fileObjectSnapshot: {
    fhirData?: any;
    belroseFields?: any;
    extractedText?: string | null;
    // Other relevant fields from FileObject that can change
  };
  
  checksum: string;
  isInitialVersion: boolean;
}

export interface ChangeSet {
  operation: 'create' | 'update' | 'delete' | 'add_array_item' | 'remove_array_item';
  path: string; // JSON path like "fhirData.entry[0].resource.name"
  oldValue?: any;
  newValue?: any;
  fieldType: string;
  timestamp: string;
  description?: string; // Human-readable description
}

export interface VersionDiff {
  versionId: string;
  parentVersionId?: string;
  timestamp: string;
  changes: ChangeSet[];
  summary: string; // e.g., "3 fields updated, 1 field added"
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
  compact?: boolean;
}

export interface VersionDiffViewerProps {
  diff: VersionDiff;
  onClose?: () => void;
}

export interface VersionControlPanelProps {
  documentId: string;
  className?: string;
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