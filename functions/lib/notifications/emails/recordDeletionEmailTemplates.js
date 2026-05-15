"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRecordDeletedHtml = buildRecordDeletedHtml;
exports.buildRecordDeletedText = buildRecordDeletedText;
const emailUtils_1 = require("../emailUtils");
function buildRecordDeletedHtml(deleterName, recordName) {
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
      <span style="display:inline-block;background:#ef444420;color:#f87171;
        font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;
        padding:4px 12px;border-radius:100px;border:1px solid #ef444440;margin:12px 0 16px;">
        Record deleted
      </span>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f8fafc;
        letter-spacing:-0.5px;line-height:1.3;">
        A record you had access to was deleted
      </h1>
      <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.5;">
        ${deleterName} has deleted ${recordName}
      </p>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3f3f46;">
        <strong>${deleterName}</strong> has deleted a record you 
        had access to. You no longer have access to this record or its contents.  
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;
            font-size:13px;color:#64748b;width:40%;">Record</td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;
            font-size:13px;color:#1e293b;font-weight:500;">${recordName}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-size:13px;color:#64748b;">Deleted by</td>
          <td style="padding:10px 0;font-size:13px;
            color:#1e293b;font-weight:500;">${deleterName}</td>
        </tr>
      </table>

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;
        padding:16px 20px;margin-bottom:28px;">
        <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.6;">
            If you believe this was a mistake please reach out to ${deleterName} or contact us at ${emailUtils_1.SUPPORT_EMAIL}.
        </p>
      </div>

      <div style="text-align:center;">
        <a href="${emailUtils_1.APP_URL}/records" style="display:inline-block;background:#0f172a;color:#fff;
          font-size:15px;font-weight:600;text-decoration:none;
          padding:14px 32px;border-radius:10px;">
          View your records
        </a>
      </div>
    </div>

    <!-- Footer -->
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
    </div>

  </div>
</body>
</html>`;
}
function buildRecordDeletedText(deleterName, recordName) {
    return `${deleterName} has deleted "${recordName}".

You no longer have access to this record or its contents. If you believe this was a mistake please reach out to ${emailUtils_1.SUPPORT_EMAIL} 
or contact ${deleterName}.    

View your records at: ${emailUtils_1.APP_URL}/records

Questions? ${emailUtils_1.SUPPORT_EMAIL}`;
}
//# sourceMappingURL=recordDeletionEmailTemplates.js.map