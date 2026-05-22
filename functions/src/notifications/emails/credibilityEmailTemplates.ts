// functions/src/notifications/emails/credibilityEmailTemplates.ts

// ─── Shared helpers ───────────────────────────────────────────────────────────

import { APP_URL, MARKETING_URL, SUPPORT_EMAIL } from '../emailUtils';

function header(badgeText: string, badgeColor: string, title: string, subtitle: string): string {
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

function ctaButton(href: string, label: string, color = '#0f172a'): string {
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

function wrap(body: string): string {
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

// ─── Verification added ───────────────────────────────────────────────────────

export function buildVerificationAddedHtml(
  verifierName: string,
  recordName: string,
  recordId: string,
  levelName: string
): string {
  return wrap(`
    ${header(
      'Verification added',
      '#22c55e',
      "A record you're connected to was verified",
      `${verifierName} added a ${levelName} verification`
    )}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${verifierName}</strong> has added a verification to a record 
        you're connected to, increasing its credibility score.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Record', recordName)}
        ${infoRow('Verified by', verifierName)}
        ${infoRow('Verification level', levelName)}
      </table>
      ${ctaButton(`${APP_URL}/records/${recordId}`, 'View record', '#22c55e')}
    </div>
    ${footer()}
  `);
}

export function buildVerificationAddedText(
  verifierName: string,
  recordName: string,
  recordId: string,
  levelName: string
): string {
  return `${verifierName} added a ${levelName} verification to ${recordName}.

This increases the record's credibility score.

View the record at: ${APP_URL}/records/${recordId}

Questions? ${SUPPORT_EMAIL}`;
}

// ─── Verification modified ────────────────────────────────────────────────────

export function buildVerificationModifiedHtml(
  verifierName: string,
  recordName: string,
  recordId: string,
  prevLevel: string,
  newLevel: string
): string {
  return wrap(`
    ${header(
      'Verification updated',
      '#3b82f6',
      'A verification was updated',
      `${verifierName} changed their verification level`
    )}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${verifierName}</strong> updated their verification on 
        ${recordName}.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Record', recordName)}
        ${infoRow('Previous level', prevLevel)}
        ${infoRow('New level', newLevel)}
      </table>
      ${ctaButton(`${APP_URL}/records/${recordId}`, 'View record')}
    </div>
    ${footer()}
  `);
}

export function buildVerificationModifiedText(
  verifierName: string,
  recordName: string,
  recordId: string,
  prevLevel: string,
  newLevel: string
): string {
  return `${verifierName} updated their verification on ${recordName} from ${prevLevel} to ${newLevel}.

View the record at: ${APP_URL}/records/${recordId}

Questions? ${SUPPORT_EMAIL}`;
}

// ─── Verification retracted ───────────────────────────────────────────────────

export function buildVerificationRetractedHtml(
  verifierName: string,
  recordName: string,
  recordId: string
): string {
  return wrap(`
    ${header(
      'Verification retracted',
      '#f59e0b',
      'A verification was retracted',
      `${verifierName} removed their verification`
    )}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${verifierName}</strong> has retracted their verification on 
        ${recordName}. This may affect the record's credibility score.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Record', recordName)}
        ${infoRow('Retracted by', verifierName)}
      </table>
      ${ctaButton(`${APP_URL}/records/${recordId}`, 'View record', '#f59e0b')}
    </div>
    ${footer()}
  `);
}

export function buildVerificationRetractedText(
  verifierName: string,
  recordName: string,
  recordId: string
): string {
  return `${verifierName} retracted their verification on ${recordName}.

This may affect the record's credibility score.

View the record at: ${APP_URL}/records/${recordId}

Questions? ${SUPPORT_EMAIL}`;
}

// ─── Dispute added ────────────────────────────────────────────────────────────

export function buildDisputeAddedHtml(
  disputerName: string,
  recordName: string,
  recordId: string,
  severityName: string
): string {
  return wrap(`
    ${header(
      'Dispute raised',
      '#ef4444',
      'A dispute has been raised on a record',
      `${disputerName} raised a ${severityName} dispute`
    )}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${disputerName}</strong> has raised a dispute on a record 
        you're connected to. This affects the record's credibility score 
        and may warrant review.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${infoRow('Record', recordName)}
        ${infoRow('Disputed by', disputerName)}
        ${infoRow('Severity', severityName)}
      </table>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;
        padding:16px 20px;margin-bottom:8px;">
        <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.6;">
          You can view the full dispute details on the record page.
        </p>
      </div>
      ${ctaButton(`${APP_URL}/records/${recordId}`, 'View dispute', '#ef4444')}
    </div>
    ${footer()}
  `);
}

export function buildDisputeAddedText(
  disputerName: string,
  recordName: string,
  recordId: string,
  severityName: string
): string {
  return `${disputerName} raised a ${severityName} dispute on ${recordName}.

This affects the record's credibility score and may warrant review.

View the record at: ${APP_URL}/records/${recordId}

Questions? ${SUPPORT_EMAIL}`;
}

// ─── Dispute modified ─────────────────────────────────────────────────────────

export function buildDisputeModifiedHtml(
  disputerName: string,
  recordName: string,
  recordId: string,
  newSeverity: string
): string {
  return wrap(`
    ${header(
      'Dispute updated',
      '#f59e0b',
      'A dispute was updated',
      `${disputerName} modified their dispute`
    )}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${disputerName}</strong> has updated their dispute on ${recordName}.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Record', recordName)}
        ${infoRow('Updated by', disputerName)}
        ${infoRow('New severity', newSeverity)}
      </table>
      ${ctaButton(`${APP_URL}/records/${recordId}`, 'View dispute', '#f59e0b')}
    </div>
    ${footer()}
  `);
}

export function buildDisputeModifiedText(
  disputerName: string,
  recordName: string,
  recordId: string,
  newSeverity: string
): string {
  return `${disputerName} updated their dispute on ${recordName} to ${newSeverity} severity.

View the record at: ${APP_URL}/records/${recordId}

Questions? ${SUPPORT_EMAIL}`;
}

// ─── Dispute retracted ────────────────────────────────────────────────────────

export function buildDisputeRetractedHtml(
  disputerName: string,
  recordName: string,
  recordId: string
): string {
  return wrap(`
    ${header(
      'Dispute retracted',
      '#22c55e',
      'A dispute was retracted',
      `${disputerName} withdrew their dispute`
    )}
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${disputerName}</strong> has retracted their dispute on 
        ${recordName}. The record's credibility score has been updated accordingly.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Record', recordName)}
        ${infoRow('Retracted by', disputerName)}
      </table>
      ${ctaButton(`${APP_URL}/records/${recordId}`, 'View record', '#22c55e')}
    </div>
    ${footer()}
  `);
}

export function buildDisputeRetractedText(
  disputerName: string,
  recordName: string,
  recordId: string
): string {
  return `${disputerName} retracted their dispute on ${recordName}.

The record's credibility score has been updated accordingly.

View the record at: ${APP_URL}/records/${recordId}

Questions? ${SUPPORT_EMAIL}`;
}
