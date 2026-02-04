// src/features/HealthRecordViewer/lib/types.ts

import { DisputeSeverityOptions } from '@/features/Credibility/services/disputeService';
import { VerificationLevelOptions } from '@/features/Credibility/services/verificationService';
import { ethers } from 'ethers';

/**
 * Types for HealthRecordCore contract data
 * These mirror the Solidity contract structures
 */

// ===============================================================
// CONTRACT INTERFACE - For type-safe contract calls
// ===============================================================

export interface HealthRecordCoreContract {
  // Stats
  getTotalAnchoredRecords(): Promise<bigint>;
  totalVerifications(): Promise<bigint>;
  totalDisputes(): Promise<bigint>;
  totalUnacceptedFlags(): Promise<bigint>;

  // Record Anchoring
  getRecordSubjects(recordId: string): Promise<string[]>;
  getRecordVersionHistory(recordId: string): Promise<string[]>;
  isSubject(recordId: string, userIdHash: string): Promise<boolean>;
  isActiveSubject(recordId: string, userIdHash: string): Promise<boolean>;
  getActiveRecordSubjects(recordId: string): Promise<string[]>;
  getSubjectStats(recordId: string): Promise<[bigint, bigint]>;
  getSubjectMedicalHistory(userIdHash: string): Promise<string[]>;
  getRecordIdForHash(recordHash: string): Promise<string>;
  doesHashExist(recordHash: string): Promise<boolean>;
  getVersionCount(recordId: string): Promise<bigint>;

  // Verifications
  getVerifications(recordHash: string): Promise<VerificationStruct[]>;
  hasUserVerified(recordHash: string, userIdHash: string): Promise<boolean>;
  getUserVerification(
    recordHash: string,
    userIdHash: string
  ): Promise<[boolean, string, number, bigint, boolean]>;
  getVerificationStats(recordHash: string): Promise<[bigint, bigint]>;
  getUserVerifications(userIdHash: string): Promise<string[]>;

  // Disputes
  getDisputes(recordHash: string): Promise<DisputeStruct[]>;
  hasUserDisputed(recordHash: string, userIdHash: string): Promise<boolean>;
  getUserDispute(
    recordHash: string,
    userIdHash: string
  ): Promise<[boolean, string, number, number, string, bigint, boolean]>;
  getDisputeStats(recordHash: string): Promise<[bigint, bigint]>;
  getUserDisputes(userIdHash: string): Promise<string[]>;

  // Reactions
  getDisputeReactions(recordHash: string, disputerIdHash: string): Promise<ReactionStruct[]>;
  getReactionStats(recordHash: string, disputerIdHash: string): Promise<[bigint, bigint, bigint]>;

  // Unaccepted Flags
  getUnacceptedUpdateFlags(subjectIdHash: string): Promise<UnacceptedUpdateFlagStruct[]>;
  getActiveUnacceptedFlagCount(subjectIdHash: string): Promise<bigint>;
  getUnacceptedUpdateFlag(
    subjectIdHash: string,
    flagIndex: number
  ): Promise<[string, string, bigint, number, bigint, boolean]>;
  hasActiveUnacceptedFlags(subjectIdHash: string): Promise<boolean>;

  // Event filters
  filters: {
    RecordAnchored(): ethers.DeferredTopicFilter;
    RecordUnanchored(): ethers.DeferredTopicFilter;
    RecordReanchored(): ethers.DeferredTopicFilter;
    RecordHashAdded(): ethers.DeferredTopicFilter;
    RecordHashRetracted(): ethers.DeferredTopicFilter;
    RecordVerified(): ethers.DeferredTopicFilter;
    VerificationRetracted(): ethers.DeferredTopicFilter;
    RecordDisputed(): ethers.DeferredTopicFilter;
    DisputeRetracted(): ethers.DeferredTopicFilter;
    UnacceptedUpdateFlagged(): ethers.DeferredTopicFilter;
    UnacceptedUpdateResolved(): ethers.DeferredTopicFilter;
  };

  queryFilter(
    filter: ethers.DeferredTopicFilter,
    fromBlock?: number,
    toBlock?: number | string
  ): Promise<(ethers.EventLog | ethers.Log)[]>;

  runner?: {
    provider?: {
      getBlockNumber(): Promise<number>;
    };
  };
}

// Raw struct types returned from contract calls
interface VerificationStruct {
  verifierIdHash: string;
  recordId: string;
  level: number;
  createdAt: bigint;
  isActive: boolean;
}

interface DisputeStruct {
  disputerIdHash: string;
  recordId: string;
  severity: number;
  culpability: number;
  notes: string;
  createdAt: bigint;
  isActive: boolean;
}

interface ReactionStruct {
  reactorIdHash: string;
  supportsDispute: boolean;
  timestamp: bigint;
  isActive: boolean;
}

interface UnacceptedUpdateFlagStruct {
  recordId: string;
  noteHash: string;
  createdAt: bigint;
  resolution: number;
  resolvedAt: bigint;
  isActive: boolean;
}

// ===============================================================
// ENUMS - Match contract exactly
// ===============================================================

export enum VerificationLevel {
  None = 0,
  Provenance = 1, // Vouches for source/origin
  Content = 2, // Vouches for content accuracy
  Full = 3, // Full verification (source + content)
}

export enum DisputeSeverity {
  None = 0,
  Negligible = 1, // Minor issue, doesn't affect treatment
  Moderate = 2, // Notable error, may affect care
  Major = 3, // Serious issue, significant impact
}

export enum DisputeCulpability {
  None = 0,
  NoFault = 1, // Honest mistake, system limitations
  Systemic = 2, // Process/system failure
  Preventable = 3, // Could have been avoided with care
  Reckless = 4, // Disregard for accuracy
  Intentional = 5, // Deliberate falsification
}

export enum ResolutionType {
  None = 0, // Unresolved
  PatientAccepted = 1, // Patient eventually accepted the update
  DoctorWithdrew = 2, // Doctor withdrew the proposed update
  Arbitrated = 3, // Belrose made a decision
  Expired = 4, // No resolution after time limit
}

// ===============================================================
// RECORD ANCHORING TYPES
// ===============================================================

export interface AnchoredRecord {
  recordId: string;
  subjects: SubjectLink[];
  versionHistory: RecordVersion[];
  activeSubjectCount: number;
  totalSubjectCount: number;
  activeVersionCount: number;
}

export interface SubjectLink {
  subjectIdHash: string;
  isActive: boolean;
  // Enriched from Firebase if available
  profile?: {
    displayName: string;
    email: string;
  };
}

export interface RecordVersion {
  hash: string;
  isActive: boolean;
  addedAt?: number; // Block timestamp if we can get it
  addedBy?: string; // userIdHash of who added it
}

// ===============================================================
// RECORD REVIEW TYPES
// ===============================================================

export interface Verification {
  verifierIdHash: string;
  recordId: string;
  recordHash: string;
  level: VerificationLevelOptions;
  createdAt: number;
  isActive: boolean;
  // Enriched from Firebase
  verifierProfile?: {
    displayName: string;
    email: string;
  };
}

export interface Dispute {
  disputerIdHash: string;
  recordId: string;
  recordHash: string;
  severity: DisputeSeverityOptions;
  culpability: DisputeCulpability;
  notes: string; // IPFS hash or reference
  createdAt: number;
  isActive: boolean;
  // Enriched from Firebase
  disputerProfile?: {
    displayName: string;
    email: string;
  };
  // Aggregated reaction stats
  reactionStats?: {
    supports: number;
    opposes: number;
  };
}

export interface Reaction {
  reactorIdHash: string;
  supportsDispute: boolean;
  timestamp: number;
  isActive: boolean;
  // Enriched from Firebase
  reactorProfile?: {
    displayName: string;
    email: string;
  };
}

export interface UnacceptedUpdateFlag {
  subjectIdHash: string;
  recordId: string;
  noteHash: string;
  createdAt: number;
  resolution: ResolutionType;
  resolvedAt: number;
  isActive: boolean;
  flagIndex: number;
}

// ===============================================================
// DASHBOARD / AGGREGATE TYPES
// ===============================================================

export interface HealthRecordStats {
  totalAnchoredRecords: number;
  totalVerifications: number;
  totalDisputes: number;
  totalUnacceptedFlags: number;
  // Could add more derived stats
  activeDisputes?: number;
  activeVerifications?: number;
}

export interface RecordHashSummary {
  recordHash: string;
  recordId: string;
  activeVerifications: number;
  activeDisputes: number;
  totalVerifications: number;
  totalDisputes: number;
}

// ===============================================================
// FILTER TYPES
// ===============================================================

export type RecordStatusFilter = 'all' | 'active' | 'inactive';
export type VerificationLevelFilter = 'all' | VerificationLevel;
export type DisputeSeverityFilter = 'all' | DisputeSeverity;

// ===============================================================
// VIEW TYPES
// ===============================================================

export type HealthRecordView = 'anchoring' | 'verifications' | 'disputes' | 'flags';

// ===============================================================
// EVENT LOG TYPES (for transaction history)
// ===============================================================

export interface RecordEvent {
  type:
    | 'anchored'
    | 'unanchored'
    | 'reanchored'
    | 'hashAdded'
    | 'hashRetracted'
    | 'verified'
    | 'verificationRetracted'
    | 'disputed'
    | 'disputeRetracted';
  recordId: string;
  recordHash?: string;
  userIdHash: string;
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
}
