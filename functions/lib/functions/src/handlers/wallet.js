"use strict";
// functions/src/handlers/wallet.ts
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
exports.getEncryptedWallet = exports.createWallet = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const backendWalletService_1 = require("../services/backendWalletService");
// ==================== CREATE WALLET HANDLER ====================
/**
 * Create Wallet Function
 * Creates a new blockchain wallet for a user
 */
exports.createWallet = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    // Validate HTTP method
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        // Extract and validate request body
        const { userId, masterKeyHex } = req.body;
        if (!userId) {
            res.status(400).json({
                error: 'Missing required fields',
                details: 'userId is required',
            });
            return;
        }
        console.log('💼 Creating wallet for user:', userId);
        // Authenticate the user
        const authenticatedUserId = await authenticateUser(req, userId);
        if (!authenticatedUserId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        // Verify user IDs match (prevent users from creating wallets for others)
        if (authenticatedUserId !== userId) {
            res.status(403).json({
                error: 'Forbidden',
                details: 'Cannot create wallet for another user',
            });
            return;
        }
        // Check if user exists and doesn't already have a wallet
        const db = (0, firestore_1.getFirestore)();
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const userData = userDoc.data();
        if (userData?.wallet?.address) {
            res.status(400).json({
                error: 'Wallet already exists',
                details: 'User already has a wallet linked to their account',
            });
            return;
        }
        // Validate master key
        if (!masterKeyHex) {
            res.status(400).json({
                error: 'Missing encryption key',
                details: 'Master key is required to encrypt wallet',
            });
            return;
        }
        // Generate the wallet
        console.log('🔐 Generating wallet...');
        const wallet = (0, backendWalletService_1.generateWallet)();
        console.log('✅ Generated wallet address:', wallet.address);
        console.log('🔑 Using master key for wallet encryption...');
        // Encrypt the private key and mnemonic
        const encryptedData = (0, backendWalletService_1.encryptPrivateKey)(wallet.privateKey, masterKeyHex);
        const encryptedMnemonic = (0, backendWalletService_1.encryptPrivateKey)(wallet.mnemonic || '', masterKeyHex);
        const walletData = {
            address: wallet.address.toLowerCase(),
            origin: 'generated',
            //Encrypted private key data
            encryptedPrivateKey: encryptedData.encryptedKey,
            keyIv: encryptedData.iv,
            keyAuthTag: encryptedData.authTag,
            keySalt: encryptedData.salt,
            //Encrypted Mnemonic Data
            encryptedMnemonic: encryptedMnemonic.encryptedKey,
            mnemonicIv: encryptedMnemonic.iv,
            mnemonicAuthTag: encryptedMnemonic.authTag,
            mnemonicSalt: encryptedMnemonic.salt,
        };
        // Save encrypted wallet to database
        await userRef.update({
            wallet: walletData,
        });
        console.log('✅ Wallet saved for user:', userId);
        // Return success response
        const response = {
            success: true,
            walletAddress: wallet.address,
            message: 'Wallet created successfully',
        };
        res.status(201).json(response);
    }
    catch (error) {
        console.error('❌ Wallet creation error:', error);
        handleWalletError(res, error, 'create');
    }
});
// ==================== GET WALLET HANDLER ====================
/**
 * Get Encrypted Wallet Function
 * Retrieves the encrypted wallet data for a user
 */
exports.getEncryptedWallet = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    // Validate HTTP method
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        console.log('💼 Fetching encrypted wallet...');
        // Authenticate the user
        const userId = await authenticateUser(req);
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        // Get user's wallet from database
        const db = (0, firestore_1.getFirestore)();
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const userData = userDoc.data();
        const wallet = userData?.wallet;
        if (!wallet) {
            res.status(404).json({
                error: 'Wallet not found',
                details: 'No generated wallet found for this user',
            });
            return;
        }
        // Only return encrypted data if this is a generated wallet
        if (wallet.origin !== 'generated' || !wallet.encryptedPrivateKey) {
            res.status(400).json({
                error: 'Not a generated wallet',
                details: 'This wallet was connected externally. Private key is not stored.',
            });
            return;
        }
        // Validate all required fields exist
        if (!wallet.encryptedPrivateKey || !wallet.keyIv || !wallet.keyAuthTag || !wallet.keySalt) {
            console.error('❌ Generated wallet missing encryption fields:', userId);
            res.status(500).json({
                error: 'Wallet data corrupted',
                details: 'Generated wallet is missing encryption data. Please contact support.',
            });
            return;
        }
        console.log('✅ Wallet found for user:', userId);
        // Return wallet data (encrypted)
        const response = {
            walletAddress: wallet.address,
            encryptedPrivateKey: wallet.encryptedPrivateKey,
            iv: wallet.keyIv,
            authTag: wallet.keyAuthTag,
            salt: wallet.keySalt,
            walletType: wallet.origin,
        };
        res.json(response);
    }
    catch (error) {
        console.error('❌ Error fetching wallet:', error);
        handleWalletError(res, error, 'fetch');
    }
});
// ==================== HELPER FUNCTIONS ====================
/**
 * Authenticate user from Authorization header
 * Returns userId if authenticated, null otherwise
 */
async function authenticateUser(req, expectedUserId) {
    try {
        // Check for Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            console.error('❌ Missing or invalid Authorization header');
            return null;
        }
        // Extract and verify token
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userId = decodedToken.uid;
        console.log('✅ User authenticated:', userId);
        return userId;
    }
    catch (error) {
        console.error('❌ Authentication failed:', error);
        return null;
    }
}
/**
 * Handle wallet-related errors with appropriate responses
 */
function handleWalletError(res, error, operation) {
    const operationText = operation === 'create' ? 'create' : 'fetch';
    // Handle specific error types
    if (error.code === 'permission-denied') {
        res.status(403).json({
            error: 'Permission denied',
            details: `You don't have permission to ${operationText} this wallet`,
        });
        return;
    }
    if (error.code === 'unauthenticated') {
        res.status(401).json({
            error: 'Unauthenticated',
            details: 'Please log in to access wallet functions',
        });
        return;
    }
    // Handle crypto/encryption errors
    if (error.message?.includes('encrypt') || error.message?.includes('crypto')) {
        res.status(500).json({
            error: 'Encryption error',
            details: `Failed to ${operationText} wallet due to encryption error`,
        });
        return;
    }
    // Handle database errors
    if (error.message?.includes('Firestore') || error.message?.includes('database')) {
        res.status(500).json({
            error: 'Database error',
            details: `Failed to ${operationText} wallet in database`,
        });
        return;
    }
    // Generic error
    res.status(500).json({
        error: `Failed to ${operationText} wallet`,
        message: error.message || 'Unknown error occurred',
    });
}
//# sourceMappingURL=wallet.js.map