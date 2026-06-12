"use strict";
// functions/src/handlers/initiateHandoff.ts
// Sends a handoff email to the contact email provided by the guardian.
// The email tells the dependent their Belrose login email and instructs them
// to use their 24-word recovery phrase to set their own password.
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
exports.initiateHandoff = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin = __importStar(require("firebase-admin"));
const resend_1 = require("resend");
const params_1 = require("firebase-functions/params");
const resendKey = (0, params_1.defineSecret)('RESEND_API_KEY');
const FROM_EMAIL = 'noreply@belrosehealth.com';
const FROM_NAME = 'Belrose Health';
exports.initiateHandoff = (0, https_1.onCall)({ secrets: [resendKey] }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated');
    const guardianUid = request.auth.uid;
    const { dependentUid, contactEmail } = request.data;
    if (!dependentUid || !contactEmail) {
        throw new https_1.HttpsError('invalid-argument', 'Missing dependentUid or contactEmail');
    }
    const db = (0, firestore_1.getFirestore)();
    // Verify caller is an active controller trustee of the dependent
    const relId = `${dependentUid}_${guardianUid}`;
    const relDoc = await db.collection('trusteeRelationships').doc(relId).get();
    if (!relDoc.exists || !relDoc.data()?.isActive || relDoc.data()?.trustLevel !== 'controller') {
        throw new https_1.HttpsError('permission-denied', 'Not an active controller of this account');
    }
    // Get the dependent's login email and display name
    let loginEmail = '';
    let displayName = '';
    try {
        const authUser = await admin.auth().getUser(dependentUid);
        loginEmail = authUser.email ?? '';
        displayName = authUser.displayName ?? '';
    }
    catch {
        throw new https_1.HttpsError('not-found', 'Dependent account not found');
    }
    // Get guardian's display name for the email
    const guardianDoc = await db.collection('users').doc(guardianUid).get();
    const guardianName = guardianDoc.data()?.displayName ?? 'Your guardian';
    // Mark the dependent's account as handoff-initiated so that if the guardian
    // later removes themselves, the account is preserved rather than deleted.
    await db.collection('users').doc(dependentUid).update({
        handoffInitiatedAt: firestore_1.Timestamp.now(),
    });
    const resend = new resend_1.Resend(resendKey.value());
    await resend.emails.send({
        to: contactEmail,
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        subject: 'Your Belrose Health account is ready to claim',
        html: buildHandoffHtml({ displayName, loginEmail, guardianName }),
        text: buildHandoffText({ displayName, loginEmail, guardianName }),
    });
    console.log(`✅ Handoff email sent for dependent ${dependentUid} to ${contactEmail}`);
    return { success: true };
});
function buildHandoffHtml({ displayName, loginEmail, guardianName }) {
    const recoveryLink = 'https://belrosehealth.com/auth/recover';
    const loginLink = 'https://belrosehealth.com/auth';
    const supportEmail = 'support@belrosehealth.com';
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Belrose account is ready</title>
  <style>
    body { margin:0; padding:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background:#f4f4f5; color:#18181b; }
    .wrapper { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#0f172a; padding:40px 40px 32px; text-align:center; }
    .badge { display:inline-block; background:#3b82f620; color:#93c5fd; font-size:12px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; padding:4px 12px; border-radius:100px; border:1px solid #3b82f640; }
    .header h1 { color:#f8fafc; font-size:24px; font-weight:700; margin:16px 0 8px; letter-spacing:-0.5px; }
    .header p { color:#94a3b8; font-size:14px; margin:0; }
    .body { padding:36px 40px; }
    .body p { font-size:15px; line-height:1.7; color:#3f3f46; margin:0 0 16px; }
    .info-block { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:20px 24px; margin:20px 0; }
    .info-block .label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; color:#94a3b8; margin-bottom:4px; }
    .info-block .value { font-size:15px; font-weight:600; color:#0f172a; font-family:monospace; }
    .steps { margin:20px 0; }
    .step { display:flex; gap:12px; margin-bottom:14px; }
    .step-num { width:24px; height:24px; border-radius:50%; background:#0f172a; color:#f8fafc; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; }
    .step-text { font-size:14px; color:#3f3f46; line-height:1.6; }
    .cta-block { text-align:center; margin:28px 0; }
    .cta-button { display:inline-block; background:#0f172a; color:#f8fafc !important; text-decoration:none; padding:14px 36px; border-radius:10px; font-size:15px; font-weight:600; }
    .divider { height:1px; background:#f1f5f9; margin:24px 0; }
    .footer { background:#f8fafc; padding:20px 40px; text-align:center; }
    .footer p { font-size:12px; color:#94a3b8; margin:0; line-height:1.6; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <span class="badge">Account handoff</span>
    <h1>Your Belrose account is ready</h1>
    <p>${guardianName} has set up a health records account for you</p>
  </div>
  <div class="body">
    <p>Hi ${displayName || 'there'},</p>
    <p>
      ${guardianName} has created a secure health records account on Belrose Health on your behalf.
      You can now take ownership of it.
    </p>

    <div class="info-block">
      <div class="label">Your login email</div>
      <div class="value">${loginEmail}</div>
    </div>

    <p style="font-size:14px;color:#64748b;">
      To log in, you'll need to set your own password using the <strong>24-word recovery phrase</strong>
      that ${guardianName} has for you. Ask them for it before following the steps below.
    </p>

    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Get your 24-word recovery phrase from ${guardianName}.</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">
          Go to <a href="${recoveryLink}" style="color:#0f172a;">${recoveryLink}</a> and enter your recovery phrase to set a new password.
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">
          Log in at <a href="${loginLink}" style="color:#0f172a;">${loginLink}</a> with your email and new password.
        </div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text">Follow the on-screen prompts to claim your account.</div>
      </div>
    </div>

    <div class="cta-block">
      <a href="${recoveryLink}" class="cta-button">Set My Password →</a>
    </div>

    <div class="divider"></div>
    <p style="font-size:13px;color:#94a3b8;">
      Questions? Contact us at <a href="mailto:${supportEmail}" style="color:#64748b;">${supportEmail}</a>.
      ${guardianName} will continue to have access to your records as a guardian until you manage
      your account settings.
    </p>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Belrose Health. All rights reserved.</p>
  </div>
</div>
</body>
</html>
  `.trim();
}
function buildHandoffText({ displayName, loginEmail, guardianName }) {
    const recoveryLink = 'https://belrosehealth.com/auth/recover';
    const loginLink = 'https://belrosehealth.com/auth';
    return `
Hi ${displayName || 'there'},

${guardianName} has created a secure health records account on Belrose Health on your behalf.
You can now take ownership of it.

YOUR LOGIN EMAIL: ${loginEmail}

To log in, you'll need to set your own password using the 24-word recovery phrase that
${guardianName} has for you. Ask them for it before following the steps below.

STEPS TO CLAIM YOUR ACCOUNT:

1. Get your 24-word recovery phrase from ${guardianName}.
2. Go to ${recoveryLink} and enter your recovery phrase to set a new password.
3. Log in at ${loginLink} with your email and new password.
4. Follow the on-screen prompts to claim your account.

© ${new Date().getFullYear()} Belrose Health. All rights reserved.
  `.trim();
}
//# sourceMappingURL=initiateHandoff.js.map