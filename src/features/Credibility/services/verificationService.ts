//src/features/Credibility/services/verificationService.ts

import { ethers } from 'ethers';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
  collection,
  where,
  query,
  getDocs,
} from 'firebase/firestore';
import { blockchainHealthRecordService } from './blockchainHealthRecordService';
import { FileText, Lock, LucideIcon, MapPin, X } from 'lucide-react';
import { getDisputeId } from './disputeService';

// ============================================================
// TYPES
// ============================================================

export type VerificationLevel = 0 | 1 | 2 | 3;
export type VerificationLevelOptions = 1 | 2 | 3;
export type VerificationLevelOptionName = 'Provenance' | 'Content' | 'Full';

export interface VerificationConfig {
  value: VerificationLevelOptions;
  name: VerificationLevelOptionName;
  icon: LucideIcon;
  description: string;
  declarative: string;
}

export interface VerificationDoc {
  id: string;
  recordHash: string;
  recordId: string;
  verifierId: string;
  verifierIdHash: string;
  level: VerificationLevelOptions;
  isActive: boolean;
  createdAt: Timestamp;
  lastModified?: Timestamp;
  chainStatus: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

export const VERIFICATION_LEVEL_CONFIG: Record<VerificationLevelOptions, VerificationConfig> = {
  3: {
    value: 3,
    name: 'Full',
    icon: Lock,
    declarative:
      'I created this record or am willing to verify both the content and provenance of the record.',
    description:
      'The verifier is vouching for both the content and the provenance of this record. They are either the provider who originally created the record or directly verified that the record is complete and accuate',
  },
  2: {
    value: 2,
    name: 'Content',
    icon: FileText,
    declarative:
      'I am vouching for the content of the record, but I did not observe the original interaction described.',
    description:
      'The verifier is vouching for the content of the record. They may not have originally created the record or directly observed the interaction, however they have certified they agree with its content.',
  },
  1: {
    value: 1,
    name: 'Provenance',
    icon: MapPin,
    declarative:
      'I am confirming that the origin of the record is correct. I am not verifying the accuracy of its content.',
    description:
      'The verifier is confirming the origin of the record is correctly stated. They are not verifying the completeness and accuracy of the content itself.',
  },
};

// Helper functions to access config
export const getVerificationConfig = (
  verificationLevel: VerificationLevelOptions
): VerificationConfig => VERIFICATION_LEVEL_CONFIG[verificationLevel];

// Arrays for iterating in UI (forms, selects, etc.)
export const VERIFICATION_OPTIONS = Object.values(VERIFICATION_LEVEL_CONFIG);

// ============================================================
// HELPERS
// ============================================================

/**
 * Generates a deterministic verification document ID.
 * Format: {recordHash}_{verifierId}
 * This ensures one verification per user per record hash.
 */
export function getVerificationId(recordHash: string, verifierId: string): string {
  return `${recordHash}_${verifierId}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// ============================================================
// QUERY FUNCTIONS
// ============================================================

/**
 * Fetches all verifications for a record (across all versions/hashes).
 * Uses Firestore query on recordId field.
 *
 * @param recordId - The record ID to fetch verifications for
 * @returns Array of VerificationDoc objects
 */
export async function getVerificationsByRecordId(recordId: string): Promise<VerificationDoc[]> {
  const db = getFirestore();
  const verificationsRef = collection(db, 'verifications');

  // Query all verifications where recordId matches
  const q = query(verificationsRef, where('recordId', '==', recordId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(
    doc =>
      ({
        id: doc.id,
        ...doc.data(),
      }) as VerificationDoc
  );
}

/**
 * Fetches verifications with version information.
 * Groups verifications by hash and includes version numbers.
 *
 * @param recordId - The record ID
 * @param hashVersionMap - Map of recordHash -> versionNumber (from record's version history)
 * @returns Array of verifications with version info attached
 */
export async function getVerificationsWithVersionInfo(
  recordId: string,
  hashVersionMap: Map<string, number>
): Promise<VerificationDoc[]> {
  const verifications = await getVerificationsByRecordId(recordId);
  const totalVersions = hashVersionMap.size;

  return verifications.map(v => ({
    ...v,
    versionNumber: hashVersionMap.get(v.recordHash) ?? 0,
    totalVersions,
  }));
}

// ============================================================
// VERIFICATION FUNCTIONS
// ============================================================

export async function createVerification(
  recordId: string,
  recordHash: string,
  verifierId: string,
  level: VerificationLevel
): Promise<string> {
  const db = getFirestore();
  // CHECK 1: Ensure user is not verifying their own record
  const recordRef = doc(db, 'records', recordId);
  const recordSnap = await getDoc(recordRef);

  if (!recordSnap.exists()) {
    throw new Error('Record not found.');
  }

  const recordData = recordSnap.data();

  // CHECK 2: Ensure there isn't already an existing verification
  const verificationId = getVerificationId(recordHash, verifierId);
  const docRef = doc(db, 'verifications', verificationId);
  const existing = await getDoc(docRef);

  if (existing.exists()) {
    const data = existing.data();

    // If it's already confirmed on-chain and active, block it.
    if (data?.isActive && data?.chainStatus === 'confirmed') {
      throw new Error('You have already verified this record. Use modify to update.');
    }

    console.log('Reactivating or retrying failed or pending verification...');
  }

  // CHECK 3: You cannot both dispute and verify the same recordHash
  const disputeId = getDisputeId(recordHash, verifierId);
  const disputeDocRef = doc(db, 'disputes', disputeId);
  const disputeExisting = await getDoc(disputeDocRef);

  if (disputeExisting.exists()) {
    throw new Error('You can not both verify and dispute the same record Hash');
  }

  const verifierIdHash = ethers.keccak256(ethers.toUtf8Bytes(verifierId));

  // 1. Write to Firebase first. Update existing if reactiviating or retrying failed blockchain write
  if (existing.exists()) {
    await updateDoc(docRef, {
      level,
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
      verifierId,
      verifierIdHash,
      level,
      isActive: true,
      createdAt: Timestamp.now(),
      chainStatus: 'pending',
    });
  }

  try {
    // 2. Check if hash needs to be added to the blockchain first
    const isHashOnChain = await blockchainHealthRecordService.doesHashExist(recordHash);

    if (!isHashOnChain) {
      await blockchainHealthRecordService.addRecordHash(recordId, recordHash);
    }

    // 3. Write verification to blockchain
    const tx = await blockchainHealthRecordService.verifyRecord(recordId, recordHash, level);

    // 4. Update Firebase with confirmation
    await updateDoc(docRef, {
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });

    // 5. Recalculate scores
    //await recalculateScores(recordHash, recordId, verifierIdHash);

    return verificationId;
  } catch (error) {
    // Mark as failed
    await updateDoc(docRef, {
      chainStatus: 'failed',
      error: getErrorMessage(error),
    });
    throw error;
  }
}

export async function retractVerification(recordHash: string, verifierId: string): Promise<void> {
  const verifierIdHash = ethers.keccak256(ethers.toUtf8Bytes(verifierId));

  // CHECK 1. Find the verification make sure it is active
  const verificationId = getVerificationId(recordHash, verifierId);

  const db = getFirestore();
  const docRef = doc(db, 'verifications', verificationId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error('Verification not found');
  }

  const data = snapshot.data();
  if (!data?.isActive) {
    throw new Error('Verification is already inactive');
  }

  // CHECK 2. You can only retract your own verification
  if (data.verifierId !== verifierId) {
    throw new Error('You can only retract your own verifications');
  }

  // 1. Update Firebase
  await updateDoc(docRef, {
    isActive: false,
    lastModified: Timestamp.now(),
    chainStatus: 'pending',
  });

  try {
    // 2. Write to blockchain
    const tx = await blockchainHealthRecordService.retractVerification(recordHash);

    // 3. Confirm
    await updateDoc(docRef, {
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });

    // 4. Recalculate scores
    //await recalculateScores(recordHash, verification.recordId, verifierIdHash);
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

export async function modifyVerificationLevel(
  recordHash: string,
  verifierId: string,
  newLevel: VerificationLevel
): Promise<void> {
  const verifierIdHash = ethers.keccak256(ethers.toUtf8Bytes(verifierId));

  // CHECK 1: Make sure that the verification exists and is active
  const verificationId = getVerificationId(recordHash, verifierId);
  const db = getFirestore();
  const docRef = doc(db, 'verifications', verificationId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    throw new Error('Verification not found');
  }

  const data = snapshot.data();
  if (!data?.isActive) {
    throw new Error('Cannot modify an inactive verification');
  }

  // CHECK 2: Make sure that the verification level is different
  if (data.verifierId !== verifierId) {
    throw new Error('You can only modify your own verification');
  }

  // CHECK 3: Make sure that the verification level is different
  const oldLevel = data.level;
  if (oldLevel === newLevel) {
    throw new Error('New level is the same as current level');
  }

  await updateDoc(docRef, {
    level: newLevel,
    lastModified: Timestamp.now(),
    chainStatus: 'pending',
  });

  try {
    const tx = await blockchainHealthRecordService.modifyVerificationLevel(recordHash, newLevel);

    await updateDoc(docRef, {
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });

    //await recalculateScores(recordHash, snapshot.docs[0].data().recordId, verifierIdHash);
  } catch (error) {
    await updateDoc(docRef, {
      level: oldLevel,
      chainStatus: 'failed',
      error: getErrorMessage(error),
    });
    throw error;
  }
}

export async function getVerification(
  recordHash: string,
  verifierId: string
): Promise<VerificationDoc | null> {
  const verificationId = getVerificationId(recordHash, verifierId);

  const db = getFirestore();
  try {
    const snapshot = await getDoc(doc(db, 'verifications', verificationId));

    if (!snapshot.exists()) return null;

    return { id: snapshot.id, ...snapshot.data() } as VerificationDoc;
  } catch (error) {
    console.debug('Verification not found or not accessible:', verificationId);
    return null;
  }
}
