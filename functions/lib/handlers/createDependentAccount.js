"use strict";
// functions/src/handlers/createDependentAccount.ts
// Creates a dependent account on behalf of a guardian.
// Client generates all crypto material; this CF handles the identity operations
// that require Admin SDK: Firebase Auth user creation, Firestore writes to another
// user's document, blockchain registration with the admin wallet, and the active
// trustee relationship (which Firestore rules require to start as 'pending' from
// the client — bypassed here because the guardian is the one giving consent).
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDependentAccount = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const ethers_1 = require("ethers");
const _shared_1 = require("../_shared/");
const backendWalletService_1 = require("../services/backendWalletService");
const wallet_1 = require("./wallet");
const MEMBER_ROLE_MANAGER_ADDRESS = _shared_1.MEMBER_ROLE_MANAGER.proxy;
const CHAIN_ID = _shared_1.NETWORK.chainId;
const MEMBER_ROLE_MANAGER_ABI = [
    'function addMemberBatch(address[] calldata walletAddresses, bytes32 userIdHash) external',
];
function getAdminWallet() {
    const privateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;
    const rpcUrl = process.env.RPC_URL || _shared_1.NETWORK.rpcUrlFallback;
    if (!privateKey)
        throw new Error('Admin wallet private key not found');
    const provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
    return new ethers_1.ethers.Wallet(privateKey, provider);
}
exports.createDependentAccount = (0, https_1.onCall)({ secrets: ['ADMIN_WALLET_PRIVATE_KEY', 'RPC_URL'] }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Guardian must be authenticated');
    const guardianUid = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    // Dependents cannot create other dependents
    const guardianDoc = await db.collection('users').doc(guardianUid).get();
    if (!guardianDoc.exists)
        throw new https_1.HttpsError('not-found', 'Guardian profile not found');
    if (guardianDoc.data()?.isDependent) {
        throw new https_1.HttpsError('permission-denied', 'Dependent accounts cannot create other accounts');
    }
    const { email, password, firstName, lastName, encryptedMasterKey, masterKeyIV, masterKeySalt, publicKey, encryptedPrivateKey, encryptedPrivateKeyIV, recoveryKeyHash, masterKeyHex, } = request.data;
    if (!email || !password || !firstName || !lastName ||
        !encryptedMasterKey || !masterKeyIV || !masterKeySalt ||
        !publicKey || !encryptedPrivateKey || !encryptedPrivateKeyIV ||
        !recoveryKeyHash || !masterKeyHex) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    // ── Step 1: Create Firebase Auth user ─────────────────────────────────────
    const isPlaceholder = email.endsWith('@placeholder.belrose.health');
    let dependentUid;
    try {
        const displayName = `${firstName} ${lastName}`.trim();
        const authUser = await admin.auth().createUser({ email, password, displayName, emailVerified: isPlaceholder });
        dependentUid = authUser.uid;
        console.log('✅ Firebase Auth user created:', dependentUid);
    }
    catch (err) {
        if (err.code === 'auth/email-already-exists') {
            throw new https_1.HttpsError('already-exists', 'An account with this email already exists');
        }
        console.error('❌ Firebase Auth user creation failed:', err);
        throw new https_1.HttpsError('internal', 'Failed to create account');
    }
    const dependentRef = db.collection('users').doc(dependentUid);
    const now = firestore_1.Timestamp.now();
    try {
        // ── Step 2: Create Firestore user document ─────────────────────────────
        const displayName = `${firstName} ${lastName}`.trim();
        await dependentRef.set({
            uid: dependentUid,
            email,
            emailVerified: isPlaceholder,
            displayName,
            displayNameLower: displayName.toLowerCase(),
            firstName,
            lastName,
            isDependent: true,
            dependentCreatedBy: guardianUid,
            identityVerified: false,
            createdAt: now,
            updatedAt: now,
            encryption: {
                enabled: true,
                encryptedMasterKey,
                masterKeyIV,
                masterKeySalt,
                encryptedPrivateKey,
                encryptedPrivateKeyIV,
                publicKey,
                recoveryKeyHash,
                setupAt: now.toDate().toISOString(),
            },
        });
        console.log('✅ Firestore user document created');
        // ── Step 3: Wallet generation + on-chain registration ──────────────────
        // Mirrors registerMemberOnChainComplete but uses dependentUid rather than
        // request.auth.uid (guardian is the caller; dependent has no active session).
        console.log('🔐 Generating EOA wallet...');
        const wallet = (0, backendWalletService_1.generateWallet)();
        console.log('🧮 Computing smart account address...');
        const smartAccountAddress = await (0, wallet_1.computeSmartAccountAddress)(wallet.privateKey);
        console.log('⛓️ Registering both wallets on-chain...');
        const userIdHash = ethers_1.ethers.id(dependentUid);
        const contract = new ethers_1.ethers.Contract(MEMBER_ROLE_MANAGER_ADDRESS, MEMBER_ROLE_MANAGER_ABI, getAdminWallet());
        const tx = await contract.addMemberBatch([wallet.address, smartAccountAddress], userIdHash);
        const receipt = await tx.wait();
        const blockchainRef = {
            txHash: tx.hash,
            chainId: CHAIN_ID,
            blockNumber: receipt.blockNumber,
            contractAddress: MEMBER_ROLE_MANAGER_ADDRESS,
        };
        console.log('✅ Both wallets registered on-chain:', tx.hash);
        const encryptedWallet = (0, backendWalletService_1.encryptPrivateKey)(wallet.privateKey, masterKeyHex);
        const encryptedMnemonic = (0, backendWalletService_1.encryptPrivateKey)(wallet.mnemonic || '', masterKeyHex);
        await dependentRef.update({
            wallet: {
                address: wallet.address.toLowerCase(),
                smartAccountAddress: smartAccountAddress.toLowerCase(),
                origin: 'generated',
                encryptedPrivateKey: encryptedWallet.encryptedKey,
                encryptedPrivateKeyIV: encryptedWallet.iv,
                keyAuthTag: encryptedWallet.authTag,
                keySalt: encryptedWallet.salt,
                encryptedMnemonic: encryptedMnemonic.encryptedKey,
                mnemonicIv: encryptedMnemonic.iv,
                mnemonicAuthTag: encryptedMnemonic.authTag,
                mnemonicSalt: encryptedMnemonic.salt,
            },
            onChainIdentity: {
                userIdHash,
                status: 'Active',
                linkedWallets: [
                    { address: wallet.address.toLowerCase(), type: 'eoa', isWalletActive: true, registeredAt: now, blockchainRef },
                    { address: smartAccountAddress.toLowerCase(), type: 'smartAccount', isWalletActive: true, registeredAt: now, blockchainRef },
                ],
                registeredAt: now,
                blockchainRef,
            },
        });
        console.log('✅ Wallet data saved to Firestore');
        // ── Step 4: Active controller trustee relationship ─────────────────────
        // trustorId = dependent (account owner), trusteeId = guardian (account manager).
        // Written via Admin SDK to bypass the client Firestore rule that requires
        // new relationships to start as status:'pending' / isActive:false.
        const relationshipId = `${dependentUid}_${guardianUid}`;
        await db.collection('trusteeRelationships').doc(relationshipId).set({
            trustorId: dependentUid,
            trusteeId: guardianUid,
            trustLevel: 'controller',
            isActive: true,
            status: 'active',
            isDependentRelationship: true,
            createdAt: now,
            respondedAt: now,
            revokedAt: null,
            revokedBy: null,
            statusUpdateReason: null,
            inviteBlockchainRef: null,
            acceptBlockchainRef: null,
            revocationBlockchainRef: null,
            editBlockchainRef: null,
        });
        console.log('✅ Controller trustee relationship created');
        return { uid: dependentUid, walletAddress: wallet.address, smartAccountAddress };
    }
    catch (err) {
        // Best-effort cleanup: remove the Auth user so we don't leave orphaned accounts
        console.error('❌ Dependent account setup failed, cleaning up Auth user:', err);
        try {
            await admin.auth().deleteUser(dependentUid);
        }
        catch (cleanupErr) {
            console.error('❌ Cleanup failed — Auth user may be orphaned:', cleanupErr);
        }
        throw new https_1.HttpsError('internal', 'Failed to set up dependent account');
    }
});
//# sourceMappingURL=createDependentAccount.js.map