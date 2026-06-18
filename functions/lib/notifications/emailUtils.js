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
const notifications_1 = require("../_shared/notifications");
exports.resendKey = (0, params_1.defineSecret)('RESEND_API_KEY');
exports.FROM_EMAIL = 'noreply@belrosehealth.com';
exports.FROM_NAME = 'Belrose Health';
exports.APP_URL = 'https://belrosehealth.com/app';
exports.SUPPORT_EMAIL = 'support@belrosehealth.com';
exports.MARKETING_URL = 'https://www.belrosehealth.com';
const PLACEHOLDER_EMAIL_DOMAIN = '@placeholder.belrose.health';
/**
 * Resolve the set of email recipients for a given user.
 *
 * - Regular user          → [user]
 * - Dependent, placeholder email → [guardian]          (no real inbox for dependent)
 * - Dependent, real email        → [guardian, dependent] (both get a copy)
 *
 * Guardian-bound emails are tagged with isDependent + dependentDisplayName so
 * sendEmailIfEnabled can prepend a "re: [Name]'s account" context note.
 */
async function resolveEmailRecipients(userId) {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists)
        return [];
    const data = userDoc.data();
    // Regular account — straightforward
    if (!data.isDependent || !data.dependentCreatedBy) {
        if (!data.email)
            return [];
        return [
            {
                email: data.email,
                prefs: (data.notificationPrefs ?? {}),
                isDependent: false,
            },
        ];
    }
    // Dependent account
    const guardianDoc = await admin
        .firestore()
        .collection('users')
        .doc(data.dependentCreatedBy)
        .get();
    if (!guardianDoc.exists)
        return [];
    const guardianData = guardianDoc.data();
    const dependentDisplayName = (data.displayName || data.firstName || 'your dependent');
    const dependentEmail = data.email;
    const isPlaceholder = dependentEmail?.endsWith(PLACEHOLDER_EMAIL_DOMAIN) ?? true;
    const recipients = [];
    // Guardian always receives a copy
    if (guardianData.email) {
        recipients.push({
            email: guardianData.email,
            prefs: (guardianData.notificationPrefs ?? {}),
            isDependent: true,
            dependentDisplayName,
        });
    }
    // Real-email dependent also gets their own copy. Practically this should never happen because isDependent is removed once a real email is provided, but we support it for completeness.
    if (!isPlaceholder && dependentEmail) {
        recipients.push({
            email: dependentEmail,
            prefs: (data.notificationPrefs ?? {}),
            isDependent: true,
            dependentDisplayName,
        });
    }
    return recipients;
}
/**
 * Send an email only if the user has that category enabled.
 * Pass type = null for transactional emails that always send.
 *
 * Handles dependent account routing transparently — callers don't need to
 * know whether the target is a dependent.
 */
async function sendEmailIfEnabled(userId, type, payload, resend) {
    const recipients = await resolveEmailRecipients(userId);
    if (recipients.length === 0) {
        console.warn(`⚠️ No email recipients resolved for user ${userId}, skipping email`);
        return;
    }
    for (const recipient of recipients) {
        if (type !== null) {
            const effective = recipient.prefs[type] ??
                notifications_1.DEFAULT_NOTIFICATION_PREFS[type] ?? { inApp: true, email: true };
            if (!effective.email) {
                console.log(`📭 ${recipient.email} has disabled email for '${type}', skipping`);
                continue;
            }
        }
        // For guardian-bound emails: suffix the subject, inject a pill into the header, clean up plain text
        const finalPayload = recipient.isDependent && recipient.dependentDisplayName
            ? (() => {
                const name = recipient.dependentDisplayName;
                const pill = `<span style="display:inline-block;background:#8b5cf620;color:#c4b5fd;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;padding:4px 10px;border-radius:100px;border:1px solid #8b5cf640;margin-left:8px;">👤 ${name}</span>`;
                return {
                    subject: `${payload.subject} — ${name}'s account`,
                    html: payload.html.replace('<h1', `${pill}<h1`),
                    text: `[${name}'s account]\n\n${payload.text}`,
                };
            })()
            : payload;
        await resend.emails.send({
            to: recipient.email,
            from: `${exports.FROM_NAME} <${exports.FROM_EMAIL}>`,
            subject: finalPayload.subject,
            html: finalPayload.html,
            text: finalPayload.text,
        });
        console.log(`✅ Email sent to ${recipient.email} [type: ${type ?? 'transactional'}, isDependent: ${recipient.isDependent}]`);
    }
}
//# sourceMappingURL=emailUtils.js.map