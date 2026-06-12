"use strict";
// functions/src/handlers/removeDependentRelationship.ts
// Removes the guardian's controller relationship with a dependent.
//
// Behaviour depends on account state:
//   - Unclaimed AND handoff not initiated: deletes the Firebase Auth user entirely
//     (nobody is expecting this account; safe to clean up fully)
//   - Unclaimed BUT handoff initiated: revoke only — dependent may be mid-claim
//   - Claimed: revoke only — dependent keeps their account, guardian loses Controller access.
//     The dependent keeps their account; the guardian loses Controller access.
//
// On-chain note: revokeTrustee on MemberRoleManager is onlyActiveMember, so the admin
// wallet cannot call it. Firestore is the primary access gate for the app. On-chain
// revocation from the guardian's client wallet can be wired separately if needed.
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
exports.removeDependentRelationship = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin = __importStar(require("firebase-admin"));
exports.removeDependentRelationship = (0, https_1.onCall)({}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated');
    const guardianUid = request.auth.uid;
    const { dependentUid } = request.data;
    if (!dependentUid)
        throw new https_1.HttpsError('invalid-argument', 'Missing dependentUid');
    const db = (0, firestore_1.getFirestore)();
    // Verify caller is an active controller trustee of the dependent
    const relId = `${dependentUid}_${guardianUid}`;
    const relRef = db.collection('trusteeRelationships').doc(relId);
    const relDoc = await relRef.get();
    if (!relDoc.exists || !relDoc.data()?.isActive || relDoc.data()?.trustLevel !== 'controller') {
        throw new https_1.HttpsError('permission-denied', 'Not an active controller of this account');
    }
    // Check account state
    const dependentDoc = await db.collection('users').doc(dependentUid).get();
    const dependentData = dependentDoc.data() ?? {};
    const isUnclaimed = dependentData.isDependent === true;
    const handoffInitiated = !!dependentData.handoffInitiatedAt;
    const now = firestore_1.Timestamp.now();
    const revokeOnly = !isUnclaimed || handoffInitiated;
    if (revokeOnly) {
        // Claimed or handoff already sent — revoke access, leave account intact
        await relRef.update({
            isActive: false,
            status: 'revoked',
            isDependentRelationship: false,
            revokedAt: now,
            revokedBy: guardianUid,
        });
        console.log(`✅ Guardian access revoked for dependent ${dependentUid} by ${guardianUid}` +
            (handoffInitiated && isUnclaimed ? ' (handoff in progress — account preserved)' : ''));
    }
    else {
        // Unclaimed, no handoff initiated — full cleanup
        await relRef.update({
            isActive: false,
            status: 'revoked',
            revokedAt: now,
            revokedBy: guardianUid,
        });
        await db.collection('users').doc(dependentUid).delete();
        try {
            await admin.auth().deleteUser(dependentUid);
        }
        catch (err) {
            console.warn(`Could not delete Auth user ${dependentUid}:`, err);
        }
        console.log(`✅ Unclaimed dependent ${dependentUid} fully removed by ${guardianUid}`);
    }
    return { success: true };
});
//# sourceMappingURL=removeDependentRelationship.js.map