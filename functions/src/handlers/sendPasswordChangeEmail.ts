// functions/src/handlers/sendPasswordChangeEmail
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Resend } from 'resend';
import { defineSecret } from 'firebase-functions/params';

const resendKey = defineSecret('RESEND_API_KEY');

const FROM_EMAIL = 'noreply@belrosehealth.com';
const FROM_NAME = 'Belrose Health';

interface PasswordChangeData {
  email: string;
  displayName: string;
}

export const sendPasswordChangeEmail = onCall(
  { secrets: [resendKey] },
  async (request): Promise<{ success: boolean }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { email, displayName } = request.data as PasswordChangeData;

    if (!email) {
      throw new HttpsError('invalid-argument', 'Missing required field: email');
    }

    const resend = new Resend(resendKey.value());

    await resend.emails.send({
      to: email,
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      subject: 'Your Belrose password was changed',
      html: buildPasswordChangeHtml(displayName),
      text: buildPasswordChangeText(displayName),
    });

    console.log(`✅ Password change notification sent to ${email}`);
    return { success: true };
  }
);

// ── Email templates ───────────────────────────────────────────────────────────

function buildPasswordChangeHtml(displayName: string): string {
  const supportEmail = 'support@belrosehealth.com';
  const recoveryLink = 'https://belrosehealth.com/auth/recover';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your password was changed</title>
  <style>
    body { margin:0; padding:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background:#f4f4f5; color:#18181b; }
    .wrapper { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#0f172a; padding:40px 40px 32px; text-align:center; }
    .badge { display:inline-block; background:#22c55e20; color:#4ade80; font-size:12px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; padding:4px 12px; border-radius:100px; border:1px solid #22c55e40; }
    .header h1 { color:#f8fafc; font-size:24px; font-weight:700; margin:16px 0 8px; letter-spacing:-0.5px; }
    .header p { color:#94a3b8; font-size:14px; margin:0; }
    .body { padding:36px 40px; }
    .body p { font-size:15px; line-height:1.7; color:#3f3f46; margin:0 0 16px; }
    .alert-block { background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:24px 28px; margin:24px 0; }
    .alert-block p { color:#991b1b; font-size:14px; margin:0 0 12px; }
    .alert-block p:last-child { margin:0; }
    .alert-block strong { color:#7f1d1d; }
    .cta-block { text-align:center; margin:28px 0; }
    .cta-button { display:inline-block; background:#dc2626; color:#ffffff !important; text-decoration:none; padding:14px 36px; border-radius:10px; font-size:15px; font-weight:600; }
    .divider { height:1px; background:#f1f5f9; margin:24px 0; }
    .footer { background:#f8fafc; padding:20px 40px; text-align:center; }
    .footer p { font-size:12px; color:#94a3b8; margin:0; line-height:1.6; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <span class="badge">Security notice</span>
    <h1>Your password was changed</h1>
    <p>This is a confirmation of a recent account change</p>
  </div>
  <div class="body">
    <p>Hi ${displayName || 'there'},</p>
    <p>
      The password for your Belrose Health account was successfully changed.
      If you made this change, no further action is needed.
    </p>

    <div class="alert-block">
      <p><strong>Didn't make this change?</strong></p>
      <p>
        Do NOT use the standard password reset link. Resetting your password without your recovery phrase will permanently lock you out 
of your health data.</p>

<p>To regain access, go to: <a href="${recoveryLink}" style="color:#991b1b;">${recoveryLink}</a> and use your 24-word recovery phrase.</p>

<p>If you've lost your recovery phrase, contact <a href="mailto:${supportEmail}" style="color:#991b1b;">${supportEmail}</a> —
but be aware that without the phrase, we cannot recover your encrypted data.

      </p>
    </div>

    <div class="cta-block">
      <a href="${recoveryLink}" class="cta-button">Account Recovery →</a>
    </div>

    <div class="divider"></div>
    <p style="font-size:13px;color:#94a3b8;">
      For security, we notify you of all password changes on your account.
      If you have questions, contact us at
      <a href="mailto:${supportEmail}" style="color:#64748b;">${supportEmail}</a>.
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

function buildPasswordChangeText(displayName: string): string {
  const supportEmail = 'support@belrosehealth.com';
  const recoveryLink = 'https://belrosehealth.com/auth/recover';

  return `
Hi ${displayName || 'there'},

The password for your Belrose Health account was successfully changed. If you made this 
change, no further action is needed.

DIDN'T MAKE THIS CHANGE?

Do NOT use the standard password reset link. Resetting your password without your 
recovery phrase will permanently lock you out of your health data.

To regain access, go to: ${recoveryLink} and use your 24-word recovery phrase.

If you've lost your recovery phrase, contact ${supportEmail} — but be aware that without 
the phrase, we cannot recover your encrypted data.

© ${new Date().getFullYear()} Belrose Health. All rights reserved.
  `.trim();
}
