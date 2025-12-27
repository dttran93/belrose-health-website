// functions/src/handlers/smartAccountRegistry.ts
//
// Cloud Function to register a user's Smart Account address on-chain.
// Called lazily when the user first attempts a sponsored transaction.
//
// The Smart Account is the on-chain identity for Account Abstraction users.
// It's a deterministic address computed from the user's EOA.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ethers } from 'ethers';

// ==================== CONFIG ====================

const MEMBER_ROLE_MANAGER_ADDRESS = '0x0FdDcE7EdebD73C6d1A11983bb6a759132543aaD';
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://1rpc.io/sepolia';

// Define secret for admin wallet
const adminWalletPrivateKey = defineSecret('ADMIN_WALLET_PRIVATE_KEY');

// ABI for addMember function
const MEMBER_ROLE_MANAGER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'walletAddress', type: 'address' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'addMember',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'isActiveMember',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// ==================== CLOUD FUNCTION ====================

/**
 * Register a user's Smart Account address on the blockchain.
 *
 * This is called lazily when the user first attempts a sponsored transaction.
 * The Smart Account address is deterministic and computed on the frontend.
 *
 * Flow:
 * 1. Verify caller is authenticated
 * 2. Verify the user has a generated wallet (EOA)
 * 3. Check if smart account is already registered
 * 4. Call addMember(smartAccountAddress, userIdHash) on contract
 * 5. Update Firestore with smartAccountAddress
 */
export const registerSmartAccount = onCall(
  {
    enforceAppCheck: false, // Enable in production
    maxInstances: 10,
    secrets: [adminWalletPrivateKey],
  },
  async request => {
    // 1. Auth and Input Validation
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = request.auth.uid;
    const { smartAccountAddress } = request.data;

    if (!smartAccountAddress) {
      throw new HttpsError('invalid-argument', 'smartAccountAddress is required');
    }

    if (!ethers.isAddress(smartAccountAddress)) {
      throw new HttpsError('invalid-argument', 'Invalid smart account address format');
    }

    const privateKey = adminWalletPrivateKey.value();
    if (!privateKey) {
      console.error('❌ ADMIN_WALLET_PRIVATE_KEY not configured');
      throw new HttpsError('internal', 'Server configuration error');
    }

    // 2. Get user data
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();

    //3. Setup Blockchain Connection
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const adminWallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(
      MEMBER_ROLE_MANAGER_ADDRESS,
      MEMBER_ROLE_MANAGER_ABI,
      adminWallet
    );

    const isAlreadyMember = await contract.isActiveMember(smartAccountAddress);

    if (isAlreadyMember) {
      console.log('ℹ️ Smart account already registered on-chain, updating Firestore');

      // Repair Firestore to match if it was missing
      if (!userData?.wallet?.smartAccountAddress) {
        await db.collection('users').doc(userId).update({
          'wallet.smartAccountAddress': smartAccountAddress,
          'blockchainMember.smartAccountRegistered': true,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return {
        success: true,
        smartAccountAddress,
        alreadyRegistered: true,
      };
    }

    // 4. If not on-chain, register now
    console.log('🔗 Registering smart account on-chain:', smartAccountAddress);

    // Create userIdHash from Firebase UID (same as regular member registration)
    const userIdHash = ethers.id(userId);

    try {
      const tx = await contract.addMember(smartAccountAddress, userIdHash);
      console.log('📤 Transaction sent:', tx.hash);

      const receipt = await tx.wait();
      console.log('✅ Smart account registered, block:', receipt?.blockNumber);

      // ==================== UPDATE FIRESTORE ====================
      await db.collection('users').doc(userId).update({
        'wallet.smartAccountAddress': smartAccountAddress,
        'blockchainMember.smartAccountRegistered': true,
        'blockchainMember.smartAccountTxHash': tx.hash,
        'blockchainMember.smartAccountBlockNumber': receipt?.blockNumber,
        'blockchainMember.smartAccountRegisteredAt': FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        txHash: tx.hash,
        smartAccountAddress,
      };
    } catch (error: any) {
      console.error('❌ Failed to register smart account:', error);

      // Check for specific errors
      if (error.message?.includes('already registered')) {
        // Race condition - another request registered it
        await db.collection('users').doc(userId).update({
          'wallet.smartAccountAddress': smartAccountAddress,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return {
          success: true,
          txHash: '',
          smartAccountAddress,
          alreadyRegistered: true,
        };
      }

      throw new HttpsError('internal', `Failed to register smart account: ${error.message}`);
    }
  }
);
