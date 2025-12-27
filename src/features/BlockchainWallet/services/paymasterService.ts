// src/features/BlockchainWallet/services/paymasterService.ts

/**
 * PaymasterService - Handles all blockchain write transactions
 *
 * This service is the main entry point for sending blockchain transactions:
 *
 * This service abstracts away the complexity of:
 * - Creating smart account clients
 * - Requesting gas sponsorship from our backend
 * - Submitting UserOperations through a bundler
 *
 * OR - directs transactions to direct signing where the user pays for gas
 *
 * Any feature needing to write to blockchain should use this service.
 */

import { createPublicClient, http, type Hex, concat, pad, toHex } from 'viem';
import { sepolia } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address, getUserOperationHash } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { WalletService } from './walletService';

// ==================== CONFIG ====================

// Deployed paymaster contract address
const PAYMASTER_ADDRESS = '0x967e757609E1118E7164e51A204772a14804E253';

// Pimlico bundler URL (from dashboard.pimlico.io)
const BUNDLER_URL = import.meta.env.VITE_PIMLICO_BUNDLER_URL;

// Chain configuration
const CHAIN = sepolia;

// ==================== TYPES ====================

interface SponsorshipResponse {
  sponsored: boolean;
  signature?: string;
  reason?: string;
}

export interface SponsorshipCheckResult {
  canUse: boolean;
  reason?: string;
}

export interface TransactionRequest {
  to: Hex;
  data: Hex;
  value?: bigint;
}

// ==================== SERVICE ====================

export class PaymasterService {
  /**
   * Send a transaction - automatically routes to sponsored or direct based on wallet type
   *
   * This is the main entry point for all blockchain write operations.
   * - Generated wallets: Uses paymaster for gasless transactions
   * - MetaMask/external wallets: User pays gas directly
   *
   * @param request - The transaction to send (to, data, value)
   * @returns Transaction hash
   */
  static async sendTransaction(request: TransactionRequest): Promise<string> {
    const wallet = await WalletService.getCurrentUserWallet();

    if (wallet?.origin === 'generated') {
      return this.sendSponsoredTransaction(request);
    } else {
      return this.sendDirectTransaction(request);
    }
  }

  /**
   * Send a direct transaction where user pays gas (MetaMask, etc.)
   */
  private static async sendDirectTransaction(request: TransactionRequest): Promise<string> {
    console.log('🦊 PaymasterService: Sending direct transaction (user pays gas)...');

    const { signer } = await WalletService.getSigner();
    const tx = await signer.sendTransaction({
      to: request.to,
      data: request.data,
      value: request.value ?? 0n,
    });

    const receipt = await tx.wait();
    console.log('✅ PaymasterService: Direct transaction confirmed:', tx.hash);

    return tx.hash;
  }

  /**
   * Check if user can use sponsored (gasless) transactions
   *
   * Requirements:
   * - User must have a generated wallet (not MetaMask)
   * - Bundler must be configured
   * - User must be able to sign
   */
  static async canUseSponsoredTransactions(): Promise<SponsorshipCheckResult> {
    // Check if user can sign at all
    const signCheck = await WalletService.canSign();

    if (!signCheck.canSign) {
      return { canUse: false, reason: signCheck.reason };
    }

    // Only generated wallets can use Account Abstraction currently
    // MetaMask users would need a different integration approach
    if (signCheck.walletOrigin !== 'generated') {
      return {
        canUse: false,
        reason: 'Sponsored transactions only available for generated wallets',
      };
    }

    // Check bundler configuration
    if (!BUNDLER_URL) {
      return { canUse: false, reason: 'Bundler not configured' };
    }

    return { canUse: true };
  }

  /**
   * Send a sponsored (gasless) transaction
   *
   * This handles:
   * 1. Ensuring smart account is registered on-chain (lazy registration)
   * 2. Creating the smart account client
   * 3. Getting sponsorship from backend
   * 4. Submitting the UserOperation
   *
   * @param request - The transaction to send (to, data, value)
   * @returns Transaction hash
   * @throws Error if sponsorship fails or transaction reverts
   */
  static async sendSponsoredTransaction(request: TransactionRequest): Promise<string> {
    console.log('🚀 PaymasterService: Sending sponsored transaction...');

    // Verify eligibility first
    const sponsorCheck = await this.canUseSponsoredTransactions();
    if (!sponsorCheck.canUse) {
      throw new Error(`Cannot use sponsored transactions: ${sponsorCheck.reason}`);
    }

    // Ensure smart account is registered on-chain before first tx
    await this.ensureSmartAccountRegistered();

    // Create the smart account client with paymaster
    const client = await this.createSmartAccountClient();

    // Send the transaction
    const txHash = await client.sendTransaction({
      to: request.to,
      data: request.data,
      value: request.value ?? 0n,
    });

    console.log('✅ PaymasterService: Transaction submitted:', txHash);
    return txHash;
  }

  /**
   * Ensure the user's Smart Account is registered on-chain as a member.
   * This is lazy - only happens on first sponsored transaction.
   *
   * Smart Accounts have a deterministic address based on the EOA owner,
   * so we can compute it without deploying the contract.
   */
  private static async ensureSmartAccountRegistered(): Promise<void> {
    const wallet = await WalletService.getCurrentUserWallet();

    // Already registered? Skip
    if (wallet?.smartAccountAddress) {
      console.log('✅ PaymasterService: Smart account already registered');
      return;
    }

    console.log('🔐 PaymasterService: Registering smart account on-chain...');

    // Compute the deterministic smart account address
    const smartAccountAddress = await this.computeSmartAccountAddress();
    console.log('📱 PaymasterService: Computed smart account:', smartAccountAddress);

    // Register on-chain via Cloud Function
    // This will call addMember(smartAccountAddress, userIdHash) and update Firestore
    const functions = getFunctions();
    const registerFn = httpsCallable<
      { smartAccountAddress: string },
      { success: boolean; txHash: string }
    >(functions, 'registerSmartAccount');

    const result = await registerFn({ smartAccountAddress });

    if (!result.data.success) {
      throw new Error('Failed to register smart account on-chain');
    }

    console.log('✅ PaymasterService: Smart account registered:', result.data.txHash);
  }

  /**
   * Compute the deterministic Smart Account address for the current user.
   *
   * The address is derived from:
   * - The EOA owner address
   * - The EntryPoint address
   * - The SimpleAccount factory
   *
   * This is the same address every time for the same EOA.
   */
  private static async computeSmartAccountAddress(): Promise<string> {
    const { signer } = await WalletService.getSigner();
    const privateKey = (signer as any).privateKey as Hex;
    const viemAccount = privateKeyToAccount(privateKey);

    const publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(),
    });

    const simpleAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: viemAccount,
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    return simpleAccount.address;
  }

  /**
   * Create a smart account client configured with our paymaster
   *
   * The smart account client:
   * - Wraps the user's EOA (Externally Owned Account) in a smart contract wallet
   * - Routes transactions through the ERC-4337 bundler
   * - Uses our paymaster to sponsor gas fees
   */
  private static async createSmartAccountClient() {
    // 1. Get the user's signer from WalletService
    const { signer, address, origin } = await WalletService.getSigner();
    console.log(`🔐 PaymasterService: Creating smart account for ${origin} wallet: ${address}`);

    // 2. Create public client for reading chain state
    const publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(),
    });

    // 3. Convert ethers signer to viem account
    // For generated wallets, we extract the private key
    if (origin !== 'generated') {
      throw new Error(
        'Account abstraction currently only supports generated wallets. ' +
          'MetaMask users can transact directly without gas sponsorship.'
      );
    }

    const wallet = await WalletService.getCurrentUserWallet();
    if (!wallet?.encryptedPrivateKey) {
      throw new Error('Generated wallet missing private key');
    }

    // The signer from WalletService is already an ethers.Wallet with the private key
    const privateKey = (signer as any).privateKey as Hex;
    const viemAccount = privateKeyToAccount(privateKey);

    // 4. Create simple smart account (ERC-4337 compatible)
    const simpleAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: viemAccount,
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    console.log(`📱 PaymasterService: Smart account address: ${simpleAccount.address}`);

    // 5. Create Pimlico client for bundler communication
    const pimlicoClient = createPimlicoClient({
      transport: http(BUNDLER_URL),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    // 6. Create the smart account client with paymaster configuration
    const smartAccountClient = createSmartAccountClient({
      account: simpleAccount,
      chain: CHAIN,
      bundlerTransport: http(BUNDLER_URL),
      paymaster: {
        // Step 1: Bundler asks for stub data to simulate and estimate gas
        getPaymasterStubData: async userOperation => {
          return this.getStubPaymasterData();
        },
        // Step 2: Bundler asks for real signature to broadcast
        getPaymasterData: async userOperation => {
          return this.getFinalPaymasterData(userOperation, simpleAccount.address);
        },
      },
      userOperation: {
        estimateFeesPerGas: async () => {
          return (await pimlicoClient.getUserOperationGasPrice()).fast;
        },
      },
    });

    return smartAccountClient;
  }

  /**
   * Generate stub paymaster data for gas estimation
   *
   * The bundler needs dummy data to simulate the transaction
   * and estimate gas costs before we get the real signature.
   */
  private static getStubPaymasterData() {
    console.log('🧪 PaymasterService: Providing stub data for gas estimation...');

    // Create placeholder data structure:
    // validUntil (6 bytes) + validAfter (6 bytes) + signature (65 bytes) = 77 bytes
    const validUntil = 'ffffffffffff'; // 6 bytes - max value
    const validAfter = '000000000000'; // 6 bytes - zero (valid immediately)

    // Structurally valid dummy signature (65 bytes = r + s + v)
    const dummyR = '0000000000000000000000000000000000000000000000000000000000000001';
    const dummyS = '0000000000000000000000000000000000000000000000000000000000000001';
    const dummyV = '1b';

    const paymasterData = `0x${validUntil}${validAfter}${dummyR}${dummyS}${dummyV}` as Hex;

    return {
      paymaster: PAYMASTER_ADDRESS as Hex,
      paymasterData,
      paymasterVerificationGasLimit: 100000n,
      paymasterPostOpGasLimit: 0n,
    };
  }

  /**
   * Get final paymaster data with real backend signature
   *
   * After gas estimation, we compute the real UserOperation hash
   * and request a sponsorship signature from our backend.
   */
  private static async getFinalPaymasterData(userOperation: any, smartAccountAddress: string) {
    console.log('🛰️ PaymasterService: Requesting real signature for final UserOp...');

    // 1. Generate timestamps
    const now = Math.floor(Date.now() / 1000);
    const validUntil = now + 300; // Valid for 5 minutes
    const validAfter = 0; // Valid immediately

    // 2. Format as 6-byte hex strings
    const validUntilHex = pad(toHex(validUntil), { size: 6 });
    const validAfterHex = pad(toHex(validAfter), { size: 6 });

    // 3. Create placeholder paymasterData for hash computation (with zero signature)
    const placeholderSig = toHex(new Uint8Array(65)); // 65 bytes of zeros
    const paymasterDataForHash = concat([validUntilHex, validAfterHex, placeholderSig]);

    // 4. Build complete userOp for hash computation
    const userOpForHash = {
      ...userOperation,
      signature: '0x' as Hex,
      callGasLimit: userOperation.callGasLimit ?? 0n,
      verificationGasLimit: userOperation.verificationGasLimit ?? 0n,
      preVerificationGas: userOperation.preVerificationGas ?? 0n,
      maxFeePerGas: userOperation.maxFeePerGas ?? 0n,
      maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas ?? 0n,
      paymaster: PAYMASTER_ADDRESS as Hex,
      paymasterData: paymasterDataForHash,
      paymasterVerificationGasLimit: 100000n,
      paymasterPostOpGasLimit: 0n,
    };

    // 5. Compute the UserOperation hash (ERC-4337 standard)
    const userOpHash = getUserOperationHash({
      userOperation: userOpForHash,
      chainId: CHAIN.id,
      entryPointAddress: entryPoint07Address,
      entryPointVersion: '0.7',
    });

    console.log('📝 PaymasterService: UserOpHash:', userOpHash);

    // 6. Request sponsorship signature from backend
    const signature = await this.requestSponsorship(
      userOpHash,
      smartAccountAddress,
      validUntil,
      validAfter
    );

    // 7. Build final paymasterData with real signature
    const finalPaymasterData = concat([validUntilHex, validAfterHex, signature as Hex]);

    console.log('✅ PaymasterService: Final paymaster data ready');

    return {
      paymaster: PAYMASTER_ADDRESS as Hex,
      paymasterData: finalPaymasterData,
      paymasterVerificationGasLimit: 100000n,
      paymasterPostOpGasLimit: 0n,
    };
  }

  /**
   * Request gas sponsorship from our backend
   *
   * The backend verifies eligibility and signs the UserOperation
   * with the paymaster's private key.
   */
  private static async requestSponsorship(
    userOpHash: string,
    sender: string,
    validUntil: number,
    validAfter: number
  ): Promise<string> {
    console.log('💰 PaymasterService: Requesting sponsorship from backend...');

    const functions = getFunctions();
    const signSponsorship = httpsCallable<
      { userOpHash: string; sender: string; validUntil: number; validAfter: number },
      SponsorshipResponse
    >(functions, 'signSponsorship');

    const result = await signSponsorship({ userOpHash, sender, validUntil, validAfter });

    if (!result.data.sponsored) {
      throw new Error(result.data.reason || 'Sponsorship denied');
    }

    console.log('✅ PaymasterService: Sponsorship approved!');
    return result.data.signature!;
  }
}
