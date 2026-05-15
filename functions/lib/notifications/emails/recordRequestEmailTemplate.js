"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRecordRequestViewedHtml = buildRecordRequestViewedHtml;
exports.buildRecordRequestViewedText = buildRecordRequestViewedText;
exports.buildRecordRequestFulfilledHtml = buildRecordRequestFulfilledHtml;
exports.buildRecordRequestFulfilledText = buildRecordRequestFulfilledText;
exports.buildRecordRequestDeniedHtml = buildRecordRequestDeniedHtml;
exports.buildRecordRequestDeniedText = buildRecordRequestDeniedText;
const emailUtils_1 = require("../emailUtils");
// ─── Shared layout helpers ────────────────────────────────────────────────────
function letterhead(badgeText, badgeColor) {
    return `
    <table style="background:#0f172a;border-radius:16px 16px 0 0;width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:24px 40px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#f8fafc;
            letter-spacing:1px;text-transform:uppercase;">Belrose Health</p>
          <p style="margin:3px 0 0;font-size:11px;color:#64748b;">Secure Health Record Platform</p>
        </td>
        <td style="padding:24px 40px;text-align:right;white-space:nowrap;">
          <span style="background:#ffffff15;border:1px solid #ffffff20;border-radius:100px;
            padding:5px 12px;font-size:11px;color:#94a3b8;">🔒 End-to-end encrypted</span>
        </td>
      </tr>
    </table>
    <div style="background:${badgeColor};padding:12px 40px;">
      <p style="margin:0;font-size:11px;color:#fff;font-weight:600;
        letter-spacing:0.5px;text-transform:uppercase;">${badgeText}</p>
    </div>`;
}
function ctaButton(href, label, color = '#0f172a') {
    return `
    <div style="text-align:center;margin:28px 0 10px;">
      <a href="${href}" style="display:inline-block;background:${color};color:#fff;
        text-decoration:none;padding:14px 40px;border-radius:10px;
        font-size:15px;font-weight:600;">${label}</a>
    </div>`;
}
function infoRow(label, value) {
    return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;
        font-size:13px;color:#64748b;width:40%;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;
        font-size:13px;color:#1e293b;font-weight:500;">${value}</td>
    </tr>`;
}
function footer() {
    const year = new Date().getFullYear();
    return `
    <div style="background:#f8fafc;border-radius:0 0 16px 16px;padding:16px 40px;
      border-top:1px solid #e2e8f0;">
      <p style="font-size:11px;color:#94a3b8;margin:0 0 4px;">
        © ${year} Belrose Health Ltd. All rights reserved.
      </p>
      <p style="font-size:11px;color:#94a3b8;margin:0;">
        Questions? <a href="mailto:${emailUtils_1.SUPPORT_EMAIL}"
          style="color:#64748b;">${emailUtils_1.SUPPORT_EMAIL}</a>
        &nbsp;·&nbsp;
        <a href="${emailUtils_1.APP_URL}/settings/notifications"
          style="color:#64748b;">Manage notification preferences</a>
      </p>
    </div>`;
}
function wrap(inner) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;
  font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#18181b;">
  <div style="max-width:580px;margin:40px auto;">
    ${inner}
  </div>
</body>
</html>`;
}
// ─── Case 1: Request viewed ───────────────────────────────────────────────────
function buildRecordRequestViewedHtml(targetEmail) {
    return wrap(`
    ${letterhead('Record Request · Opened', '#1e3a5f')}
    <div style="background:#fff;padding:36px 40px;">
      <p style="font-size:15px;color:#0f172a;line-height:1.7;margin:0 0 16px;">
        Your record request has been opened by the provider. They are aware of 
        your request and the 30-day response window is in effect.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Provider', targetEmail)}
        ${infoRow('Status', 'Request opened')}
      </table>
      <p style="font-size:14px;color:#64748b;line-height:1.7;margin:0 0 20px;">
        We'll notify you again once the provider uploads your records or 
        responds to your request. If you don't hear back within 30 days, 
        you may be entitled to escalate under GDPR Article 15.
      </p>
      ${ctaButton(`${emailUtils_1.APP_URL}/requests`, 'View your requests')}
      <div style="height:1px;background:#f1f5f9;margin:0 0 24px;"></div>
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">
        Questions? <a href="mailto:${emailUtils_1.SUPPORT_EMAIL}"
          style="color:#64748b;">${emailUtils_1.SUPPORT_EMAIL}</a>
        &nbsp;·&nbsp;
        <a href="${emailUtils_1.MARKETING_URL}" style="color:#64748b;">belrosehealth.com</a>
      </p>
    </div>
    ${footer()}
  `);
}
function buildRecordRequestViewedText(targetEmail) {
    return `Your record request to ${targetEmail} has been opened.

The provider is now aware of your request. The 30-day GDPR response window is in effect.

We'll notify you once they upload your records or respond. If you don't hear back within 30 days, you may be entitled to escalate under GDPR Article 15.

View your requests: ${emailUtils_1.APP_URL}/requests

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
// ─── Case 2: Request fulfilled ────────────────────────────────────────────────
function buildRecordRequestFulfilledHtml(targetEmail, firstRecordId) {
    const recordUrl = firstRecordId ? `${emailUtils_1.APP_URL}/records/${firstRecordId}` : `${emailUtils_1.APP_URL}/requests`;
    return wrap(`
    ${letterhead('Record Request · Fulfilled', '#166534')}
    <div style="background:#fff;padding:36px 40px;">
      <p style="font-size:15px;color:#0f172a;line-height:1.7;margin:0 0 16px;">
        Great news — <strong>${targetEmail}</strong> has uploaded your requested 
        health records to Belrose. Your records are encrypted and waiting for 
        you in your account.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Provider', targetEmail)}
        ${infoRow('Status', 'Records uploaded')}
      </table>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
        padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#166534;line-height:1.6;">
          Your records are end-to-end encrypted. Only you can decrypt and 
          view their contents.
        </p>
      </div>
      ${ctaButton(recordUrl, 'View your records →', '#166534')}
      <div style="height:1px;background:#f1f5f9;margin:0 0 24px;"></div>
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">
        Questions? <a href="mailto:${emailUtils_1.SUPPORT_EMAIL}"
          style="color:#64748b;">${emailUtils_1.SUPPORT_EMAIL}</a>
        &nbsp;·&nbsp;
        <a href="${emailUtils_1.MARKETING_URL}" style="color:#64748b;">belrosehealth.com</a>
      </p>
    </div>
    ${footer()}
  `);
}
function buildRecordRequestFulfilledText(targetEmail, firstRecordId) {
    const recordUrl = firstRecordId ? `${emailUtils_1.APP_URL}/records/${firstRecordId}` : `${emailUtils_1.APP_URL}/requests`;
    return `Your records have been uploaded by ${targetEmail}.

Your health records are now encrypted and waiting in your Belrose account.

View your records: ${recordUrl}

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
// ─── Case 3: Request denied ───────────────────────────────────────────────────
function buildRecordRequestDeniedHtml(targetEmail, deniedReason) {
    return wrap(`
    ${letterhead('Record Request · Declined', '#7f1d1d')}
    <div style="background:#fff;padding:36px 40px;">
      <p style="font-size:15px;color:#0f172a;line-height:1.7;margin:0 0 16px;">
        <strong>${targetEmail}</strong> has declined your record request.
        ${deniedReason ? `They provided the following reason:` : `No reason was provided.`}
      </p>
      ${deniedReason
        ? `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;
        padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;color:#7f1d1d;line-height:1.6;
          font-style:italic;">"${deniedReason}"</p>
      </div>`
        : ''}
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Provider', targetEmail)}
        ${infoRow('Status', 'Request declined')}
      </table>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;
        padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;
          color:#1e40af;">Your rights under GDPR</p>
        <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
          If you believe this denial is unjustified, you have the right to 
          complain to your national data protection authority. In the UK 
          this is the <strong>ICO</strong> — 
          <a href="https://ico.org.uk" style="color:#1d4ed8;">ico.org.uk</a>.
        </p>
      </div>
      ${ctaButton(`${emailUtils_1.APP_URL}/requests`, 'View your requests')}
      <div style="height:1px;background:#f1f5f9;margin:0 0 24px;"></div>
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">
        Questions? <a href="mailto:${emailUtils_1.SUPPORT_EMAIL}"
          style="color:#64748b;">${emailUtils_1.SUPPORT_EMAIL}</a>
        &nbsp;·&nbsp;
        <a href="${emailUtils_1.MARKETING_URL}" style="color:#64748b;">belrosehealth.com</a>
      </p>
    </div>
    ${footer()}
  `);
}
function buildRecordRequestDeniedText(targetEmail, deniedReason) {
    const reasonLine = deniedReason
        ? `\nReason provided: "${deniedReason}"\n`
        : `\nNo reason was provided.\n`;
    return `${targetEmail} has declined your record request.
${reasonLine}
If you believe this is unjustified, you have the right to complain to your national data protection authority. In the UK this is the ICO — https://ico.org.uk

View your requests: ${emailUtils_1.APP_URL}/requests

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
//# sourceMappingURL=recordRequestEmailTemplate.js.map