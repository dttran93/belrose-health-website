// src/features/BlockchainVerification/services/sharingContractService.ts

import { ethers, Contract, ContractTransactionResponse } from 'ethers';

// Your deployed contract address
const CONTRACT_ADDRESS = '0xA9f388D92032E5e84E1264e72129A30d57cBfE66';

// Contract ABI (just the sharing functions)
const CONTRACT_ABI = [
  // grantAccess
  {
    inputs: [
      { internalType: 'string', name: 'permissionHash', type: 'string' },
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'receiver', type: 'address' },
    ],
    name: 'grantAccess',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // revokeAccess
  {
    inputs: [{ internalType: 'string', name: 'permissionHash', type: 'string' }],
    name: 'revokeAccess',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // checkAccess
  {
    inputs: [{ internalType: 'string', name: 'permissionHash', type: 'string' }],
    name: 'checkAccess',
    outputs: [
      { internalType: 'bool', name: 'isActive', type: 'bool' },
      { internalType: 'address', name: 'sharer', type: 'address' },
      { internalType: 'address', name: 'receiver', type: 'address' },
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'uint256', name: 'grantedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'revokedAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: '', type: 'string' }],
    name: 'accessPermissions',
    outputs: [
      { internalType: 'string', name: 'permissionHash', type: 'string' },
      { internalType: 'address', name: 'sharer', type: 'address' },
      { internalType: 'address', name: 'receiver', type: 'address' },
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'uint256', name: 'grantedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'revokedAt', type: 'uint256' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
      { internalType: 'bool', name: 'exists', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'permissionHash', type: 'string' },
      { indexed: true, internalType: 'address', name: 'sharer', type: 'address' },
      { indexed: true, internalType: 'address', name: 'receiver', type: 'address' },
      { indexed: false, internalType: 'string', name: 'recordId', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'AccessGranted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'permissionHash', type: 'string' },
      { indexed: true, internalType: 'address', name: 'sharer', type: 'address' },
      { indexed: true, internalType: 'address', name: 'receiver', type: 'address' },
      { indexed: false, internalType: 'string', name: 'recordId', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'AccessRevoked',
    type: 'event',
  },
] as const;

export class SharingContractService {
  /**
   * Get contract instance with signer
   */
  private static async getContract(): Promise<Contract> {
    // Check if MetaMask is available
    if (!window.ethereum) {
      throw new Error('MetaMask not installed');
    }

    // Create provider
    const provider = new ethers.BrowserProvider(window.ethereum);

    // Get signer (current user's wallet)
    const signer = await provider.getSigner();

    // Create contract instance
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  }

  /**
   * Grant access on blockchain
   */
  static async grantAccessOnChain(
    permissionHash: string,
    recordId: string,
    receiverWalletAddress: string
  ): Promise<string> {
    console.log('🔗 Calling smart contract grantAccess()...');

    const contract = await this.getContract();

    // Call the contract function
    const grantAccessFunction = contract.getFunction('grantAccess');
    const tx = (await grantAccessFunction(
      permissionHash,
      recordId,
      receiverWalletAddress
    )) as ContractTransactionResponse;

    console.log('📝 Transaction sent:', tx.hash);
    console.log('⏳ Waiting for confirmation...');

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    console.log('✅ Transaction confirmed in block:', receipt?.blockNumber);

    return tx.hash;
  }

  /**
   * Revoke access on blockchain
   */
  static async revokeAccessOnChain(permissionHash: string): Promise<string> {
    console.log('🔗 Calling smart contract revokeAccess()...');

    const contract = await this.getContract();

    // Call the contract function
    const revokeAccessFunction = contract.getFunction('revokeAccess');
    const tx = (await revokeAccessFunction(permissionHash)) as ContractTransactionResponse;

    console.log('📝 Transaction sent:', tx.hash);
    console.log('⏳ Waiting for confirmation...');

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    console.log('✅ Transaction confirmed in block:', receipt?.blockNumber);

    return tx.hash;
  }

  /**
   * Check access status on blockchain
   */
  static async checkAccessOnChain(permissionHash: string): Promise<{
    isActive: boolean;
    sharer: string;
    receiver: string;
    recordId: string;
    grantedAt: number;
    revokedAt: number;
  }> {
    const contract = await this.getContract();

    const checkAccessFunction = contract.getFunction('checkAccess');
    const result = (await checkAccessFunction(permissionHash)) as [
      boolean,
      string,
      string,
      string,
      bigint,
      bigint
    ];

    return {
      isActive: result[0],
      sharer: result[1],
      receiver: result[2],
      recordId: result[3],
      grantedAt: Number(result[4]),
      revokedAt: Number(result[5]),
    };
  }

  /**
   * Get permission details from blockchain (for testing)
   */
  static async getPermissionDetails(permissionHash: string): Promise<any> {
    console.log('🔍 Getting permission details for:', permissionHash);

    const contract = await this.getContract();

    // Use getFunction to be type-safe
    const accessPermissionsFunction = contract.getFunction('accessPermissions');
    const permission = await accessPermissionsFunction(permissionHash);

    console.log('📋 Permission details:', permission);
    return permission;
  }
}
