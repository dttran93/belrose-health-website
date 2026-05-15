import { APP_URL, MARKETING_URL, SUPPORT_EMAIL } from '../emailUtils';

type Role = 'owner' | 'administrator' | 'viewer';

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  administrator: 'Administrator',
  viewer: 'Viewer',
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'You can view, edit, share, and manage all aspects of this record.',
  administrator: 'You can view, edit, and share this record.',
  viewer: 'You can view this record.',
};

// ─── Shared layout helpers ────────────────────────────────────────────────────

function letterhead(
  badgeText: string,
  badgeColor: string,
  title: string,
  subtitle: string
): string {
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

function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;
        font-size:13px;color:#64748b;width:40%;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;
        font-size:13px;color:#1e293b;font-weight:500;">${value}</td>
    </tr>`;
}

function ctaButton(href: string, label: string, color = '#3b82f6'): string {
  return `
    <div style="text-align:center;margin:28px 0;">
      <a href="${href}" style="display:inline-block;background:${color};color:#fff;
        font-size:15px;font-weight:600;text-decoration:none;
        padding:14px 32px;border-radius:10px;">${label}</a>
    </div>`;
}

function footer(): string {
  const year = new Date().getFullYear();
  return `
    <div style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;
      text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">
        Questions? <a href="mailto:${SUPPORT_EMAIL}"
          style="color:#3b82f6;text-decoration:none;">${SUPPORT_EMAIL}</a>
      </p>
      <p style="margin:0;font-size:11px;color:#cbd5e1;">
        <a href="${MARKETING_URL}" style="color:#cbd5e1;text-decoration:none;">
          Belrose Health</a> · © ${year} · 
        <a href="${APP_URL}/settings/notifications"
          style="color:#cbd5e1;text-decoration:none;">Manage notification preferences</a>
      </p>
    </div>`;
}

function wrap(inner: string): string {
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

export function buildPermissionGrantedHtml(
  changedByName: string,
  recordId: string,
  newRole: Role,
  isUpgrade: boolean,
  previousRole?: Role
): string {
  const recordUrl = `${APP_URL}/records/${recordId}`;
  const badgeText = isUpgrade ? 'Access upgraded' : 'Access granted';
  const title = isUpgrade
    ? `Your access has been upgraded to ${ROLE_LABELS[newRole]}`
    : `You've been granted ${ROLE_LABELS[newRole]} access`;
  const subtitle = isUpgrade
    ? `${changedByName} upgraded your role from ${ROLE_LABELS[previousRole!]} to ${ROLE_LABELS[newRole]}`
    : `${changedByName} has given you access to a record`;

  return wrap(`
    ${letterhead(badgeText, '#22c55e', title, subtitle)}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        ${
          isUpgrade
            ? `<strong>${changedByName}</strong> has upgraded your access level on a record.`
            : `<strong>${changedByName}</strong> has granted you access to a record on Belrose.`
        }
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${isUpgrade ? infoRow('Previous role', ROLE_LABELS[previousRole!]) : ''}
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

export function buildPermissionGrantedText(
  changedByName: string,
  recordId: string,
  newRole: Role,
  isUpgrade: boolean,
  previousRole?: Role
): string {
  const action = isUpgrade
    ? `upgraded your access from ${previousRole} to ${newRole}`
    : `granted you ${newRole} access`;
  return `${changedByName} has ${action} on a record.

${ROLE_DESCRIPTIONS[newRole]}

View the record at: ${APP_URL}/records/${recordId}

Questions? ${SUPPORT_EMAIL}`;
}

// ─── Downgraded ───────────────────────────────────────────────────────────────

export function buildPermissionDowngradedHtml(
  changedByName: string,
  recordId: string,
  previousRole: Role,
  newRole: Role
): string {
  const recordUrl = `${APP_URL}/records/${recordId}`;

  return wrap(`
    ${letterhead(
      'Access changed',
      '#f59e0b',
      `Your access has been changed to ${ROLE_LABELS[newRole]}`,
      `${changedByName} changed your role from ${ROLE_LABELS[previousRole]} to ${ROLE_LABELS[newRole]}`
    )}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${changedByName}</strong> has updated your access level on a record.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
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

export function buildPermissionDowngradedText(
  changedByName: string,
  recordId: string,
  previousRole: Role,
  newRole: Role
): string {
  return `${changedByName} has changed your access from ${previousRole} to ${newRole} on a record.

${ROLE_DESCRIPTIONS[newRole]}

View the record at: ${APP_URL}/records/${recordId}

Questions? ${SUPPORT_EMAIL}`;
}

// ─── Revoked ─────────────────────────────────────────────────────────────────

export function buildPermissionRevokedHtml(
  changedByName: string,
  recordId: string,
  previousRole: Role
): string {
  return wrap(`
    ${letterhead(
      'Access removed',
      '#ef4444',
      'Your access has been removed',
      `${changedByName} removed your ${ROLE_LABELS[previousRole]} access`
    )}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${changedByName}</strong> has removed your access to a record
        on Belrose. You no longer have access to this record or its contents.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${infoRow('Removed role', ROLE_LABELS[previousRole])}
      </table>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;
        padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.6;">
          If you believe this was a mistake, please contact the record owner
          or reach out to our support team.
        </p>
      </div>
      ${ctaButton(`${APP_URL}/records`, 'View your records', '#0f172a')}
    </div>
    ${footer()}
  `);
}

export function buildPermissionRevokedText(
  changedByName: string,
  recordId: string,
  previousRole: Role
): string {
  return `${changedByName} has removed your ${previousRole} access to a record.

You no longer have access to this record or its contents.

If you believe this was a mistake, please contact the record owner or reach out to ${SUPPORT_EMAIL}.

View your records at: ${APP_URL}/records

Questions? ${SUPPORT_EMAIL}`;
}
