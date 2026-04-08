// functions/src/handlers/createRecordRequest.ts

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import * as crypto from 'crypto';
import { Resend } from 'resend';
import { createOrRetrieveGuestAccount, writeGuestInviteDoc } from '../utils/guestAccountUtils';

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

    // ── Create or retrieve guest account for the provider ────────────────────
    // We create the guest account at request-send time so:
    //   1. The private key can go in the email link fragment immediately
    //   2. redeemGuestInvite can be reused as-is for token minting
    //   3. The provider's public key is ready to wrap the file key on upload
    const {
      guestUid: providerGuestUid,
      privateKeyBase64: providerPrivateKey,
      isNewGuest,
      guestIdHash,
      guestWallet,
      publicKeyBase64: providerPublicKey,
    } = await createOrRetrieveGuestAccount(targetEmail);

    // ── Check if provider is already a full Belrose user ────────────────────
    let targetUserId: string | null = null;
    try {
      const targetAuthUser = await admin.auth().getUserByEmail(targetEmail);
      const targetProfile = await db.collection('users').doc(targetAuthUser.uid).get();
      const isFullAccount = targetProfile.exists && !targetProfile.data()?.isGuest;
      if (isFullAccount) {
        targetUserId = targetAuthUser.uid;
      }
    } catch {
      // Not found — providerGuestUid covers this case
    }

    // ── Compute dates ─────────────────────────────────────────────────────────
    const requestDate = new Date();
    const deadline = new Date(requestDate);
    deadline.setDate(deadline.getDate() + 30);

    // ── Write recordRequests document ────────────────────────────────────────
    const inviteCode = crypto.randomBytes(32).toString('hex');

    const requestDoc = {
      requesterId,
      requesterEmail,
      requesterName,
      requesterPublicKey, // Snapshotted — fulfil page reads this directly
      targetEmail,
      targetUserId,
      providerGuestUid,
      providerPublicKey,
      requestNote: requestNote ?? null,
      inviteCode,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      deadline: admin.firestore.Timestamp.fromDate(deadline),
      fulfilledRecordId: null,
    };

    const docRef = db.collection('recordRequests').doc(inviteCode);
    await docRef.set(requestDoc);
    console.log(`✅ recordRequests document created: ${docRef.id}`);

    // ── Write guestInvites document ──────────────────────────────────────────
    // recordIds is empty — provider is uploading a new record, not accessing
    // existing ones. recordRequestId links back for context.
    const { inviteCode: guestInviteCode } = await writeGuestInviteDoc({
      guestUid: providerGuestUid,
      invitedBy: requesterId,
      guestEmail: targetEmail,
      recordIds: [],
      guestIdHash,
      guestWallet,
      isNewGuest,
      durationSeconds: 2 * 365 * 24 * 60 * 60, // 2 years - provider may delay, but if more than 2 years probably a ghost account, should be cleaned up
      context: 'record_request',
      recordRequestId: inviteCode,
    });

    // ── Send email ────────────────────────────────────────────────────────────
    // Private key in URL fragment — never hits the server, never logged.
    // FulfillRequestPage reads window.location.hash to get the private key,
    // then calls redeemGuestInvite with guestCode to get the custom token.
    const appUrl = 'https://belrosehealth.com';

    // The inviteCode is the only thing in the URL — no sensitive data in transit.
    // The fulfill page reads the requesterPublicKey from the Firestore document
    // after validating the code, which is safer than putting it in the URL.
    const fulfillUrl =
      `${appUrl}/fulfill-request?code=${inviteCode}&guestCode=${guestInviteCode}` +
      `#${providerPrivateKey}`;

    const resend = new Resend(resendKey.value());
    try {
      await resend.emails.send({
        to: targetEmail,
        cc: requesterEmail,
        from: 'Belrose Health <noreply@belrosehealth.com>',
        subject: `${requesterName} is requesting their health records`,
        html: buildRequestEmail(requesterName, fulfillUrl, requesterEmail, requestDate, deadline),
      });
      console.log(`✅ Record request email sent to ${targetEmail}, CC: ${requesterEmail}`);
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
  requesterEmail: string,
  requestedDate: Date,
  deadline: Date
): string {
  const year = new Date().getFullYear();
  const marketingUrl = 'https://www.belrosehealth.com';
  const formattedRequest = requestedDate.toLocaleDateString('en-GB', { dateStyle: 'long' });
  const formattedDeadline = deadline.toLocaleDateString('en-GB', { dateStyle: 'long' });

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>Subject Access Request — ${requesterName}</title>
  </head>
  <body
    style="
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #18181b;
    "
  >
    <div style="max-width: 580px; margin: 40px auto">
      <!-- Letterhead -->
      <table style="background: #0f172a; border-radius: 16px 16px 0 0; width: 100%;
        border-collapse: collapse;">
        <tr>
          <td style="padding: 24px 40px;">
            <p style="margin: 0; font-size: 13px; font-weight: 700; color: #f8fafc;
              letter-spacing: 1px; text-transform: uppercase;">Belrose Health</p>
            <p style="margin: 3px 0 0; font-size: 11px; color: #64748b;">Secure Health Record Platform</p>
          </td>
          <td style="padding: 24px 40px; text-align: right; white-space: nowrap;">
            <span style="background: #ffffff15; border: 1px solid #ffffff20; border-radius: 100px;
              padding: 5px 12px; font-size: 11px; color: #94a3b8;">🔒 End-to-end encrypted</span>
          </td>
        </tr>
      </table>

      <!-- Legal classification band -->
      <div style="background: #1e3a5f; padding: 12px 40px">
        <p
          style="
            margin: 0;
            font-size: 11px;
            color: #93c5fd;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          "
        >
          GDPR Article 15 &nbsp;·&nbsp; Subject Access Request
        </p>
      </div>

      <!-- Body -->
      <div style="background: #ffffff; padding: 36px 40px">
        <p style="font-size: 12px; color: #94a3b8; margin: 0 0 20px">${formattedRequest}</p>

        <p style="font-size: 15px; color: #0f172a; line-height: 1.7; margin: 0 0 16px">
          Dear healthcare provider,
        </p>

        <!-- Lead with the legal obligation immediately -->
        <p style="font-size: 15px; color: #0f172a; line-height: 1.7; margin: 0 0 16px">
          This is a <strong>Subject Access Request</strong> via Belrose Health from your patient,
          <strong style="color: #0f172a">${requesterName}</strong>
          (cc'd on this email: ${requesterEmail}), for a copy of their personal health records
          held by your organisation.
        </p>

        <p style="font-size: 15px; color: #0f172a; line-height: 1.7; margin: 0 0 20px">
          Under <strong>GDPR Article 15</strong> covered entities are obligated to provide patients
          with their records within <strong>30 days</strong> of a written request. This request was
          submitted on <strong style="color: #0f172a">${formattedRequest}</strong>. Please respond by
          <strong style="color: #0f172a">${formattedDeadline}</strong>.
        </p>

        <p style="font-size: 15px; color: #0f172a; line-height: 1.7; margin: 0 0 20px">
          Click <a href="${marketingUrl}/for-providers">here</a> for more information on your legal
          obligations and to learn how Belrose Health works.
        </p>

        <!-- CTA -->
        <div style="text-align: center; margin: 28px 0 10px">
          <a
            href="${fulfillUrl}"
            style="
              display: inline-block;
              background: #0f172a;
              color: #ffffff;
              text-decoration: none;
              padding: 14px 40px;
              border-radius: 10px;
              font-size: 15px;
              font-weight: 600;
            "
          >
            Upload Records Securely →
          </a>
        </div>

        <div style="height: 1px; background: #f1f5f9; margin: 0 0 24px"></div>

        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0">
          Questions?
          <a href="mailto:requests@belrosehealth.com" style="color: #64748b"
            >requests@belrosehealth.com</a
          >
          &nbsp;·&nbsp; <a href="${marketingUrl}" style="color: #64748b">belrosehealth.com</a>
        </p>
      </div>

      <!-- Footer -->
      <div
        style="
          background: #f8fafc;
          border-radius: 0 0 16px 16px;
          padding: 16px 40px;
          border-top: 1px solid #e2e8f0;
        "
      >
        <p style="font-size: 11px; color: #94a3b8; margin: 0 0 4px">
          © ${year} Belrose Health Ltd. All rights reserved.
        </p>
        <p style="font-size: 11px; color: #94a3b8; margin: 0">
          You received this because a patient submitted a Subject Access Request via Belrose.
          Belrose Health is a designated recipient and is not acting on behalf of the patient in a
          legal capacity.
        </p>
      </div>
    </div>
  </body>
</html>

`;
}
