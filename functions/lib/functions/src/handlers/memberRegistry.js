"use strict";
// functions/src/handlers/memberRegistry.ts
// Backend function to register members on blockchain using admin wallet
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeRecordOnChain = exports.updateMemberStatus = exports.registerMemberOnChain = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const ethers_1 = require("ethers");
const MEMBER_ROLE_MANAGER_ADDRESS = '0xD671B0cB1cB10330d9Ed05dC1D1F6E63802Cf4A9';
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
            { internalType: 'address', name: 'firstAdmin', type: 'address' },
        ],
        name: 'initializeRecordRole',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
];
// Member status enum
var MemberStatus;
(function (MemberStatus) {
    MemberStatus[MemberStatus["Inactive"] = 0] = "Inactive";
    MemberStatus[MemberStatus["Active"] = 1] = "Active";
    MemberStatus[MemberStatus["Verified"] = 2] = "Verified";
})(MemberStatus || (MemberStatus = {}));
/**
 * Get admin wallet from environment
 */
function getAdminWallet() {
    const privateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('Admin wallet private key not configured');
    }
    const provider = new ethers_1.ethers.JsonRpcProvider(process.env.RPC_URL || 'https://1rpc.io/sepolia');
    return new ethers_1.ethers.Wallet(privateKey, provider);
}
/**
 * Get contract instance with admin signer
 */
function getAdminContract() {
    const wallet = getAdminWallet();
    return new ethers_1.ethers.Contract(MEMBER_ROLE_MANAGER_ADDRESS, MEMBER_ROLE_MANAGER_ABI, wallet);
}
/**
 * Register a new member on the blockchain
 * Called after user completes registration
 */
exports.registerMemberOnChain = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    // Verify user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { walletAddress } = request.data;
    const userId = request.auth.uid;
    // Validate wallet address
    if (!walletAddress || !ethers_1.ethers.isAddress(walletAddress)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid wallet address');
    }
    console.log('🔗 Registering member on blockchain:', { userId, walletAddress });
    try {
        // Create userIdHash from Firebase UID
        const userIdHash = ethers_1.ethers.id(userId); // keccak256 hash of the userId
        // Get admin contract
        const contract = getAdminContract();
        // Call addMember
        console.log('📝 Calling addMember...');
        const tx = await contract.addMember(walletAddress, userIdHash);
        console.log('⏳ Transaction sent:', tx.hash);
        // Wait for confirmation
        const receipt = await tx.wait();
        console.log('✅ Member registered on blockchain, block:', receipt === null || receipt === void 0 ? void 0 : receipt.blockNumber);
        // Update Firestore with blockchain registration info
        const db = (0, firestore_1.getFirestore)();
        await db
            .collection('users')
            .doc(userId)
            .update({
            blockchainMember: {
                registered: true,
                walletAddress: walletAddress,
                userIdHash: userIdHash,
                txHash: tx.hash,
                blockNumber: receipt === null || receipt === void 0 ? void 0 : receipt.blockNumber,
                registeredAt: new Date().toISOString(),
                status: 'Active',
            },
        });
        return {
            success: true,
            txHash: tx.hash,
            blockNumber: receipt === null || receipt === void 0 ? void 0 : receipt.blockNumber,
        };
    }
    catch (error) {
        console.error('❌ Failed to register member on blockchain:', error);
        // Handle specific errors
        if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Already a member')) {
            throw new https_1.HttpsError('already-exists', 'User is already registered on blockchain');
        }
        if ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('User ID already registered')) {
            throw new https_1.HttpsError('already-exists', 'User ID is already registered');
        }
        throw new https_1.HttpsError('internal', `Blockchain registration failed: ${error.message}`);
    }
});
/**
 * Update member status (e.g., after identity verification)
 * Called by backend after Persona verification completes
 */
exports.updateMemberStatus = (0, https_1.onCall)(async (request) => {
    // This should only be called by admin/backend processes
    // In production, add additional security checks
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { walletAddress, status } = request.data;
    // Validate inputs
    if (!walletAddress || !ethers_1.ethers.isAddress(walletAddress)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid wallet address');
    }
    if (status === undefined || ![0, 1, 2].includes(status)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid status. Must be 0 (Inactive), 1 (Active), or 2 (Verified)');
    }
    console.log('🔗 Updating member status on blockchain:', { walletAddress, status });
    try {
        const contract = getAdminContract();
        const tx = await contract.setMemberStatus(walletAddress, status);
        console.log('⏳ Transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('✅ Member status updated, block:', receipt === null || receipt === void 0 ? void 0 : receipt.blockNumber);
        return {
            success: true,
            txHash: tx.hash,
            blockNumber: receipt === null || receipt === void 0 ? void 0 : receipt.blockNumber,
        };
    }
    catch (error) {
        console.error('❌ Failed to update member status:', error);
        throw new https_1.HttpsError('internal', `Status update failed: ${error.message}`);
    }
});
/**
 * Initialize a record with its first administrator
 * Called when a new record is created
 */
exports.initializeRecordOnChain = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { recordId, adminWalletAddress } = request.data;
    // Validate inputs
    if (!recordId || typeof recordId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Invalid record ID');
    }
    if (!adminWalletAddress || !ethers_1.ethers.isAddress(adminWalletAddress)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid admin wallet address');
    }
    console.log('🔗 Initializing record role on blockchain:', { recordId, adminWalletAddress });
    try {
        const contract = getAdminContract();
        const tx = await contract.initializeRecordRole(recordId, adminWalletAddress);
        console.log('⏳ Transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('✅ Record role initialized, block:', receipt === null || receipt === void 0 ? void 0 : receipt.blockNumber);
        return {
            success: true,
            txHash: tx.hash,
            blockNumber: receipt === null || receipt === void 0 ? void 0 : receipt.blockNumber,
        };
    }
    catch (error) {
        console.error('❌ Failed to initialize record role:', error);
        if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Record already initialized')) {
            throw new https_1.HttpsError('already-exists', 'Record already has roles assigned');
        }
        throw new https_1.HttpsError('internal', `Record initialization failed: ${error.message}`);
    }
});
//# sourceMappingURL=memberRegistry.js.map