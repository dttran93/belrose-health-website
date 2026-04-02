"use strict";
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
exports.getKeyBundle = exports.aiChat = exports.getSponsorshipStatus = exports.signSponsorship = exports.onRecordDeletionEventUpdated = exports.onRecordDeletionEventCreated = exports.onSubjectConsentRequestUpdated = exports.onSubjectConsentRequestCreated = exports.initializeRoleOnChain = exports.reactivateWalletOnChain = exports.deactivateWalletOnChain = exports.updateMemberStatus = exports.registerMemberOnChain = exports.healthDetailed = exports.health = exports.claimGuestAccount = exports.redeemGuestInvite = exports.createGuestInvite = exports.sendPasswordChangeEmail = exports.sendWaitlistConfirmationEmail = exports.sendAlphaApprovalEmail = exports.sendShareInvitationEmail = exports.personaWebhook = exports.checkVerificationStatus = exports.createVerificationSession = exports.getEncryptedWallet = exports.createWallet = exports.createDetailedNarrative = exports.createBelroseFields = exports.convertToFHIR = exports.analyzeImageWithAI = exports.setPlatformAdmin = void 0;
// functions/src/index.ts
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
// ==================== ADMIN FUNCTIONS ====================
var setAdminClaim_1 = require("./handlers/setAdminClaim");
Object.defineProperty(exports, "setPlatformAdmin", { enumerable: true, get: function () { return setAdminClaim_1.setPlatformAdmin; } });
// ==================== IMAGE ANALYSIS FUNCTIONS ====================
var image_1 = require("./handlers/image");
Object.defineProperty(exports, "analyzeImageWithAI", { enumerable: true, get: function () { return image_1.analyzeImageWithAI; } });
// ==================== MEDICAL DATA PROCESSING FUNCTIONS ====================
var convertToFHIR_1 = require("./handlers/convertToFHIR");
Object.defineProperty(exports, "convertToFHIR", { enumerable: true, get: function () { return convertToFHIR_1.convertToFHIR; } });
var belroseFields_1 = require("./handlers/belroseFields");
Object.defineProperty(exports, "createBelroseFields", { enumerable: true, get: function () { return belroseFields_1.createBelroseFields; } });
var belroseNarrative_1 = require("./handlers/belroseNarrative");
Object.defineProperty(exports, "createDetailedNarrative", { enumerable: true, get: function () { return belroseNarrative_1.createDetailedNarrative; } });
// ==================== WALLET FUNCTIONS ====================
var wallet_1 = require("./handlers/wallet");
Object.defineProperty(exports, "createWallet", { enumerable: true, get: function () { return wallet_1.createWallet; } });
Object.defineProperty(exports, "getEncryptedWallet", { enumerable: true, get: function () { return wallet_1.getEncryptedWallet; } });
// ==================== IDENTITY VERIFICATION FUNCTIONS ====================
var verification_1 = require("./handlers/verification");
Object.defineProperty(exports, "createVerificationSession", { enumerable: true, get: function () { return verification_1.createVerificationSession; } });
Object.defineProperty(exports, "checkVerificationStatus", { enumerable: true, get: function () { return verification_1.checkVerificationStatus; } });
Object.defineProperty(exports, "personaWebhook", { enumerable: true, get: function () { return verification_1.personaWebhook; } });
// ==================== EMAIL FUNCTIONS ====================
var sendShareInvitationEmail_1 = require("./handlers/sendShareInvitationEmail");
Object.defineProperty(exports, "sendShareInvitationEmail", { enumerable: true, get: function () { return sendShareInvitationEmail_1.sendShareInvitationEmail; } });
var sendAlphaApprovalEmail_1 = require("./handlers/sendAlphaApprovalEmail");
Object.defineProperty(exports, "sendAlphaApprovalEmail", { enumerable: true, get: function () { return sendAlphaApprovalEmail_1.sendAlphaApprovalEmail; } });
var sendWaitlistConfirmationEmail_1 = require("./handlers/sendWaitlistConfirmationEmail");
Object.defineProperty(exports, "sendWaitlistConfirmationEmail", { enumerable: true, get: function () { return sendWaitlistConfirmationEmail_1.sendWaitlistConfirmationEmail; } });
var sendPasswordChangeEmail_1 = require("./handlers/sendPasswordChangeEmail");
Object.defineProperty(exports, "sendPasswordChangeEmail", { enumerable: true, get: function () { return sendPasswordChangeEmail_1.sendPasswordChangeEmail; } });
// ==================== GUEST INVITE ====================
var createGuestInvite_1 = require("./handlers/createGuestInvite");
Object.defineProperty(exports, "createGuestInvite", { enumerable: true, get: function () { return createGuestInvite_1.createGuestInvite; } });
var redeemGuestInvite_1 = require("./handlers/redeemGuestInvite");
Object.defineProperty(exports, "redeemGuestInvite", { enumerable: true, get: function () { return redeemGuestInvite_1.redeemGuestInvite; } });
var claimGuestAccount_1 = require("./handlers/claimGuestAccount");
Object.defineProperty(exports, "claimGuestAccount", { enumerable: true, get: function () { return claimGuestAccount_1.claimGuestAccount; } });
// ==================== HEALTH CHECK ====================
var healthCheck_1 = require("./handlers/healthCheck");
Object.defineProperty(exports, "health", { enumerable: true, get: function () { return healthCheck_1.health; } });
Object.defineProperty(exports, "healthDetailed", { enumerable: true, get: function () { return healthCheck_1.healthDetailed; } });
// ==================== MEMBER REGISTRY ====================
var memberRegistry_1 = require("./handlers/memberRegistry");
Object.defineProperty(exports, "registerMemberOnChain", { enumerable: true, get: function () { return memberRegistry_1.registerMemberOnChain; } });
Object.defineProperty(exports, "updateMemberStatus", { enumerable: true, get: function () { return memberRegistry_1.updateMemberStatus; } });
Object.defineProperty(exports, "deactivateWalletOnChain", { enumerable: true, get: function () { return memberRegistry_1.deactivateWalletOnChain; } });
Object.defineProperty(exports, "reactivateWalletOnChain", { enumerable: true, get: function () { return memberRegistry_1.reactivateWalletOnChain; } });
Object.defineProperty(exports, "initializeRoleOnChain", { enumerable: true, get: function () { return memberRegistry_1.initializeRoleOnChain; } });
// ==================== NOTIFICATIONS ====================
var subjectNotificationTrigger_1 = require("./notifications/triggers/subjectNotificationTrigger");
Object.defineProperty(exports, "onSubjectConsentRequestCreated", { enumerable: true, get: function () { return subjectNotificationTrigger_1.onSubjectConsentRequestCreated; } });
Object.defineProperty(exports, "onSubjectConsentRequestUpdated", { enumerable: true, get: function () { return subjectNotificationTrigger_1.onSubjectConsentRequestUpdated; } });
var deleteRecordNotificationTrigger_1 = require("./notifications/triggers/deleteRecordNotificationTrigger");
Object.defineProperty(exports, "onRecordDeletionEventCreated", { enumerable: true, get: function () { return deleteRecordNotificationTrigger_1.onRecordDeletionEventCreated; } });
Object.defineProperty(exports, "onRecordDeletionEventUpdated", { enumerable: true, get: function () { return deleteRecordNotificationTrigger_1.onRecordDeletionEventUpdated; } });
// ==================== PAYMASTER ====================
var paymaster_1 = require("./handlers/paymaster");
Object.defineProperty(exports, "signSponsorship", { enumerable: true, get: function () { return paymaster_1.signSponsorship; } });
Object.defineProperty(exports, "getSponsorshipStatus", { enumerable: true, get: function () { return paymaster_1.getSponsorshipStatus; } });
// ==================== AI CHAT FUNCTIONS ====================
var aiChat_1 = require("./handlers/aiChat");
Object.defineProperty(exports, "aiChat", { enumerable: true, get: function () { return aiChat_1.aiChat; } });
// ==================== MESSAGING FUNCTIONS ====================
var getKeyBundle_1 = require("./handlers/getKeyBundle");
Object.defineProperty(exports, "getKeyBundle", { enumerable: true, get: function () { return getKeyBundle_1.getKeyBundle; } });
//# sourceMappingURL=index.js.map