import { BlockchainRef } from './blockchainAddresses';
import { TimestampLike } from './timestamp';

export type VerificationLevelOptions = 1 | 2 | 3;
export type DisputeSeverityOptions = 1 | 2 | 3;
export type DisputeCulpability = 0 | 1 | 2 | 3 | 4 | 5;

export interface EncryptedField {
  encrypted: string;
  iv: string;
}

// ── On-chain history event types ──────────────────────────────────────────────

export interface VerificationOnChainEvent {
  action: 'verified' | 'retracted' | 'modified';
  at: TimestampLike;
  blockchainRef: BlockchainRef;
  fromLevel?: VerificationLevelOptions;
  toLevel?: VerificationLevelOptions;
}

export interface DisputeOnChainEvent {
  action: 'disputed' | 'retracted' | 'modified';
  at: TimestampLike;
  blockchainRef: BlockchainRef;
  fromSeverity?: DisputeSeverityOptions;
  toSeverity?: DisputeSeverityOptions;
  fromCulpability?: DisputeCulpability;
  toCulpability?: DisputeCulpability;
}

export interface VouchOnChainEvent {
  action: 'vouched' | 'retracted' | 're-vouched';
  at: TimestampLike;
  blockchainRef: BlockchainRef;
}

// ── Document types ────────────────────────────────────────────────────────────

export interface VerificationDoc {
  id: string;
  recordIdHash: string;
  recordHash: string;
  recordId: string;
  verifierId: string;
  verifierIdHash: string;
  level: VerificationLevelOptions;
  isActive: boolean;
  createdAt: TimestampLike;
  lastModified?: TimestampLike;
  chainStatus: 'pending' | 'confirmed' | 'failed';
  onChainHistory: VerificationOnChainEvent[];
  encryptedRecordTitle?: string;
  encryptedRecordTitleIv: string;
}

export interface DisputeDoc {
  id: string;
  recordHash: string;
  recordId: string;
  recordIdHash: string;
  disputerId: string;
  disputerIdHash: string;
  severity: DisputeSeverityOptions;
  culpability: DisputeCulpability;
  encryptedNotes?: EncryptedField;
  notesHash: string;
  isActive: boolean;
  createdAt: TimestampLike;
  lastModified?: TimestampLike;
  chainStatus: 'pending' | 'confirmed' | 'failed';
  onChainHistory: DisputeOnChainEvent[];
  encryptedRecordTitle?: string;
  encryptedRecordTitleIv?: string;
}

export type VouchChainStatus = 'None' | 'Active' | 'Retracted';

export interface VouchDoc {
  id: string;
  voucherId: string;
  voucherIdHash: string;
  voucheeId: string;
  voucheeIdHash: string;
  chainStatus: VouchChainStatus;
  createdAt: TimestampLike;
  lastModified?: TimestampLike;
  onChainHistory: VouchOnChainEvent[];
}
