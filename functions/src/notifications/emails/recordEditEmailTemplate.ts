// functions/src/notifications/triggers/recordEditEmailTemplates.ts

import { APP_URL, MARKETING_URL, SUPPORT_EMAIL } from '../emailUtils';

export function buildRecordEditedHtml(
  editorName: string,
  recordName: string,
  recordId: string,
  versionNumber: number
): string {
  const recordUrl = `${APP_URL}/records/${recordId}`;
  const year = new Date().getFullYear();

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

    <!-- Header -->
    <div style="background:#0f172a;padding:36px 40px 28px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#f8fafc;
        letter-spacing:1.5px;text-transform:uppercase;">Belrose Health</p>
      <span style="display:inline-block;background:#3b82f620;color:#60a5fa;
        font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;
        padding:4px 12px;border-radius:100px;border:1px solid #3b82f640;margin:12px 0 16px;">
        Record edited
      </span>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f8fafc;
        letter-spacing:-0.5px;line-height:1.3;">
        A record was updated
      </h1>
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.5;">
        ${editorName} made changes to ${recordName}
      </p>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${editorName}</strong> has saved a new version of a record 
        you're connected to. You can view the full change history from the 
        record page.
      </p>

      <!-- Details table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;
            font-size:13px;color:#64748b;width:40%;">Record</td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;
            font-size:13px;color:#1e293b;font-weight:500;">${recordId}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;
            font-size:13px;color:#64748b;">Edited by</td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;
            font-size:13px;color:#1e293b;font-weight:500;">${editorName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;
            font-size:13px;color:#64748b;">Version</td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;
            font-size:13px;color:#1e293b;font-weight:500;">${versionNumber}</td>
        </tr>
      </table>

      <!-- CTA -->
      <div style="text-align:center;margin:28px 0;">
        <a href="${recordUrl}" style="display:inline-block;background:#3b82f6;color:#fff;
          font-size:15px;font-weight:600;text-decoration:none;
          padding:14px 32px;border-radius:10px;">
          View record
        </a>
      </div>
    </div>

    <!-- Footer -->
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
          style="color:#cbd5e1;text-decoration:none;">Manage email preferences</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

export function buildRecordEditedText(
  editorName: string,
  recordName: string,
  recordId: string,
  versionNumber: number
): string {
  return `${editorName} has saved a new version of ${recordName} (version ${versionNumber}).

View the record at: ${APP_URL}/records/${recordId}

Questions? ${SUPPORT_EMAIL}`;
}
