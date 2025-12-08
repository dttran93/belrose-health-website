// src/features/Permissions/services/blockchainRoleManagerService.ts
//
// Frontend service for blockchain role management.
// Uses WalletService for signing (supports both MetaMask and generated wallets).
//
// Read operations: No wallet needed (uses public RPC)
// Write operations: Uses user's wallet via WalletService

import { ethers, Contract } from 'ethers';
import { WalletService } from '@/features/BlockchainWallet/services/walletService';

// Contract address
const MEMBER_ROLE_MANAGER_ADDRESS = '0xD671B0cB1cB10330d9Ed05dC1D1F6E63802Cf4A9';

// RPC for read-only operations
const RPC_URL = 'https://1rpc.io/sepolia';

// ABI - only the functions we need
const MEMBER_ROLE_MANAGER_ABI = [
  // ==================== VIEW FUNCTIONS (no gas needed) ====================
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'isActiveMember',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'isVerifiedMember',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getMember',
    outputs: [
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
      { internalType: 'uint8', name: 'status', type: 'uint8' },
      { internalType: 'uint256', name: 'joinedAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalMembers',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'hasActiveRole',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'user', type: 'address' },
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
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'isOwnerOrAdmin',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordOwners',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordAdmins',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getRecordsByUser',
    outputs: [{ internalType: 'string[]', name: '', type: 'string[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  // ==================== WRITE FUNCTIONS (require user signature) ====================
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'user', type: 'address' },
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
      { internalType: 'address', name: 'user', type: 'address' },
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
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'revokeRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'voluntarilyRemoveOwnOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

// ==================== TYPES ====================

export enum MemberStatus {
  Inactive = 0,
  Active = 1,
  Verified = 2,
}

export interface MemberInfo {
  userIdHash: string;
  status: MemberStatus;
  joinedAt: Date | null;
}

export interface TransactionResult {
  txHash: string;
  blockNumber: number;
}

// ==================== SERVICE ====================

export class BlockchainRoleManagerService {
  /**
   * Get a read-only contract instance (no wallet needed)
   */
  private static getReadOnlyContract(): Contract {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    return new ethers.Contract(MEMBER_ROLE_MANAGER_ADDRESS, MEMBER_ROLE_MANAGER_ABI, provider);
  }

  /**
   * Get contract instance with user's signer
   * Works for both MetaMask and generated wallets
   */
  private static async getSignerContract(): Promise<{
    contract: Contract;
    walletOrigin: string;
  }> {
    const { signer, origin } = await WalletService.getSigner();
    const contract = new ethers.Contract(
      MEMBER_ROLE_MANAGER_ADDRESS,
      MEMBER_ROLE_MANAGER_ABI,
      signer
    );
    return { contract, walletOrigin: origin };
  }

  // ============================================================================
  // MEMBER VIEW FUNCTIONS (Read-only, no gas)
  // ============================================================================

  /**
   * Check if an address is an active member
   */
  static async isActiveMember(userAddress: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('isActiveMember');
      return await fn(userAddress);
    } catch (error) {
      console.error('Error checking active member status:', error);
      return false;
    }
  }

  /**
   * Check if an address is a verified member
   */
  static async isVerifiedMember(userAddress: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('isVerifiedMember');
      return await fn(userAddress);
    } catch (error) {
      console.error('Error checking verified member status:', error);
      return false;
    }
  }

  /**
   * Get member details
   */
  static async getMember(userAddress: string): Promise<MemberInfo | null> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getMember');
      const result = await fn(userAddress);

      // If joinedAt is 0, member doesn't exist
      if (Number(result[2]) === 0) {
        return null;
      }

      return {
        userIdHash: result[0],
        status: Number(result[1]) as MemberStatus,
        joinedAt: new Date(Number(result[2]) * 1000),
      };
    } catch (error) {
      console.error('Error getting member:', error);
      return null;
    }
  }

  /**
   * Get total number of members
   */
  static async getTotalMembers(): Promise<number> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('totalMembers');
      const total = await fn();
      return Number(total);
    } catch (error) {
      console.error('Error getting total members:', error);
      return 0;
    }
  }

  // ============================================================================
  // ROLE VIEW FUNCTIONS (Read-only, no gas)
  // ============================================================================

  /**
   * Check if user has any active role on a record
   */
  static async hasActiveRole(recordId: string, userAddress: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('hasActiveRole');
      return await fn(recordId, userAddress);
    } catch (error) {
      console.error('Error checking active role:', error);
      return false;
    }
  }

  /**
   * Check if user has a specific role on a record
   */
  static async hasRole(
    recordId: string,
    userAddress: string,
    role: 'owner' | 'administrator' | 'viewer'
  ): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('hasRole');
      return await fn(recordId, userAddress, role);
    } catch (error) {
      console.error('Error checking role:', error);
      return false;
    }
  }

  /**
   * Check if user is owner or admin of a record
   */
  static async isOwnerOrAdmin(recordId: string, userAddress: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('isOwnerOrAdmin');
      return await fn(recordId, userAddress);
    } catch (error) {
      console.error('Error checking owner/admin status:', error);
      return false;
    }
  }

  /**
   * Get all owners of a record
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
   * Get all admins of a record
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
   * Get all records a user has roles on
   */
  static async getRecordsByUser(userAddress: string): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRecordsByUser');
      return await fn(userAddress);
    } catch (error) {
      console.error('Error getting records by user:', error);
      return [];
    }
  }

  // ============================================================================
  // ROLE WRITE FUNCTIONS (Require user signature)
  // ============================================================================

  /**
   * Grant a role to another user (must be owner/admin)
   */
  static async grantRole(
    recordId: string,
    userAddress: string,
    role: 'owner' | 'administrator' | 'viewer'
  ): Promise<TransactionResult> {
    console.log('🔗 Granting role on blockchain...', { recordId, userAddress, role });

    const { contract, walletOrigin } = await this.getSignerContract();
    console.log(`📝 Signing with ${walletOrigin} wallet...`);

    const fn = contract.getFunction('grantRole');
    const tx = await fn(recordId, userAddress, role);
    console.log('📤 Transaction sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('✅ Role granted, block:', receipt?.blockNumber);

    return {
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber || 0,
    };
  }

  /**
   * Change a user's role (must be owner/admin)
   */
  static async changeRole(
    recordId: string,
    userAddress: string,
    newRole: 'owner' | 'administrator' | 'viewer'
  ): Promise<TransactionResult> {
    console.log('🔗 Changing role on blockchain...', { recordId, userAddress, newRole });

    const { contract, walletOrigin } = await this.getSignerContract();
    console.log(`📝 Signing with ${walletOrigin} wallet...`);

    const fn = contract.getFunction('changeRole');
    const tx = await fn(recordId, userAddress, newRole);
    console.log('📤 Transaction sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('✅ Role changed, block:', receipt?.blockNumber);

    return {
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber || 0,
    };
  }

  /**
   * Revoke a user's role (must be owner/admin, or self-revoke)
   */
  static async revokeRole(recordId: string, userAddress: string): Promise<TransactionResult> {
    console.log('🔗 Revoking role on blockchain...', { recordId, userAddress });

    const { contract, walletOrigin } = await this.getSignerContract();
    console.log(`📝 Signing with ${walletOrigin} wallet...`);

    const fn = contract.getFunction('revokeRole');
    const tx = await fn(recordId, userAddress);
    console.log('📤 Transaction sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('✅ Role revoked, block:', receipt?.blockNumber);

    return {
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber || 0,
    };
  }

  /**
   * Owner voluntarily removes their own ownership
   */
  static async voluntarilyRemoveOwnOwnership(recordId: string): Promise<TransactionResult> {
    console.log('🔗 Removing own ownership on blockchain...', { recordId });

    const { contract, walletOrigin } = await this.getSignerContract();
    console.log(`📝 Signing with ${walletOrigin} wallet...`);

    const fn = contract.getFunction('voluntarilyRemoveOwnOwnership');
    const tx = await fn(recordId);
    console.log('📤 Transaction sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('✅ Ownership removed, block:', receipt?.blockNumber);

    return {
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber || 0,
    };
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Check if user can sign transactions
   */
  static async canSign(): Promise<{ canSign: boolean; reason?: string }> {
    return WalletService.canSign();
  }
}
