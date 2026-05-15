// functions/src/notifications/subjectEmailTemplates.ts
//
// HTML email templates for all subject consent request notifications.
// One builder per trigger case — call these from subjectNotificationTrigger.ts.
//
// Cases covered:
//   buildSubjectRequestHtml        → subject receives a new request
//   buildSubjectAcceptedHtml       → requester notified of acceptance
//   buildSubjectDeclinedHtml       → requester notified of initial decline
//   buildSubjectRemovedHtml        → record owners notified of removal after acceptance
//   buildCreatorResponseHtml       → subject notified of creator's response

import { APP_URL, MARKETING_URL, SUPPORT_EMAIL } from '../emailUtils';

// ─── Shared layout pieces ────────────────────────────────────────────────────

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

function ctaButton(href: string, label: string, color = '#3b82f6'): string {
  return `
    <div style="text-align:center;margin:28px 0;">
      <a href="${href}" style="display:inline-block;background:${color};color:#fff;
        font-size:15px;font-weight:600;text-decoration:none;
        padding:14px 32px;border-radius:10px;">
        ${label}
      </a>
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

function footer(): string {
  const year = new Date().getFullYear();
  return `
    <div style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;
      text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">
        Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:#3b82f6;
        text-decoration:none;">${SUPPORT_EMAIL}</a>
      </p>
      <p style="margin:0;font-size:11px;color:#cbd5e1;">
        <a href="${MARKETING_URL}" style="color:#cbd5e1;text-decoration:none;">
          Belrose Health</a> · © ${year} · 
        <a href="${APP_URL}/settings/notifications"
          style="color:#cbd5e1;text-decoration:none;">Manage email preferences</a>
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

function body(content: string): string {
  return `<div style="padding:32px 40px;">${content}</div>`;
}

// ─── Case 1: New subject request ─────────────────────────────────────────────

export function buildSubjectRequestHtml(
  requesterName: string,
  recordName: string,
  recordId: string
): string {
  const reviewUrl = `${APP_URL}/records/${recordId}/review-subject-request`;

  return wrap(`
    ${header(
      'Subject request',
      '#3b82f6',
      "You've been requested as a subject",
      `${requesterName} wants to associate you with a health record.`
    )}
    ${body(`
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        Hi — <strong>${requesterName}</strong> has requested to set you as the 
        subject of the following record. As the subject, you have full visibility 
        over the record and control over who can access it.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Record', recordName)}
        ${infoRow('Requested by', requesterName)}
        ${infoRow('Your role', 'Subject')}
      </table>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;
        padding:16px 20px;margin-bottom:8px;">
        <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
          You can <strong>accept</strong> (gain access to the record) or 
          <strong>decline</strong> (no further action required). 
          You're never obligated to accept.
        </p>
      </div>
      ${ctaButton(reviewUrl, 'Review request')}
    `)}
    ${footer()}
  `);
}

export function buildSubjectRequestText(
  requesterName: string,
  recordName: string,
  recordId: string
): string {
  return `${requesterName} has requested to set you as the subject of "${recordName}".

Review and respond at: ${APP_URL}/records/${recordId}/review-subject-request

You can accept (gaining access to the record) or decline — you're never obligated to accept.

Questions? ${SUPPORT_EMAIL}`;
}

// ─── Case 2: Request accepted ────────────────────────────────────────────────

export function buildSubjectAcceptedHtml(
  subjectName: string,
  recordName: string,
  recordId: string
): string {
  const recordUrl = `${APP_URL}/records/${recordId}`;

  return wrap(`
    ${header(
      'Request accepted',
      '#22c55e',
      `${subjectName} accepted your request`,
      `They are now the subject of "${recordName}".`
    )}
    ${body(`
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${subjectName}</strong> has accepted your subject request 
        for the record below. They now have subject-level access and 
        visibility over this record.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Record', recordName)}
        ${infoRow('Subject', subjectName)}
        ${infoRow('Status', 'Accepted')}
      </table>
      ${ctaButton(recordUrl, 'View record', '#22c55e')}
    `)}
    ${footer()}
  `);
}

export function buildSubjectAcceptedText(
  subjectName: string,
  recordName: string,
  recordId: string
): string {
  return `${subjectName} has accepted your subject request for "${recordName}".

View the record at: ${APP_URL}/records/${recordId}

Questions? ${SUPPORT_EMAIL}`;
}

// ─── Case 3: Request declined ────────────────────────────────────────────────

export function buildSubjectDeclinedHtml(
  subjectName: string,
  recordName: string,
  recordId: string
): string {
  const recordUrl = `${APP_URL}/records/${recordId}`;

  return wrap(`
    ${header(
      'Request declined',
      '#f59e0b',
      `${subjectName} declined your request`,
      `Your subject request for "${recordName}" was not accepted.`
    )}
    ${body(`
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${subjectName}</strong> has chosen not to be set as the 
        subject of the record below. The record remains unchanged — 
        you can update the subject at any time from the record settings.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Record', recordName)}
        ${infoRow('Requested subject', subjectName)}
        ${infoRow('Status', 'Declined')}
      </table>
      ${ctaButton(recordUrl, 'View record', '#f59e0b')}
    `)}
    ${footer()}
  `);
}

export function buildSubjectDeclinedText(
  subjectName: string,
  recordName: string,
  recordId: string
): string {
  return `${subjectName} has declined to be set as the subject of "${recordName}".

View the record at: ${APP_URL}/records/${recordId}

Questions? ${SUPPORT_EMAIL}`;
}

// ─── Case 4a: Subject removed after acceptance (notifies record owners) ───────

export function buildSubjectRemovedHtml(
  subjectName: string,
  recordName: string,
  recordId: string
): string {
  const reviewUrl = `${APP_URL}/records/${recordId}/review-rejection`;

  return wrap(`
    ${header(
      'Action required',
      '#ef4444',
      'A subject has removed themselves',
      `${subjectName} removed their subject status from "${recordName}".`
    )}
    ${body(`
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${subjectName}</strong> has withdrawn their subject status 
        from the record below after previously accepting. As a record owner, 
        you need to decide how to handle this change.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${infoRow('Record', recordName)}
        ${infoRow('Former subject', subjectName)}
      </table>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;
        padding:16px 20px;margin-bottom:8px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#991b1b;">
          Your options
        </p>
        <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.6;">
          <strong>Drop-It</strong> — Acknowledge the user's right to withdraw. No further action.<br/>
          <strong>Escalate</strong> — If you feel the record is crucial information to the 
          user's health record, you may escalate it to Belrose. Upon review we may publicly 
          log the subject's rejection. (No sensitive information will ever be disclosed)
        </p>
      </div>
      ${ctaButton(reviewUrl, 'Review and decide', '#ef4444')}
    `)}
    ${footer()}
  `);
}

export function buildSubjectRemovedText(
  subjectName: string,
  recordName: string,
  recordId: string
): string {
  return `Action required: ${subjectName} has removed their subject status from "${recordName}".

Review and decide at: ${APP_URL}/records/${recordId}/review-rejection

Options:
- Acknowledge: note the change privately
- Publicly list: disclose the removal on the public record log

Questions? ${SUPPORT_EMAIL}`;
}

// ─── Case 4b: Creator responded (notifies the subject) ───────────────────────

export function buildCreatorResponseHtml(
  recordName: string,
  recordId: string,
  escalated: boolean
): string {
  const recordUrl = `${APP_URL}/records/${recordId}`;
  const isEscalated = escalated;

  const badgeText = isEscalated ? 'Escalated' : 'Acknowledged';
  const badgeColor = isEscalated ? '#ef4444' : '#22c55e';
  const title = isEscalated
    ? 'Your removal has been escalated'
    : 'Your removal has been acknowledged';
  const subtitle = isEscalated
    ? `The record creator has escalated your subject removal for "${recordName}".`
    : `The record creator has acknowledged your subject removal for "${recordName}".`;
  const bodyText = isEscalated
    ? `The record owner has chosen to <strong>escalate</strong> your subject 
       status removal on the record log for <strong>${recordName}</strong>. 
       This means the change is visible as part of the record's transparency log. 
       No further action is required from you.`
    : `The record owner has <strong>acknowledged</strong> your subject status removal 
       from <strong>${recordName}</strong>. The change has been noted privately 
       and no further action is required from you.`;

  return wrap(`
    ${header(badgeText, badgeColor, title, subtitle)}
    ${body(`
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        ${bodyText}
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${infoRow('Record', recordName)}
        ${infoRow('Outcome', isEscalated ? 'Escalated' : 'Acknowledged privately')}
      </table>
      ${ctaButton(recordUrl, 'View record', badgeColor)}
    `)}
    ${footer()}
  `);
}

export function buildCreatorResponseText(
  recordName: string,
  recordId: string,
  escalated: boolean
): string {
  const outcome = escalated
    ? 'escalated your subject status removal'
    : 'acknowledged your subject status removal';
  return `The record creator has ${outcome} for "${recordName}".

View the record at: ${APP_URL}/records/${recordId}

Questions? ${SUPPORT_EMAIL}`;
}
