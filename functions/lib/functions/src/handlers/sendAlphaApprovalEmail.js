"use strict";
// functions/src/handlers/sendAlphaApprovalEmail.ts
//
// Triggered automatically when an `invites/{email}` document is updated.
// Fires when `approved` flips to true — sends a branded approval email
// containing the user's invite code via SendGrid.
//
// HOW TO APPROVE A USER:
//   1. Open Firebase Console → Firestore → invites collection
//   2. Find (or create) a document with ID = their email (lowercase)
//   3. Set `approved: true` and ensure `code` is populated
//   4. This function fires automatically and emails them the code
//
// FIRESTORE STRUCTURE:
//   invites/{email}
//     approved: boolean          ← flip this to true to trigger the email
//     code: string               ← the invite code, e.g. "A3KZ-PQ7W-BNXT-M2RY"
//     approvedAt?: Timestamp     ← set automatically by this function
//     registeredUserId?: string  ← set during registration to mark invite as used
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAlphaApprovalEmail = void 0;
const admin = __importStar(require("firebase-admin"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
const params_1 = require("firebase-functions/params");
const firestore_1 = require("firebase-functions/v2/firestore");
const sendgridKey = (0, params_1.defineSecret)('SENDGRID_API_KEY');
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://app.belrosehealth.com';
const FROM_EMAIL = 'noreply@belrosehealth.com';
const FROM_NAME = 'Belrose Health';
exports.sendAlphaApprovalEmail = (0, firestore_1.onDocumentUpdated)({
    document: 'invites/{email}',
    secrets: [sendgridKey],
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    // Only fire when approved flips false/undefined → true
    if (before?.approved === true || after?.approved !== true)
        return null;
    const email = event.params.email;
    const code = after.code;
    if (!code) {
        console.error(`❌ Invite for ${email} has no code field — email not sent.`);
        return null;
    }
    console.log(`✉️  Sending alpha approval email to: ${email}`);
    try {
        await event.data.after.ref.update({
            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        mail_1.default.setApiKey(sendgridKey.value());
        // Format code with dashes for display: XXXX-XXXX-XXXX-XXXX
        const displayCode = code
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .match(/.{1,4}/g)
            ?.join('-') ?? code;
        const registrationUrl = `${APP_BASE_URL}/auth/register`;
        await mail_1.default.send({
            to: email,
            from: { email: FROM_EMAIL, name: FROM_NAME },
            subject: "You're in — here's your Belrose invite code 🎉",
            html: buildApprovalEmailHtml(email, displayCode, registrationUrl),
            text: buildApprovalEmailText(email, displayCode, registrationUrl),
        });
        console.log(`✅ Approval email sent to ${email} with code ${displayCode}`);
        return null;
    }
    catch (error) {
        console.error(`❌ Failed to send approval email to ${email}:`, error);
        return null;
    }
});
// ── Email templates ───────────────────────────────────────────────────────────
function buildApprovalEmailHtml(email, displayCode, registrationUrl) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Belrose Invite Code</title>
  <style>
    body { margin:0; padding:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background:#f4f4f5; color:#18181b; }
    .wrapper { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#0f172a; padding:40px 40px 32px; text-align:center; }
    .badge { display:inline-block; background:#22c55e20; color:#16a34a; font-size:12px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; padding:4px 12px; border-radius:100px; border:1px solid #22c55e40; }
    .header h1 { color:#f8fafc; font-size:24px; font-weight:700; margin:16px 0 8px; letter-spacing:-0.5px; }
    .header p { color:#94a3b8; font-size:14px; margin:0; }
    .body { padding:36px 40px; }
    .body p { font-size:15px; line-height:1.7; color:#3f3f46; margin:0 0 16px; }
    .code-block { background:#f8fafc; border:2px dashed #e2e8f0; border-radius:12px; padding:24px; text-align:center; margin:28px 0; }
    .code-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; margin-bottom:10px; }
    .code-value { font-family:'Courier New',Courier,monospace; font-size:28px; font-weight:700; letter-spacing:6px; color:#0f172a; }
    .cta-block { text-align:center; margin:28px 0; }
    .cta-button { display:inline-block; background:#0f172a; color:#ffffff !important; text-decoration:none; padding:14px 36px; border-radius:10px; font-size:15px; font-weight:600; }
    .steps { background:#f8fafc; border-radius:10px; padding:20px 24px; margin:0 0 24px; }
    .steps h3 { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; margin:0 0 12px; }
    .steps ol { margin:0; padding-left:20px; font-size:14px; color:#3f3f46; line-height:1.9; }
    .divider { height:1px; background:#f1f5f9; margin:24px 0; }
    .footer { background:#f8fafc; padding:20px 40px; text-align:center; }
    .footer p { font-size:12px; color:#94a3b8; margin:0; line-height:1.6; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <span class="badge">✓ Access Approved</span>
    <h1>Welcome to Belrose's Alpha Test!</h1>
    <p>Your invite code is ready</p>
  </div>
  <div class="body">
    <p>Hi there,</p>
    <p>
      Great news — you've been approved for the Belrose Health alpha. You're joining a small,
      carefully selected group of testers helping us build a better way to own and
      control your health data.
    </p>
    <p>
      Remember that this is a testing environment, features and infrastructure are actively evolving. But we guarantee your data will always belong solely to you.
    </p>
    <p>Here's your personal invite code:</p>

    <div class="code-block">
      <div class="code-label">Invite Code</div>
      <div class="code-value">${displayCode}</div>
    </div>

    <div class="steps">
      <h3>How to get started</h3>
      <ol>
        <li>Click the button below to go to the registration page</li>
        <li>Enter <strong>${email}</strong> as your email</li>
        <li>Enter the invite code above when prompted</li>
        <li>Complete your account setup</li>
      </ol>
    </div>

    <div class="cta-block">
      <a href="${registrationUrl}" class="cta-button">Go to registration →</a>
    </div>

    <div class="divider"></div>
    <p style="font-size:13px;color:#94a3b8;">
      Your invite code is personal to your email address and can only be used once.
      If you have any trouble, contact us at
      <a href="mailto:alpha@belrosehealth.com" style="color:#64748b;">alpha@belrosehealth.com</a>.
    </p>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Belrose Health. All rights reserved.<br />
    You received this because you applied for Belrose alpha access.</p>
  </div>
</div>
</body>
</html>
  `.trim();
}
function buildApprovalEmailText(email, displayCode, registrationUrl) {
    return `
Hi there,

Great news — you've been approved for the Belrose Health alpha. You're joining a small, carefully selected group of testers helping us build a better way to own and control your health data.

Remember that this is a testing environment, features and infrastructure are actively evolving. But we guarantee your data will always belong solely to you.

Here's your personal invite code: ${displayCode}

To create your account:
1. Click the button below to go to the registration page
2. Enter ${email} as your email address
3. Enter your invite code when prompted
4. Complete your account setup

Your code is personal to your email address and can only be used once.

Questions? Email alpha@belrosehealth.com

© ${new Date().getFullYear()} Belrose Health
  `.trim();
}
//# sourceMappingURL=sendAlphaApprovalEmail.js.map