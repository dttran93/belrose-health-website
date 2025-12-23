// src/features/Sharing/services/sharingBlockchainService.ts

/**
 * SharingBlockchainService - Handles blockchain operations for sharing health records
 *
 * - Encoding contract calls for grant/revoke access
 * - Reading access status from the blockchain
 *
 */

import { encodeFunctionData, createPublicClient, http, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { ethers } from 'ethers';
import { WalletService } from '@/features/BlockchainWallet/services/walletService';
import { PaymasterService } from '@/features/BlockchainWallet/services/paymasterService';

// ==================== CONFIG ====================

// HealthRecordCore contract address (for sharing permissions)
const HEALTH_RECORD_CONTRACT = '0xA9f388D92032E5e84E1264e72129A30d57cBfE66' as Hex;

// Chain config
const CHAIN = sepolia;

// ==================== CONTRACT ABI ====================

const CONTRACT_ABI = [
  {
    inputs: [
      { name: 'permissionHash', type: 'string' },
      { name: 'recordId', type: 'string' },
      { name: 'receiver', type: 'address' },
    ],
    name: 'grantAccess',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'permissionHash', type: 'string' }],
    name: 'revokeAccess',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'permissionHash', type: 'string' }],
    name: 'checkAccess',
    outputs: [
      { name: 'isActive', type: 'bool' },
      { name: 'sharer', type: 'address' },
      { name: 'receiver', type: 'address' },
      { name: 'recordId', type: 'string' },
      { name: 'grantedAt', type: 'uint256' },
      { name: 'revokedAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ==================== TYPES ====================

export interface AccessStatus {
  isActive: boolean;
  sharer: string;
  receiver: string;
  recordId: string;
  grantedAt: number;
  revokedAt: number;
}

// ==================== SERVICE ====================

export class SharingBlockchainService {
  /**
   * Grant access to a health record on the blockchain
   *
   * Attempts sponsored (gasless) transaction first, falls back to direct if unavailable.
   *
   * @param permissionHash - Unique hash identifying this permission
   * @param recordId - The health record being shared
   * @param receiverWalletAddress - Wallet address of the recipient
   * @returns Transaction hash
   */
  static async grantAccessOnChain(
    permissionHash: string,
    recordId: string,
    receiverWalletAddress: string
  ): Promise<string> {
    console.log('🔗 SharingBlockchainService: Granting access...');

    // Encode the contract call
    const callData = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: 'grantAccess',
      args: [permissionHash, recordId, receiverWalletAddress as Hex],
    });

    // Try sponsored transaction first
    return this.sendTransaction(callData, 'grantAccess', () =>
      this.grantAccessDirect(permissionHash, recordId, receiverWalletAddress)
    );
  }

  /**
   * Revoke access to a health record on the blockchain
   *
   * @param permissionHash - The permission hash to revoke
   * @returns Transaction hash
   */
  static async revokeAccessOnChain(permissionHash: string): Promise<string> {
    console.log('🔗 SharingBlockchainService: Revoking access...');

    // Encode the contract call
    const callData = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: 'revokeAccess',
      args: [permissionHash],
    });

    // Try sponsored transaction first
    return this.sendTransaction(callData, 'revokeAccess', () =>
      this.revokeAccessDirect(permissionHash)
    );
  }

  /**
   * Check access status on blockchain (read-only, no gas needed)
   *
   * @param permissionHash - The permission hash to check
   * @returns Access status details
   */
  static async checkAccessOnChain(permissionHash: string): Promise<AccessStatus> {
    const publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(),
    });

    const result = await publicClient.readContract({
      address: HEALTH_RECORD_CONTRACT,
      abi: CONTRACT_ABI,
      functionName: 'checkAccess',
      args: [permissionHash],
    });

    return {
      isActive: result[0],
      sharer: result[1],
      receiver: result[2],
      recordId: result[3],
      grantedAt: Number(result[4]),
      revokedAt: Number(result[5]),
    };
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Send a transaction, trying sponsored first with fallback to direct
   */
  private static async sendTransaction(
    callData: Hex,
    operationName: string,
    fallbackFn: () => Promise<string>
  ): Promise<string> {
    // Check if we can use sponsored transactions
    const sponsorCheck = await PaymasterService.canUseSponsoredTransactions();

    if (!sponsorCheck.canUse) {
      console.log(`⚠️ Cannot use sponsorship (${sponsorCheck.reason}), using direct transaction`);
      return fallbackFn();
    }

    try {
      // Attempt sponsored transaction
      const txHash = await PaymasterService.sendSponsoredTransaction({
        to: HEALTH_RECORD_CONTRACT,
        data: callData,
      });

      console.log(`✅ Sponsored ${operationName} submitted:`, txHash);
      return txHash;
    } catch (error) {
      console.error(`❌ Sponsored ${operationName} failed:`, error);
      console.log('⚠️ Falling back to direct transaction...');
      return fallbackFn();
    }
  }

  /**
   * Grant access directly (user pays gas) - fallback method
   */
  private static async grantAccessDirect(
    permissionHash: string,
    recordId: string,
    receiverWalletAddress: string
  ): Promise<string> {
    const { signer } = await WalletService.getSigner();

    const contract = new ethers.Contract(HEALTH_RECORD_CONTRACT, CONTRACT_ABI, signer);
    const grantAccess = contract.getFunction('grantAccess');
    const tx = await grantAccess(permissionHash, recordId, receiverWalletAddress);

    console.log('📝 Direct grantAccess sent:', tx.hash);
    await tx.wait();
    console.log('✅ Direct grantAccess confirmed');

    return tx.hash;
  }

  /**
   * Revoke access directly (user pays gas) - fallback method
   */
  private static async revokeAccessDirect(permissionHash: string): Promise<string> {
    const { signer } = await WalletService.getSigner();

    const contract = new ethers.Contract(HEALTH_RECORD_CONTRACT, CONTRACT_ABI, signer);
    const revokeAccess = contract.getFunction('revokeAccess');
    const tx = await revokeAccess(permissionHash);

    console.log('📝 Direct revokeAccess sent:', tx.hash);
    await tx.wait();
    console.log('✅ Direct revokeAccess confirmed');

    return tx.hash;
  }
}
