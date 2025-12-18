"use strict";
// functions/src/handlers/paymaster.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSponsorshipStatus = exports.signSponsorship = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const ethers_1 = require("ethers");
const params_1 = require("firebase-functions/params");
// ==================== SECRETS ====================
// Define secrets (set these with: firebase functions:secrets:set PAYMASTER_SIGNER_PRIVATE_KEY)
const paymasterSignerKey = (0, params_1.defineSecret)('PAYMASTER_SIGNER_PRIVATE_KEY');
// ==================== CONFIG ====================
// Your deployed paymaster contract address (update after deployment)
const PAYMASTER_CONTRACT_ADDRESS = process.env.PAYMASTER_CONTRACT_ADDRESS || '';
// Sepolia chain ID
const CHAIN_ID = 11155111;
// Rate limiting config
const DAILY_SPONSORED_LIMIT = 10; // Max sponsored txs per user per day
const SIGNATURE_VALIDITY_SECONDS = 300; // 5 minutes
// ==================== HELPER FUNCTIONS ====================
/**
 * Check and update rate limit for a user
 */
async function checkRateLimit(db, userId) {
    const rateLimitRef = db.collection('paymasterRateLimits').doc(userId);
    return db.runTransaction(async (transaction) => {
        const doc = await transaction.get(rateLimitRef);
        const now = new Date();
        if (!doc.exists) {
            // First request - create rate limit doc
            const resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            transaction.set(rateLimitRef, {
                count: 1,
                resetAt: resetAt,
            });
            return { allowed: true };
        }
        const data = doc.data();
        const resetAt = data.resetAt.toDate();
        if (now > resetAt) {
            // Reset period passed - reset counter
            const newResetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            transaction.update(rateLimitRef, {
                count: 1,
                resetAt: newResetAt,
            });
            return { allowed: true };
        }
        if (data.count >= DAILY_SPONSORED_LIMIT) {
            return {
                allowed: false,
                reason: `Daily limit reached (${DAILY_SPONSORED_LIMIT} transactions). Resets at ${resetAt.toISOString()}`,
            };
        }
        // Increment counter
        transaction.update(rateLimitRef, {
            count: data.count + 1,
        });
        return { allowed: true };
    });
}
/**
 * Build the paymasterAndData field for the UserOperation
 * Format: [paymaster(20)][validUntil(6)][validAfter(6)][signature(65)]
 */
async function buildPaymasterAndData(userOpHash, signerPrivateKey) {
    const now = Math.floor(Date.now() / 1000);
    const validAfter = now;
    const validUntil = now + SIGNATURE_VALIDITY_SECONDS;
    // Create signer
    const signer = new ethers_1.ethers.Wallet(signerPrivateKey);
    // Build hash that matches what the paymaster contract expects
    const hash = ethers_1.ethers.solidityPackedKeccak256(['bytes32', 'uint256', 'address', 'uint48', 'uint48'], [userOpHash, CHAIN_ID, PAYMASTER_CONTRACT_ADDRESS, validUntil, validAfter]);
    // Sign with EIP-191 prefix (what toEthSignedMessageHash does in Solidity)
    const signature = await signer.signMessage(ethers_1.ethers.getBytes(hash));
    // Pack paymasterAndData
    // Format: [paymaster(20)][validUntil(6)][validAfter(6)][signature(65)]
    const paymasterAndData = ethers_1.ethers.concat([
        PAYMASTER_CONTRACT_ADDRESS,
        ethers_1.ethers.zeroPadValue(ethers_1.ethers.toBeHex(validUntil), 6),
        ethers_1.ethers.zeroPadValue(ethers_1.ethers.toBeHex(validAfter), 6),
        signature,
    ]);
    return ethers_1.ethers.hexlify(paymasterAndData);
}
// ==================== MAIN HANDLER ====================
/**
 * Sign Sponsorship Request
 *
 * Called by frontend when a user wants to perform a gasless transaction.
 * Validates the user, checks rate limits, and returns a signed approval
 * that the paymaster contract will accept.
 *
 * Usage:
 *   const result = await httpsCallable(functions, 'signSponsorship')({
 *     userOpHash: '0x...',
 *     sender: '0x...'
 *   });
 */
exports.signSponsorship = (0, https_1.onCall)({
    secrets: [paymasterSignerKey],
    cors: true,
}, async (request) => {
    // 1. Verify authentication
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be logged in to request sponsorship');
    }
    const userId = request.auth.uid;
    const { userOpHash, sender } = request.data;
    // 2. Validate input
    if (!userOpHash || !sender) {
        throw new https_1.HttpsError('invalid-argument', 'Missing userOpHash or sender');
    }
    if (!userOpHash.startsWith('0x') || userOpHash.length !== 66) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid userOpHash format');
    }
    if (!sender.startsWith('0x') || sender.length !== 42) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid sender address format');
    }
    // 3. Check paymaster is configured
    if (!PAYMASTER_CONTRACT_ADDRESS) {
        console.error('PAYMASTER_CONTRACT_ADDRESS not configured');
        throw new https_1.HttpsError('internal', 'Paymaster not configured');
    }
    const signerKey = paymasterSignerKey.value();
    if (!signerKey) {
        console.error('PAYMASTER_SIGNER_PRIVATE_KEY secret not set');
        throw new https_1.HttpsError('internal', 'Paymaster signer not configured');
    }
    try {
        const db = (0, firestore_1.getFirestore)();
        // 4. Verify user exists and is verified
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return { sponsored: false, reason: 'User not found' };
        }
        const userData = userDoc.data();
        // Check email verification (adjust based on your user model)
        if (!(userData === null || userData === void 0 ? void 0 : userData.emailVerified) && !(userData === null || userData === void 0 ? void 0 : userData.verified)) {
            return { sponsored: false, reason: 'Email not verified' };
        }
        // 5. Check rate limits
        const rateLimitCheck = await checkRateLimit(db, userId);
        if (!rateLimitCheck.allowed) {
            return { sponsored: false, reason: rateLimitCheck.reason };
        }
        // 6. Build and sign paymasterAndData
        const paymasterAndData = await buildPaymasterAndData(userOpHash, signerKey);
        // 7. Log for analytics (optional)
        await db.collection('paymasterLogs').add({
            userId,
            sender,
            userOpHash,
            timestamp: new Date(),
            sponsored: true,
        });
        console.log(`✅ Sponsored transaction for user ${userId}, sender ${sender}`);
        return {
            sponsored: true,
            paymasterAndData,
        };
    }
    catch (error) {
        console.error('Sponsorship signing failed:', error);
        throw new https_1.HttpsError('internal', 'Failed to sign sponsorship');
    }
});
/**
 * Get Sponsorship Status
 *
 * Returns user's current rate limit status
 */
exports.getSponsorshipStatus = (0, https_1.onCall)({
    cors: true,
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be logged in');
    }
    const userId = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const rateLimitDoc = await db.collection('paymasterRateLimits').doc(userId).get();
    if (!rateLimitDoc.exists) {
        return {
            used: 0,
            limit: DAILY_SPONSORED_LIMIT,
            resetsAt: null,
        };
    }
    const data = rateLimitDoc.data();
    const now = new Date();
    const resetAt = data.resetAt.toDate();
    // If reset time has passed, they have full allowance
    if (now > resetAt) {
        return {
            used: 0,
            limit: DAILY_SPONSORED_LIMIT,
            resetsAt: null,
        };
    }
    return {
        used: data.count,
        limit: DAILY_SPONSORED_LIMIT,
        remaining: DAILY_SPONSORED_LIMIT - data.count,
        resetsAt: resetAt.toISOString(),
    };
});
//# sourceMappingURL=paymaster.js.map