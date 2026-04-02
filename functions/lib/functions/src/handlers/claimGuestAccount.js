"use strict";
// functions/src/handlers/claimGuestAccount.ts
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
exports.claimGuestAccount = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
exports.claimGuestAccount = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in.');
    }
    const guestUid = request.auth.uid;
    const db = admin.firestore();
    // ── Verify this is actually a guest account ──────────────────────────────
    const userDoc = await db.collection('users').doc(guestUid).get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError('not-found', 'User profile not found.');
    }
    const userData = userDoc.data();
    if (!userData.isGuest) {
        throw new https_1.HttpsError('failed-precondition', 'This account has already been claimed.');
    }
    const { displayName, firstName, lastName, encryptedMasterKey, masterKeyIV, masterKeySalt, recoveryKeyHash, publicKey, encryptedPrivateKey, encryptedPrivateKeyIV, reWrappedKeys, } = request.data;
    const batch = db.batch();
    // ── Re-wrap wrappedKeys docs ─────────────────────────────────────────────
    // Each entry is { docId: newAES-wrappedKey }
    // isCreator stays FALSE — these are still shared records, not owned ones.
    // The creator path (isCreator: true) is only for records the user uploads themselves.
    for (const [docId, newWrappedKey] of Object.entries(reWrappedKeys)) {
        const wrappedKeyRef = db.collection('wrappedKeys').doc(docId);
        batch.update(wrappedKeyRef, {
            wrappedKey: newWrappedKey,
            isCreator: false,
            isGuest: false,
            expiresAt: admin.firestore.FieldValue.delete(),
            claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    // ── Update user profile to full account ──────────────────────────────────
    const userRef = db.collection('users').doc(guestUid);
    batch.update(userRef, {
        displayName,
        displayNameLower: displayName.toLowerCase(),
        firstName,
        lastName,
        isGuest: false,
        emailVerified: true, // ← already verified by clicking the invite link
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        identityVerified: false, // ← needs to go through Persona flow separately
        identityVerifiedAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        encryption: {
            enabled: true,
            encryptedMasterKey,
            masterKeyIV,
            masterKeySalt,
            recoveryKeyHash,
            publicKey,
            encryptedPrivateKey,
            encryptedPrivateKeyIV,
            setupAt: new Date().toISOString(),
        },
    });
    // ── Mark all pending guestInvites as accepted ────────────────────────────
    const inviteSnap = await db
        .collection('guestInvites')
        .where('guestUserId', '==', guestUid)
        .where('status', '==', 'pending')
        .get();
    inviteSnap.docs.forEach(inviteDoc => {
        batch.update(inviteDoc.ref, {
            status: 'accepted',
            claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    await batch.commit();
    console.log(`✅ Guest account claimed: ${guestUid}`);
    return { success: true };
});
//# sourceMappingURL=claimGuestAccount.js.map