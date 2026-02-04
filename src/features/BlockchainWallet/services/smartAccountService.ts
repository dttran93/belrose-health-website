// src/features/BlockchainWallet/services/smartAccountService.ts
/**
 * Service to generate smartAccountAddresses from Wallet addresses
 * Called in blockchainPreprationService
 */

import { createPublicClient, http, type Hex, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { WalletService } from './walletService';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { MemberRegistryBlockchain } from '@/features/Auth/services/memberRegistryBlockchain';

const CHAIN = sepolia;

// ABI for checking if wallet is already registered
const MEMBER_ROLE_MANAGER_ADDRESS = '0xC31477f563dC8f7529Ba6AE7E410ABdB84C27d7C' as const;
const MEMBER_ROLE_MANAGER_ABI = [
  {
    name: 'wallets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [
      { name: 'userIdHash', type: 'bytes32' },
      { name: 'isWalletActive', type: 'bool' },
    ],
  },
] as const;

// ==================== TYPES ====================

interface SmartAccountStatus {
  address: string;
  isComputedLocally: boolean;
  isSavedToFirestore: boolean;
  isRegisteredOnChain: boolean;
}

// ==================== SERVICE ====================

/**
 * SmartAccountService - Manages Smart Account address computation and registration
 *
 * Smart Account = ERC-4337 contract wallet derived deterministically from user's EOA
 * The same private key always produces the same smart account address.
 *
 * This service handles:
 * 1. Computing the smart account address from a private key
 * 2. Storing the address in Firestore
 * 3. Registering the smart account on-chain (linking to user's identity)
 */
export class SmartAccountService {
  private static publicClient = createPublicClient({
    chain: CHAIN,
    transport: http(),
  });

  // ==================== CORE COMPUTATION ====================

  /**
   * Compute smart account address from a private key
   * This is a pure cryptographic operation - no network calls needed
   *
   * @param providedPrivateKey - Optional key (uses WalletService if not provided)
   */
  static async computeAddress(providedPrivateKey?: Hex): Promise<string> {
    let privateKey: Hex;

    if (providedPrivateKey) {
      privateKey = providedPrivateKey.startsWith('0x')
        ? providedPrivateKey
        : (`0x${providedPrivateKey}` as Hex);
    } else {
      const { signer } = await WalletService.getSigner();
      privateKey = (signer as any).privateKey as Hex;
    }

    const viemAccount = privateKeyToAccount(privateKey);
    const simpleAccount = await toSimpleSmartAccount({
      client: this.publicClient,
      owner: viemAccount,
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    return simpleAccount.address;
  }

  // ==================== FIRESTORE CACHE ====================

  /**
   * Get cached smart account address from Firestore
   */
  static async getCachedAddress(): Promise<string | null> {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return null;

    const db = getFirestore();
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    return userDoc.data()?.wallet?.smartAccountAddress || null;
  }

  /**
   * Save smart account address to Firestore
   */
  static async saveAddressToFirestore(address: string): Promise<void> {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const db = getFirestore();
    await updateDoc(doc(db, 'users', user.uid), {
      'wallet.smartAccountAddress': address,
      'wallet.smartAccountComputedAt': new Date().toISOString(),
    });

    console.log('✅ Smart account address saved to Firestore:', address);
  }

  // ==================== BLOCKCHAIN REGISTRATION ====================

  /**
   * Check if a smart account is already registered on-chain
   */
  static async isRegisteredOnChain(address: string): Promise<boolean> {
    try {
      const result = await this.publicClient.readContract({
        address: MEMBER_ROLE_MANAGER_ADDRESS,
        abi: MEMBER_ROLE_MANAGER_ABI,
        functionName: 'wallets',
        args: [address as Address],
      });

      const [userIdHash] = result;
      // If userIdHash is not zero, wallet is registered
      return userIdHash !== '0x0000000000000000000000000000000000000000000000000000000000000000';
    } catch (error) {
      console.error('Error checking on-chain registration:', error);
      return false;
    }
  }

  /**
   * Register smart account on-chain (links to user's identity)
   */
  static async registerOnChain(address: string): Promise<void> {
    console.log('🔗 Registering smart account on blockchain...');

    const result = await MemberRegistryBlockchain.registerMemberWallet(address);

    if (result.success) {
      console.log('✅ Smart account registered on-chain:', result.txHash || 'already registered');
    }
  }

  // ==================== HIGH-LEVEL OPERATIONS ====================

  /**
   * Get smart account address - from cache or compute fresh
   * Does NOT register on-chain (use ensureFullyInitialized for that)
   */
  static async getAddress(): Promise<string> {
    // Try to lookup in storage first
    const smartAccountAddress = await this.getCachedAddress();
    if (smartAccountAddress) return smartAccountAddress;

    // Compute and save to Firestore
    const address = await this.computeAddress();
    await this.saveAddressToFirestore(address);

    return address;
  }

  /**
   * Get full status of the smart account
   */
  static async getStatus(): Promise<SmartAccountStatus> {
    const cached = await this.getCachedAddress();

    if (!cached) {
      // Need to compute
      const address = await this.computeAddress();
      return {
        address,
        isComputedLocally: true,
        isSavedToFirestore: false,
        isRegisteredOnChain: false,
      };
    }

    const isRegistered = await this.isRegisteredOnChain(cached);

    return {
      address: cached,
      isComputedLocally: true,
      isSavedToFirestore: true,
      isRegisteredOnChain: isRegistered,
    };
  }

  /**
   * Ensure smart account is fully initialized:
   * 1. Computed
   * 2. Saved to Firestore
   * 3. Registered on-chain
   *
   * This is the main method to call when you need the smart account ready
   */
  static async ensureFullyInitialized(): Promise<string> {
    console.log('🔄 Ensuring smart account is fully initialized...');

    // Step 1: Get or compute address (also saves to Firestore)
    const address = await this.getAddress();

    // Step 2: Check if on-chain registration needed
    const isRegistered = await this.isRegisteredOnChain(address);

    if (!isRegistered) {
      // Step 3: Register on-chain
      await this.registerOnChain(address);
    } else {
      console.log('ℹ️ Smart account already registered on-chain');
    }

    console.log('✅ Smart account fully initialized:', address);
    return address;
  }
}
