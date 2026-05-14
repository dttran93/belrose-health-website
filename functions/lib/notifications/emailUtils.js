"use strict";
// functions/src/notifications/emailUtils.ts
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
exports.MARKETING_URL = exports.SUPPORT_EMAIL = exports.APP_URL = exports.FROM_NAME = exports.FROM_EMAIL = exports.resendKey = void 0;
exports.sendEmailIfEnabled = sendEmailIfEnabled;
/**
 * Email notification utility. Basically, emails are just a parallel call along
 * side notifications. Can be enabled/disabled in settings.
 */
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const notificationUtils_1 = require("./notificationUtils");
const notifications_1 = require("@/_shared/notifications");
exports.resendKey = (0, params_1.defineSecret)('RESEND_API_KEY');
exports.FROM_EMAIL = 'noreply@belrosehealth.com';
exports.FROM_NAME = 'Belrose Health';
exports.APP_URL = 'https://belrosehealth.com/app';
exports.SUPPORT_EMAIL = 'support@belrosehealth.com';
exports.MARKETING_URL = 'https://www.belrosehealth.com';
/**
 * Fetch a user's email address and their notification preferences.
 */
async function getUserEmailAndPrefs(userId) {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists)
        return null;
    const data = userDoc.data();
    return {
        email: data.email,
        prefs: data.notificationPrefs ?? notifications_1.DEFAULT_NOTIFICATION_PREFS,
    };
}
/**
 * Send an email only if the user has that category enabled.
 * Pass category = null for transactional emails that always send.
 */
async function sendEmailIfEnabled(userId, type, payload, resend) {
    const result = await getUserEmailAndPrefs(userId);
    if (!result?.email) {
        console.warn(`⚠️ No email found for user ${userId}, skipping email`);
        return;
    }
    if (type !== null) {
        const category = notificationUtils_1.NOTIFICATION_MAPPING[type];
        const prefs = result.prefs;
        if (!prefs[category]?.email) {
            console.log(`📭 User ${userId} has disabled email for '${category}', skipping`);
            return;
        }
    }
    await resend.emails.send({
        to: result.email,
        from: `${exports.FROM_NAME} <${exports.FROM_EMAIL}>`,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
    });
    console.log(`✅ Email sent to ${result.email} [type: ${type ?? 'transactional'}]`);
}
//# sourceMappingURL=emailUtils.js.map