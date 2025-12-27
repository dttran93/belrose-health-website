// functions/src/handlers/memberRegistry.ts
// Backend functions for blockchain operations using admin wallet

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { ethers } from 'ethers';

const MEMBER_ROLE_MANAGER_ADDRESS = '0x0FdDcE7EdebD73C6d1A11983bb6a759132543aaD';

// ABI - only admin functions
const MEMBER_ROLE_MANAGER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'userWallet', type: 'address' },
      { internalType: 'bytes32', name: 'userIdHash', type: 'bytes32' },
    ],
    name: 'addMember',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'userWallet', type: 'address' },
      { internalType: 'uint8', name: 'newStatus', type: 'uint8' },
    ],
    name: 'setMemberStatus',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'recordId', type: 'string' },
      { internalType: 'address', name: 'firstUser', type: 'address' },
      { internalType: 'string', name: 'role', type: 'string' },
    ],
    name: 'initializeRecordRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];
type InitialRole = 'administrator' | 'owner';
// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get admin wallet from environment
 */
function getAdminWallet(): ethers.Wallet {
  const privateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL || 'https://1rpc.io/sepolia';

  if (!privateKey) {
    throw new Error('Admin wallet private key not found in environment secrets');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Get contract instance with admin signer
 */
function getAdminContract(): ethers.Contract {
  const wallet = getAdminWallet();
  return new ethers.Contract(MEMBER_ROLE_MANAGER_ADDRESS, MEMBER_ROLE_MANAGER_ABI, wallet);
}

// ============================================================================
// MEMBER REGISTRATION
// ============================================================================

/**
 * Register a new member on the blockchain
 * Called after user completes registration
 */
export const registerMemberOnChain = onCall(
  { secrets: ['ADMIN_WALLET_PRIVATE_KEY', 'RPC_URL'] },
  async request => {
    // Verify user is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { walletAddress } = request.data;
    const userId = request.auth.uid;

    // Validate wallet address
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      throw new HttpsError('invalid-argument', 'Invalid wallet address');
    }

    console.log('🔗 Registering member on blockchain:', { userId, walletAddress });

    try {
      // Create userIdHash from Firebase UID
      const userIdHash = ethers.id(userId); // keccak256 hash of the userId

      // Get admin contract
      const contract = getAdminContract();

      // Call addMember
      console.log('📝 Calling addMember...');
      const tx = await contract.addMember(walletAddress, userIdHash);
      console.log('⏳ Transaction sent:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('✅ Member registered on blockchain, block:', receipt?.blockNumber);

      // Update Firestore with blockchain registration info
      const db = getFirestore();
      await db
        .collection('users')
        .doc(userId)
        .update({
          blockchainMember: {
            registered: true,
            walletAddress: walletAddress,
            userIdHash: userIdHash,
            txHash: tx.hash,
            blockNumber: receipt?.blockNumber,
            registeredAt: Timestamp.now(),
            status: 'Active',
          },
        });

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber,
      };
    } catch (error: any) {
      console.error('❌ Failed to register member on blockchain:', error);

      // Handle specific errors
      if (error.message?.includes('Already a member')) {
        throw new HttpsError('already-exists', 'User is already registered on blockchain');
      }
      if (error.message?.includes('User ID already registered')) {
        throw new HttpsError('already-exists', 'User ID is already registered');
      }

      throw new HttpsError('internal', `Blockchain registration failed: ${error.message}`);
    }
  }
);

// ============================================================================
// MEMBER STATUS
// ============================================================================

/**
 * Update member status (e.g., after identity verification)
 * Called by backend after Persona verification completes
 */
export const updateMemberStatus = onCall(
  { secrets: ['ADMIN_WALLET_PRIVATE_KEY', 'RPC_URL'] },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { walletAddress, status } = request.data;

    // Validate inputs
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      throw new HttpsError('invalid-argument', 'Invalid wallet address');
    }

    if (status === undefined || ![0, 1, 2].includes(status)) {
      throw new HttpsError(
        'invalid-argument',
        'Invalid status. Must be 0 (Inactive), 1 (Active), or 2 (Verified)'
      );
    }

    console.log('🔗 Updating member status on blockchain:', { walletAddress, status });

    try {
      const contract = getAdminContract();

      const tx = await contract.setMemberStatus(walletAddress, status);
      console.log('⏳ Transaction sent:', tx.hash);

      const receipt = await tx.wait();
      console.log('✅ Member status updated, block:', receipt?.blockNumber);

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber,
      };
    } catch (error: any) {
      console.error('❌ Failed to update member status:', error);
      throw new HttpsError('internal', `Status update failed: ${error.message}`);
    }
  }
);

// ============================================================================
// RECORD INITIALIZATION
// ============================================================================

// Read-only ABI for checking blockchain state
const MEMBER_ROLE_MANAGER_READ_ABI = [
  {
    inputs: [{ internalType: 'string', name: 'recordId', type: 'string' }],
    name: 'getRecordAdmins',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
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
];

/**
 * Get read-only contract instance for checking blockchain state
 */
function getReadOnlyContract(): ethers.Contract {
  const rpcUrl = process.env.RPC_URL || 'https://1rpc.io/sepolia';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Contract(MEMBER_ROLE_MANAGER_ADDRESS, MEMBER_ROLE_MANAGER_READ_ABI, provider);
}

/**
 * Initialize a record with its first manager (administrator or owner)
 * Called when uploader first wants to share a record
 *
 * Validation order:
 * 1. Input validation
 * 2. Firestore validation (record exists, user is creator, wallet matches)
 * 3. Blockchain validation (not already initialized) - authoritative check
 * 4. Execute blockchain transaction
 * 5. Update Firestore with tx details
 *
 * Self-heals Firestore if it's out of sync with blockchain.
 */
export const initializeRoleOnChain = onCall(
  { secrets: ['ADMIN_WALLET_PRIVATE_KEY', 'RPC_URL'] },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { recordId, walletAddress, role } = request.data;
    const userId = request.auth.uid;

    // ======================== INPUT VALIDATION =========================

    if (!recordId || typeof recordId !== 'string') {
      throw new HttpsError('invalid-argument', 'Invalid record ID');
    }

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      throw new HttpsError('invalid-argument', 'Invalid wallet address');
    }

    // Validate role is either administrator or owner
    if (!role || (role !== 'administrator' && role !== 'owner')) {
      throw new HttpsError('invalid-argument', 'Invalid role. Must be "administrator" or "owner"');
    }

    const validatedRole: InitialRole = role;

    console.log('🔗 Initializing record role on blockchain:', {
      recordId,
      walletAddress,
      role: validatedRole,
      requestedBy: userId,
    });

    const db = getFirestore();

    // ======================== FIRESTORE VALIDATION =========================

    // 1. Verify record exists in Firestore
    const recordDoc = await db.collection('records').doc(recordId).get();

    if (!recordDoc.exists) {
      console.error('❌ Record not found in Firestore:', recordId);
      throw new HttpsError('not-found', 'Record does not exist');
    }

    const recordData = recordDoc.data();

    // 2. Verify the requesting user is the record creator
    if (recordData?.uploadedBy !== userId) {
      console.error('❌ User is not the record creator:', {
        uploadedBy: recordData?.uploadedBy,
        requestedBy: userId,
      });
      throw new HttpsError(
        'permission-denied',
        'Only the record creator can initialize blockchain roles'
      );
    }

    // 3. Verify the wallet matches the user's registered wallet
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User profile not found');
    }

    const userData = userDoc.data();
    const userWallet = userData?.wallet?.address;

    if (!userWallet) {
      throw new HttpsError('failed-precondition', 'User does not have a registered wallet');
    }

    if (userWallet.toLowerCase() !== walletAddress.toLowerCase()) {
      console.error('❌ Wallet address mismatch:', {
        userWallet,
        providedWallet: walletAddress,
      });
      throw new HttpsError('invalid-argument', 'Wallet address must match your registered wallet');
    }

    // ======================== BLOCKCHAIN VALIDATION =========================

    try {
      const readOnlyContract = getReadOnlyContract();

      // Check if record already has admins or owners on-chain
      const [admins, owners] = await Promise.all([
        readOnlyContract.getRecordAdmins(recordId),
        readOnlyContract.getRecordOwners(recordId),
      ]);

      if (admins.length > 0 || owners.length > 0) {
        console.log('ℹ️ Record already initialized on blockchain:', {
          adminCount: admins.length,
          ownerCount: owners.length,
        });

        // Self-heal: sync Firestore if it was out of sync
        if (!recordData?.blockchainRoleInitialization?.blockchainInitialized) {
          console.log('🔄 Syncing Firestore with blockchain state...');
          await db
            .collection('records')
            .doc(recordId)
            .update({
              blockchainRoleInitialization: {
                blockchainInitialized: true,
                syncedFromChain: true, // Flag that this was a sync, not original init
              },
            });
        }

        throw new HttpsError('already-exists', 'Record already initialized on blockchain');
      }

      // Edge case: Firestore says initialized but blockchain doesn't
      // This is unusual but blockchain is truth - proceed with initialization
      if (recordData?.blockchainRoleInitialization.blockchainInitialized) {
        console.warn(
          '⚠️ Firestore marked as initialized but blockchain is not. Proceeding with initialization...'
        );
      }
    } catch (error: any) {
      // Re-throw HttpsError (from already-exists check above)
      if (error instanceof HttpsError) {
        throw error;
      }

      // RPC error - log but continue (fail-safe: let smart contract be the final check)
      console.warn('⚠️ Could not verify blockchain state, proceeding anyway:', error.message);
    }

    // ======================== BLOCKCHAIN TRANSACTION =========================

    try {
      const contract = getAdminContract();

      const tx = await contract.initializeRecordRole(recordId, walletAddress, validatedRole);
      console.log('⏳ Transaction sent:', tx.hash);

      const receipt = await tx.wait();
      console.log('✅ Record role initialized, block:', receipt?.blockNumber);

      // Update Firestore to mark record as blockchain-initialized
      await db
        .collection('records')
        .doc(recordId)
        .update({
          blockchainRoleInitialization: {
            blockchainInitialized: true,
            blockchainInitializedAt: Timestamp.now(),
            blockchainInitTxHash: tx.hash,
            blockchainInitBlockNumber: receipt?.blockNumber,
            initialRole: validatedRole,
          },
        });

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber,
        role: validatedRole,
      };
    } catch (error: any) {
      console.error('❌ Failed to initialize record role:', error);

      // Handle smart contract "already initialized" error (final safety net)
      if (error.message?.includes('Record already initialized')) {
        // Sync Firestore state
        await db
          .collection('records')
          .doc(recordId)
          .update({
            blockchainRoleInitialization: {
              blockchainInitialized: true,
              syncedFromChain: true,
            },
          });
        throw new HttpsError('already-exists', 'Record already has roles assigned on blockchain');
      }

      throw new HttpsError('internal', `Record initialization failed: ${error.message}`);
    }
  }
);
