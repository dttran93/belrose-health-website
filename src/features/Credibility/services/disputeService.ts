//src/features/Credibility/services/disputeService.ts

import { ethers } from 'ethers';
import {
  getFirestore,
  collection,
  updateDoc,
  doc,
  Timestamp,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { EncryptionKeyManager } from '@/features/Encryption/services/encryptionKeyManager';
import { EncryptionService } from '@/features/Encryption/services/encryptionService';
import { RecordDecryptionService } from '@/features/Encryption/services/recordDecryptionService';
import { blockchainHealthRecordService } from './blockchainHealthRecordService';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/utils/dataFormattingUtils';

export type DisputeSeverity = 1 | 2 | 3;

export type DisputeSeverityName = 'Negligible' | 'Moderate' | 'Major';

export type DisputeCulpability = 0 | 1 | 2 | 3 | 4 | 5;

export type DisputeCulpabilityName =
  | 'Unknown'
  | 'No Fault'
  | 'Systemic'
  | 'Preventable'
  | 'Reckless'
  | 'Intentional';

export interface DisputeData {
  recordId: string;
  recordHash: string;
  severity: DisputeSeverity;
  culpability: DisputeCulpability;
  notes?: string;
}

export interface EncryptedField {
  encrypted: string;
  iv: string;
}

export interface DisputeDoc {
  id: string;
  recordHash: string;
  recordId: string;
  disputerId: string;
  disputerIdHash: string;
  severity: DisputeSeverity;
  culpability: DisputeCulpability;
  encryptedNotes?: EncryptedField;
  notesHash: string;
  isActive: boolean;
  createdAt: Timestamp;
  lastModified?: Timestamp;
  chainStatus: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
}

/** Extended type with decrypted notes for display */
export interface DisputeDocDecrypted extends Omit<DisputeDoc, 'encryptedNotes'> {
  notes: string;
}

/** Extended type that includes version info for display */
export interface DisputeWithVersion extends DisputeDocDecrypted {
  versionNumber: number;
  totalVersions: number;
}

// ============================================================
// CONSTANTS
// ============================================================

/** Severity configuration - single source of truth */
export const SEVERITY_MAPPING: Record<DisputeSeverity, DisputeSeverityName> = {
  1: 'Negligible',
  2: 'Moderate',
  3: 'Major',
};

/** Culpability configuration - single source of truth */
export const CULPABILITY_MAPPING: Record<DisputeCulpability, DisputeCulpabilityName> = {
  0: 'Unknown',
  1: 'No Fault',
  2: 'Systemic',
  3: 'Preventable',
  4: 'Reckless',
  5: 'Intentional',
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Generates a deterministic dispute document ID.
 * Format: {recordHash}_{disputerId}
 * This ensures one dispute per user per record hash.
 */
export function getDisputeId(recordHash: string, disputerId: string): string {
  return `${recordHash}_${disputerId}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Get severity value from display name
 */
export function getSeverityValue(name: DisputeSeverityName): DisputeSeverity {
  const entry = Object.entries(SEVERITY_MAPPING).find(([_, v]) => v === name);
  if (!entry) throw new Error(`Invalid severity name: ${name}`);
  return Number(entry[0]) as DisputeSeverity;
}

/**
 * Get culpability value from display name
 */
export function getCulpabilityValue(name: DisputeCulpabilityName): DisputeCulpability {
  const entry = Object.entries(CULPABILITY_MAPPING).find(([_, v]) => v === name);
  if (!entry) throw new Error(`Invalid culpability name: ${name}`);
  return Number(entry[0]) as DisputeCulpability;
}

/**
 * Encrypts notes using the record's encryption key
 */
async function encryptNotes(notes: string, recordId: string): Promise<EncryptedField> {
  const masterKey = EncryptionKeyManager.getSessionKey();
  if (!masterKey) {
    throw new Error('Encryption session not active. Please unlock your encryption.');
  }

  const recordKey = await RecordDecryptionService.getRecordKey(recordId, masterKey);
  const encrypted = await EncryptionService.encryptText(notes, recordKey);

  return {
    encrypted: arrayBufferToBase64(encrypted.encrypted),
    iv: arrayBufferToBase64(encrypted.iv),
  };
}

/**
 * Decrypts notes using the record's encryption key
 */
async function decryptNotes(encryptedNotes: EncryptedField, recordId: string): Promise<string> {
  const masterKey = EncryptionKeyManager.getSessionKey();
  if (!masterKey) {
    throw new Error('Encryption session not active. Please unlock your encryption.');
  }

  const recordKey = await RecordDecryptionService.getRecordKey(recordId, masterKey);
  const encryptedData = base64ToArrayBuffer(encryptedNotes.encrypted);
  const iv = base64ToArrayBuffer(encryptedNotes.iv);

  const decrypted = await EncryptionService.decryptText(encryptedData, recordKey, iv);

  return decrypted;
}

/**
 * Decrypts a DisputeDoc's notes field
 */
async function decryptDisputeDoc(dispute: DisputeDoc): Promise<DisputeDocDecrypted> {
  let notes = '';

  if (dispute.encryptedNotes) {
    try {
      notes = await decryptNotes(dispute.encryptedNotes, dispute.recordId);
    } catch (error) {
      console.error('Failed to decrypt dispute notes:', error);
      notes = '[Unable to decrypt notes]';
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { encryptedNotes, ...rest } = dispute;
  return { ...rest, notes };
}

// ============================================================
// QUERY FUNCTIONS
// ============================================================

/**
 * Fetches all disputes for a record (across all versions/hashes).
 * Uses Firestore query on recordId field.
 *
 * @param recordId - The record ID to fetch disputes for
 * @param decrypt - Whether to decrypt notes (requires encryption session)
 * @returns Array of DisputeDocDecrypted objects
 */
export async function getDisputesByRecordId(
  recordId: string,
  decrypt: boolean = true
): Promise<DisputeDocDecrypted[]> {
  const db = getFirestore();
  const disputesRef = collection(db, 'disputes');

  const q = query(disputesRef, where('recordId', '==', recordId));
  const snapshot = await getDocs(q);

  const disputes = snapshot.docs.map(
    doc =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as DisputeDoc
  );

  if (decrypt) {
    // Decrypt all notes in parallel
    const decrypted = await Promise.all(disputes.map(d => decryptDisputeDoc(d)));
    return decrypted;
  }

  // Return without decryption (notes will be empty)
  return disputes.map(d => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedNotes, ...rest } = d;
    return { ...rest, notes: '' };
  });
}

/**
 * Fetches disputes with version information.
 *
 * @param recordId - The record ID
 * @param hashVersionMap - Map of recordHash -> versionNumber
 * @returns Array of disputes with version info attached
 */
export async function getDisputesWithVersionInfo(
  recordId: string,
  hashVersionMap: Map<string, number>
): Promise<DisputeWithVersion[]> {
  const disputes = await getDisputesByRecordId(recordId);
  const totalVersions = hashVersionMap.size;

  return disputes.map(d => ({
    ...d,
    versionNumber: hashVersionMap.get(d.recordHash) ?? 0,
    totalVersions,
  }));
}

// ============================================================
// DISPUTE FUNCTIONS
// ============================================================

/**
 * Creates a new dispute for a record hash.
 */
export async function createDispute(
  recordId: string,
  recordHash: string,
  disputerId: string,
  severity: DisputeSeverity,
  culpability: DisputeCulpability,
  notes?: string
): Promise<string> {
  const db = getFirestore();

  // CHECK 1: Ensure user is not disputing their own record
  const recordRef = doc(db, 'records', recordId);
  const recordSnap = await getDoc(recordRef);

  if (!recordSnap.exists()) {
    throw new Error('Record not found.');
  }

  const recordData = recordSnap.data();
  if (recordData.uploadedBy === disputerId) {
    throw new Error('Conflict of Interest: You cannot dispute a record you created yourself.');
  }

  // CHECK 2: Ensure there isn't already an existing active dispute
  const disputeId = getDisputeId(recordHash, disputerId);
  const docRef = doc(db, 'disputes', disputeId);
  const existing = await getDoc(docRef);

  if (existing.exists()) {
    const data = existing.data();

    if (data?.isActive && data?.chainStatus === 'confirmed') {
      throw new Error('You have already disputed this record. Use modify to update.');
    }

    console.log('Reactivating or retrying failed or pending dispute...');
  }

  const disputerIdHash = ethers.keccak256(ethers.toUtf8Bytes(disputerId));

  // Encrypt notes if provided
  let encryptedNotes: EncryptedField | null = null;
  let notesHash = '';

  if (notes && notes.trim()) {
    encryptedNotes = await encryptNotes(notes, recordId);
    notesHash = ethers.keccak256(ethers.toUtf8Bytes(notes));
  }

  console.log('Dispute Creation Inputs:', disputeId, severity, culpability);

  // 1. Write to Firebase first
  if (existing.exists()) {
    await updateDoc(docRef, {
      severity,
      culpability,
      encryptedNotes,
      notesHash,
      isActive: true,
      chainStatus: 'pending',
      txHash: null,
      error: null,
      lastModified: Timestamp.now(),
    });
  } else {
    await setDoc(docRef, {
      recordHash,
      recordId,
      disputerId,
      disputerIdHash,
      severity,
      culpability,
      encryptedNotes,
      notesHash,
      isActive: true,
      createdAt: Timestamp.now(),
      chainStatus: 'pending',
    });
  }

  try {
    // 2. Write to blockchain (notes hash only, not the actual notes)
    const tx = await blockchainHealthRecordService.disputeRecord(
      recordId,
      recordHash,
      severity,
      culpability,
      notesHash
    );

    // 3. Update Firebase with confirmation
    await updateDoc(docRef, {
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });

    return disputeId;
  } catch (error) {
    // Mark as failed
    await updateDoc(docRef, {
      chainStatus: 'failed',
      error: getErrorMessage(error),
    });
    throw error;
  }
}

/**
 * Retracts (deactivates) a dispute.
 */
export async function retractDispute(recordHash: string, disputerId: string): Promise<void> {
  const disputeId = getDisputeId(recordHash, disputerId);

  const db = getFirestore();
  const docRef = doc(db, 'disputes', disputeId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error('Dispute not found');
  }

  const data = snapshot.data();
  if (!data?.isActive) {
    throw new Error('Dispute is already inactive');
  }

  if (data.disputerId !== disputerId) {
    throw new Error('You can only retract your own disputes');
  }

  // 1. Update Firebase
  await updateDoc(docRef, {
    isActive: false,
    lastModified: Timestamp.now(),
    chainStatus: 'pending',
  });

  try {
    // 2. Write to blockchain
    const tx = await blockchainHealthRecordService.retractDispute(recordHash);

    // 3. Confirm
    await updateDoc(docRef, {
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });
  } catch (error) {
    // Rollback Firebase
    await updateDoc(docRef, {
      isActive: true,
      lastModified: null,
      chainStatus: 'failed',
      error: getErrorMessage(error),
    });
    throw error;
  }
}

/**
 * Modifies a dispute's severity and culpability.
 * Note: Notes cannot be modified after creation (hash is on-chain).
 */
export async function modifyDispute(
  recordHash: string,
  disputerId: string,
  newSeverity: DisputeSeverity,
  newCulpability: DisputeCulpability
): Promise<void> {
  const disputeId = getDisputeId(recordHash, disputerId);
  const db = getFirestore();
  const docRef = doc(db, 'disputes', disputeId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error('Dispute not found');
  }

  const data = snapshot.data();
  if (!data?.isActive) {
    throw new Error('Cannot modify an inactive dispute');
  }

  if (data.disputerId !== disputerId) {
    throw new Error('You can only modify your own dispute');
  }

  const oldSeverity = data.severity;
  const oldCulpability = data.culpability;

  if (oldSeverity === newSeverity && oldCulpability === newCulpability) {
    throw new Error('New values are the same as current values');
  }

  await updateDoc(docRef, {
    severity: newSeverity,
    culpability: newCulpability,
    lastModified: Timestamp.now(),
    chainStatus: 'pending',
  });

  try {
    const tx = await blockchainHealthRecordService.modifyDispute(
      recordHash,
      newSeverity,
      newCulpability
    );

    await updateDoc(docRef, {
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });
  } catch (error) {
    await updateDoc(docRef, {
      severity: oldSeverity,
      culpability: oldCulpability,
      chainStatus: 'failed',
      error: getErrorMessage(error),
    });
    throw error;
  }
}

/**
 * Gets a single dispute by recordHash and disputerId.
 * Returns null if not found or on permission error.
 */
export async function getDispute(
  recordHash: string,
  disputerId: string,
  decrypt: boolean = true
): Promise<DisputeDocDecrypted | null> {
  const disputeId = getDisputeId(recordHash, disputerId);

  const db = getFirestore();

  try {
    const snapshot = await getDoc(doc(db, 'disputes', disputeId));

    if (!snapshot.exists()) return null;

    const dispute = { id: snapshot.id, ...snapshot.data() } as DisputeDoc;

    if (decrypt) {
      return await decryptDisputeDoc(dispute);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedNotes, ...rest } = dispute;
    return { ...rest, notes: '' };
  } catch (error) {
    // Permission denied likely means doc doesn't exist for this user
    console.debug('Dispute not found or not accessible:', disputeId);
    return null;
  }
}

// ============================================================
// REACTION FUNCTIONS
// ============================================================

/**
 * React to a dispute (support or oppose).
 * @param recordId - The record ID (needed for Firestore security rules)
 * @param recordHash - The record hash the dispute is for
 * @param disputerIdHash - The hashed ID of the disputer
 * @param reactorId - The ID of the user reacting
 * @param supportsDispute - true to support, false to oppose
 */
export async function reactToDispute(
  recordId: string,
  recordHash: string,
  disputerIdHash: string,
  reactorId: string,
  supportsDispute: boolean
): Promise<string> {
  const db = getFirestore();
  const reactorIdHash = ethers.keccak256(ethers.toUtf8Bytes(reactorId));

  // Generate deterministic ID
  const reactionId = `${recordHash}_${disputerIdHash}_${reactorId}`;
  const docRef = doc(db, 'disputeReactions', reactionId);

  const existing = await getDoc(docRef);

  if (existing.exists()) {
    const data = existing.data();
    if (data?.isActive && data?.chainStatus === 'confirmed') {
      throw new Error('You have already reacted to this dispute. Use modify to change.');
    }
  }

  // 1. Write to Firebase
  if (existing.exists()) {
    await updateDoc(docRef, {
      supportsDispute,
      isActive: true,
      chainStatus: 'pending',
      txHash: null,
      error: null,
      lastModified: Timestamp.now(),
    });
  } else {
    await setDoc(docRef, {
      recordId,
      recordHash,
      disputerIdHash,
      reactorId,
      reactorIdHash,
      supportsDispute,
      isActive: true,
      createdAt: Timestamp.now(),
      chainStatus: 'pending',
    });
  }

  try {
    // 2. Write to blockchain
    const tx = await blockchainHealthRecordService.reactToDispute(
      recordHash,
      disputerIdHash,
      supportsDispute
    );

    // 3. Confirm
    await updateDoc(docRef, {
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });

    return reactionId;
  } catch (error) {
    await updateDoc(docRef, {
      chainStatus: 'failed',
      error: getErrorMessage(error),
    });
    throw error;
  }
}

/**
 * Retract a reaction to a dispute.
 */
export async function retractReaction(
  recordHash: string,
  disputerIdHash: string,
  reactorId: string
): Promise<void> {
  const reactionId = `${recordHash}_${disputerIdHash}_${reactorId}`;
  const db = getFirestore();
  const docRef = doc(db, 'disputeReactions', reactionId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error('Reaction not found');
  }

  const data = snapshot.data();
  if (!data?.isActive) {
    throw new Error('Reaction is already inactive');
  }

  if (data.reactorId !== reactorId) {
    throw new Error('You can only retract your own reactions');
  }

  await updateDoc(docRef, {
    isActive: false,
    lastModified: Timestamp.now(),
    chainStatus: 'pending',
  });

  try {
    const tx = await blockchainHealthRecordService.retractReaction(recordHash, disputerIdHash);

    await updateDoc(docRef, {
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });
  } catch (error) {
    await updateDoc(docRef, {
      isActive: true,
      lastModified: null,
      chainStatus: 'failed',
      error: getErrorMessage(error),
    });
    throw error;
  }
}

/**
 * Modify a reaction to a dispute.
 */
export async function modifyReaction(
  recordHash: string,
  disputerIdHash: string,
  reactorId: string,
  newSupport: boolean
): Promise<void> {
  const reactionId = `${recordHash}_${disputerIdHash}_${reactorId}`;
  const db = getFirestore();
  const docRef = doc(db, 'disputeReactions', reactionId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error('Reaction not found');
  }

  const data = snapshot.data();
  if (!data?.isActive) {
    throw new Error('Cannot modify an inactive reaction');
  }

  if (data.reactorId !== reactorId) {
    throw new Error('You can only modify your own reactions');
  }

  const oldSupport = data.supportsDispute;
  if (oldSupport === newSupport) {
    throw new Error('New support value is the same as current');
  }

  await updateDoc(docRef, {
    supportsDispute: newSupport,
    lastModified: Timestamp.now(),
    chainStatus: 'pending',
  });

  try {
    const tx = await blockchainHealthRecordService.modifyReaction(
      recordHash,
      disputerIdHash,
      newSupport
    );

    await updateDoc(docRef, {
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });
  } catch (error) {
    await updateDoc(docRef, {
      supportsDispute: oldSupport,
      chainStatus: 'failed',
      error: getErrorMessage(error),
    });
    throw error;
  }
}
