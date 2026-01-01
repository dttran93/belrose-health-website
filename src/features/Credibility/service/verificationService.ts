// services/verificationService.ts

import { ethers } from 'ethers';
import { Timestamp } from 'firebase/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { blockchainHealthRecordService } from './blockchainHealthRecordService';

export interface VerificationData {
  recordId: string;
  recordHash: string;
  level: VerificationLevel;
}

export interface VerificationDoc {
  id: string;
  recordHash: string;
  recordId: string;
  verifierUserId: string;
  verifierIdHash: string; //For blockchain
  level: 'Provenance' | 'Content' | 'Full';
  isActive: boolean;
  createdAt: Timestamp;
  retractedAt?: Timestamp;
  chainStatus: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
}

export type VerificationLevel = 1 | 2 | 3;

export async function createVerification(
  recordId: string,
  recordHash: string,
  verifierUserId: string,
  level: 'Provenance' | 'Content' | 'Full'
): Promise<string> {
  const verifierIdHash = ethers.keccak256(ethers.toUtf8Bytes(verifierUserId));
  const levelNum = { Provenance: 1, Content: 2, Full: 3 }[level];

  // 1. Write to Firebase first
  const db = getFirestore();
  const docRef = await db.collection('verifications').add({
    recordHash,
    recordId,
    verifierUserId,
    verifierIdHash,
    level,
    isActive: true,
    createdAt: Timestamp.now(),
    chainStatus: 'pending',
  });

  try {
    // 2. Write to blockchain
    const tx = await blockchainHealthRecordService.verifyRecord(recordId, recordHash, levelNum);

    // 3. Update Firebase with confirmation
    await docRef.update({
      chainStatus: 'confirmed',
      txHash: tx.txHash,
    });

    // 4. Recalculate scores
    await recalculateScores(recordHash, recordId, verifierIdHash);

    return docRef.id;
  } catch (error) {
    // Mark as failed
    await docRef.update({
      chainStatus: 'failed',
      error: error.message,
    });
    throw error;
  }
}

export async function retractVerification(
  recordHash: string,
  verifierOdysId: string
): Promise<void> {
  const verifierIdHash = ethers.keccak256(ethers.toUtf8Bytes(verifierOdysId));

  // 1. Find the verification
  const snapshot = await db
    .collection('verifications')
    .where('recordHash', '==', recordHash)
    .where('verifierOdysId', '==', verifierOdysId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) throw new Error('Verification not found');

  const docRef = snapshot.docs[0].ref;
  const verification = snapshot.docs[0].data();

  // 2. Update Firebase
  await docRef.update({
    isActive: false,
    retractedAt: Timestamp.now(),
    chainStatus: 'pending',
  });

  try {
    // 3. Write to blockchain
    const tx = await HealthRecordCore.retractVerification(recordHash);
    const receipt = await tx.wait();

    // 4. Confirm
    await docRef.update({
      chainStatus: 'confirmed',
      txHash: receipt.hash,
    });

    // 5. Recalculate scores
    //await recalculateScores(recordHash, verification.recordId, verifierIdHash);
  } catch (error) {
    // Rollback Firebase
    await docRef.update({
      isActive: true,
      retractedAt: null,
      chainStatus: 'failed',
      error: error.message,
    });
    throw error;
  }
}

export async function modifyVerificationLevel(
  recordHash: string,
  verifierOdysId: string,
  newLevel: 'Provenance' | 'Content' | 'Full'
): Promise<void> {
  const verifierIdHash = ethers.keccak256(ethers.toUtf8Bytes(verifierOdysId));
  const levelNum = { Provenance: 1, Content: 2, Full: 3 }[newLevel];

  const snapshot = await db
    .collection('verifications')
    .where('recordHash', '==', recordHash)
    .where('verifierOdysId', '==', verifierOdysId)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) throw new Error('Verification not found');

  const docRef = snapshot.docs[0].ref;
  const oldLevel = snapshot.docs[0].data().level;

  await docRef.update({
    level: newLevel,
    chainStatus: 'pending',
  });

  try {
    const tx = await HealthRecordCore.modifyVerificationLevel(recordHash, levelNum);
    const receipt = await tx.wait();

    await docRef.update({
      chainStatus: 'confirmed',
      txHash: receipt.hash,
    });

    await recalculateScores(recordHash, snapshot.docs[0].data().recordId, verifierIdHash);
  } catch (error) {
    await docRef.update({
      level: oldLevel,
      chainStatus: 'failed',
      error: error.message,
    });
    throw error;
  }
}
