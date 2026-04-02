"use strict";
// functions/src/handlers/redeemGuestInvite.ts
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
exports.redeemGuestInvite = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
exports.redeemGuestInvite = (0, https_1.onCall)(async (request) => {
    const { inviteCode } = request.data;
    if (!inviteCode || typeof inviteCode !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Invite code is required.');
    }
    const db = admin.firestore();
    // ── Find invite by code ──────────────────────────────────────────────────
    const inviteSnap = await db
        .collection('guestInvites')
        .where('inviteCode', '==', inviteCode)
        .where('status', '==', 'pending')
        .limit(1)
        .get();
    if (inviteSnap.empty) {
        throw new https_1.HttpsError('not-found', 'Invite not found or already used.');
    }
    const inviteDoc = inviteSnap.docs[0];
    const invite = inviteDoc.data();
    // ── Check expiry ─────────────────────────────────────────────────────────
    const now = new Date();
    const expiresAt = invite.expiresAt?.toDate();
    if (!expiresAt || expiresAt < now) {
        throw new https_1.HttpsError('failed-precondition', `This invite expired on ${expiresAt?.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }) ?? 'an unknown date'}.`);
    }
    // ── Mint a fresh custom token ────────────────────────────────────────────
    // Custom tokens expire in 1 hour — we mint fresh on each click so the
    // invite URL itself never expires, only the underlying guestInvites doc does.
    const customToken = await admin.auth().createCustomToken(invite.guestUserId, {
        isGuest: true,
    });
    console.log(`✅ Guest invite redeemed for: ${invite.guestUserId}`);
    return {
        customToken,
        guestUid: invite.guestUserId,
    };
});
//# sourceMappingURL=redeemGuestInvite.js.map