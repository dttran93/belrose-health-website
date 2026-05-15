"use strict";
// functions/src/notifications/emails/trusteeEmailTemplates.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTrusteeInvitedHtml = buildTrusteeInvitedHtml;
exports.buildTrusteeInvitedText = buildTrusteeInvitedText;
exports.buildTrusteeAcceptedHtml = buildTrusteeAcceptedHtml;
exports.buildTrusteeAcceptedText = buildTrusteeAcceptedText;
exports.buildTrusteeDeclinedHtml = buildTrusteeDeclinedHtml;
exports.buildTrusteeDeclinedText = buildTrusteeDeclinedText;
exports.buildTrusteeRevokedHtml = buildTrusteeRevokedHtml;
exports.buildTrusteeRevokedText = buildTrusteeRevokedText;
exports.buildTrusteeResignedHtml = buildTrusteeResignedHtml;
exports.buildTrusteeResignedText = buildTrusteeResignedText;
exports.buildTrusteeLevelChangedHtml = buildTrusteeLevelChangedHtml;
exports.buildTrusteeLevelChangedText = buildTrusteeLevelChangedText;
const emailUtils_1 = require("../emailUtils");
function header(badgeText, badgeColor, title, subtitle) {
    return `
    <div style="background:#0f172a;padding:36px 40px 28px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#f8fafc;
        letter-spacing:1.5px;text-transform:uppercase;">Belrose Health</p>
      <span style="display:inline-block;background:${badgeColor}20;color:${badgeColor};
        font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;
        padding:4px 12px;border-radius:100px;border:1px solid ${badgeColor}40;margin:12px 0 16px;">
        ${badgeText}
      </span>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f8fafc;
        letter-spacing:-0.5px;line-height:1.3;">${title}</h1>
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.5;">${subtitle}</p>
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
function ctaButton(href, label, color = '#0f172a') {
    return `
    <div style="text-align:center;margin:28px 0;">
      <a href="${href}" style="display:inline-block;background:${color};color:#fff;
        font-size:15px;font-weight:600;text-decoration:none;
        padding:14px 32px;border-radius:10px;">${label}</a>
    </div>`;
}
function footer() {
    const year = new Date().getFullYear();
    return `
    <div style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;
      text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">
        Questions? <a href="mailto:${emailUtils_1.SUPPORT_EMAIL}"
          style="color:#3b82f6;text-decoration:none;">${emailUtils_1.SUPPORT_EMAIL}</a>
      </p>
      <p style="margin:0;font-size:11px;color:#cbd5e1;">
        <a href="${emailUtils_1.MARKETING_URL}" style="color:#cbd5e1;text-decoration:none;">
          Belrose Health</a> · © ${year} ·
        <a href="${emailUtils_1.APP_URL}/settings/notifications"
          style="color:#cbd5e1;text-decoration:none;">Manage notification preferences</a>
      </p>
    </div>`;
}
function wrap(body) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;
  font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#18181b;">
  <div style="max-width:560px;margin:40px auto;background:#fff;
    border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    ${body}
  </div>
</body>
</html>`;
}
// ─── Invite received ──────────────────────────────────────────────────────────
function buildTrusteeInvitedHtml(trustorName, levelLabel, levelDescription) {
    return wrap(`
    ${header('Trustee invite', '#8b5cf6', `${trustorName} invited you to be their trustee`, `You've been invited as a ${levelLabel} trustee`)}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${trustorName}</strong> has invited you to act as their
        <strong>${levelLabel}</strong> trustee on Belrose Health.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${infoRow('Invited by', trustorName)}
        ${infoRow('Trust level', levelLabel)}
      </table>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;
        padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#5b21b6;">
          What this means
        </p>
        <p style="margin:0;font-size:13px;color:#6d28d9;line-height:1.6;">
          ${levelDescription}
        </p>
      </div>
      ${ctaButton(`${emailUtils_1.APP_URL}/trustees`, 'Review invite', '#8b5cf6')}
    </div>
    ${footer()}
  `);
}
function buildTrusteeInvitedText(trustorName, levelLabel, levelDescription) {
    return `${trustorName} has invited you to be their ${levelLabel} trustee on Belrose Health.

What this means: ${levelDescription}

Review the invite at: ${emailUtils_1.APP_URL}/trustees

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
// ─── Invite accepted ──────────────────────────────────────────────────────────
function buildTrusteeAcceptedHtml(trusteeName, levelLabel) {
    return wrap(`
    ${header('Invite accepted', '#22c55e', `${trusteeName} is now your trustee`, `${trusteeName} accepted your ${levelLabel} trustee invite`)}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${trusteeName}</strong> has accepted your trustee invite and
        now has <strong>${levelLabel}</strong> access on your account.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Trustee', trusteeName)}
        ${infoRow('Trust level', levelLabel)}
        ${infoRow('Status', 'Active')}
      </table>
      ${ctaButton(`${emailUtils_1.APP_URL}/trustees`, 'Manage trustees', '#22c55e')}
    </div>
    ${footer()}
  `);
}
function buildTrusteeAcceptedText(trusteeName, levelLabel) {
    return `${trusteeName} accepted your ${levelLabel} trustee invite and is now active on your account.

Manage your trustees at: ${emailUtils_1.APP_URL}/trustees

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
// ─── Invite declined ──────────────────────────────────────────────────────────
function buildTrusteeDeclinedHtml(trusteeName, levelLabel) {
    return wrap(`
    ${header('Invite declined', '#f59e0b', `${trusteeName} declined your invite`, `Your ${levelLabel} trustee invite was not accepted`)}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${trusteeName}</strong> has declined your <strong>${levelLabel}</strong>
        trustee invite. You can invite someone else from your trustees page.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Invited user', trusteeName)}
        ${infoRow('Trust level', levelLabel)}
        ${infoRow('Status', 'Declined')}
      </table>
      ${ctaButton(`${emailUtils_1.APP_URL}/trustees`, 'Manage trustees', '#f59e0b')}
    </div>
    ${footer()}
  `);
}
function buildTrusteeDeclinedText(trusteeName, levelLabel) {
    return `${trusteeName} declined your ${levelLabel} trustee invite.

You can invite someone else from your trustees page: ${emailUtils_1.APP_URL}/trustees

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
// ─── Trustee revoked ──────────────────────────────────────────────────────────
function buildTrusteeRevokedHtml(trustorName, levelLabel) {
    return wrap(`
    ${header('Access revoked', '#ef4444', 'Your trustee access has been revoked', `${trustorName} removed your ${levelLabel} trustee status`)}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${trustorName}</strong> has revoked your <strong>${levelLabel}</strong>
        trustee access. You no longer have access to their records or account.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Account owner', trustorName)}
        ${infoRow('Previous level', levelLabel)}
        ${infoRow('Status', 'Revoked')}
      </table>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;
        padding:16px 20px;margin-bottom:8px;">
        <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.6;">
          If you believe this was a mistake, please contact ${trustorName} directly.
        </p>
      </div>
      ${ctaButton(`${emailUtils_1.APP_URL}/trustees`, 'View your trustees', '#ef4444')}
    </div>
    ${footer()}
  `);
}
function buildTrusteeRevokedText(trustorName, levelLabel) {
    return `${trustorName} has revoked your ${levelLabel} trustee access.

You no longer have access to their records or account. If you believe this was a mistake, please contact ${trustorName} directly.

View your trustees at: ${emailUtils_1.APP_URL}/trustees

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
// ─── Trustee resigned ────────────────────────────────────────────────────────
function buildTrusteeResignedHtml(trusteeName, levelLabel) {
    return wrap(`
    ${header('Trustee resigned', '#f59e0b', `${trusteeName} has resigned`, `Your ${levelLabel} trustee stepped down`)}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${trusteeName}</strong> has resigned as your <strong>${levelLabel}</strong>
        trustee. They no longer have access to your records or account.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Former trustee', trusteeName)}
        ${infoRow('Previous level', levelLabel)}
        ${infoRow('Status', 'Resigned')}
      </table>
      ${ctaButton(`${emailUtils_1.APP_URL}/trustees`, 'Manage trustees', '#f59e0b')}
    </div>
    ${footer()}
  `);
}
function buildTrusteeResignedText(trusteeName, levelLabel) {
    return `${trusteeName} has resigned as your ${levelLabel} trustee.

They no longer have access to your records or account. You can appoint a new trustee from your trustees page.

Manage your trustees at: ${emailUtils_1.APP_URL}/trustees

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
// ─── Trust level changed ──────────────────────────────────────────────────────
function buildTrusteeLevelChangedHtml(trustorName, prevLabel, newLabel, newDescription, isUpgrade) {
    const badgeColor = isUpgrade ? '#22c55e' : '#f59e0b';
    const action = isUpgrade ? 'upgraded' : 'changed';
    return wrap(`
    ${header(`Level ${action}`, badgeColor, `Your trustee level was ${action}`, `${trustorName} ${action} your trust level from ${prevLabel} to ${newLabel}`)}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${trustorName}</strong> has ${action} your trustee level.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${infoRow('Previous level', prevLabel)}
        ${infoRow('New level', newLabel)}
      </table>
      <div style="background:${isUpgrade ? '#f0fdf4' : '#fffbeb'};
        border:1px solid ${isUpgrade ? '#bbf7d0' : '#fde68a'};border-radius:10px;
        padding:16px 20px;margin-bottom:8px;">
        <p style="margin:0;font-size:13px;
          color:${isUpgrade ? '#166534' : '#92400e'};line-height:1.6;">
          ${newDescription}
        </p>
      </div>
      ${ctaButton(`${emailUtils_1.APP_URL}/trustees`, 'View trustee relationships', badgeColor)}
    </div>
    ${footer()}
  `);
}
function buildTrusteeLevelChangedText(trustorName, prevLabel, newLabel, isUpgrade) {
    const action = isUpgrade ? 'upgraded' : 'changed';
    return `${trustorName} has ${action} your trustee level from ${prevLabel} to ${newLabel}.

View your trustee relationships at: ${emailUtils_1.APP_URL}/trustees

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
//# sourceMappingURL=trusteeEmailTemplates.js.map