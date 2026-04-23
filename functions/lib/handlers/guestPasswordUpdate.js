"use strict";
// functions/src/handlers/guestPasswordUpdate.ts
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
exports.guestPasswordUpdate = void 0;
/**
 * Guest password update function. Important because the guest password only updates after 5 minutes by default
 * to prevent abuse. This allows guests to set their password in the guest flow, even if it takes longer than 5 minutes (which it usually does)
 */
const https_1 = require("firebase-functions/https");
const admin = __importStar(require("firebase-admin"));
exports.guestPasswordUpdate = (0, https_1.onCall)(async (request) => {
    const { newPassword } = request.data;
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Not signed in');
    if (!newPassword || newPassword.length < 8) {
        throw new https_1.HttpsError('invalid-argument', 'Password must be at least 8 characters');
    }
    // Verify it's actually a guest account before allowing password set
    const inviteSnap = await admin
        .firestore()
        .collection('guestInvites')
        .where('guestUserId', '==', uid)
        .where('status', '==', 'pending')
        .limit(1)
        .get();
    if (inviteSnap.empty) {
        throw new https_1.HttpsError('permission-denied', 'Not an active guest account');
    }
    await admin.auth().updateUser(uid, { password: newPassword });
    // Return a fresh token so client can re-authenticate immediately
    const customToken = await admin.auth().createCustomToken(uid);
    return { success: true, customToken };
});
//# sourceMappingURL=guestPasswordUpdate.js.map