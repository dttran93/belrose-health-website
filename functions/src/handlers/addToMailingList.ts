// functions/src/handlers/addToMailingList.ts
//
// HTTPS callable function that handles the full mailing list signup flow:
//   1. Validates the email
//   2. Checks if already on the waitlist (skip if so)
//   3. Checks for duplicate mailing list entry (skip if so)
//   4. Writes the mailingList doc
//   5. Sends the confirmation email via Resend
//
// FRONTEND USAGE:
//   const addToMailingList = httpsCallable(getFunctions(), 'addToMailingList');
//   await addToMailingList({ email, source, resourceAccessed, consentText });
//
// FIRESTORE STRUCTURE:
//   mailingList/{email}
//     email: string
//     consentText: string           ← exact wording shown to user (GDPR)
//     consentTimestamp: Timestamp
//     source: string                ← which surface triggered signup
//     resourceAccessed: string      ← e.g. 'whitepaper' (optional)
//     status: 'active' | 'unsubscribed'
//     notified: boolean
//     notifiedAt: Timestamp

import { FROM_EMAIL, FROM_NAME, MARKETING_URL } from '../notifications/emailUtils';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Resend } from 'resend';

const resendKey = defineSecret('RESEND_API_KEY');

// ============================================================================
// TYPES
// ============================================================================

interface AddToMailingListRequest {
  email: string;
  source: string;
  consentText: string;
  resourceAccessed?: string;
}

type AddToMailingListStatus = 'success' | 'waitlist' | 'duplicate';

interface AddToMailingListResponse {
  status: AddToMailingListStatus;
}

// ============================================================================
// CALLABLE FUNCTION
// ============================================================================

export const addToMailingList = onCall<AddToMailingListRequest, Promise<AddToMailingListResponse>>(
  { secrets: [resendKey] },
  async request => {
    const { email, source, consentText, resourceAccessed } = request.data;

    // ── 1. Validate ──────────────────────────────────────────────────────────
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError('invalid-argument', 'Invalid email address.');
    }
    if (!source) {
      throw new HttpsError('invalid-argument', 'Source is required.');
    }
    if (!consentText) {
      throw new HttpsError('invalid-argument', 'Consent text is required.');
    }

    const normalised = email.trim().toLowerCase();
    const db = admin.firestore();

    // ── 2. Waitlist check ────────────────────────────────────────────────────
    // If they're already on the waitlist they'll receive comms through
    // that flow — don't double up
    const waitlistDoc = await db.doc(`waitlist/${normalised}`).get();
    if (waitlistDoc.exists) {
      console.log(`⏭️  ${normalised} is on waitlist, skipping mailing list`);
      return { status: 'waitlist' };
    }

    // ── 3. Duplicate check ───────────────────────────────────────────────────
    const existingDoc = await db.doc(`mailingList/${normalised}`).get();
    if (existingDoc.exists) {
      console.log(`⏭️  ${normalised} already on mailing list`);
      return { status: 'duplicate' };
    }

    // ── 4. Write Firestore doc ───────────────────────────────────────────────
    await db.doc(`mailingList/${normalised}`).set({
      email: normalised,
      consentText,
      consentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      source,
      resourceAccessed: resourceAccessed ?? null,
      status: 'active',
      notified: false,
    });

    console.log(`✉️  Sending mailing list confirmation to: ${normalised}`);

    // ── 5. Send confirmation email ───────────────────────────────────────────
    // Mark notified BEFORE sending — if Resend succeeds but the update
    // fails we miss one email; if we update after and the function
    // retries, we'd send a duplicate. Missing one is the lesser evil.
    await db.doc(`mailingList/${normalised}`).update({
      notified: true,
      notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const resend = new Resend(resendKey.value());

    await resend.emails.send({
      to: normalised,
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      subject: "You're on our list — here's what we're building at Belrose",
      html: buildMailingListEmailHtml(MARKETING_URL),
      text: buildMailingListEmailText(MARKETING_URL),
    });

    console.log(`✅ Mailing list confirmation sent to ${normalised}`);
    return { status: 'success' };
  }
);

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function buildMailingListEmailHtml(marketingUrl: string): string {
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
          <a href="mailto:hello@belrosehealth.com" style="color: #64748b">
            hello@belrosehealth.com
          </a>.
        </p>
      </div>
      <div class="footer">
        <p>
          © ${new Date().getFullYear()} Belrose Health. All rights reserved.<br />
          You received this because you opted in at ${marketingUrl}.<br />
          <a href="mailto:hello@belrosehealth.com?subject=Unsubscribe" style="color: #94a3b8">
            Unsubscribe
          </a>
        </p>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

function buildMailingListEmailText(marketingUrl: string): string {
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
