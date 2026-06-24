// src/features/BackendChainParity/services/integrityCheckService.ts

import { ethers } from 'ethers';
import {
  buildRpcUrl,
  HEALTH_RECORD_CORE,
  MEMBER_ROLE_MANAGER,
  HealthRecordCore__factory,
  MemberRoleManager__factory,
} from '@belrose/shared';
import type { HealthRecordCore, MemberRoleManager } from '@belrose/shared';
import { requireEnv } from '@/utils/utils';
import type {
  FirestoreUser,
  FirestoreVerification,
  FirestoreDispute,
  MemberIntegrityItem,
  VerificationIntegrityItem,
  DisputeIntegrityItem,
  IntegrityStatus,
} from '../lib/types';

// ============================================================================
// SINGLETON CONTRACT INSTANCES (read-only, no wallet)
// ============================================================================

const RPC_URL = buildRpcUrl(requireEnv('VITE_ALCHEMY_API_KEY'));

let provider: ethers.JsonRpcProvider | null = null;
let healthContract: HealthRecordCore | null = null;
let memberContract: MemberRoleManager | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return provider;
}

function getHealthContract(): HealthRecordCore {
  if (!healthContract) {
    healthContract = new ethers.Contract(
      HEALTH_RECORD_CORE.proxy,
      HealthRecordCore__factory.abi,
      getProvider()
    ) as unknown as HealthRecordCore;
  }
  return healthContract;
}

function getMemberContract(): MemberRoleManager {
  if (!memberContract) {
    memberContract = new ethers.Contract(
      MEMBER_ROLE_MANAGER.proxy,
      MemberRoleManager__factory.abi,
      getProvider()
    ) as unknown as MemberRoleManager;
  }
  return memberContract;
}

// ============================================================================
// HELPERS
// ============================================================================

const FIRESTORE_STATUS_TO_NUMBER: Record<string, number> = {
  Inactive: 1,
  Active: 2,
  Verified: 3,
  VerifiedProvider: 4,
  Guest: 5,
};

// ============================================================================
// MEMBER INTEGRITY CHECK
// ============================================================================

export async function checkMemberIntegrity(user: FirestoreUser): Promise<MemberIntegrityItem> {
  const userIdHash = user.onChainIdentity?.userIdHash;
  const displayName =
    user.displayName ||
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
    user.email ||
    user.uid;

  const onChainStatuses = user.onChainIdentity?.onChainStatus ?? [];
  const currentFirestoreStatus = onChainStatuses[onChainStatuses.length - 1]?.status;

  const base: Omit<MemberIntegrityItem, 'integrityStatus'> = {
    uid: user.uid,
    displayName,
    email: user.email ?? '',
    userIdHash,
    firestoreStatus: currentFirestoreStatus,
    firestoreWalletAddress: user.wallet?.address,
    firestoreSmartAccountAddress: user.wallet?.smartAccountAddress,
    linkedWallets: user.onChainIdentity?.linkedWallets,
  };

  if (!userIdHash) {
    return { ...base, integrityStatus: 'not_applicable' };
  }

  try {
    const contract = getMemberContract();
    const [onChainStatusBigInt, onChainWallets] = await Promise.all([
      contract.userStatus(userIdHash),
      contract.getWalletsForUser(userIdHash),
    ]);

    const onChainStatus = Number(onChainStatusBigInt);

    // 0 = NotRegistered — userIdHash set in Firestore but not found on-chain
    if (onChainStatus === 0) {
      return { ...base, integrityStatus: 'missing', onChainStatus, onChainWallets };
    }

    const expectedStatus = FIRESTORE_STATUS_TO_NUMBER[currentFirestoreStatus ?? ''];
    const statusMismatch = expectedStatus !== undefined && expectedStatus !== onChainStatus;

    const onChainWalletsLower = onChainWallets.map(w => w.toLowerCase());
    const firestoreWallets = [user.wallet?.address, user.wallet?.smartAccountAddress]
      .filter((w): w is string => Boolean(w))
      .map(w => w.toLowerCase());
    const walletMismatch = firestoreWallets.some(w => !onChainWalletsLower.includes(w));

    const integrityStatus: IntegrityStatus =
      statusMismatch || walletMismatch ? 'mismatch' : 'synced';

    return {
      ...base,
      integrityStatus,
      onChainStatus,
      onChainWallets,
      walletMismatch,
      statusMismatch,
    };
  } catch (error) {
    return { ...base, integrityStatus: 'failed', error: String(error) };
  }
}

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
