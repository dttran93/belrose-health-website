// src/features/BlockchainVerification/services/sharingContractService.ts

import { ethers, Contract, ContractTransactionResponse } from 'ethers';

// Your deployed contract address (update after deployment!)
const CONTRACT_ADDRESS = '0xDB920644612CfaEd5240a9665c5Cb9aa12A75c71';

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
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'receiver', type: 'address' },
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'uint256', name: 'grantedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'revokedAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'string', name: 'permissionHash', type: 'string' },
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
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
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
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
    owner: string;
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
      owner: result[1],
      receiver: result[2],
      recordId: result[3],
      grantedAt: Number(result[4]),
      revokedAt: Number(result[5]),
    };
  }
}
