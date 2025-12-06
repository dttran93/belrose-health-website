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
exports.initializeRecordOnChain = exports.updateMemberStatus = exports.registerMemberOnChain = exports.healthDetailed = exports.health = exports.sendShareInvitationEmail = exports.personaWebhook = exports.checkVerificationStatus = exports.createVerificationSession = exports.getEncryptedWallet = exports.createWallet = exports.createDetailedNarrative = exports.createBelroseFields = exports.convertToFHIR = exports.analyzeImageWithAI = void 0;
// functions/src/index.ts
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
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
// ==================== HEALTH CHECK ====================
var healthCheck_1 = require("./handlers/healthCheck");
Object.defineProperty(exports, "health", { enumerable: true, get: function () { return healthCheck_1.health; } });
Object.defineProperty(exports, "healthDetailed", { enumerable: true, get: function () { return healthCheck_1.healthDetailed; } });
// ==================== MEMBER REGISTRY ====================
var memberRegistry_1 = require("./handlers/memberRegistry");
Object.defineProperty(exports, "registerMemberOnChain", { enumerable: true, get: function () { return memberRegistry_1.registerMemberOnChain; } });
Object.defineProperty(exports, "updateMemberStatus", { enumerable: true, get: function () { return memberRegistry_1.updateMemberStatus; } });
Object.defineProperty(exports, "initializeRecordOnChain", { enumerable: true, get: function () { return memberRegistry_1.initializeRecordOnChain; } });
//# sourceMappingURL=index.js.map