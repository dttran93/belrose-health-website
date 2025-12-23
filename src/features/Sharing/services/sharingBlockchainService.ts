// src/features/Sharing/services/sharingBlockchainService.ts

/**
 * This service handles the blockchain portion of sharing records
 * Combines signing service from wallet and paymaster to abstract gas transactions
 */
import { encodeFunctionData, createPublicClient, http, type Hex, concat, pad, toHex } from 'viem';
import { sepolia } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address, getUserOperationHash } from 'viem/account-abstraction';
import { privateKeyToAccount } from 'viem/accounts';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { WalletService } from '@/features/BlockchainWallet/services/walletService';

// ==================== CONFIG ====================

// Your deployed HealthRecordCore contract (for sharing)
const HEALTH_RECORD_CONTRACT = '0xA9f388D92032E5e84E1264e72129A30d57cBfE66';

// Your deployed paymaster
const PAYMASTER_ADDRESS = '0x967e757609E1118E7164e51A204772a14804E253';

// Pimlico bundler URL (get from dashboard.pimlico.io)
const BUNDLER_URL = import.meta.env.VITE_PIMLICO_BUNDLER_URL;

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

interface SponsorshipResponse {
  sponsored: boolean;
  signature?: string;
  reason?: string;
}

export class SharingBlockchainService {
  /**
   * Create a smart account client with paymaster sponsorship
   */
  private static async getSmartAccountClient() {
    // 1. Get the user's signer from WalletService
    const { signer, address, origin } = await WalletService.getSigner();
    console.log(`🔐 Creating smart account for ${origin} wallet: ${address}`);

    // 2. Create public client for reading chain state
    const publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(),
    });

    // 3. Convert ethers signer to viem account
    // For generated wallets, we have the private key; for MetaMask, we need a different approach
    let viemAccount;

    if (origin === 'generated') {
      // For generated wallets, get the private key and create a viem account
      const wallet = await WalletService.getCurrentUserWallet();
      if (!wallet?.encryptedPrivateKey) {
        throw new Error('Generated wallet missing private key');
      }

      // Get decrypted private key through the signer
      // The signer from WalletService is already an ethers.Wallet with the private key
      const privateKey = (signer as any).privateKey as Hex;
      viemAccount = privateKeyToAccount(privateKey);
    } else {
      // For MetaMask/external wallets, we need to use the window.ethereum provider
      // This is more complex with permissionless - for now, throw an error
      // In production, you'd use a different approach for external wallets
      throw new Error(
        'Account abstraction currently only supports generated wallets. ' +
          'MetaMask users can transact directly without gas sponsorship.'
      );
    }

    // 4. Create simple smart account
    const simpleAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: viemAccount,
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    console.log(`📱 Smart account address: ${simpleAccount.address}`);

    // 5. Create Pimlico client for bundler
    const pimlicoClient = createPimlicoClient({
      transport: http(BUNDLER_URL),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    // Helper ensures the hash and data structure are identical for dummy and real steps
    const fetchSponsorshipData = async (userOperation: any, phase: string) => {
      // 1. STUB PHASE: Provide dummy data so Pimlico can estimate gas accurately
      if (phase === 'STUB-SIMULATION') {
        console.log(`[${phase}] 🧪 Providing dummy signature for estimation...`);

        //Create Placeholder data to run a transaction to estimate gas cost
        // validUntil (6 bytes) + validAfter (6 bytes) + signature (65 bytes) = 77 bytes
        const validUntil = 'ffffffffffff'; // 6 bytes
        const validAfter = '000000000000'; // 6 bytes

        // Structurally valid dummy signature (65 bytes)
        const dummyR = '0000000000000000000000000000000000000000000000000000000000000001'; // 64 hex chars
        const dummyS = '0000000000000000000000000000000000000000000000000000000000000001'; // 64 hex chars
        const dummyV = '1b'; // 2 hex chars

        const paymasterData = `0x${validUntil}${validAfter}${dummyR}${dummyS}${dummyV}` as Hex;

        // Verify: should be 12 + 12 + 64 + 64 + 2 = 154 hex chars = 77 bytes
        console.log('paymasterData length (hex chars):', paymasterData.length - 2); // subtract '0x'

        return {
          paymaster: PAYMASTER_ADDRESS as Hex,
          paymasterData,
          paymasterVerificationGasLimit: 100000n,
          paymasterPostOpGasLimit: 0n,
        };
      }

      // 2. FINAL PHASE: Calculate the REAL hash after gas estimation is done
      console.log(`[${phase}] 🛰️ Requesting real signature for final UserOp...`);

      //1. Generate timestamps Client-Side
      const now = Math.floor(Date.now() / 1000);
      const validUntil = now + 300; // 5 minutes from now
      const validAfter = 0;

      // 2. Format as 6-byte hex strings
      const validUntilHex = pad(toHex(validUntil), { size: 6 });
      const validAfterHex = pad(toHex(validAfter), { size: 6 });

      // 3. Create placeholder paymasterData for hash computation (with zero signature)
      const placeholderSig = toHex(new Uint8Array(65)); // 65 bytes of zeros
      const paymasterDataForHash = concat([validUntilHex, validAfterHex, placeholderSig]);

      //4. Build complete userOp for hash computation
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

      //5. Compute the userOpHash first Stnadard Layer 2 Hash (The ERC-4337 Standard Hash)
      const UserOpHash = getUserOperationHash({
        userOperation: userOpForHash,
        chainId: CHAIN.id,
        entryPointAddress: entryPoint07Address,
        entryPointVersion: '0.7',
      });

      console.log('UserOpHash:', UserOpHash);
      console.log('validUntil:', validUntil, 'validAfter:', validAfter);

      //6. request signature from backend (and send timestamps)
      const signature = await SharingBlockchainService.requestSponsorship(
        UserOpHash,
        simpleAccount.address,
        validUntil,
        validAfter
      );

      // 7. Build final paymasterData with real signature
      const finalPaymasterData = concat([validUntilHex, validAfterHex, signature as Hex]);

      console.log('=== FINAL PAYMASTER DATA DEBUG ===');
      console.log('validUntilHex:', validUntilHex);
      console.log('validAfterHex:', validAfterHex);
      console.log('signature from backend:', signature);
      console.log('finalPaymasterData:', finalPaymasterData);
      console.log('Total bytes:', (finalPaymasterData.length - 2) / 2); // Should be exactly 77

      // Also log what we used for hash computation
      console.log('paymasterDataForHash:', paymasterDataForHash);

      return {
        paymaster: PAYMASTER_ADDRESS as Hex,
        paymasterData: finalPaymasterData,
        paymasterVerificationGasLimit: 100000n,
        paymasterPostOpGasLimit: 0n,
      };
    };

    // 6. Create smart account client with the shared logic
    const smartAccountClient = createSmartAccountClient({
      account: simpleAccount,
      chain: CHAIN,
      bundlerTransport: http(BUNDLER_URL),
      paymaster: {
        // Step 1: Bundler asks for data to simulate and estimate gas
        getPaymasterStubData: async userOperation => {
          return await fetchSponsorshipData(userOperation, 'STUB-SIMULATION');
        },
        // Step 2: Bundler asks for data to actually sign and broadcast
        getPaymasterData: async userOperation => {
          console.log('=== FINAL PHASE USER OP ===');
          console.log(
            'Full userOperation:',
            JSON.stringify(
              userOperation,
              (key, value) => (typeof value === 'bigint' ? value.toString() : value),
              2
            )
          );
          console.log('callGasLimit:', userOperation.callGasLimit);
          console.log('verificationGasLimit:', userOperation.verificationGasLimit);
          console.log('preVerificationGas:', userOperation.preVerificationGas);
          console.log('maxFeePerGas:', userOperation.maxFeePerGas);
          console.log('maxPriorityFeePerGas:', userOperation.maxPriorityFeePerGas);
          console.log('nonce:', userOperation.nonce);
          console.log('sender:', userOperation.sender);

          return await fetchSponsorshipData(userOperation, 'FINAL-BROADCAST');
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
   * Request sponsorship from our backend
   */
  private static async requestSponsorship(
    userOpHash: string,
    sender: string,
    validUntil: number,
    validAfter: number
  ): Promise<string> {
    console.log('💰 Requesting gas sponsorship from backend...');

    const functions = getFunctions();
    const signSponsorship = httpsCallable<
      { userOpHash: string; sender: string; validUntil: number; validAfter: number },
      SponsorshipResponse
    >(functions, 'signSponsorship');

    const result = await signSponsorship({ userOpHash, sender, validUntil, validAfter });

    if (!result.data.sponsored) {
      throw new Error(result.data.reason || 'Sponship denied');
    }

    console.log('✅ Sponsorship approved!');
    return result.data.signature!;
  }

  /**
   * Check if user can use sponsored transactions
   */
  static async canUseSponsoredTransactions(): Promise<{
    canUse: boolean;
    reason?: string;
  }> {
    const signCheck = await WalletService.canSign();

    if (!signCheck.canSign) {
      return { canUse: false, reason: signCheck.reason };
    }

    // Only generated wallets can use AA currently
    if (signCheck.walletOrigin !== 'generated') {
      return {
        canUse: false,
        reason: 'Sponsored transactions only available for generated wallets',
      };
    }

    if (!BUNDLER_URL) {
      return { canUse: false, reason: 'Bundler not configured' };
    }

    return { canUse: true };
  }

  /**
   * Grant access on blockchain (gasless via paymaster)
   */
  static async grantAccessOnChain(
    permissionHash: string,
    recordId: string,
    receiverWalletAddress: string
  ): Promise<string> {
    console.log('🔗 Preparing sponsored grantAccess transaction...');

    // Check if we can use sponsored transactions
    const sponsorCheck = await this.canUseSponsoredTransactions();

    if (!sponsorCheck.canUse) {
      // Fall back to direct transaction (user pays gas)
      console.log('⚠️ Cannot use sponsorship, falling back to direct transaction');
      return this.grantAccessDirect(permissionHash, recordId, receiverWalletAddress);
    }

    try {
      const client = await this.getSmartAccountClient();

      // Encode the contract call
      const callData = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'grantAccess',
        args: [permissionHash, recordId, receiverWalletAddress as Hex],
      });

      // Send via smart account (paymaster sponsors gas)
      const txHash = await client.sendTransaction({
        to: HEALTH_RECORD_CONTRACT as Hex,
        data: callData,
        value: 0n,
      });

      console.log('✅ Sponsored transaction submitted:', txHash);
      return txHash;
    } catch (error) {
      console.error('❌ Sponsored transaction failed:', error);

      // If sponsorship fails, try direct transaction
      console.log('⚠️ Falling back to direct transaction...');
      return this.grantAccessDirect(permissionHash, recordId, receiverWalletAddress);
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
    const { ethers } = await import('ethers');

    const contract = new ethers.Contract(HEALTH_RECORD_CONTRACT, CONTRACT_ABI, signer);

    const grantAccess = contract.getFunction('grantAccess');
    const tx = await grantAccess(permissionHash, recordId, receiverWalletAddress);

    console.log('📝 Direct transaction sent:', tx.hash);
    await tx.wait();
    console.log('✅ Direct transaction confirmed');

    return tx.hash;
  }

  /**
   * Revoke access on blockchain (gasless via paymaster)
   */
  static async revokeAccessOnChain(permissionHash: string): Promise<string> {
    console.log('🔗 Preparing sponsored revokeAccess transaction...');

    const sponsorCheck = await this.canUseSponsoredTransactions();

    if (!sponsorCheck.canUse) {
      console.log('⚠️ Cannot use sponsorship, falling back to direct transaction');
      return this.revokeAccessDirect(permissionHash);
    }

    try {
      const client = await this.getSmartAccountClient();

      const callData = encodeFunctionData({
        abi: CONTRACT_ABI,
        functionName: 'revokeAccess',
        args: [permissionHash],
      });

      const txHash = await client.sendTransaction({
        to: HEALTH_RECORD_CONTRACT as Hex,
        data: callData,
        value: 0n,
      });

      console.log('✅ Sponsored transaction submitted:', txHash);
      return txHash;
    } catch (error) {
      console.error('❌ Sponsored transaction failed:', error);
      console.log('⚠️ Falling back to direct transaction...');
      return this.revokeAccessDirect(permissionHash);
    }
  }

  /**
   * Revoke access directly (user pays gas) - fallback method
   */
  private static async revokeAccessDirect(permissionHash: string): Promise<string> {
    const { signer } = await WalletService.getSigner();
    const { ethers } = await import('ethers');

    const contract = new ethers.Contract(HEALTH_RECORD_CONTRACT, CONTRACT_ABI, signer);
    const revokeAccess = contract.getFunction('revokeAccess');
    const tx = await revokeAccess(permissionHash);

    console.log('📝 Direct transaction sent:', tx.hash);
    await tx.wait();
    console.log('✅ Direct transaction confirmed');

    return tx.hash;
  }

  /**
   * Check access status on blockchain (read-only, no gas needed)
   */
  static async checkAccessOnChain(permissionHash: string): Promise<{
    isActive: boolean;
    sharer: string;
    receiver: string;
    recordId: string;
    grantedAt: number;
    revokedAt: number;
  }> {
    const publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(),
    });

    const result = await publicClient.readContract({
      address: HEALTH_RECORD_CONTRACT as Hex,
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
}
