// 1. Change the imports to the client SDK
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { keccak256, toUtf8Bytes } from 'ethers';
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
  chainStatus: 'pending' | 'confirmed' | 'failed';
}

export interface ReactionDoc {
  disputeId: string;
  recordHash: string;
  disputerId: string;
  reactorId: string;
  supportsDispute: boolean;
  createdAt: number;
  isActive: boolean;
  txHash: string;
  chainStatus: 'pending' | 'confirmed' | 'failed';
}

const db = getFirestore();

export async function createDispute(
  recordId: string,
  recordHash: string,
  disputerId: string,
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

  // 4. Create Firestore document (Client SDK Syntax)
  const disputeRef = await addDoc(collection(db, 'disputes'), {
    recordId,
    recordHash,
    disputerId,
    disputerIdHash: keccak256(toUtf8Bytes(disputerId)),
    severity: SEVERITY_NAMES[severity],
    culpability: CULPABILITY_NAMES[culpability],
    encryptedNotes,
    notesHash,
    isActive: true,
    createdAt: serverTimestamp(), // Use serverTimestamp() for client-side
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

  // 6. Update document (Client SDK Syntax)
  await updateDoc(disputeRef, {
    chainStatus: 'confirmed',
    txHash: tx.txHash,
    blockNumber: tx.blockNumber,
  });

  return disputeRef.id;
}

export async function reactToDispute(
  disputerId: string,
  recordHash: string,
  supportsDispute: boolean
): Promise<string> {
  // 1. Create Firestore document
  const reactionRef = await addDoc(collection(db, 'disputeReactions'), {
    disputerId,
    recordHash,
    isActive: true,
    createdAt: serverTimestamp(),
    chainStatus: 'pending',
  });

  const disputerIdHash = keccak256(toUtf8Bytes(disputerId));

  // 2. Submit to blockchain
  const tx = await blockchainHealthRecordService.reactToDispute(
    recordHash,
    disputerIdHash,
    supportsDispute
  );

  // 3. Update document
  await updateDoc(reactionRef, {
    chainStatus: 'confirmed',
    txHash: tx.txHash,
    blockNumber: tx.blockNumber,
  });

  return reactionRef.id;
}
