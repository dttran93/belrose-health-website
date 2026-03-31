// src/features/Permissions/services/blockchainRoleManagerService.ts
//
// Frontend service for blockchain role management.
// Uses PaymasterService for all write transactions (handles sponsored vs direct).
//
// KEY ARCHITECTURE (matches MemberRoleManager.sol):
// - Members are registered by WALLET ADDRESS
// - Each wallet is linked to an IDENTITY (userIdHash)
// - One identity can have MULTIPLE wallets (EOA, Smart Account, etc.)
// - Roles are assigned to IDENTITIES, not wallets
// - Any wallet linked to an identity can exercise that identity's roles
//
// Read operations: No wallet needed (uses public RPC)
// Write operations: Routes through PaymasterService
//
// Note: Admin-only functions (addMember, setUserStatus, initializeRecordRole,
// deactivateWallet, reactivateWallet) are handled by Cloud Functions, not this frontend service.

import { ethers, Contract } from 'ethers';
import { PaymasterService } from '@/features/BlockchainWallet/services/paymasterService';
import { MEMBER_ROLE_MANAGER, NETWORK } from '@/config/blockchainAddresses';

// Contract address
const MEMBER_ROLE_MANAGER_ADDRESS = MEMBER_ROLE_MANAGER.proxy;

// RPC for read-only operations
const RPC_URL = NETWORK.rpcUrl;

// ABI - all functions we need (view + write)
const MEMBER_ROLE_MANAGER_ABI = [
  // ============================================================================
  // MEMBER REGISTRY - VIEW FUNCTIONS
  // ============================================================================

  // wallets(address) -> (userIdHash, isWalletActive)
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'wallets',
    outputs: [
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
      { internalType: 'bool', name: 'isWalletActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // userStatus(bytes32) -> MemberStatus
  {
    inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    name: 'userStatus',
    outputs: [{ internalType: 'enum MemberRoleManager.MemberStatus', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'wallet', type: 'address' }],
    name: 'isActiveMember',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'wallet', type: 'address' }],
    name: 'isVerifiedMember',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'wallet', type: 'address' }],
    name: 'getUserForWallet',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' }],
    name: 'getWalletsForUser',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' }],
    name: 'getUserStatus',
    outputs: [
      { internalType: 'enum MemberRoleManager.MemberStatus', name: 'status', type: 'uint8' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAllUsers',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalUsers',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ============================================================================
  // ROLE MANAGEMENT - VIEW FUNCTIONS
  // ============================================================================
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'wallet', type: 'address' },
    ],
    name: 'hasActiveRole',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'wallet', type: 'address' },
      { internalType: 'string', name: 'role', type: 'string' },
    ],
    name: 'hasRole',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'wallet', type: 'address' },
    ],
    name: 'isOwnerOrAdmin',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'wallet', type: 'address' },
    ],
    name: 'getRoleDetails',
    outputs: [
      { internalType: 'string', name: 'role', type: 'string' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'getRoleDetailsByUser',
    outputs: [
      { internalType: 'string', name: 'role', type: 'string' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordOwners',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordAdmins',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordViewers',
    outputs: [{ internalType: 'bytes32[]', name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' }],
    name: 'getRecordsByUser',
    outputs: [{ internalType: 'string[]', name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordRoleStats',
    outputs: [
      { internalType: 'uint256', name: 'ownerCount', type: 'uint256' },
      { internalType: 'uint256', name: 'adminCount', type: 'uint256' },
      { internalType: 'uint256', name: 'viewerCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalRoles',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ============================================================================
  // ROLE MANAGEMENT - WRITE FUNCTIONS (require user signature)
  // ============================================================================
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'targetWallet', type: 'address' },
      { internalType: 'string', name: 'role', type: 'string' },
    ],
    name: 'grantRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'targetWallet', type: 'address' },
      { internalType: 'string', name: 'newRole', type: 'string' },
    ],
    name: 'changeRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'targetWallet', type: 'address' },
    ],
    name: 'revokeRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'voluntarilyLeaveOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============================================================================
  // BATCH ROLE MANAGEMENT - WRITE FUNCTIONS
  // ============================================================================
  {
    inputs: [
      { internalType: 'string[]', name: 'recordIds', type: 'string[]' },
      { internalType: 'address', name: 'targetWallet', type: 'address' },
      { internalType: 'string[]', name: 'roles', type: 'string[]' },
    ],
    name: 'grantRoleBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string[]', name: 'recordIds', type: 'string[]' },
      { internalType: 'address', name: 'targetWallet', type: 'address' },
      { internalType: 'string[]', name: 'newRoles', type: 'string[]' },
    ],
    name: 'changeRoleBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string[]', name: 'recordIds', type: 'string[]' },
      { internalType: 'address', name: 'targetWallet', type: 'address' },
    ],
    name: 'revokeRoleBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string[]', name: 'recordIds', type: 'string[]' },
      { internalType: 'bytes32', name: 'trustorIdHash', type: 'bytes32' },
    ],
    name: 'grantRoleAsTrusteeBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============================================================================
  // TRUSTEE RELATIONSHIPS - WRITE FUNCTIONS
  // ============================================================================
  {
    inputs: [
      { internalType: 'bytes32', name: 'trusteeIdHash', type: 'bytes32' },
      { internalType: 'uint8', name: 'level', type: 'uint8' },
    ],
    name: 'proposeTrustee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'trustorIdHash', type: 'bytes32' }],
    name: 'acceptTrustee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'trustorIdHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'trusteeIdHash', type: 'bytes32' },
    ],
    name: 'revokeTrustee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'trusteeIdHash', type: 'bytes32' },
      { internalType: 'uint8', name: 'newLevel', type: 'uint8' },
    ],
    name: 'updateTrusteeLevel',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============================================================================
  // TRUSTEE RELATIONSHIPS - VIEW FUNCTIONS
  // ============================================================================
  {
    inputs: [
      { internalType: 'bytes32', name: 'trustorIdHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'trusteeIdHash', type: 'bytes32' },
    ],
    name: 'isControllerOf',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'trustorIdHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'trusteeIdHash', type: 'bytes32' },
    ],
    name: 'getTrusteeRelationship',
    outputs: [
      { internalType: 'uint8', name: 'status', type: 'uint8' },
      { internalType: 'uint8', name: 'level', type: 'uint8' },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ============================================================================
  // GUEST ACCESS - WRITE FUNCTIONS
  // ============================================================================
  {
    inputs: [
      { internalType: 'string[]', name: 'recordIds', type: 'string[]' },
      { internalType: 'address', name: 'guestWallet', type: 'address' },
      { internalType: 'bytes32', name: 'guestIdHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'guestEmailHash', type: 'bytes32' },
      { internalType: 'uint256', name: 'durationSeconds', type: 'uint256' },
    ],
    name: 'grantGuestAccess',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string[]', name: 'recordIds', type: 'string[]' },
      { internalType: 'bytes32', name: 'guestIdHash', type: 'bytes32' },
    ],
    name: 'revokeGuestAccess',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============================================================================
  // GUEST ACCESS - VIEW FUNCTIONS
  // ============================================================================
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'bytes32', name: 'guestIdHash', type: 'bytes32' },
    ],
    name: 'hasActiveGuestAccess',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'bytes32', name: 'guestIdHash', type: 'bytes32' },
    ],
    name: 'getGuestAccess',
    outputs: [
      { internalType: 'uint256', name: 'grantedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'expiresAt', type: 'uint256' },
      { internalType: 'bytes32', name: 'grantedByIdHash', type: 'bytes32' },
      { internalType: 'bytes32', name: 'guestEmailHash', type: 'bytes32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// ============================================================================
// TYPES
// ============================================================================

/**
 * Member status enum - matches MemberRoleManager.sol
 * NotRegistered = 0: Default/uninitialized
 * Inactive = 1: Cannot transact (banned/removed)
 * Active = 2: Default for new members
 * Verified = 3: User has verified their identity and email
 */
export enum MemberStatus {
  NotRegistered = 0,
  Inactive = 1,
  Active = 2,
  Verified = 3,
  VerifiedProvider = 4,
  Guest = 5,
}

export type RoleType = 'owner' | 'administrator' | 'viewer';

/**
 * Wallet info from the wallets() mapping
 */
export interface WalletInfo {
  userIdHash: string;
  isWalletActive: boolean;
}

/**
 * Combined member info (wallet + identity status)
 */
export interface MemberInfo {
  userIdHash: string;
  isWalletActive: boolean;
  status: MemberStatus;
}

/**
 * Role details - simplified in new contract (no timestamps/grantedBy on-chain)
 */
export interface RoleDetails {
  role: RoleType | '';
  isActive: boolean;
}

export interface RecordRoleStats {
  ownerCount: number;
  adminCount: number;
  viewerCount: number;
}

export interface TransactionResult {
  txHash: string;
  blockNumber: number;
}

export type TrusteeLevel = 0 | 1 | 2; //Observer = 0, Custodian = 1, Controller = 2
export type TrusteeLevelName = 'Observer' | 'Custodian' | 'Controller';
export type TrusteeStatusName = 'None' | 'Pending' | 'Active' | 'Revoked';

export interface TrusteeRelationship {
  status: TrusteeStatusName;
  level: TrusteeLevelName;
}

export interface GuestAccessInfo {
  grantedAt: Date;
  expiresAt: Date;
  grantedByIdHash: string;
  guestEmailHash: string;
  isExpired: boolean;
}

// ============================================================================
// SERVICE
// ============================================================================

export class BlockchainRoleManagerService {
  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Get a read-only contract instance (no wallet needed)
   */
  private static getReadOnlyContract(): Contract {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    return new ethers.Contract(MEMBER_ROLE_MANAGER_ADDRESS, MEMBER_ROLE_MANAGER_ABI, provider);
  }

  /**
   * Encode function call data for a write transaction
   */
  private static encodeFunctionData(functionName: string, args: unknown[]): `0x${string}` {
    const iface = new ethers.Interface(MEMBER_ROLE_MANAGER_ABI);
    return iface.encodeFunctionData(functionName, args) as `0x${string}`;
  }

  /**
   * Execute a write transaction via PaymasterService
   */
  private static async executeWrite(
    functionName: string,
    args: unknown[]
  ): Promise<TransactionResult> {
    const data = this.encodeFunctionData(functionName, args);

    const txHash = await PaymasterService.sendTransaction({
      to: MEMBER_ROLE_MANAGER_ADDRESS as `0x${string}`,
      data,
    });

    return { txHash, blockNumber: 0 };
  }

  // ==========================================================================
  // MEMBER REGISTRY - VIEW FUNCTIONS (Read-only, no gas)
  // ==========================================================================

  /**
   * Get raw wallet info from the wallets() mapping
   */
  static async getWalletInfo(walletAddress: string): Promise<WalletInfo | null> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('wallets');
      const result = await fn(walletAddress);

      // If userIdHash is zero, wallet isn't registered
      if (result[0] === ethers.ZeroHash) {
        return null;
      }

      return {
        userIdHash: result[0],
        isWalletActive: result[1],
      };
    } catch (error) {
      console.error('Error getting wallet info:', error);
      return null;
    }
  }

  /**
   * Check if an address is an active member
   * (wallet is active AND identity status is Active or Verified)
   */
  static async isActiveMember(walletAddress: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('isActiveMember');
      return await fn(walletAddress);
    } catch (error) {
      console.error('Error checking active member status:', error);
      return false;
    }
  }

  /**
   * Check if an address is a verified member
   */
  static async isVerifiedMember(walletAddress: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('isVerifiedMember');
      return await fn(walletAddress);
    } catch (error) {
      console.error('Error checking verified member status:', error);
      return false;
    }
  }

  /**
   * Get the identity (userIdHash) for a wallet address
   * Returns null/zero hash if wallet not registered
   */
  static async getUserForWallet(walletAddress: string): Promise<string | null> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getUserForWallet');
      const userIdHash = await fn(walletAddress);

      if (userIdHash === ethers.ZeroHash) {
        return null;
      }

      return userIdHash;
    } catch (error) {
      console.error('Error getting user for wallet:', error);
      return null;
    }
  }

  /**
   * Get all wallet addresses linked to an identity
   */
  static async getWalletsForUser(userIdHash: string): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getWalletsForUser');
      return await fn(userIdHash);
    } catch (error) {
      console.error('Error getting wallets for user:', error);
      return [];
    }
  }

  /**
   * Get the status of an identity (by userIdHash)
   */
  static async getUserStatus(userIdHash: string): Promise<MemberStatus> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getUserStatus');
      const status = await fn(userIdHash);
      return Number(status) as MemberStatus;
    } catch (error) {
      console.error('Error getting user status:', error);
      return MemberStatus.NotRegistered;
    }
  }

  /**
   * Get combined member info for a wallet (convenience method)
   * Returns null if wallet isn't registered
   */
  static async getMemberInfo(walletAddress: string): Promise<MemberInfo | null> {
    try {
      const walletInfo = await this.getWalletInfo(walletAddress);
      if (!walletInfo) return null;

      const status = await this.getUserStatus(walletInfo.userIdHash);

      return {
        userIdHash: walletInfo.userIdHash,
        isWalletActive: walletInfo.isWalletActive,
        status,
      };
    } catch (error) {
      console.error('Error getting member info:', error);
      return null;
    }
  }

  /**
   * Get all registered user identity hashes
   */
  static async getAllUsers(): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getAllUsers');
      return await fn();
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  /**
   * Get total number of registered identities
   */
  static async getTotalUsers(): Promise<number> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getTotalUsers');
      const total = await fn();
      return Number(total);
    } catch (error) {
      console.error('Error getting total users:', error);
      return 0;
    }
  }

  // ==========================================================================
  // ROLE MANAGEMENT - VIEW FUNCTIONS (Read-only, no gas)
  // ==========================================================================

  /**
   * Check if wallet's identity has any active role on a record
   */
  static async hasActiveRole(recordId: string, walletAddress: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('hasActiveRole');
      return await fn(recordId, walletAddress);
    } catch (error) {
      console.error('Error checking active role:', error);
      return false;
    }
  }

  /**
   * Check if wallet's identity has a specific role on a record
   */
  static async hasRole(recordId: string, walletAddress: string, role: RoleType): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('hasRole');
      return await fn(recordId, walletAddress, role);
    } catch (error) {
      console.error('Error checking role:', error);
      return false;
    }
  }

  /**
   * Check if wallet's identity is owner or administrator of a record
   */
  static async isOwnerOrAdmin(recordId: string, walletAddress: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('isOwnerOrAdmin');
      return await fn(recordId, walletAddress);
    } catch (error) {
      console.error('Error checking owner/admin status:', error);
      return false;
    }
  }

  /**
   * Get role details for a wallet on a record
   */
  static async getRoleDetails(recordId: string, walletAddress: string): Promise<RoleDetails> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRoleDetails');
      const result = await fn(recordId, walletAddress);

      return {
        role: (result[0] as RoleType) || '',
        isActive: result[1],
      };
    } catch (error) {
      console.error('Error getting role details:', error);
      return { role: '', isActive: false };
    }
  }

  /**
   * Get role details by identity hash (instead of wallet)
   */
  static async getRoleDetailsByUser(recordId: string, userIdHash: string): Promise<RoleDetails> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRoleDetailsByUser');
      const result = await fn(recordId, userIdHash);

      return {
        role: (result[0] as RoleType) || '',
        isActive: result[1],
      };
    } catch (error) {
      console.error('Error getting role details by user:', error);
      return { role: '', isActive: false };
    }
  }

  /**
   * Get all owner identity hashes for a record
   * Note: Returns userIdHashes, not wallet addresses
   */
  static async getRecordOwners(recordId: string): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRecordOwners');
      return await fn(recordId);
    } catch (error) {
      console.error('Error getting record owners:', error);
      return [];
    }
  }

  /**
   * Get all administrator identity hashes for a record
   * Note: Returns userIdHashes, not wallet addresses
   */
  static async getRecordAdmins(recordId: string): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRecordAdmins');
      return await fn(recordId);
    } catch (error) {
      console.error('Error getting record admins:', error);
      return [];
    }
  }

  /**
   * Get all viewer identity hashes for a record
   * Note: Returns userIdHashes, not wallet addresses
   */
  static async getRecordViewers(recordId: string): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRecordViewers');
      return await fn(recordId);
    } catch (error) {
      console.error('Error getting record viewers:', error);
      return [];
    }
  }

  /**
   * Get all records where an identity has any role
   * Note: Takes userIdHash, not wallet address
   */
  static async getRecordsByUser(userIdHash: string): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRecordsByUser');
      return await fn(userIdHash);
    } catch (error) {
      console.error('Error getting records by user:', error);
      return [];
    }
  }

  /**
   * Get role statistics for a record (owner/admin/viewer counts)
   */
  static async getRecordRoleStats(recordId: string): Promise<RecordRoleStats> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRecordRoleStats');
      const result = await fn(recordId);

      return {
        ownerCount: Number(result[0]),
        adminCount: Number(result[1]),
        viewerCount: Number(result[2]),
      };
    } catch (error) {
      console.error('Error getting record role stats:', error);
      return { ownerCount: 0, adminCount: 0, viewerCount: 0 };
    }
  }

  /**
   * Get total number of roles across all records
   */
  static async getTotalRoles(): Promise<number> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getTotalRoles');
      const total = await fn();
      return Number(total);
    } catch (error) {
      console.error('Error getting total roles:', error);
      return 0;
    }
  }

  // ==========================================================================
  // ROLE MANAGEMENT - WRITE FUNCTIONS (Via PaymasterService)
  // ==========================================================================

  /**
   * Grant a role to a user for a specific record
   *
   * Requirements (enforced by smart contract):
   * - Caller must be an active member
   * - Caller must have an active role on the record
   * - To grant 'owner': caller must be owner (or admin if no owner exists)
   * - To grant 'administrator' or 'viewer': caller must be owner or admin
   * - Target identity must not already have a role (use changeRole instead)
   */
  static async grantRole(
    recordId: string,
    targetWalletAddress: string,
    role: RoleType
  ): Promise<TransactionResult> {
    console.log('🔗 Granting role on blockchain...', { recordId, targetWalletAddress, role });
    const result = await this.executeWrite('grantRole', [recordId, targetWalletAddress, role]);
    console.log('✅ Role granted:', result.txHash);
    return result;
  }

  /**
   * Change a user's existing role to a different role
   *
   * Requirements (enforced by smart contract):
   * - Caller must be an active member
   * - Target identity must have an active role
   * - Owners cannot be demoted (must use voluntarilyLeaveOwnership)
   * - To promote to 'owner': caller must be owner (or admin if no owner exists)
   * - To promote to 'administrator': caller must be owner or admin
   * - To demote to 'viewer': caller must be owner, or admin demoting themselves
   */
  static async changeRole(
    recordId: string,
    targetWalletAddress: string,
    newRole: RoleType
  ): Promise<TransactionResult> {
    console.log('🔗 Changing role on blockchain...', { recordId, targetWalletAddress, newRole });
    const result = await this.executeWrite('changeRole', [recordId, targetWalletAddress, newRole]);
    console.log('✅ Role changed:', result.txHash);
    return result;
  }

  /**
   * Revoke a user's role entirely
   *
   * Requirements (enforced by smart contract):
   * - Target identity must have an active role
   * - Owners cannot be revoked (must use voluntarilyLeaveOwnership)
   * - Self-revoke is always allowed (for non-owners)
   * - To revoke others: caller must be owner or admin
   * - Admins can only revoke other admins if no owner exists
   * - Cannot revoke last administrator if no owner exists
   */
  static async revokeRole(
    recordId: string,
    targetWalletAddress: string
  ): Promise<TransactionResult> {
    console.log('🔗 Revoking role on blockchain...', { recordId, targetWalletAddress });
    const result = await this.executeWrite('revokeRole', [recordId, targetWalletAddress]);
    console.log('✅ Role revoked:', result.txHash);
    return result;
  }

  /**
   * Owner voluntarily removes their own ownership
   *
   * Requirements (enforced by smart contract):
   * - Caller must be an owner of the record
   * - Cannot leave if you're the last owner AND there are no admins
   */
  static async voluntarilyLeaveOwnership(recordId: string): Promise<TransactionResult> {
    console.log('🔗 Leaving ownership on blockchain...', { recordId });
    const result = await this.executeWrite('voluntarilyLeaveOwnership', [recordId]);
    console.log('✅ Ownership left:', result.txHash);
    return result;
  }

  // ==========================================================================
  // BATCH ROLE MANAGEMENT - WRITE FUNCTIONS
  // ==========================================================================

  static async grantRoleBatch(
    recordIds: string[],
    targetWalletAddress: string,
    roles: RoleType[]
  ): Promise<TransactionResult> {
    console.log('🔗 Batch granting roles on blockchain...', {
      recordIds,
      targetWalletAddress,
      roles,
    });
    const result = await this.executeWrite('grantRoleBatch', [
      recordIds,
      targetWalletAddress,
      roles,
    ]);
    console.log('✅ Batch roles granted:', result.txHash);
    return result;
  }

  static async changeRoleBatch(
    recordIds: string[],
    targetWalletAddress: string,
    newRoles: RoleType[]
  ): Promise<TransactionResult> {
    console.log('🔗 Batch changing roles on blockchain...', {
      recordIds,
      targetWalletAddress,
      newRoles,
    });
    const result = await this.executeWrite('changeRoleBatch', [
      recordIds,
      targetWalletAddress,
      newRoles,
    ]);
    console.log('✅ Batch roles changed:', result.txHash);
    return result;
  }

  static async revokeRoleBatch(
    recordIds: string[],
    targetWalletAddress: string
  ): Promise<TransactionResult> {
    console.log('🔗 Batch revoking roles on blockchain...', { recordIds, targetWalletAddress });
    const result = await this.executeWrite('revokeRoleBatch', [recordIds, targetWalletAddress]);
    console.log('✅ Batch roles revoked:', result.txHash);
    return result;
  }

  static async grantRoleAsTrusteeBatch(
    recordIds: string[],
    trustorIdHash: string
  ): Promise<TransactionResult> {
    console.log('🔗 Granting trustee batch roles on blockchain...', { recordIds, trustorIdHash });
    const result = await this.executeWrite('grantRoleAsTrusteeBatch', [recordIds, trustorIdHash]);
    console.log('✅ Trustee batch roles granted:', result.txHash);
    return result;
  }

  // ==========================================================================
  // TRUSTEE RELATIONSHIPS - WRITE FUNCTIONS
  // ==========================================================================

  /**
   * Trustor proposes a trustee relationship (Step 1)
   * Called by the TRUSTOR — msg.sender must be an active member
   * @param trusteeIdHash Identity hash of the proposed trustee
   * @param level 0=Observer, 1=Custodian, 2=Controller
   */
  static async proposeTrustee(
    trusteeIdHash: string,
    level: TrusteeLevel
  ): Promise<TransactionResult> {
    console.log('🔗 Proposing trustee on blockchain...', { trusteeIdHash, level });
    const result = await this.executeWrite('proposeTrustee', [trusteeIdHash, level]);
    console.log('✅ Trustee proposed:', result.txHash);
    return result;
  }

  /**
   * Trustee accepts a pending proposal (Step 2)
   * Called by the TRUSTEE — msg.sender must be an active member
   */
  static async acceptTrustee(trustorIdHash: string): Promise<TransactionResult> {
    console.log('🔗 Accepting trustee proposal on blockchain...', { trustorIdHash });
    const result = await this.executeWrite('acceptTrustee', [trustorIdHash]);
    console.log('✅ Trustee accepted:', result.txHash);
    return result;
  }

  /**
   * Revoke a trustee relationship — callable by either party
   */
  static async revokeTrustee(
    trustorIdHash: string,
    trusteeIdHash: string
  ): Promise<TransactionResult> {
    console.log('🔗 Revoking trustee on blockchain...', { trustorIdHash, trusteeIdHash });
    const result = await this.executeWrite('revokeTrustee', [trustorIdHash, trusteeIdHash]);
    console.log('✅ Trustee revoked:', result.txHash);
    return result;
  }

  /**
   * Upgrade a trustee relationship, only callable by Trustor
   */
  static async updateTrusteeLevel(
    trusteeIdHash: string,
    newLevel: TrusteeLevel
  ): Promise<TransactionResult> {
    console.log('🔗 Updating trustee level on blockchain...', { trusteeIdHash, newLevel });
    const result = await this.executeWrite('updateTrusteeLevel', [trusteeIdHash, newLevel]);
    console.log('✅ Trustee level updated:', result.txHash);
    return result;
  }

  // ==========================================================================
  // TRUSTEE RELATIONSHIPS - VIEW FUNCTIONS
  // ==========================================================================

  static async isControllerOf(trustorIdHash: string, trusteeIdHash: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('isControllerOf');
      return await fn(trustorIdHash, trusteeIdHash);
    } catch (error) {
      console.error('Error checking controller status:', error);
      return false;
    }
  }

  static async getTrusteeRelationship(
    trustorIdHash: string,
    trusteeIdHash: string
  ): Promise<TrusteeRelationship> {
    try {
      const statusMap: Record<number, TrusteeStatusName> = {
        0: 'None',
        1: 'Pending',
        2: 'Active',
        3: 'Revoked',
      };
      const levelMap: Record<number, TrusteeLevelName> = {
        0: 'Observer',
        1: 'Custodian',
        2: 'Controller',
      };
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getTrusteeRelationship');
      const result = await fn(trustorIdHash, trusteeIdHash);
      return {
        status: statusMap[Number(result[0])] ?? 'None',
        level: levelMap[Number(result[1])] ?? 'Observer',
      };
    } catch (error) {
      console.error('Error getting trustee relationship:', error);
      return { status: 'None', level: 'Observer' };
    }
  }

  // ==========================================================================
  // GUEST ACCESS - WRITE FUNCTIONS
  // ==========================================================================

  /**
   * Grant a guest temporary viewer access to one or more records.
   * @param recordIds One or more record IDs
   * @param guestWallet Deterministic placeholder address derived from guest UID
   * @param guestIdHash keccak256 of guest Firebase UID
   * @param guestEmailHash keccak256 of guest email (lowercased)
   * @param durationSeconds How long access lasts (default 7 days = 604800)
   */
  static async grantGuestAccess(
    recordIds: string[],
    guestWallet: string,
    guestIdHash: string,
    guestEmailHash: string,
    durationSeconds: number = 604800
  ): Promise<TransactionResult> {
    console.log('🔗 Granting guest access on blockchain...', { recordIds, guestWallet });
    const result = await this.executeWrite('grantGuestAccess', [
      recordIds,
      guestWallet,
      guestIdHash,
      guestEmailHash,
      durationSeconds,
    ]);
    console.log('✅ Guest access granted:', result.txHash);
    return result;
  }

  /**
   * Revoke a guest's access to one or more records.
   * Can be called by the granter or any owner/admin of the record.
   */
  static async revokeGuestAccess(
    recordIds: string[],
    guestIdHash: string
  ): Promise<TransactionResult> {
    console.log('🔗 Revoking guest access on blockchain...', { recordIds, guestIdHash });
    const result = await this.executeWrite('revokeGuestAccess', [recordIds, guestIdHash]);
    console.log('✅ Guest access revoked:', result.txHash);
    return result;
  }

  // ==========================================================================
  // GUEST ACCESS - VIEW FUNCTIONS
  // ==========================================================================

  /**
   * Check if a guest has active non-expired access to a record
   */
  static async hasActiveGuestAccess(recordId: string, guestIdHash: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('hasActiveGuestAccess');
      return await fn(recordId, guestIdHash);
    } catch (error) {
      console.error('Error checking guest access:', error);
      return false;
    }
  }

  /**
   * Get full guest access details for a record
   */
  static async getGuestAccess(
    recordId: string,
    guestIdHash: string
  ): Promise<GuestAccessInfo | null> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getGuestAccess');
      const result = await fn(recordId, guestIdHash);

      const grantedAt = new Date(Number(result[0]) * 1000);
      const expiresAt = new Date(Number(result[1]) * 1000);

      // grantedAt of 0 means no access was ever granted
      if (Number(result[0]) === 0) return null;

      return {
        grantedAt,
        expiresAt,
        grantedByIdHash: result[2],
        guestEmailHash: result[3],
        isExpired: new Date() > expiresAt,
      };
    } catch (error) {
      console.error('Error getting guest access:', error);
      return null;
    }
  }

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================

  /**
   * Get the contract address (useful for debugging/display)
   */
  static getContractAddress(): string {
    return MEMBER_ROLE_MANAGER_ADDRESS;
  }
}
