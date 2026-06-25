// src/features/BackendChainParity/services/credibilityIntegrityService.ts

import type { VerificationDoc, DisputeDoc, BlockchainRef, TimestampLike } from '@belrose/shared';
import type { IntegrityStatus } from '../lib/types';
import { getHealthContract } from '../lib/contracts';
import { id } from 'ethers';

// ============================================================================
// VERIFICATION INTEGRITY CHECK
// ============================================================================

export interface VerificationIntegrityItem {
  recordId: string;
  recordIdHash: string;
  recordHash: string;
  verifierIdHash: string;
  verifierId: string;
  chainStatus?: string;
  blockchainRef?: BlockchainRef;
  level: number;
  createdAt?: TimestampLike;
  integrityStatus: IntegrityStatus;
  existsOnChain?: boolean;
  isActiveOnChain?: boolean;
  mismatchReasons?: string[];
  error?: string;
}

export async function checkVerificationIntegrity(
  ver: VerificationDoc
): Promise<VerificationIntegrityItem> {
  const expectedRecordIdHash = (ver.recordIdHash || id(ver.recordId)).toLowerCase();

  const base: Omit<VerificationIntegrityItem, 'integrityStatus'> = {
    recordId: ver.recordId,
    recordIdHash: expectedRecordIdHash,
    recordHash: ver.recordHash,
    verifierId: ver.verifierId,
    verifierIdHash: ver.verifierIdHash,
    chainStatus: ver.chainStatus,
    blockchainRef: ver.blockchainRef,
    level: ver.level,
    createdAt: ver.createdAt,
  };

  if (ver.chainStatus === 'pending') return { ...base, integrityStatus: 'pending' };
  if (ver.chainStatus === 'failed') return { ...base, integrityStatus: 'failed' };

  try {
    const contract = getHealthContract();

    const [[exists, onChainRecordIdHash, onChainLevel, , isActive], hashIsActive] =
      await Promise.all([
        contract.getUserVerification(ver.recordHash, ver.verifierIdHash),
        contract.doesHashExist(ver.recordHash),
      ]);

    // Check 1: does the verification exist on-chain?
    if (!exists) return { ...base, integrityStatus: 'missing', existsOnChain: false };

    const mismatchReasons: string[] = [];

    // Check 2: is the record hash still active on-chain (not retracted from the record)?
    if (!hashIsActive) {
      mismatchReasons.push('record hash retracted on-chain');
    }

    // Check 3: does the on-chain verification still point to the expected record?
    const onChainRecordIdHashNorm = (onChainRecordIdHash as string).toLowerCase();
    if (onChainRecordIdHashNorm !== expectedRecordIdHash) {
      mismatchReasons.push(
        `recordIdHash mismatch — on-chain: ${onChainRecordIdHashNorm.slice(0, 12)}…, expected: ${expectedRecordIdHash.slice(0, 12)}…`
      );
    }

    // Check 4: does the on-chain level match Firestore?
    const onChainLevelNum = Number(onChainLevel);
    if (onChainLevelNum !== ver.level) {
      mismatchReasons.push(
        `level mismatch — on-chain: ${onChainLevelNum}, firestore: ${ver.level}`
      );
    }

    // Check 5: is the verification still active?
    if (!isActive) {
      mismatchReasons.push('verification retracted on-chain');
    }

    const integrityStatus: IntegrityStatus = mismatchReasons.length > 0 ? 'mismatch' : 'synced';

    return {
      ...base,
      integrityStatus,
      existsOnChain: true,
      isActiveOnChain: !!isActive,
      ...(mismatchReasons.length > 0 && { mismatchReasons }),
    };
  } catch (error) {
    return { ...base, integrityStatus: 'failed', error: String(error) };
  }
}

// ============================================================================
// DISPUTE INTEGRITY CHECK
// ============================================================================

export interface DisputeIntegrityItem {
  recordId: string;
  recordIdHash: string;
  recordHash: string;
  disputerIdHash?: string;
  disputerId?: string;
  chainStatus?: string;
  blockchainRef?: BlockchainRef;
  severity: number;
  culpability: number;
  createdAt?: TimestampLike;
  integrityStatus: IntegrityStatus;
  existsOnChain?: boolean;
  isActiveOnChain?: boolean;
  mismatchReasons?: string[];
  error?: string;
}

export async function checkDisputeIntegrity(dispute: DisputeDoc): Promise<DisputeIntegrityItem> {
  const expectedRecordIdHash = id(dispute.recordId).toLowerCase();

  const base: Omit<DisputeIntegrityItem, 'integrityStatus'> = {
    recordId: dispute.recordId,
    recordIdHash: expectedRecordIdHash,
    recordHash: dispute.recordHash,
    disputerIdHash: dispute.disputerIdHash,
    disputerId: dispute.disputerId,
    chainStatus: dispute.chainStatus,
    blockchainRef: dispute.blockchainRef,
    severity: dispute.severity,
    culpability: dispute.culpability,
    createdAt: dispute.createdAt,
  };

  if (dispute.chainStatus === 'pending') return { ...base, integrityStatus: 'pending' };
  if (dispute.chainStatus === 'failed') return { ...base, integrityStatus: 'failed' };
  if (!dispute.recordHash || !dispute.disputerIdHash)
    return { ...base, integrityStatus: 'not_applicable' };

  try {
    const contract = getHealthContract();

    const [[exists, onChainRecordIdHash, onChainSeverity, onChainCulpability, , , isActive], hashIsActive] =
      await Promise.all([
        contract.getUserDispute(dispute.recordHash, dispute.disputerIdHash),
        contract.doesHashExist(dispute.recordHash),
      ]);

    // Check 1: does the dispute exist on-chain?
    if (!exists) return { ...base, integrityStatus: 'missing', existsOnChain: false };

    const mismatchReasons: string[] = [];

    // Check 2: is the record hash still active on-chain (not retracted from the record)?
    if (!hashIsActive) {
      mismatchReasons.push('record hash retracted on-chain');
    }

    // Check 3: does the on-chain dispute still point to the expected record?
    const onChainRecordIdHashNorm = (onChainRecordIdHash as string).toLowerCase();
    if (onChainRecordIdHashNorm !== expectedRecordIdHash) {
      mismatchReasons.push(
        `recordIdHash mismatch — on-chain: ${onChainRecordIdHashNorm.slice(0, 12)}…, expected: ${expectedRecordIdHash.slice(0, 12)}…`
      );
    }

    // Check 4: does the on-chain severity match Firestore?
    const onChainSeverityNum = Number(onChainSeverity);
    if (onChainSeverityNum !== dispute.severity) {
      mismatchReasons.push(
        `severity mismatch — on-chain: ${onChainSeverityNum}, firestore: ${dispute.severity}`
      );
    }

    // Check 5: does the on-chain culpability match Firestore?
    const onChainCulpabilityNum = Number(onChainCulpability);
    if (onChainCulpabilityNum !== dispute.culpability) {
      mismatchReasons.push(
        `culpability mismatch — on-chain: ${onChainCulpabilityNum}, firestore: ${dispute.culpability}`
      );
    }

    // Check 6: is the dispute still active?
    if (!isActive) {
      mismatchReasons.push('dispute retracted on-chain');
    }

    const integrityStatus: IntegrityStatus = mismatchReasons.length > 0 ? 'mismatch' : 'synced';

    return {
      ...base,
      integrityStatus,
      existsOnChain: true,
      isActiveOnChain: !!isActive,
      ...(mismatchReasons.length > 0 && { mismatchReasons }),
    };
  } catch (error) {
    return { ...base, integrityStatus: 'failed', error: String(error) };
  }
}
