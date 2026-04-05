// functions/src/handlers/createRecordRequest.ts

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import * as crypto from 'crypto';
import { Resend } from 'resend';

const resendKey = defineSecret('RESEND_API_KEY');

// ==================== TYPES ====================

interface CreateRecordRequestInput {
  targetEmail: string; // Who to request from
  requesterName: string; // For the email greeting e.g. "Dr. Smith"
  requestNote?: string; // Optional message to the uploader
}

interface CreateRecordRequestResult {
  success: boolean;
  requestId: string;
}

// ==================== MAIN FUNCTION ====================

export const createRecordRequest = onCall(
  { secrets: [resendKey] },
  async (request): Promise<CreateRecordRequestResult> => {
    // ── Auth check ──────────────────────────────────────────────────────────
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be logged in to request records.');
    }

    const requesterId = request.auth.uid;
    const { targetEmail, requesterName, requestNote } = request.data as CreateRecordRequestInput;

    // ── Input validation ─────────────────────────────────────────────────────
    if (!targetEmail || !requesterName) {
      throw new HttpsError('invalid-argument', 'targetEmail and requesterName are required.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      throw new HttpsError('invalid-argument', 'Invalid email address.');
    }

    const db = admin.firestore();

    // ── Fetch requester's public key ─────────────────────────────────────────
    // We snapshot it now so the fulfill page never needs a second Firestore
    // read — everything it needs is in the single recordRequests document.
    const requesterDoc = await db.collection('users').doc(requesterId).get();
    if (!requesterDoc.exists) {
      throw new HttpsError('not-found', 'Requester profile not found.');
    }

    const requesterData = requesterDoc.data()!;
    const requesterPublicKey = requesterData.encryption?.publicKey;
    const requesterEmail = requesterData.email ?? '';

    if (!requesterPublicKey) {
      throw new HttpsError(
        'failed-precondition',
        'Your encryption keys are not set up. Please complete account setup first.'
      );
    }

    // ── Check if target is already a Belrose user ────────────────────────────
    // Purely informational — we still send the magic link either way, but
    // storing targetUserId lets the fulfill page skip creating a guest session
    // if they're already logged in.
    let targetUserId: string | null = null;
    try {
      const targetAuthUser = await admin.auth().getUserByEmail(targetEmail);
      targetUserId = targetAuthUser.uid;
    } catch (err: any) {
      if (err.code !== 'auth/user-not-found') {
        throw new HttpsError('internal', 'Failed to check for existing user.');
      }
      // Not found is fine — targetUserId stays null
    }

    // ── Build the request document ───────────────────────────────────────────
    const inviteCode = crypto.randomBytes(32).toString('hex');

    const requestDoc = {
      requesterId,
      requesterEmail,
      requesterName,
      requesterPublicKey, // Snapshotted — fulfil page reads this directly
      targetEmail,
      targetUserId, // null if non-user
      requestNote: requestNote ?? null,
      inviteCode,
      status: 'pending', // pending | fulfilled | declined
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      fulfilledRecordId: null,
    };

    const docRef = db.collection('recordRequests').doc(inviteCode);
    await docRef.set(requestDoc);
    console.log(`✅ recordRequests document created: ${docRef.id}`);

    // ── Send email ───────────────────────────────────────────────────────────
    const appUrl = 'https://belrosehealth.com';

    // The inviteCode is the only thing in the URL — no sensitive data in transit.
    // The fulfill page reads the requesterPublicKey from the Firestore document
    // after validating the code, which is safer than putting it in the URL.
    const fulfillUrl = `${appUrl}/fulfill-request?code=${inviteCode}`;

    const resend = new Resend(resendKey.value());
    try {
      await resend.emails.send({
        to: targetEmail,
        cc: requesterEmail,
        from: 'Belrose Health <noreply@belrosehealth.com>',
        subject: `${requesterName} is requesting their health records`,
        html: buildRequestEmail(requesterName, fulfillUrl, requestNote),
      });
      console.log(`✅ Record request email sent to ${targetEmail}`);
    } catch (emailError) {
      // Don't fail the whole function — the Firestore doc is created and the
      // requester can resend manually. Log for debugging.
      console.error('⚠️  Failed to send request email:', emailError);
      console.log(`🔗 Fulfill URL (dev only): ${fulfillUrl}`);
    }

    return { success: true, requestId: inviteCode };
  }
);

// ==================== EMAIL TEMPLATE ====================

function buildRequestEmail(
  requesterName: string,
  fulfillUrl: string,
  requestNote?: string | null
): string {
  const year = new Date().getFullYear();
  const marketingUrl = 'https://www.belrosehealth.com';

  const noteBlock = requestNote
    ? `
    <div style="background:#f8fafc; border-left:4px solid #3b82f6; border-radius:0 8px 8px 0; padding:16px 20px; margin:20px 0;">
      <p style="font-size:13px; font-weight:600; color:#1e3a5f; margin:0 0 6px;">Message from ${requesterName}:</p>
      <p style="font-size:14px; color:#334155; margin:0; line-height:1.6;">${requestNote}</p>
    </div>`
    : '';

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${requesterName} is requesting their health records</title>
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
      .info-block {
        background: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 12px;
        padding: 20px 24px;
        margin: 24px 0;
      }
      .info-block p {
        font-size: 14px;
        color: #0c4a6e;
        margin: 0;
        line-height: 1.7;
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
        <span class="badge">Record Requested</span>
        <h1>You have a record request</h1>
        <p>${requesterName} has requested their health records via Belrose Health</p>
      </div>

      <div class="body">
        <p>Hi there,</p>
        <p>
          <strong>${requesterName}</strong> (cc'd on this email) has requested that you share their health records with
          them securely via Belrose Health.
        </p>

        ${noteBlock}

        <div class="cta-block">
          <a href="${fulfillUrl}" class="cta-button">Upload Your Records →</a>
        </div>

        <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-top: -12px">
          Under GDPR Article 15 (UK/EU) and HIPAA 45 CFR §164.524 (US), covered entities are legally
          required to provide patients with their records within 30 days of request.
        </p>

        <div class="divider"></div>

        <div class="info-block">
          <p><strong>How it works</strong></p>
          <p>
            Clicking the link above takes you to a secure upload page. Your file is encrypted in
            your browser using ${requesterName}'s public key before it ever leaves your device —
            meaning only they can read it. Belrose cannot access the contents.
          </p>
        </div>

        <div class="divider"></div>
        <p style="text-align: center; font-size: 13px; color: #94a3b8">
          Questions? Reach us at
          <a href="mailto:hello@belrosehealth.com" style="color: #64748b"
            >hello@belrosehealth.com</a
          >
          or learn more at <a href="${marketingUrl}" style="color: #64748b">belrosehealth.com</a>.
        </p>
      </div>

      <div class="footer">
        <p>
          © ${year} Belrose Health. All rights reserved.<br />
          You received this because someone requested their records from you via Belrose.
        </p>
      </div>
    </div>
  </body>
</html>
`;
}
