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
import { getVerificationId } from './verificationService';

// ============================================================
// TYPES
// ============================================================

export type DisputeSeverity = 0 | 1 | 2 | 3; // 0 used in blockchain for returning errors
export type DisputeSeverityOptions = 1 | 2 | 3; //0 is not an option in actual selection
export type DisputeSeverityOptionNames = 'Negligible' | 'Moderate' | 'Major';

export type DisputeSeverityName = 'None' | 'Negligible' | 'Moderate' | 'Major';

export type DisputeCulpability = 0 | 1 | 2 | 3 | 4 | 5;

export type DisputeCulpabilityName =
  | 'Unknown'
  | 'No Fault'
  | 'Systemic'
  | 'Preventable'
  | 'Reckless'
  | 'Intentional';

export interface SeverityConfig {
  value: DisputeSeverityOptions;
  name: DisputeSeverityOptionNames;
  description: string;
  declarative: string;
  color: 'blue' | 'yellow' | 'red' | 'gray';
}

export interface CulpabilityConfig {
  value: DisputeCulpability;
  name: DisputeCulpabilityName;
  description: string;
  declarative: string;
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
  severity: DisputeSeverityOptions;
  culpability: DisputeCulpability;
  encryptedNotes?: EncryptedField;
  notesHash: string;
  isActive: boolean;
  createdAt: Timestamp;
  lastModified?: Timestamp;
  chainStatus: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
}

export interface ReactionDoc {
  id: string;
  recordId: string;
  recordHash: string;
  reactorId: string;
  reactorIdHash: string;
  supportsDispute: boolean;
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

export interface ReactionStats {
  supports: number;
  opposes: number;
  userReaction?: boolean | null;
}

// ============================================================
// CONSTANTS
// ============================================================

export const SEVERITY_CONFIG: Record<DisputeSeverityOptions, SeverityConfig> = {
  1: {
    value: 1,
    name: 'Negligible',
    description:
      'A minor issue that does not significantly affect the usefulness or accuracy of the record. Unlikely to impact care decisions.',
    declarative: "Minor issue that doesn't affect clinical decisions",
    color: 'blue',
  },
  2: {
    value: 2,
    name: 'Moderate',
    description:
      'An issue that could potentially affect care decisions or treatment planning. Should be reviewed and corrected.',
    declarative: 'Noticeable error that could cause confusion',
    color: 'yellow',
  },
  3: {
    value: 3,
    name: 'Major',
    description:
      'A serious inaccuracy that could lead to incorrect diagnoses or harmful treatment decisions. Requires immediate attention.',
    declarative: 'Serious error that could affect patient safety',
    color: 'red',
  },
};

export const CULPABILITY_CONFIG: Record<DisputeCulpability, CulpabilityConfig> = {
  0: {
    value: 0,
    name: 'Unknown',
    description: 'Unknown why the error occurred.',
    declarative: 'Do not know why the mistake happened',
  },
  1: {
    value: 1,
    name: 'No Fault',
    description:
      'Unavoidable mistake, such as a false positive on a diagnostic test. No individual is responsible for the error.',
    declarative: 'Unavoidable mistake, no one to blame',
  },
  2: {
    value: 2,
    name: 'Systemic',
    description:
      'An organizational or process failure. The error stems from flawed procedures or systems.',
    declarative: 'Process or system issue, not individual error',
  },
  3: {
    value: 3,
    name: 'Preventable',
    description: 'An error that should have been caught through normal review processes.',
    declarative: 'Could have been caught with normal diligence',
  },
  4: {
    value: 4,
    name: 'Reckless',
    description: 'Careless disregard for accuracy or proper procedures.',
    declarative: 'Serious negligence in documentation',
  },
  5: {
    value: 5,
    name: 'Intentional',
    description: 'Deliberate falsification or manipulation of the record.',
    declarative: 'Deliberate falsification or manipulation',
  },
};

// Helper functions to access config
export const getSeverityConfig = (severity: DisputeSeverityOptions): SeverityConfig =>
  SEVERITY_CONFIG[severity];

export const getCulpabilityConfig = (culpability: DisputeCulpability): CulpabilityConfig =>
  CULPABILITY_CONFIG[culpability];

// Arrays for iterating in UI (forms, selects, etc.)
export const SEVERITY_OPTIONS = Object.values(SEVERITY_CONFIG);
export const CULPABILITY_OPTIONS = Object.values(CULPABILITY_CONFIG);

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

  // CHECK 3: You cannot both dispute and verify the same recordHash
  const verificationId = getVerificationId(recordHash, disputerId);
  const verificationDocRef = doc(db, 'verifications', verificationId);
  const verificationExisting = await getDoc(verificationDocRef);

  if (verificationExisting.exists()) {
    throw new Error('You can not both verify and dispute the same record Hash');
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
 * @param disputerId - The ID of the disputer
 * @param reactorId - The ID of the user reacting
 * @param supportsDispute - true to support, false to oppose
 */
export async function reactToDispute(
  recordId: string,
  recordHash: string,
  disputerId: string,
  reactorId: string,
  supportsDispute: boolean
): Promise<string> {
  const db = getFirestore();
  const reactorIdHash = ethers.keccak256(ethers.toUtf8Bytes(reactorId));
  const disputerIdHash = ethers.keccak256(ethers.toUtf8Bytes(disputerId));

  // Generate deterministic ID
  const reactionId = `${recordHash}_${disputerId}_${reactorId}`;
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
      disputerId,
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

// ============================================================
// REACTION QUERY FUNCTIONS
// ============================================================

/**
 * Fetches all reactions for a specific dispute.
 * Returns full ReactionDoc objects for displaying user lists.
 *
 * @param recordId - The record ID the dispute is for
 * @param recordHash - The record hash the dispute is for
 * @param disputerId - The ID of the disputer
 * @param activeOnly - Whether to only return active reactions (default: true)
 * @returns Array of ReactionDoc objects
 */
export async function getDisputeReactions(
  recordId: string,
  recordHash: string,
  disputerId: string,
  activeOnly: boolean = true
): Promise<ReactionDoc[]> {
  const db = getFirestore();
  const reactionsRef = collection(db, 'disputeReactions');

  // Build query
  let q = query(
    reactionsRef,
    where('recordId', '==', recordId),
    where('recordHash', '==', recordHash),
    where('disputerId', '==', disputerId)
  );

  // Note: Firestore doesn't allow multiple inequality filters,
  // so we filter isActive in memory if needed
  const querySnapshot = await getDocs(q);

  const reactions: ReactionDoc[] = [];

  querySnapshot.forEach(doc => {
    const data = doc.data();

    // Filter by active status if requested
    if (activeOnly && !data.isActive) {
      return;
    }

    reactions.push({
      id: doc.id,
      recordId: data.recordId,
      recordHash: data.recordHash,
      reactorId: data.reactorId,
      reactorIdHash: data.reactorIdHash,
      supportsDispute: data.supportsDispute,
      isActive: data.isActive,
      createdAt: data.createdAt,
      lastModified: data.lastModified,
      chainStatus: data.chainStatus,
      txHash: data.txHash,
    } as ReactionDoc);
  });

  // Sort by createdAt (newest first)
  reactions.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

  return reactions;
}

/**
 * Fetches reactions filtered by support type.
 * Convenience wrapper around getDisputeReactions.
 *
 * @param recordHash - The record hash the dispute is for
 * @param disputerId - The ID of the disputer
 * @param supportsDispute - true for supporters, false for opposers
 * @returns Array of ReactionDoc objects
 */
export async function getDisputeReactionsByType(
  recordHash: string,
  disputerId: string,
  supportsDispute: boolean
): Promise<ReactionDoc[]> {
  const reactions = await getDisputeReactions(recordHash, disputerId, 'true');
  return reactions.filter(r => r.supportsDispute === supportsDispute);
}

/**
 * Fetches reaction counts for a specific dispute
 */
export async function getDisputeReactionStats(
  recordId: string,
  recordHash: string,
  disputerId: string,
  currentUserId?: string
): Promise<ReactionStats> {
  const db = getFirestore();
  const reactionsRef = collection(db, 'disputeReactions');

  // Query all active reactions for this specific dispute
  const q = query(
    reactionsRef,
    where('recordId', '==', recordId),
    where('recordHash', '==', recordHash),
    where('disputerId', '==', disputerId),
    where('isActive', '==', true)
  );

  const querySnapshot = await getDocs(q);

  let supports = 0;
  let opposes = 0;
  let userReaction: boolean | null = null;

  querySnapshot.forEach(doc => {
    const data = doc.data();

    if (data.supportsDispute) {
      supports++;
    } else {
      opposes++;
    }

    // Track if the current user is one of the reactors
    if (currentUserId && data.reactorId === currentUserId) {
      userReaction = data.supportsDispute;
    }
  });

  console.log('Final stats:', { supports, opposes, userReaction });

  return { supports, opposes, userReaction };
}
