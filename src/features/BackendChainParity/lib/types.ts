// src/features/BackendChainParity/lib/types.ts

import type { Timestamp } from 'firebase/firestore';

export type IntegrityStatus =
  | 'synced'
  | 'mismatch'
  | 'missing'
  | 'pending'
  | 'not_applicable'
  | 'failed';

export interface BlockchainRef {
  txHash?: string;
  chainId?: number;
  blockNumber?: number;
  contractAddress?: string;
}

// ============================================================================
// RAW FIRESTORE SHAPES (what we read from Firestore)
// ============================================================================

export interface FirestoreRecord {
  id: string;
  recordHash?: string;
  recordIdHash?: string;
  blockchainRoleInitialization?: {
    blockchainInitialized?: boolean;
    blockchainRef?: BlockchainRef;
  };
  subjects?: string[]; // Firebase UIDs
  owners?: string[];
  fileName?: string;
}

export interface FirestoreUser {
  uid: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  onChainIdentity?: {
    userIdHash?: string;
    status?: string;
  };
  wallet?: {
    address?: string;
    smartAccountAddress?: string;
  };
}

export interface FirestoreVerification {
  id: string;
  recordHash?: string;
  recordId?: string;
  verifierId?: string;
  verifierIdHash?: string;
  chainStatus?: 'pending' | 'confirmed' | 'failed';
  blockchainRef?: BlockchainRef;
  level?: number;
  createdAt?: Timestamp;
}

export interface FirestoreDispute {
  id: string;
  recordHash?: string;
  recordId?: string;
  disputerId?: string;
  disputerIdHash?: string;
  chainStatus?: 'pending' | 'confirmed' | 'failed';
  blockchainRef?: BlockchainRef;
  severity?: number;
  createdAt?: Timestamp;
}

export interface FirestoreSyncQueueItem {
  id: string;
  contract?: string;
  action?: string;
  userId?: string;
  userWalletAddress?: string;
  error?: string;
  retryCount?: number;
  createdAt?: Timestamp;
  lastAttemptAt?: Timestamp;
  status?: string;
  context?: Record<string, unknown>;
}

// ============================================================================
// INTEGRITY RESULT TYPES (Firestore data + chain check outcome)
// ============================================================================

export interface SubjectIntegrityStatus {
  uid: string;
  userIdHash: string;
  isActiveOnChain: boolean;
}

export interface RecordIntegrityItem {
  firestoreId: string;
  recordHash?: string;
  recordIdHash?: string;
  blockchainRef?: BlockchainRef;
  isBlockchainInitialized: boolean;
  subjects: string[];
  integrityStatus: IntegrityStatus;
  hashExistsOnChain?: boolean;
  subjectStatuses?: SubjectIntegrityStatus[];
  error?: string;
}

export interface MemberIntegrityItem {
  uid: string;
  displayName: string;
  email: string;
  userIdHash?: string;
  firestoreStatus?: string;
  firestoreWalletAddress?: string;
  firestoreSmartAccountAddress?: string;
  integrityStatus: IntegrityStatus;
  onChainStatus?: number;
  onChainWallets?: string[];
  walletMismatch?: boolean;
  statusMismatch?: boolean;
  error?: string;
}

export interface VerificationIntegrityItem {
  firestoreId: string;
  recordHash?: string;
  recordId?: string;
  verifierIdHash?: string;
  verifierId?: string;
  chainStatus?: string;
  blockchainRef?: BlockchainRef;
  level?: number;
  createdAt?: Timestamp;
  integrityStatus: IntegrityStatus;
  existsOnChain?: boolean;
  isActiveOnChain?: boolean;
  error?: string;
}

export interface DisputeIntegrityItem {
  firestoreId: string;
  recordHash?: string;
  recordId?: string;
  disputerIdHash?: string;
  disputerId?: string;
  chainStatus?: string;
  blockchainRef?: BlockchainRef;
  severity?: number;
  createdAt?: Timestamp;
  integrityStatus: IntegrityStatus;
  existsOnChain?: boolean;
  isActiveOnChain?: boolean;
  error?: string;
}

// ============================================================================
// SUMMARY STATS
// ============================================================================

export interface ParitySummary {
  total: number;
  synced: number;
  mismatch: number;
  missing: number;
  pending: number;
  notApplicable: number;
  failed: number;
}

export function computeSummary(items: { integrityStatus: IntegrityStatus }[]): ParitySummary {
  const summary: ParitySummary = {
    total: items.length,
    synced: 0,
    mismatch: 0,
    missing: 0,
    pending: 0,
    notApplicable: 0,
    failed: 0,
  };
  for (const item of items) {
    switch (item.integrityStatus) {
      case 'synced': summary.synced++; break;
      case 'mismatch': summary.mismatch++; break;
      case 'missing': summary.missing++; break;
      case 'pending': summary.pending++; break;
      case 'not_applicable': summary.notApplicable++; break;
      case 'failed': summary.failed++; break;
    }
  }
  return summary;
}
