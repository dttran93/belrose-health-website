// functions/src/handlers/paymaster.ts

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { ethers } from 'ethers';
import { defineSecret } from 'firebase-functions/params';

// ==================== SECRETS ====================

// Define secrets (set these with: firebase functions:secrets:set PAYMASTER_SIGNER_PRIVATE_KEY)
const paymasterSignerKey = defineSecret('PAYMASTER_SIGNER_PRIVATE_KEY');

// ==================== CONFIG ====================

// Your deployed paymaster contract address (update after deployment)
const PAYMASTER_CONTRACT_ADDRESS = process.env.PAYMASTER_CONTRACT_ADDRESS;

// Sepolia chain ID
const CHAIN_ID = 11155111;

// Rate limiting config
const DAILY_SPONSORED_LIMIT = 100; // Max sponsored txs per user per day. Set high so we can test in dev. Change in future

// ==================== TYPES ====================

interface SponsorshipRequest {
  userOpHash: string; // Hash of the UserOperation
  sender: string; // Smart account address
  validUntil: number;
  validAfter: number;
}

interface SponsorshipResponse {
  sponsored: boolean;
  signature?: string;
  reason?: string;
}

interface RateLimitDoc {
  count: number;
  resetAt: FirebaseFirestore.Timestamp;
  lastUserOpHash: string;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Check and update rate limit for a user
 */
async function checkRateLimit(
  db: FirebaseFirestore.Firestore,
  userId: string,
  userOpHash: string
): Promise<{ allowed: boolean; reason?: string }> {
  const rateLimitRef = db.collection('paymasterRateLimits').doc(userId);

  return db.runTransaction(async transaction => {
    const doc = await transaction.get(rateLimitRef);
    const now = new Date();

    if (!doc.exists) {
      // First request - create rate limit doc
      const resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      transaction.set(rateLimitRef, {
        count: 1,
        resetAt: resetAt,
        lastUserOpHash: userOpHash,
      });
      return { allowed: true };
    }

    const data = doc.data() as RateLimitDoc;
    const resetAt = data.resetAt.toDate();

    if (now > resetAt) {
      // Reset period passed - reset counter
      const newResetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      transaction.update(rateLimitRef, {
        count: 1,
        resetAt: newResetAt,
        lastUserOpHash: userOpHash,
      });
      return { allowed: true };
    }

    //Check if its a repeated clal for the same UserOp (Simulation and then actual)
    if (data.lastUserOpHash === userOpHash) {
      console.log(
        `♻️ Repeat request for hash ${userOpHash.slice(0, 10)}... allowing without charge.`
      );
      return { allowed: true };
    }

    //3. Check hard limit
    if (data.count >= DAILY_SPONSORED_LIMIT) {
      return {
        allowed: false,
        reason: `Daily limit reached (${DAILY_SPONSORED_LIMIT} transactions). Resets at ${resetAt.toISOString()}`,
      };
    }

    // 4. Unique transaction - Increment counter
    transaction.update(rateLimitRef, {
      count: data.count + 1,
      lastUserOpHash: userOpHash,
    });
    return { allowed: true };
  });
}

/**
 * Build the signature for the paymaster
 * Format: [paymaster(20)][validUntil(6)][validAfter(6)][signature(65)]
 */
async function buildSignature(
  userOpHash: string,
  validUntil: number, //client provided to ensure hashes match
  validAfter: number, //client provided to ensure hashes match
  signerPrivateKey: string
): Promise<string> {
  // Create signer
  const signingKey = new ethers.SigningKey(signerPrivateKey);
  const abiCoder = new ethers.AbiCoder();

  //Check for contract Address
  if (!PAYMASTER_CONTRACT_ADDRESS) {
    throw new Error('Contract Address Missing');
  }

  // Matches Solidity: abi.encode(innerHash, chainId, address, until, after)
  const encodedData = abiCoder.encode(
    ['bytes32', 'uint256', 'address', 'uint48', 'uint48'],
    [
      userOpHash,
      BigInt(CHAIN_ID),
      ethers.getAddress(PAYMASTER_CONTRACT_ADDRESS),
      BigInt(validUntil),
      BigInt(validAfter),
    ]
  );

  const hashToSign = ethers.keccak256(encodedData);

  // --- DEBUGGING ---
  console.log('--- DEBUG SPONSORSHIP ---');
  console.log('UserOpHash:', userOpHash);
  console.log('ChainId:', CHAIN_ID);
  console.log('PaymasterAddr:', PAYMASTER_CONTRACT_ADDRESS);
  console.log('ValidUntil:', validUntil);
  console.log('ValidAfter:', validAfter);
  console.log('Final Hash to Sign:', hashToSign);
  console.log('RAW ENCODED DATA:', encodedData);

  const eip191Hash = ethers.hashMessage(ethers.getBytes(hashToSign));

  // 2. Sign the raw hash
  const signatureObj = signingKey.sign(eip191Hash);

  // Use the built-in serialized property to ensure
  // the hex string is perfectly formatted for Solidity
  const signature = signatureObj.serialized;

  console.log('--- SIGNATURE CHECK ---');
  console.log('Signature Length (chars):', signature.length); // Should be 132 (0x + 130)
  console.log('Full Signature Hex:', signature);

  return signature;
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
export const signSponsorship = onCall(
  {
    secrets: [paymasterSignerKey],
    cors: true,
  },
  async (request): Promise<SponsorshipResponse> => {
    // 1. Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in to request sponsorship');
    }

    const userId = request.auth.uid;
    const { userOpHash, sender, validUntil, validAfter } = request.data as SponsorshipRequest;

    // 2. Validate input
    if (!userOpHash || !sender) {
      throw new HttpsError('invalid-argument', 'Missing userOpHash or sender');
    }

    if (!userOpHash.startsWith('0x') || userOpHash.length !== 66) {
      throw new HttpsError('invalid-argument', 'Invalid userOpHash format');
    }

    if (!sender.startsWith('0x') || sender.length !== 42) {
      throw new HttpsError('invalid-argument', 'Invalid sender address format');
    }

    // 3. Check paymaster is configured
    if (!PAYMASTER_CONTRACT_ADDRESS) {
      console.error('PAYMASTER_CONTRACT_ADDRESS not configured');
      throw new HttpsError('internal', 'Paymaster not configured');
    }

    const signerKey = paymasterSignerKey.value();
    if (!signerKey) {
      console.error('PAYMASTER_SIGNER_PRIVATE_KEY secret not set');
      throw new HttpsError('internal', 'Paymaster signer not configured');
    }

    try {
      const db = getFirestore();

      // 4. Verify user exists and is verified
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        return { sponsored: false, reason: 'User not found' };
      }

      const userData = userDoc.data();

      // Check email verification (adjust based on your user model)
      if (!userData?.emailVerified && !userData?.verified) {
        return { sponsored: false, reason: 'Email not verified' };
      }

      // 5. Check rate limits
      const rateLimitCheck = await checkRateLimit(db, userId, userOpHash);

      if (!rateLimitCheck.allowed) {
        return { sponsored: false, reason: rateLimitCheck.reason };
      }

      // 6. Build signature
      const signature = await buildSignature(userOpHash, validUntil, validAfter, signerKey);

      // 7. Log for analytics (optional)
      await db.collection('paymasterLogs').add({
        userId,
        sender,
        userOpHash,
        validUntil,
        validAfter,
        timestamp: new Date(),
        sponsored: true,
      });

      console.log(`✅ Sponsored transaction for user ${userId}, sender ${sender}`);

      return {
        sponsored: true,
        signature,
      };
    } catch (error) {
      console.error('Sponsorship signing failed:', error);
      throw new HttpsError('internal', 'Failed to sign sponsorship');
    }
  }
);

/**
 * Get Sponsorship Status - Returns user's current rate limit status
 */
export const getSponsorshipStatus = onCall(
  {
    cors: true,
  },
  async request => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const userId = request.auth.uid;
    const db = getFirestore();

    const rateLimitDoc = await db.collection('paymasterRateLimits').doc(userId).get();

    if (!rateLimitDoc.exists) {
      return {
        used: 0,
        limit: DAILY_SPONSORED_LIMIT,
        resetsAt: null,
      };
    }

    const data = rateLimitDoc.data() as RateLimitDoc;
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
  }
);
