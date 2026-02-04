"use strict";
// functions/src/handlers/memberRegistry.ts
// Backend functions for blockchain operations using admin wallet
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRoleOnChain = exports.reactivateWalletOnChain = exports.deactivateWalletOnChain = exports.updateMemberStatus = exports.registerMemberOnChain = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const ethers_1 = require("ethers");
const MEMBER_ROLE_MANAGER_ADDRESS = '0xC31477f563dC8f7529Ba6AE7E410ABdB84C27d7C';
const MEMBER_ROLE_MANAGER_ABI = [
    // Admin Functions
    'function addMember(address wallet, bytes32 userIdHash) external',
    'function setUserStatus(bytes32 userIdHash, uint8 newStatus) external',
    'function deactivateWallet(address wallet) external',
    'function reactivateWallet(address wallet) external',
    'function initializeRecordRole(string recordId, address targetWallet, string role) external',
    // View Functions
    'function ownersByRecord(string recordId, uint256 index) external view returns (bytes32)',
    'function adminsByRecord(string recordId, uint256 index) external view returns (bytes32)',
    'function getRecordOwners(string recordId) external view returns (bytes32[])',
    'function getRecordAdmins(string recordId) external view returns (bytes32[])',
    'function getUserForWallet(address wallet) external view returns (bytes32)',
    'function wallets(address wallet) external view returns (bytes32 userIdHash, bool isWalletActive)',
];
// ============================================================================
// HELPERS
// ============================================================================
/**
 * Get admin wallet from environment
 */
function getAdminWallet() {
    const privateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL || 'https://1rpc.io/sepolia';
    if (!privateKey)
        throw new Error('Admin wallet private key not found');
    const provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
    return new ethers_1.ethers.Wallet(privateKey, provider);
}
/**
 * Get contract instance with admin signer
 */
function getAdminContract() {
    return new ethers_1.ethers.Contract(MEMBER_ROLE_MANAGER_ADDRESS, MEMBER_ROLE_MANAGER_ABI, getAdminWallet());
}
// ============================================================================
// MEMBER REGISTRATION & WALLET LINKING
// ============================================================================
/**
 * Register a new member/Wallet combination on the blockchain
 * One member can be associated with multiple wallets, so this can be
 */
exports.registerMemberOnChain = (0, https_1.onCall)({ secrets: ['ADMIN_WALLET_PRIVATE_KEY', 'RPC_URL'] }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    const { walletAddress } = request.data;
    const userId = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    // Validate wallet address
    if (!walletAddress || !ethers_1.ethers.isAddress(walletAddress)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid wallet address');
    }
    console.log('🔗 Registering member on blockchain:', { userId, walletAddress });
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        if (!userData)
            throw new https_1.HttpsError('not-found', 'User profile not found');
        // IDEMPOTENCY CHECK: Don't re-register if this specific wallet is already in our array
        const existingWallets = userData.onChainIdentity?.linkedWallets || [];
        const alreadyLinked = existingWallets.some((w) => w.address.toLowerCase() === walletAddress.toLowerCase());
        if (alreadyLinked) {
            return { success: true, message: 'Wallet already registered in Firestore' };
        }
        const isSmartAccount = walletAddress.toLowerCase() === userData.wallet?.smartAccountAddress?.toLowerCase();
        const walletLabel = isSmartAccount ? 'smart-account' : 'eoa';
        // 3. Contract Call
        const userIdHash = ethers_1.ethers.id(userId);
        const contract = getAdminContract();
        // Smart Contract Call
        const tx = await contract.addMember(walletAddress, userIdHash);
        const receipt = await tx.wait();
        //4. Update Firestore
        await db
            .collection('users')
            .doc(userId)
            .update({
            'onChainIdentity.userIdHash': userIdHash,
            'onChainIdentity.status': userData.onChainIdentity?.status || 'Active',
            'onChainIdentity.linkedWallets': firestore_1.FieldValue.arrayUnion({
                address: walletAddress,
                type: walletLabel,
                txHash: tx.hash,
                blockNumber: receipt?.blockNumber,
                linkedAt: firestore_1.Timestamp.now(),
                isWalletActive: true,
            }),
        });
        return { success: true, txHash: tx.hash, blockNumber: receipt?.blockNumber };
    }
    catch (error) {
        console.error('❌ Member registration failed:', error);
        // Handle "already registered" from smart contract
        if (error.message?.includes('Wallet already registered')) {
            return { success: true, message: 'Wallet already registered on chain' };
        }
        throw new https_1.HttpsError('internal', error.message);
    }
});
// ============================================================================
// MEMBER STATUS
// ============================================================================
/**
 * Update member status (e.g., after identity verification)
 * Called by backend after Persona verification completes
 */
exports.updateMemberStatus = (0, https_1.onCall)({ secrets: ['ADMIN_WALLET_PRIVATE_KEY', 'RPC_URL'] }, async (request) => {
    const { userId, status } = request.data;
    if (!userId || ![1, 2, 3].includes(status)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid userId or status');
    }
    try {
        const userIdHash = ethers_1.ethers.id(userId);
        const contract = getAdminContract();
        const tx = await contract.setUserStatus(userIdHash, status);
        const receipt = await tx.wait();
        // Sync the status change to Firestore
        const statusMap = { 1: 'Inactive', 2: 'Active', 3: 'Verified' };
        await (0, firestore_1.getFirestore)().collection('users').doc(userId).update({
            'onChainIdentity.status': statusMap[status],
            'onChainIdentity.statusUpdatedAt': firestore_1.Timestamp.now(),
            'onChainIdentity.statusTxHash': tx.hash,
        });
        return { success: true, txHash: tx.hash, blockNumber: receipt?.blockNumber };
    }
    catch (error) {
        console.error('❌ Status update failed:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
// ============================================================================
// WALLET STATUS (INDIVIDUAL WALLET)
// ============================================================================
/**
 * Deactivate a specific wallet on the blockchain
 * The user's identity remains active, but this wallet cannot transact
 */
exports.deactivateWalletOnChain = (0, https_1.onCall)({ secrets: ['ADMIN_WALLET_PRIVATE_KEY', 'RPC_URL'] }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    const { walletAddress } = request.data;
    const userId = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    if (!walletAddress || !ethers_1.ethers.isAddress(walletAddress)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid wallet address');
    }
    console.log('🔗 Deactivating wallet on blockchain:', { userId, walletAddress });
    try {
        // Verify wallet belongs to this user
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        if (!userData)
            throw new https_1.HttpsError('not-found', 'User profile not found');
        const linkedWallets = userData.onChainIdentity?.linkedWallets || [];
        const walletEntry = linkedWallets.find((w) => w.address.toLowerCase() === walletAddress.toLowerCase());
        if (!walletEntry) {
            throw new https_1.HttpsError('permission-denied', 'Wallet not linked to your account');
        }
        if (!walletEntry.isWalletActive) {
            return { success: true, message: 'Wallet already inactive' };
        }
        // Call smart contract
        const contract = getAdminContract();
        const tx = await contract.deactivateWallet(walletAddress);
        const receipt = await tx.wait();
        // Update Firestore - mark wallet as inactive
        const updatedWallets = linkedWallets.map((w) => w.address.toLowerCase() === walletAddress.toLowerCase()
            ? {
                ...w,
                isWalletActive: false,
                deactivatedAt: firestore_1.Timestamp.now(),
                deactivateTxHash: tx.hash,
            }
            : w);
        await db.collection('users').doc(userId).update({
            'onChainIdentity.linkedWallets': updatedWallets,
        });
        console.log('✅ Wallet deactivated:', tx.hash);
        return { success: true, txHash: tx.hash, blockNumber: receipt?.blockNumber };
    }
    catch (error) {
        console.error('❌ Wallet deactivation failed:', error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', error.message);
    }
});
/**
 * Reactivate a specific wallet on the blockchain
 */
exports.reactivateWalletOnChain = (0, https_1.onCall)({ secrets: ['ADMIN_WALLET_PRIVATE_KEY', 'RPC_URL'] }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    const { walletAddress } = request.data;
    const userId = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    if (!walletAddress || !ethers_1.ethers.isAddress(walletAddress)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid wallet address');
    }
    console.log('🔗 Reactivating wallet on blockchain:', { userId, walletAddress });
    try {
        // Verify wallet belongs to this user
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        if (!userData)
            throw new https_1.HttpsError('not-found', 'User profile not found');
        const linkedWallets = userData.onChainIdentity?.linkedWallets || [];
        const walletEntry = linkedWallets.find((w) => w.address.toLowerCase() === walletAddress.toLowerCase());
        if (!walletEntry) {
            throw new https_1.HttpsError('permission-denied', 'Wallet not linked to your account');
        }
        if (walletEntry.isWalletActive) {
            return { success: true, message: 'Wallet already active' };
        }
        // Call smart contract
        const contract = getAdminContract();
        const tx = await contract.reactivateWallet(walletAddress);
        const receipt = await tx.wait();
        // Update Firestore - mark wallet as active
        const updatedWallets = linkedWallets.map((w) => w.address.toLowerCase() === walletAddress.toLowerCase()
            ? {
                ...w,
                isWalletActive: true,
                reactivatedAt: firestore_1.Timestamp.now(),
                reactivateTxHash: tx.hash,
            }
            : w);
        await db.collection('users').doc(userId).update({
            'onChainIdentity.linkedWallets': updatedWallets,
        });
        console.log('✅ Wallet reactivated:', tx.hash);
        return { success: true, txHash: tx.hash, blockNumber: receipt?.blockNumber };
    }
    catch (error) {
        console.error('❌ Wallet reactivation failed:', error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', error.message);
    }
});
// ============================================================================
// RECORD INITIALIZATION
// ============================================================================
exports.initializeRoleOnChain = (0, https_1.onCall)({ secrets: ['ADMIN_WALLET_PRIVATE_KEY', 'RPC_URL'] }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    const { recordId, walletAddress, role } = request.data;
    const userId = request.auth.uid;
    if (!recordId || !ethers_1.ethers.isAddress(walletAddress)) {
        throw new https_1.HttpsError('invalid-argument', 'Missing recordId or walletAddress');
    }
    if (role !== 'administrator' && role !== 'owner') {
        throw new https_1.HttpsError('invalid-argument', 'Role must be "administrator" or "owner"');
    }
    const db = (0, firestore_1.getFirestore)();
    // 1. Fetch User and Record Data
    const [userDoc, recordDoc] = await Promise.all([
        db.collection('users').doc(userId).get(),
        db.collection('records').doc(recordId).get(),
    ]);
    const userData = userDoc.data();
    const recordData = recordDoc.data();
    if (!userData || !recordData)
        throw new https_1.HttpsError('not-found', 'Data not found');
    // 2. Validate multi-wallet ownership via our new array
    const linkedWallets = userData.onChainIdentity?.linkedWallets || [];
    const isAuthorized = linkedWallets.some((w) => w.address.toLowerCase() === walletAddress.toLowerCase() && w.isWalletActive);
    if (!isAuthorized) {
        throw new https_1.HttpsError('permission-denied', 'Wallet not linked or inactive');
    }
    if (recordData?.uploadedBy !== userId) {
        throw new https_1.HttpsError('permission-denied', 'Only the creator can initialize roles');
    }
    // 3. Authority Check
    try {
        const contract = getAdminContract();
        const owners = await contract.getRecordOwners(recordId);
        const admins = await contract.getRecordAdmins(recordId);
        if (owners.length > 0 || admins.length > 0) {
            // Self-heal Firestore if needed
            if (!recordData?.blockchainRoleInitialization?.blockchainInitialized) {
                await db.collection('records').doc(recordId).update({
                    'blockchainRoleInitialization.blockchainInitialized': true,
                    'blockchainRoleInitialization.syncedFromChain': true,
                });
            }
            throw new https_1.HttpsError('already-exists', 'Record already initialized on chain');
        }
        // 4. Execution
        const tx = await contract.initializeRecordRole(recordId, walletAddress, role);
        const receipt = await tx.wait();
        await db
            .collection('records')
            .doc(recordId)
            .update({
            blockchainRoleInitialization: {
                blockchainInitialized: true,
                blockchainInitializedAt: firestore_1.Timestamp.now(),
                blockchainInitTxHash: tx.hash,
                blockchainInitBlockNumber: receipt.blockNumber,
            },
        });
        return { success: true, txHash: tx.hash, blockNumber: receipt?.blockNumber };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', `Blockchain error: ${error.message}`);
    }
});
//# sourceMappingURL=memberRegistry.js.map