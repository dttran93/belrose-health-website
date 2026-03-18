"use strict";
/**
 * functions/src/getKeyBundle.ts
 *
 * Cloud Function: getKeyBundle
 *
 * Fetches a user's public Signal key bundle and atomically consumes
 * one one-time prekey (OPK) in a Firestore transaction.
 *
 * Why a Cloud Function instead of a direct Firestore read?
 *
 *   OPK consumption must be atomic — if two people message Bob simultaneously
 *   and both read his OPK list at the same time, they could grab the same OPK
 *   before either deletes it. That would give both sessions the same DH4 secret,
 *   undermining the per-session uniqueness that OPKs provide.
 *
 *   A Firestore transaction (runTransaction) guarantees that the read-and-delete
 *   is a single atomic operation. This cannot be done safely from the client.
 *
 * Security note:
 *   This function only returns PUBLIC key material.
 *   Private keys never leave the user's device (IndexedDB).
 *   Calling this function as an authenticated user is safe — you need
 *   someone's public keys to message them, and this is by design.
 */
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
exports.getKeyBundle = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// ---------------------------------------------------------------------------
// Cloud Function
// ---------------------------------------------------------------------------
exports.getKeyBundle = (0, https_1.onCall)(async (request) => {
    // -- Auth guard ----------------------------------------------------------
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated to fetch key bundles.');
    }
    const { targetUserId } = request.data;
    if (!targetUserId || typeof targetUserId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'targetUserId is required.');
    }
    const bundleRef = db
        .collection('users')
        .doc(targetUserId)
        .collection('signal')
        .doc('keyBundle');
    let consumedOPK;
    let bundleData;
    // -- Atomic OPK consumption ----------------------------------------------
    // runTransaction guarantees no two callers consume the same OPK.
    // Firestore retries automatically on contention (up to 5 times).
    try {
        await db.runTransaction(async (tx) => {
            const snapshot = await tx.get(bundleRef);
            if (!snapshot.exists) {
                throw new https_1.HttpsError('not-found', `No key bundle found for user ${targetUserId}. ` +
                    'They may not have completed Signal registration.');
            }
            bundleData = snapshot.data();
            const preKeys = [...bundleData.oneTimePreKeys]; // copy — don't mutate snapshot
            if (preKeys.length > 0) {
                consumedOPK = preKeys.pop();
                tx.update(bundleRef, { oneTimePreKeys: preKeys });
            }
            else {
                console.warn(`⚠️ OPKs exhausted for user ${targetUserId}`);
            }
        });
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        console.error('Transaction failed fetching key bundle:', error);
        throw new https_1.HttpsError('internal', 'Failed to fetch key bundle. Please try again.');
    }
    if (!bundleData) {
        throw new https_1.HttpsError('internal', 'Bundle data unexpectedly undefined.');
    }
    // -- Build response ------------------------------------------------------
    const response = {
        registrationId: bundleData.registrationId,
        identityKey: bundleData.identityKey,
        signedPreKey: bundleData.signedPreKey,
    };
    if (consumedOPK) {
        response.preKey = consumedOPK;
    }
    else {
        console.warn(`⚠️ No OPK available for ${targetUserId} — X3DH proceeding without OPK`);
    }
    console.log(`✅ Key bundle served for ${targetUserId}`, {
        requestedBy: request.auth.uid,
        hadOPK: !!consumedOPK,
    });
    return response;
});
//# sourceMappingURL=getKeyBundle.js.map