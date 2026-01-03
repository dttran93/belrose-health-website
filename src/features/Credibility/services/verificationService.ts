//src/features/Credibility/services/verificationService.ts

import { ethers } from 'ethers';
import { getFirestore, doc, setDoc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { blockchainHealthRecordService } from './blockchainHealthRecordService';

// ============================================================
// TYPES
// ============================================================

export type VerificationLevel = 1 | 2 | 3;

export type VerificationLevelName = 'Provenance' | 'Content' | 'Full';

export interface VerificationData {
  recordId: string;
  recordHash: string;
  level: VerificationLevel;
}

export interface VerificationDoc {
  id: string;
  recordHash: string;
  recordId: string;
  verifierId: string;
  verifierIdHash: string;
  level: VerificationLevel;
  isActive: boolean;
  createdAt: Timestamp;
  lastModified?: Timestamp;
  chainStatus: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

/** Convert level number to display name */
export const LEVEL_NAMES: Record<VerificationLevel, VerificationLevelName> = {
  1: 'Provenance',
  2: 'Content',
  3: 'Full',
};

/** Convert display name to level number */
export const LEVEL_VALUES: Record<VerificationLevelName, VerificationLevel> = {
  Provenance: 1,
  Content: 2,
  Full: 3,
};

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
  if (recordData.uploadedBy === verifierId) {
    throw new Error('Conflict of Interest: You cannot verify a record you created yourself.');
  }

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
    // 2. Write to blockchain
    const tx = await blockchainHealthRecordService.verifyRecord(recordId, recordHash, level);

    // 3. Update Firebase with confirmation
    await updateDoc(docRef, {
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });

    // 4. Recalculate scores
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
  const snapshot = await getDoc(doc(db, 'verifications', verificationId));

  if (!snapshot.exists()) return null;

  return { id: snapshot.id, ...snapshot.data() } as VerificationDoc;
}
