// src/features/Permissions/services/memberRoleManagerService.ts

import { ethers, Contract } from 'ethers';

// Contract addresses - UPDATE THESE after deployment
const MEMBER_ROLE_MANAGER_ADDRESS = '0xD671B0cB1cB10330d9Ed05dC1D1F6E63802Cf4A9';

// ABI - only the functions we need to call from frontend
const MEMBER_ROLE_MANAGER_ABI = [
  // View functions (no gas needed - anyone can call)
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
  // Role view functions
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
  // Write functions (require user's wallet to sign)
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

// Member status enum matching the contract
export enum MemberStatus {
  Inactive = 0,
  Active = 1,
  Verified = 2,
}

export class MemberRoleManagerService {
  /**
   * Get a read-only contract instance (no wallet needed)
   */
  private static getReadOnlyContract(): Contract {
    const provider = new ethers.JsonRpcProvider('https://1rpc.io/sepolia');
    return new ethers.Contract(MEMBER_ROLE_MANAGER_ADDRESS, MEMBER_ROLE_MANAGER_ABI, provider);
  }

  /**
   * Get contract instance with signer (requires MetaMask)
   */
  private static async getSignerContract(): Promise<Contract> {
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(MEMBER_ROLE_MANAGER_ADDRESS, MEMBER_ROLE_MANAGER_ABI, signer);
  }

  // ==================== MEMBER VIEW FUNCTIONS ====================

  /**
   * Check if an address is an active member
   */
  static async isActiveMember(userAddress: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const isActiveFunction = contract.getFunction('isActiveMember');
      return await isActiveFunction(userAddress);
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
      const isVerifiedFunction = contract.getFunction('isVerifiedMember');
      return await isVerifiedFunction(userAddress);
    } catch (error) {
      console.error('Error checking verified member status:', error);
      return false;
    }
  }

  /**
   * Get member details
   */
  static async getMember(userAddress: string): Promise<{
    userIdHash: string;
    status: MemberStatus;
    joinedAt: Date | null;
  } | null> {
    try {
      const contract = this.getReadOnlyContract();
      const isMemberFunction = contract.getFunction('getMember');
      const result = await isMemberFunction(userAddress);

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
      const isGetTotalFunction = contract.getFunction('getTotalMembers');
      const total = await isGetTotalFunction();
      return Number(total);
    } catch (error) {
      console.error('Error getting total members:', error);
      return 0;
    }
  }

  // ==================== ROLE VIEW FUNCTIONS ====================

  /**
   * Check if user has any active role on a record
   */
  static async hasActiveRole(recordId: string, userAddress: string): Promise<boolean> {
    try {
      const contract = this.getReadOnlyContract();
      const isActiveFunction = contract.getFunction('hasActiveRole');
      return await isActiveFunction(recordId, userAddress);
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
      const hasRoleFunction = contract.getFunction('hasRole');
      return await hasRoleFunction(recordId, userAddress, role);
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
      const OwnerOrAdminFunction = contract.getFunction('isOwnerOrAdmin');
      return await OwnerOrAdminFunction(recordId, userAddress);
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
      const getRecordOwnersFunction = contract.getFunction('getRecordOwners');
      return await getRecordOwnersFunction(recordId);
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
      const getRecordAdminsFunction = contract.getFunction('getRecordAdmins');
      return await getRecordAdminsFunction(recordId);
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
      const getRecordsByUserFunction = contract.getFunction('getRecordsByUser');
      return await getRecordsByUserFunction(userAddress);
    } catch (error) {
      console.error('Error getting records by user:', error);
      return [];
    }
  }

  // ==================== ROLE WRITE FUNCTIONS ====================
  // These require the user to sign with their wallet

  /**
   * Grant a role to another user (must be owner/admin)
   */
  static async grantRole(
    recordId: string,
    userAddress: string,
    role: 'owner' | 'administrator' | 'viewer'
  ): Promise<string> {
    console.log('🔗 Calling grantRole on MemberRoleManager...');

    const contract = await this.getSignerContract();
    const grantRoleFunction = contract.getFunction('grantRole');
    const tx = await grantRoleFunction(recordId, userAddress, role);

    console.log('📝 Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Role granted, block:', receipt?.blockNumber);

    return tx.hash;
  }

  /**
   * Change a user's role (must be owner/admin)
   */
  static async changeRole(
    recordId: string,
    userAddress: string,
    newRole: 'owner' | 'administrator' | 'viewer'
  ): Promise<string> {
    console.log('🔗 Calling changeRole on MemberRoleManager...');

    const contract = await this.getSignerContract();
    const changeRoleFunction = contract.getFunction('changeRole');
    const tx = await changeRoleFunction(recordId, userAddress, newRole);

    console.log('📝 Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Role changed, block:', receipt?.blockNumber);

    return tx.hash;
  }

  /**
   * Revoke a user's role (must be owner/admin, or self-revoke)
   */
  static async revokeRole(recordId: string, userAddress: string): Promise<string> {
    console.log('🔗 Calling revokeRole on MemberRoleManager...');

    const contract = await this.getSignerContract();
    const revokeRoleFunction = contract.getFunction('revokeRole');
    const tx = await revokeRoleFunction(recordId, userAddress);

    console.log('📝 Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Role revoked, block:', receipt?.blockNumber);

    return tx.hash;
  }

  /**
   * Owner voluntarily removes their own ownership
   */
  static async voluntarilyRemoveOwnOwnership(recordId: string): Promise<string> {
    console.log('🔗 Calling voluntarilyRemoveOwnOwnership...');

    const contract = await this.getSignerContract();
    const voluntarilyRemoveFunction = contract.getFunction('voluntarilyRemoveOwnOwnership');
    const tx = await voluntarilyRemoveFunction(recordId);

    console.log('📝 Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Ownership removed, block:', receipt?.blockNumber);

    return tx.hash;
  }
}
