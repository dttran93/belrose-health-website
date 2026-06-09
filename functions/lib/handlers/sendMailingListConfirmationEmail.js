"use strict";
// functions/src/handlers/sendMailingListConfirmationEmail.ts
//
// Triggered automatically when a `mailingList/{email}` document is CREATED.
// Sends a branded confirmation email letting them know they've been added
// to Belrose development updates.
//
// HOW IT WORKS:
//   1. The frontend writes a `mailingList/{email}` Firestore document
//      (only if they're not already on the waitlist/mailingList)
//   2. This function fires automatically and emails them a confirmation
//
// FIRESTORE STRUCTURE:
//   mailingList/{email}
//     email: string
//     consentText: string           ← exact wording they agreed to (GDPR)
//     consentTimestamp: Timestamp   ← set by frontend via serverTimestamp()
//     source: string                ← e.g. 'learnMoreHub'
//     resourceAccessed: string      ← which doc triggered the capture
//     status: 'active' | 'unsubscribed'
//     notified: boolean             ← set to true after this function runs
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMailingListConfirmationEmail = void 0;
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const firestore_1 = require("firebase-functions/v2/firestore");
const resend_1 = require("resend");
const resendKey = (0, params_1.defineSecret)('RESEND_API_KEY');
const MARKETING_URL = 'https://belrosehealth.com/#about';
const FROM_EMAIL = 'noreply@belrosehealth.com';
const FROM_NAME = 'Belrose Health';
exports.sendMailingListConfirmationEmail = (0, firestore_1.onDocumentCreated)({
    document: 'mailingList/{email}',
    secrets: [resendKey],
}, async (event) => {
    const email = event.params.email;
    console.log(`✉️  Sending mailing list confirmation to: ${email}`);
    try {
        await event.data.ref.update({
            notified: true,
            notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const resend = new resend_1.Resend(resendKey.value());
        await resend.emails.send({
            to: email,
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            subject: "You're on our list — here's what we're building at Belrose",
            html: buildMailingListEmailHtml(MARKETING_URL),
            text: buildMailingListEmailText(MARKETING_URL),
        });
        console.log(`✅ Mailing list confirmation sent to ${email}`);
        return null;
    }
    catch (error) {
        console.error(`❌ Failed to send mailing list confirmation to ${email}:`, error);
        return null;
    }
});
// ── Email templates ───────────────────────────────────────────────────────────
function buildMailingListEmailHtml(marketingUrl) {
    return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Thanks for your interest in Belrose</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        background: #f4f4f5;
        color: #18181b;
      }
      .wrapper {
        max-width: 560px;
        margin: 40px auto;
        background: #fff;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      }
      .header {
        background: #0f172a;
        padding: 40px 40px 32px;
        text-align: center;
      }
      .badge {
        display: inline-block;
        background: #3b82f620;
        color: #60a5fa;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        padding: 4px 12px;
        border-radius: 100px;
        border: 1px solid #3b82f640;
      }
      .header h1 {
        color: #f8fafc;
        font-size: 24px;
        font-weight: 700;
        margin: 16px 0 8px;
        letter-spacing: -0.5px;
      }
      .header p {
        color: #94a3b8;
        font-size: 14px;
        margin: 0;
      }
      .body {
        padding: 36px 40px;
      }
      .body p {
        font-size: 15px;
        line-height: 1.7;
        color: #3f3f46;
        margin: 0 0 16px;
      }
      .mission-block {
        background: #0f172a;
        border-radius: 12px;
        padding: 28px;
        margin: 28px 0;
      }
      .mission-block p {
        color: #cbd5e1;
        font-size: 14px;
        line-height: 1.8;
        margin: 0 0 12px;
      }
      .mission-block p:last-child {
        margin: 0;
      }
      .mission-block strong {
        color: #f8fafc;
      }
      .cta-block {
        text-align: center;
        margin: 28px 0;
      }
      .cta-button {
        display: inline-block;
        background: #0f172a;
        color: #ffffff !important;
        text-decoration: none;
        padding: 14px 36px;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 600;
      }
      .divider {
        height: 1px;
        background: #f1f5f9;
        margin: 24px 0;
      }
      .footer {
        background: #f8fafc;
        padding: 20px 40px;
        text-align: center;
      }
      .footer p {
        font-size: 12px;
        color: #94a3b8;
        margin: 0;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="header">
        <span class="badge">Confirmed</span>
        <h1>Thanks for your interest</h1>
        <p>We'll keep you updated on Belrose development</p>
      </div>
      <div class="body">
        <p>Hello!</p>
        <p>
          Thanks for signing up for the mailing list. Expect occasional emails about what we're
          working on and updates to our milestones.
        </p>

        <div class="mission-block">
          <p>
            <strong>Most people accept the status quo. Not you.</strong>
          </p>
          <p>
            That instinct — that your health story belongs to you — is exactly what Belrose Health
            is built on. With you on our team, we are one step closer to a healthier and more
            equitable world.
          </p>
        </div>

        <div class="cta-block">
          <a href="${marketingUrl}" class="cta-button">Learn more about Belrose →</a>
        </div>

        <div class="divider"></div>

        <p style="font-size: 13px; color: #94a3b8">
          Questions? Reach us at
          <a href="mailto:hello@belrosehealth.com" style="color: #64748b">hello@belrosehealth.com</a
          >.
        </p>
      </div>
      <div class="footer">
        <p>
          © ${new Date().getFullYear()} Belrose Health. All rights reserved.<br />
          You received this because you opted in at ${marketingUrl}.<br />
          <a href="mailto:hello@belrosehealth.com?subject=Unsubscribe" style="color: #94a3b8"
            >Unsubscribe</a
          >
        </p>
      </div>
    </div>
  </body>
</html>

  `.trim();
}
function buildMailingListEmailText(marketingUrl) {
    return `
Thanks for signing up for the mailing list. Expect occasional emails about what we're working on and updates to our milestones.

Most people accept the status quo. Not you.

That instinct — that your health story belongs to you — is exactly what Belrose Health is built on. With you on our team, we are one step closer to a healthier and more equitable world.

Learn more: ${marketingUrl}

Questions? Email hello@belrosehealth.com

---
© ${new Date().getFullYear()} Belrose Health
You received this because you opted in at ${marketingUrl}.
To unsubscribe, reply with "unsubscribe" or email hello@belrosehealth.com
  `.trim();
}
//# sourceMappingURL=sendMailingListConfirmationEmail.js.map