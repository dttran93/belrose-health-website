"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPermissionGrantedHtml = buildPermissionGrantedHtml;
exports.buildPermissionGrantedText = buildPermissionGrantedText;
exports.buildPermissionDowngradedHtml = buildPermissionDowngradedHtml;
exports.buildPermissionDowngradedText = buildPermissionDowngradedText;
exports.buildPermissionRevokedHtml = buildPermissionRevokedHtml;
exports.buildPermissionRevokedText = buildPermissionRevokedText;
const emailUtils_1 = require("../emailUtils");
const ROLE_LABELS = {
    owner: 'Owner',
    administrator: 'Administrator',
    viewer: 'Viewer',
};
const ROLE_DESCRIPTIONS = {
    owner: 'You can view, edit, share, and manage all aspects of this record.',
    administrator: 'You can view, edit, and share this record.',
    viewer: 'You can view this record.',
};
// ─── Shared layout helpers ────────────────────────────────────────────────────
function letterhead(badgeText, badgeColor, title, subtitle) {
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
function ctaButton(href, label, color = '#3b82f6') {
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
function wrap(inner) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;
  font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#18181b;">
  <div style="max-width:560px;margin:40px auto;background:#fff;
    border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    ${inner}
  </div>
</body>
</html>`;
}
// ─── Granted / Upgraded ───────────────────────────────────────────────────────
function buildPermissionGrantedHtml(changedByName, recordId, newRole, isUpgrade, previousRole) {
    const recordUrl = `${emailUtils_1.APP_URL}/records/${recordId}`;
    const badgeText = isUpgrade ? 'Access upgraded' : 'Access granted';
    const title = isUpgrade
        ? `Your access has been upgraded to ${ROLE_LABELS[newRole]}`
        : `You've been granted ${ROLE_LABELS[newRole]} access`;
    const subtitle = isUpgrade
        ? `${changedByName} upgraded your role from ${ROLE_LABELS[previousRole]} to ${ROLE_LABELS[newRole]}`
        : `${changedByName} has given you access to a record`;
    return wrap(`
    ${letterhead(badgeText, '#22c55e', title, subtitle)}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        ${isUpgrade
        ? `<strong>${changedByName}</strong> has upgraded your access level on a record.`
        : `<strong>${changedByName}</strong> has granted you access to a record on Belrose.`}
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${infoRow('Record', recordId)}
        ${isUpgrade ? infoRow('Previous role', ROLE_LABELS[previousRole]) : ''}
        ${infoRow('Your role', ROLE_LABELS[newRole])}
      </table>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
        padding:16px 20px;margin-bottom:8px;">
        <p style="margin:0;font-size:13px;color:#166534;line-height:1.6;">
          ${ROLE_DESCRIPTIONS[newRole]}
        </p>
      </div>
      ${ctaButton(recordUrl, 'View record', '#22c55e')}
    </div>
    ${footer()}
  `);
}
function buildPermissionGrantedText(changedByName, recordId, newRole, isUpgrade, previousRole) {
    const action = isUpgrade
        ? `upgraded your access from ${previousRole} to ${newRole}`
        : `granted you ${newRole} access`;
    return `${changedByName} has ${action} on a record.

${ROLE_DESCRIPTIONS[newRole]}

View the record at: ${emailUtils_1.APP_URL}/records/${recordId}

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
// ─── Downgraded ───────────────────────────────────────────────────────────────
function buildPermissionDowngradedHtml(changedByName, recordId, previousRole, newRole) {
    const recordUrl = `${emailUtils_1.APP_URL}/records/${recordId}`;
    return wrap(`
    ${letterhead('Access changed', '#f59e0b', `Your access has been changed to ${ROLE_LABELS[newRole]}`, `${changedByName} changed your role from ${ROLE_LABELS[previousRole]} to ${ROLE_LABELS[newRole]}`)}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${changedByName}</strong> has updated your access level on a record.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${infoRow('Record', recordId)}
        ${infoRow('Previous role', ROLE_LABELS[previousRole])}
        ${infoRow('New role', ROLE_LABELS[newRole])}
      </table>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;
        padding:16px 20px;margin-bottom:8px;">
        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
          ${ROLE_DESCRIPTIONS[newRole]}
        </p>
      </div>
      ${ctaButton(recordUrl, 'View record', '#f59e0b')}
    </div>
    ${footer()}
  `);
}
function buildPermissionDowngradedText(changedByName, recordId, previousRole, newRole) {
    return `${changedByName} has changed your access from ${previousRole} to ${newRole} on a record.

${ROLE_DESCRIPTIONS[newRole]}

View the record at: ${emailUtils_1.APP_URL}/records/${recordId}

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
// ─── Revoked ─────────────────────────────────────────────────────────────────
function buildPermissionRevokedHtml(changedByName, recordId, previousRole) {
    return wrap(`
    ${letterhead('Access removed', '#ef4444', 'Your access has been removed', `${changedByName} removed your ${ROLE_LABELS[previousRole]} access`)}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${changedByName}</strong> has removed your access to a record
        on Belrose. You no longer have access to this record or its contents.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${infoRow('Record', recordId)}
        ${infoRow('Removed role', ROLE_LABELS[previousRole])}
      </table>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;
        padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.6;">
          If you believe this was a mistake, please contact the record owner
          or reach out to our support team.
        </p>
      </div>
      ${ctaButton(`${emailUtils_1.APP_URL}/records`, 'View your records', '#0f172a')}
    </div>
    ${footer()}
  `);
}
function buildPermissionRevokedText(changedByName, recordId, previousRole) {
    return `${changedByName} has removed your ${previousRole} access to a record.

You no longer have access to this record or its contents.

If you believe this was a mistake, please contact the record owner or reach out to ${emailUtils_1.SUPPORT_EMAIL}.

View your records at: ${emailUtils_1.APP_URL}/records

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
//# sourceMappingURL=permissionEmailTemplate.js.map