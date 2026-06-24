// src/features/BackendChainParity/services/memberIntegrityService.ts

import type { BelroseUserProfile, LinkedWalletRecord, onChainIdentityStatus } from '@/types/core';
import type { IntegrityStatus } from '../lib/types';
import { getMemberContract } from '../lib/contracts';
import { id } from 'ethers';

export interface MemberIntegrityItem {
  uid: string;
  displayName: string;
  email: string;
  userIdHash?: string;
  firestoreStatus?: string;
  firestoreWalletAddress?: string;
  firestoreSmartAccountAddress?: string;
  linkedWallets?: LinkedWalletRecord[];
  onChainStatusHistory?: onChainIdentityStatus[];
  integrityStatus: IntegrityStatus;
  onChainStatus?: number;
  onChainWallets?: string[];
  walletMismatch?: boolean;
  statusMismatch?: boolean;
  error?: string;
  isGuest?: boolean;
  isDependent?: boolean;
  isPlatformAdmin?: boolean;
  identityVerified?: boolean;
  healthcareProviderVerified?: boolean;
}

const FIRESTORE_STATUS_TO_NUMBER: Record<string, number> = {
  Inactive: 1,
  Active: 2,
  Verified: 3,
  VerifiedProvider: 4,
  Guest: 5,
};

export async function buildChainOnlyItem(userIdHash: string): Promise<MemberIntegrityItem> {
  try {
    const contract = getMemberContract();
    const [onChainStatusBigInt, onChainWallets] = await Promise.all([
      contract.userStatus(userIdHash),
      contract.getWalletsForUser(userIdHash),
    ]);

    return {
      uid: userIdHash,
      displayName: 'Unknown (chain-only)',
      email: '',
      userIdHash,
      integrityStatus: 'chain_only',
      onChainStatus: Number(onChainStatusBigInt),
      onChainWallets,
    };
  } catch (error) {
    return {
      uid: userIdHash,
      displayName: 'Unknown (chain-only)',
      email: '',
      userIdHash,
      integrityStatus: 'failed',
      error: String(error),
    };
  }
}

export async function checkMemberIntegrity(user: BelroseUserProfile): Promise<MemberIntegrityItem> {
  let userIdHash = user.onChainIdentity?.userIdHash;
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
    onChainStatusHistory: onChainStatuses,
    isGuest: user.isGuest,
    isDependent: user.isDependent,
    isPlatformAdmin: user.isPlatformAdmin,
    identityVerified: user.identityVerified,
    healthcareProviderVerified: user.healthcareProviderVerified,
  };

  if (!userIdHash) {
    userIdHash = id(user.uid);
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
