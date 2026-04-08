"use strict";
// functions/src/utils/guestAccountUtils.ts
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
exports.generateRsaKeyPair = generateRsaKeyPair;
exports.createOrRetrieveGuestAccount = createOrRetrieveGuestAccount;
exports.writeGuestInviteDoc = writeGuestInviteDoc;
/**
 * Shared utilities for creating guest accounts.
 *
 * Used by both:
 *   - createGuestInvite  (patient sharing records outward)
 *   - createRecordRequest (patient requesting records inward)
 *
 * Both flows create the same infrastructure: a Firebase Auth guest account,
 * an RSA key pair, a mock wallet, and a guestInvites doc. The only differences
 * are the email template and which Firestore collection tracks the business intent.
 */
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const ethers_1 = require("ethers");
// ── RSA key pair generation ───────────────────────────────────────────────────
/**
 * Generate an RSA-OAEP 2048-bit key pair using Node crypto.
 * Returns keys in base64-encoded SPKI (public) and PKCS8 (private) DER format —
 * the same format the frontend SharingKeyManagementService expects.
 */
function generateRsaKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    });
    return {
        publicKeyBase64: publicKey.toString('base64'),
        privateKeyBase64: privateKey.toString('base64'),
    };
}
// ── Guest account creation ────────────────────────────────────────────────────
/**
 * Create or retrieve a guest Firebase Auth account for the given email.
 * Generates a fresh RSA key pair and writes/updates the user profile in Firestore.
 *
 * Keys are always regenerated on each call so each invite link has a fresh key.
 * If the provider later registers a real account, GuestClaimAccountModal
 * overwrites the key pair with a proper one derived from their password.
 */
async function createOrRetrieveGuestAccount(email) {
    const db = admin.firestore();
    // ── Create or reuse Firebase Auth account ──────────────────────────────────
    let guestUid;
    let isNewGuest = false;
    try {
        const existingUser = await admin.auth().getUserByEmail(email);
        guestUid = existingUser.uid;
        console.log(`ℹ️  Reusing existing guest account for ${email}: ${guestUid}`);
    }
    catch (err) {
        if (err.code !== 'auth/user-not-found') {
            throw new Error(`Failed to check for existing user: ${err.message}`);
        }
        isNewGuest = true;
        const newUser = await admin.auth().createUser({
            email,
            emailVerified: true, // clicking the link confirms the address is valid
            displayName: email,
        });
        guestUid = newUser.uid;
        console.log(`✅ Created guest Firebase Auth account: ${guestUid}`);
    }
    // ── Generate RSA key pair ──────────────────────────────────────────────────
    const { publicKeyBase64, privateKeyBase64 } = generateRsaKeyPair();
    // ── Derive deterministic on-chain identity from UID ───────────────────────
    const guestIdHash = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(guestUid));
    const guestWallet = ethers_1.ethers.getAddress('0x' + ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(`guest:${guestUid}`)).slice(-40));
    // ── Write/update Firestore user profile ───────────────────────────────────
    // Minimal profile that SharingKeyManagementService needs —
    // specifically encryption.publicKey for wrapping file keys.
    const guestProfile = {
        uid: guestUid,
        email,
        displayName: email,
        emailVerified: true,
        isGuest: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(isNewGuest && { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
        encryption: {
            publicKey: publicKeyBase64,
        },
        onChainIdentity: {
            userIdHash: guestIdHash,
            status: 'Active',
            linkedWallets: [
                {
                    address: guestWallet,
                    type: 'eoa',
                    txHash: '',
                    blockNumber: 0,
                    linkedAt: new Date(),
                    isWalletActive: true,
                },
            ],
        },
    };
    await db.collection('users').doc(guestUid).set(guestProfile, { merge: true });
    console.log(`✅ Guest user profile written to Firestore: ${guestUid}`);
    return {
        guestUid,
        publicKeyBase64,
        privateKeyBase64,
        isNewGuest,
        guestIdHash,
        guestWallet,
    };
}
// ── Guest invite document ─────────────────────────────────────────────────────
/**
 * Write a guestInvites document.
 * Called by both createGuestInvite (sharing) and createRecordRequest (requesting).
 *
 * redeemGuestInvite reads from this collection to validate the code and
 * mint a custom token — so both flows get the same redemption mechanism.
 */
async function writeGuestInviteDoc(params) {
    const db = admin.firestore();
    const durationSeconds = params.durationSeconds ?? 30 * 24 * 60 * 60; // 30 days default for requests
    const expiresAt = new Date(Date.now() + durationSeconds * 1000);
    const inviteCode = crypto.randomBytes(32).toString('hex');
    await db.collection('guestInvites').add({
        guestUserId: params.guestUid,
        invitedBy: params.invitedBy,
        guestEmail: params.guestEmail,
        recordIds: params.recordIds,
        status: 'pending',
        context: params.context ?? 'sharing',
        ...(params.recordRequestId && { recordRequestId: params.recordRequestId }),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        isNewGuest: params.isNewGuest,
        guestIdHash: params.guestIdHash,
        guestWallet: params.guestWallet,
        inviteCode,
    });
    console.log(`✅ guestInvites document created (context: ${params.context ?? 'sharing'})`);
    return { inviteCode, expiresAt };
}
//# sourceMappingURL=guestAccountUtils.js.map