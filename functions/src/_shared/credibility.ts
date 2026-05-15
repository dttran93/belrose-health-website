import { BlockchainRef } from './blockchain';
import { TimestampLike } from './timestamp';

export type VerificationLevelOptions = 1 | 2 | 3;
export type DisputeSeverityOptions = 1 | 2 | 3;
export type DisputeCulpability = 0 | 1 | 2 | 3 | 4 | 5;

export interface EncryptedField {
  encrypted: string;
  iv: string;
}

export interface VerificationDoc {
  id: string;
  recordHash: string;
  recordId: string;
  verifierId: string;
  verifierIdHash: string;
  level: VerificationLevelOptions;
  isActive: boolean;
  createdAt: TimestampLike;
  lastModified?: TimestampLike;
  chainStatus: 'pending' | 'confirmed' | 'failed';
  blockchainRef?: BlockchainRef;
  encryptedRecordTitle?: string;
  encryptedRecordTitleIv: string;
}

export interface DisputeDoc {
  id: string;
  recordHash: string;
  recordId: string;
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
  blockchainRef?: BlockchainRef;
  encryptedRecordTitle?: string;
  encryptedRecordTitleIv?: string;
}

export interface ReactionDoc {
  id: string;
  recordId: string;
  recordHash: string;
  reactorId: string;
  reactorIdHash: string;
  disputerId: string; //The uid of the disputer to which the reactor is reacting
  disputerIdHash: string;
  supportsDispute: boolean;
  isActive: boolean;
  createdAt: TimestampLike;
  lastModified?: TimestampLike;
  chainStatus: 'pending' | 'confirmed' | 'failed';
  blockchainRef?: BlockchainRef;
  encryptedRecordTitle?: string;
  encryptedRecordTitleIv?: string;
}
