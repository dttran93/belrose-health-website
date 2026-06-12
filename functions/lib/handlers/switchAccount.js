"use strict";
// functions/src/handlers/switchAccount.ts
// Custom-token account switching for guardian ↔ dependent sessions.
//
// Guardian → dependent: verify caller has an active controller trustee
//   relationship with the target dependent, then issue a custom token.
//
// Dependent → guardian: verify the caller's profile shows this guardian
//   as dependentCreatedBy, then issue a custom token for the guardian.
//
// Using custom tokens (not signInWithEmailAndPassword) means the guardian's
// password is never needed for day-to-day switching — it's reserved for the
// dependent's eventual independent login and the handoff flow.
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
exports.switchToGuardian = exports.switchToDependent = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
exports.switchToDependent = (0, https_1.onCall)(async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated');
    const guardianUid = request.auth.uid;
    const { dependentUid } = request.data;
    if (!dependentUid)
        throw new https_1.HttpsError('invalid-argument', 'dependentUid is required');
    if (dependentUid === guardianUid)
        throw new https_1.HttpsError('invalid-argument', 'Cannot switch to yourself');
    const db = (0, firestore_1.getFirestore)();
    // Verify the active controller relationship exists
    const relationshipId = `${dependentUid}_${guardianUid}`;
    const relDoc = await db.collection('trusteeRelationships').doc(relationshipId).get();
    if (!relDoc.exists)
        throw new https_1.HttpsError('not-found', 'No trustee relationship found');
    const rel = relDoc.data();
    if (!rel.isDependentRelationship || !rel.isActive || rel.trustLevel !== 'controller') {
        throw new https_1.HttpsError('permission-denied', 'Not an active controller for this dependent');
    }
    const token = await admin.auth().createCustomToken(dependentUid);
    console.log(`✅ Guardian ${guardianUid} switched to dependent ${dependentUid}`);
    return { token };
});
exports.switchToGuardian = (0, https_1.onCall)(async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated');
    const dependentUid = request.auth.uid;
    const { guardianUid } = request.data;
    if (!guardianUid)
        throw new https_1.HttpsError('invalid-argument', 'guardianUid is required');
    const db = (0, firestore_1.getFirestore)();
    // Verify caller is actually a dependent of this guardian
    const userDoc = await db.collection('users').doc(dependentUid).get();
    if (!userDoc.exists)
        throw new https_1.HttpsError('not-found', 'User not found');
    const userData = userDoc.data();
    if (!userData.isDependent || userData.dependentCreatedBy !== guardianUid) {
        throw new https_1.HttpsError('permission-denied', 'Not a dependent of this guardian');
    }
    const token = await admin.auth().createCustomToken(guardianUid);
    console.log(`✅ Dependent ${dependentUid} returned to guardian ${guardianUid}`);
    return { token };
});
//# sourceMappingURL=switchAccount.js.map