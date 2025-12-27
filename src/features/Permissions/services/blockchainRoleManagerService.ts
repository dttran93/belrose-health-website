// src/features/Permissions/services/blockchainRoleManagerService.ts
//
// Frontend service for blockchain role management.
// Uses PaymasterService for all write transactions (handles sponsored vs direct).
//
// Read operations: No wallet needed (uses public RPC)
// Write operations: Routes through PaymasterService
//
// Note: Admin-only functions (addMember, setMemberStatus, initializeRecordRole)
// are handled by Cloud Functions, not this frontend service.

import { ethers, Contract } from 'ethers';
import { PaymasterService } from '@/features/BlockchainWallet/services/paymasterService';

// Contract address
const MEMBER_ROLE_MANAGER_ADDRESS = '0x89839E0c266045c9EA06FdA11152B48129e76Ef2';

// RPC for read-only operations
const RPC_URL = 'https://1rpc.io/sepolia';

// ABI - all functions we need (view + write)
const MEMBER_ROLE_MANAGER_ABI = [
  // ============================================================================
  // MEMBER REGISTRY - VIEW FUNCTIONS
  // ============================================================================
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
    inputs: [{ internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' }],
    name: 'getWalletByUserIdHash',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAllMembers',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
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

  // ============================================================================
  // ROLE MANAGEMENT - VIEW FUNCTIONS
  // ============================================================================
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
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'user', type: 'address' },
    ],
    name: 'getRoleDetails',
    outputs: [
      { internalType: 'string', name: 'role', type: 'string' },
      { internalType: 'uint256', name: 'grantedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'lastModified', type: 'uint256' },
      { internalType: 'address', name: 'grantedBy', type: 'address' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
    ],
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
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordViewers',
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

// ============================================================================
// TYPES
// ============================================================================

export enum MemberStatus {
  Inactive = 0,
  Active = 1,
  Verified = 2,
}

export type RoleType = 'owner' | 'administrator' | 'viewer';

export interface MemberInfo {
  userIdHash: string;
  status: MemberStatus;
  joinedAt: Date | null;
}

export interface RoleDetails {
  role: RoleType | '';
  grantedAt: Date | null;
  lastModified: Date | null;
  grantedBy: string;
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
  private static encodeFunctionData(functionName: string, args: any[]): `0x${string}` {
    const iface = new ethers.Interface(MEMBER_ROLE_MANAGER_ABI);
    return iface.encodeFunctionData(functionName, args) as `0x${string}`;
  }

  /**
   * Execute a write transaction via PaymasterService
   */
  private static async executeWrite(functionName: string, args: any[]): Promise<TransactionResult> {
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
   * Check if an address is an active member (not inactive and is registered)
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
   * Get member details by wallet address
   * Returns null if member doesn't exist
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
   * Lookup wallet address by user ID hash
   * Returns zero address if not found
   */
  static async getWalletByUserIdHash(userIdHash: string): Promise<string> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getWalletByUserIdHash');
      return await fn(userIdHash);
    } catch (error) {
      console.error('Error getting wallet by user ID hash:', error);
      return ethers.ZeroAddress;
    }
  }

  /**
   * Get all registered member addresses
   * Useful for admin dashboards and migrations
   */
  static async getAllMembers(): Promise<string[]> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getAllMembers');
      return await fn();
    } catch (error) {
      console.error('Error getting all members:', error);
      return [];
    }
  }

  /**
   * Get total number of registered members
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

  // ==========================================================================
  // ROLE MANAGEMENT - VIEW FUNCTIONS (Read-only, no gas)
  // ==========================================================================

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
  static async hasRole(recordId: string, userAddress: string, role: RoleType): Promise<boolean> {
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
   * Check if user is owner or administrator of a record
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
   * Get full role details for a user on a record
   */
  static async getRoleDetails(recordId: string, userAddress: string): Promise<RoleDetails> {
    try {
      const contract = this.getReadOnlyContract();
      const fn = contract.getFunction('getRoleDetails');
      const result = await fn(recordId, userAddress);

      return {
        role: (result[0] as RoleType) || '',
        grantedAt: Number(result[1]) > 0 ? new Date(Number(result[1]) * 1000) : null,
        lastModified: Number(result[2]) > 0 ? new Date(Number(result[2]) * 1000) : null,
        grantedBy: result[3],
        isActive: result[4],
      };
    } catch (error) {
      console.error('Error getting role details:', error);
      return {
        role: '',
        grantedAt: null,
        lastModified: null,
        grantedBy: ethers.ZeroAddress,
        isActive: false,
      };
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
   * Get all administrators of a record
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
   * Get all viewers of a record
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
   * Get all records where a user has any role
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
   * - Target user must not already have a role (use changeRole instead)
   */
  static async grantRole(
    recordId: string,
    userAddress: string,
    role: RoleType
  ): Promise<TransactionResult> {
    console.log('🔗 Granting role on blockchain...', { recordId, userAddress, role });
    const result = await this.executeWrite('grantRole', [recordId, userAddress, role]);
    console.log('✅ Role granted:', result.txHash);
    return result;
  }

  /**
   * Change a user's existing role to a different role
   *
   * Requirements (enforced by smart contract):
   * - Caller must be an active member
   * - Target user must have an active role
   * - Owners cannot be demoted (must use voluntarilyRemoveOwnOwnership)
   * - To promote to 'owner': caller must be owner (or admin if no owner exists)
   * - To promote to 'administrator': caller must be owner or admin
   * - To demote to 'viewer': caller must be owner, or admin demoting themselves
   */
  static async changeRole(
    recordId: string,
    userAddress: string,
    newRole: RoleType
  ): Promise<TransactionResult> {
    console.log('🔗 Changing role on blockchain...', { recordId, userAddress, newRole });
    const result = await this.executeWrite('changeRole', [recordId, userAddress, newRole]);
    console.log('✅ Role changed:', result.txHash);
    return result;
  }

  /**
   * Revoke a user's role entirely
   *
   * Requirements (enforced by smart contract):
   * - Target user must have an active role
   * - Owners cannot be revoked (must use voluntarilyRemoveOwnOwnership)
   * - Self-revoke is always allowed (for non-owners)
   * - To revoke others: caller must be owner or admin
   * - Admins can only revoke other admins if no owner exists
   * - Cannot revoke last administrator if no owner exists
   */
  static async revokeRole(recordId: string, userAddress: string): Promise<TransactionResult> {
    console.log('🔗 Revoking role on blockchain...', { recordId, userAddress });
    const result = await this.executeWrite('revokeRole', [recordId, userAddress]);
    console.log('✅ Role revoked:', result.txHash);
    return result;
  }

  /**
   * Owner voluntarily removes their own ownership
   *
   * Requirements (enforced by smart contract):
   * - Caller must be an owner of the record
   * - Cannot remove yourself if you're the last owner AND there are no admins
   */
  static async voluntarilyRemoveOwnOwnership(recordId: string): Promise<TransactionResult> {
    console.log('🔗 Removing own ownership on blockchain...', { recordId });
    const result = await this.executeWrite('voluntarilyRemoveOwnOwnership', [recordId]);
    console.log('✅ Ownership removed:', result.txHash);
    return result;
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
