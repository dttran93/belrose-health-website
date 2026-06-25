// src/features/BackendChainParity/services/integrityCheckService.ts

import type {
  FirestoreVerification,
  FirestoreDispute,
  VerificationIntegrityItem,
  DisputeIntegrityItem,
  IntegrityStatus,
} from '../lib/types';
import { getHealthContract } from '../lib/contracts';

// ============================================================================
// VERIFICATION INTEGRITY CHECK
// ============================================================================

export async function checkVerificationIntegrity(
  ver: FirestoreVerification
): Promise<VerificationIntegrityItem> {
  const base: Omit<VerificationIntegrityItem, 'integrityStatus'> = {
    firestoreId: ver.id,
    recordHash: ver.recordHash,
    recordId: ver.recordId,
    verifierIdHash: ver.verifierIdHash,
    verifierId: ver.verifierId,
    chainStatus: ver.chainStatus,
    blockchainRef: ver.blockchainRef,
    level: ver.level,
    createdAt: ver.createdAt,
  };

  if (ver.chainStatus === 'pending') return { ...base, integrityStatus: 'pending' };
  if (ver.chainStatus === 'failed') return { ...base, integrityStatus: 'failed' };
  if (!ver.recordHash || !ver.verifierIdHash) return { ...base, integrityStatus: 'not_applicable' };

  try {
    const contract = getHealthContract();
    const [exists, , , , isActive] = await contract.getUserVerification(
      ver.recordHash,
      ver.verifierIdHash
    );

    let integrityStatus: IntegrityStatus;
    if (!exists) integrityStatus = 'missing';
    else if (!isActive) integrityStatus = 'mismatch';
    else integrityStatus = 'synced';

    return { ...base, integrityStatus, existsOnChain: exists, isActiveOnChain: isActive };
  } catch (error) {
    return { ...base, integrityStatus: 'failed', error: String(error) };
  }
}

// ============================================================================
// DISPUTE INTEGRITY CHECK
// ============================================================================

export async function checkDisputeIntegrity(
  dispute: FirestoreDispute
): Promise<DisputeIntegrityItem> {
  const base: Omit<DisputeIntegrityItem, 'integrityStatus'> = {
    firestoreId: dispute.id,
    recordHash: dispute.recordHash,
    recordId: dispute.recordId,
    disputerIdHash: dispute.disputerIdHash,
    disputerId: dispute.disputerId,
    chainStatus: dispute.chainStatus,
    blockchainRef: dispute.blockchainRef,
    severity: dispute.severity,
    createdAt: dispute.createdAt,
  };

  if (dispute.chainStatus === 'pending') return { ...base, integrityStatus: 'pending' };
  if (dispute.chainStatus === 'failed') return { ...base, integrityStatus: 'failed' };
  if (!dispute.recordHash || !dispute.disputerIdHash)
    return { ...base, integrityStatus: 'not_applicable' };

  try {
    const contract = getHealthContract();
    const [exists, , , , , , isActive] = await contract.getUserDispute(
      dispute.recordHash,
      dispute.disputerIdHash
    );

    let integrityStatus: IntegrityStatus;
    if (!exists) integrityStatus = 'missing';
    else if (!isActive) integrityStatus = 'mismatch';
    else integrityStatus = 'synced';

    return { ...base, integrityStatus, existsOnChain: exists, isActiveOnChain: isActive };
  } catch (error) {
    return { ...base, integrityStatus: 'failed', error: String(error) };
  }
}
