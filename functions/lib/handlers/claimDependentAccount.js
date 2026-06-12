"use strict";
// functions/src/handlers/claimDependentAccount.ts
// Called when a dependent logs in directly and chooses to claim ownership.
//
// What this does:
//   1. Flips isDependent → false, removes dependentCreatedBy from the user doc
//   2. Marks the guardian's trustee relationship isDependentRelationship: false
//      (guardian stays as a controller trustee but leaves the account-switcher list)
//   3. Notifies the guardian via in-app notification + email
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimDependentAccount = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const resend_1 = require("resend");
const notificationUtils_1 = require("../notifications/notificationUtils");
const emailUtils_1 = require("../notifications/emailUtils");
exports.claimDependentAccount = (0, https_1.onCall)({ secrets: [emailUtils_1.resendKey] }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated');
    const dependentUid = request.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    // Verify caller is actually a dependent
    const userDoc = await db.collection('users').doc(dependentUid).get();
    if (!userDoc.exists)
        throw new https_1.HttpsError('not-found', 'User not found');
    const userData = userDoc.data();
    if (!userData.isDependent || !userData.dependentCreatedBy) {
        throw new https_1.HttpsError('failed-precondition', 'Account is not a dependent account');
    }
    const guardianUid = userData.dependentCreatedBy;
    const dependentDisplayName = (userData.displayName || userData.firstName || 'Your dependent');
    // 1. Flip the user doc — clear isDependent and remove the dependentCreatedBy field entirely
    await db.collection('users').doc(dependentUid).update({
        isDependent: false,
        dependentCreatedBy: firestore_1.FieldValue.delete(),
    });
    // 2. Update the trustee relationship — guardian remains a controller trustee
    //    but isDependentRelationship: false drops them from the switcher query
    const relId = `${dependentUid}_${guardianUid}`;
    const relDoc = await db.collection('trusteeRelationships').doc(relId).get();
    if (relDoc.exists) {
        await db.collection('trusteeRelationships').doc(relId).update({
            isDependentRelationship: false,
        });
    }
    // 3. In-app notification to guardian
    await (0, notificationUtils_1.createNotification)(guardianUid, {
        type: 'GENERIC_NOTIFICATION',
        payload: { dependentUid, dependentDisplayName },
        message: `${dependentDisplayName} has claimed their Belrose account. They remain a controller trustee unless they change access in their settings.`,
        link: `${emailUtils_1.APP_URL}/app/settings/trustees`,
    });
    // 4. Email to guardian
    const resend = new resend_1.Resend(emailUtils_1.resendKey.value());
    await (0, emailUtils_1.sendEmailIfEnabled)(guardianUid, 'GENERIC_NOTIFICATION', {
        subject: `${dependentDisplayName} has claimed their Belrose account`,
        html: buildClaimEmailHtml(dependentDisplayName),
        text: buildClaimEmailText(dependentDisplayName),
    }, resend);
    console.log(`✅ Dependent ${dependentUid} claimed account from guardian ${guardianUid}`);
    return { success: true };
});
// ── Email templates ───────────────────────────────────────────────────────────
function buildClaimEmailHtml(dependentDisplayName) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${dependentDisplayName} claimed their account</title>
  <style>
    body { margin:0; padding:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background:#f4f4f5; color:#18181b; }
    .wrapper { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#0f172a; padding:40px 40px 32px; text-align:center; }
    .badge { display:inline-block; background:#22c55e20; color:#4ade80; font-size:12px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; padding:4px 12px; border-radius:100px; border:1px solid #22c55e40; }
    .header h1 { color:#f8fafc; font-size:24px; font-weight:700; margin:16px 0 8px; letter-spacing:-0.5px; }
    .header p { color:#94a3b8; font-size:14px; margin:0; }
    .body { padding:36px 40px; }
    .body p { font-size:15px; line-height:1.7; color:#3f3f46; margin:0 0 16px; }
    .info-block { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:20px 24px; margin:20px 0; }
    .info-block p { color:#166534; font-size:14px; margin:0; }
    .cta-block { text-align:center; margin:28px 0; }
    .cta-button { display:inline-block; background:#0f172a; color:#ffffff !important; text-decoration:none; padding:14px 36px; border-radius:10px; font-size:15px; font-weight:600; }
    .footer { background:#f8fafc; padding:20px 40px; text-align:center; }
    .footer p { font-size:12px; color:#94a3b8; margin:0; line-height:1.6; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <span class="badge">Account update</span>
    <h1>${dependentDisplayName} has claimed their account</h1>
    <p>They now independently manage their Belrose Health account</p>
  </div>
  <div class="body">
    <p>Hi there,</p>
    <p>
      <strong>${dependentDisplayName}</strong> has taken ownership of their Belrose Health account.
      They logged in and confirmed that the account is now theirs to manage independently.
    </p>
    <div class="info-block">
      <p>
        You remain a <strong>controller trustee</strong> on their account, which means you still
        have access to their records. They can remove your access at any time via their
        Settings → Trustees page.
      </p>
    </div>
    <p>
      No action is required from you. If you have any questions, visit your Trustees settings
      to review your current access.
    </p>
    <div class="cta-block">
      <a href="${emailUtils_1.APP_URL}/app/settings/trustees" class="cta-button">View Trustee Settings →</a>
    </div>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Belrose Health. All rights reserved.</p>
  </div>
</div>
</body>
</html>
  `.trim();
}
function buildClaimEmailText(dependentDisplayName) {
    return `
${dependentDisplayName} has claimed their Belrose account.

They logged in and confirmed that the account is now theirs to manage independently.

You remain a controller trustee on their account, which means you still have access to their
records. They can remove your access at any time via their Settings > Trustees page.

No action is required from you.

View your trustee settings: ${emailUtils_1.APP_URL}/app/settings/trustees

© ${new Date().getFullYear()} Belrose Health. All rights reserved.
  `.trim();
}
//# sourceMappingURL=claimDependentAccount.js.map