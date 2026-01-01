//src/features/Credibility/services/disputeService.ts

import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { keccak256, toUtf8Bytes } from 'ethers';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { SEVERITY_LEVELS } from '../component/ui/DisputeForm';
import { blockchainHealthRecordService } from './blockchainHealthRecordService';

export type DisputeSeverity = 1 | 2 | 3;

const SEVERITY_NAMES: Record<number, string> = {
  1: 'Negligible',
  2: 'Moderate',
  3: 'Major',
};

export type DisputeCulpability = 0 | 1 | 2 | 3 | 4 | 5;

const CULPABILITY_NAMES: Record<number, string> = {
  0: 'NoFault',
  1: 'Systemic',
  2: 'Preventable',
  3: 'Reckless',
  4: 'Intentional',
};

export interface DisputeDoc {
  recordHash: string;
  recordId: string;
  disputerId: string;
  disputerIdHash: string; //for the blockchain
  severity: 'Negligible' | 'Moderate' | 'Major';
  culpability: 'NoFault' | 'Systemic' | 'Preventable' | 'Reckless' | 'Intentional';
  notes: string;
  createdAt: number;
  isActive: boolean;
  txHash: string;
}

export interface ReactionDoc {
  recordHash: string;
  disputerIdHash: string;
  reactorIdHash: string;
  supportsDispute: boolean;
  timestamp: number;
  isActive: boolean;
  txHash: string;
}

export async function createDispute(
  recordId: string,
  recordHash: string,
  disputerOdysId: string,
  severity: DisputeSeverity,
  culpability: DisputeCulpability,
  notes: string
): Promise<string> {
  // 1. Get the record's encryption key (user must have access)
  const masterKey = EncryptionKeyManager.getSessionKey();

  if (!masterKey) {
    throw new Error('Encryption session not active. Please unlock your encryption.');
  }

  const encryptionKey = await RecordDecryptionService.getRecordKey(recordId, masterKey);

  // 2. Encrypt the notes with the same key
  const encryptedNotes = await EncryptionService.encryptText(notes, encryptionKey);

  // 3. Generate hash of plaintext notes for blockchain
  const notesHash = keccak256(toUtf8Bytes(notes));

  // 4. Create Firestore document
  const db = getFirestore();
  const disputeRef = await db.collection('disputes').add({
    recordId,
    recordHash,
    disputerOdysId,
    disputerIdHash: keccak256(toUtf8Bytes(disputerOdysId)),
    severity: SEVERITY_NAMES[severity],
    culpability: CULPABILITY_NAMES[culpability],
    encryptedNotes,
    notesHash,
    isActive: true,
    createdAt: Timestamp.now(),
    chainStatus: 'pending',
  });

  // 5. Submit to blockchain
  const tx = await blockchainHealthRecordService.disputeRecord(
    recordId,
    recordHash,
    severity,
    culpability,
    notesHash // Only hash goes on-chain
  );

  // 6. Update with tx confirmation
  await disputeRef.update({
    chainStatus: 'confirmed',
    txHash: tx.txHash,
    blockNumber: tx.blockNumber,
  });

  return disputeRef.id;
}
