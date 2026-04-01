"use strict";
// functions/src/handlers/createGuestInvite.ts
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
exports.createGuestInvite = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const crypto = __importStar(require("crypto"));
const resend_1 = require("resend");
const ethers_1 = require("ethers");
const resendKey = (0, params_1.defineSecret)('RESEND_API_KEY');
// ==================== HELPERS ====================
/**
 * Generate an RSA-OAEP key pair using Node's crypto module.
 * Returns keys in the same base64/SPKI+PKCS8 format that the frontend
 * SharingKeyManagementService expects.
 */
function generateRsaKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki', // Same format frontend imports with importKey('spki', ...)
            format: 'der', // Raw bytes, we'll base64 encode manually
        },
        privateKeyEncoding: {
            type: 'pkcs8', // Same format frontend imports with importKey('pkcs8', ...)
            format: 'der',
        },
    });
    return {
        publicKeyBase64: publicKey.toString('base64'),
        privateKeyBase64: privateKey.toString('base64'),
    };
}
// ==================== MAIN FUNCTION ====================
exports.createGuestInvite = (0, https_1.onCall)({ secrets: [resendKey] }, async (request) => {
    // ── Auth check ──────────────────────────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'You must be logged in to share records.');
    }
    const patientUid = request.auth.uid;
    const { guestEmail, recordIds, patientName } = request.data;
    // ── Input validation ─────────────────────────────────────────────────────
    if (!guestEmail || !recordIds?.length || !patientName) {
        throw new https_1.HttpsError('invalid-argument', 'guestEmail, recordIds, and patientName are required.');
    }
    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid email address.');
    }
    const db = admin.firestore();
    // ── Check the patient actually owns/has access to the records ────────────
    // We verify each recordId exists and the caller is an owner/admin.
    // This prevents a malicious caller from inviting guests to records they
    // don't control.
    for (const recordId of recordIds) {
        const recordDoc = await db.collection('records').doc(recordId).get();
        if (!recordDoc.exists) {
            throw new https_1.HttpsError('not-found', `Record ${recordId} not found.`);
        }
        const data = recordDoc.data();
        const isOwner = (data.owners || []).includes(patientUid);
        const isAdmin = (data.administrators || []).includes(patientUid);
        if (!isOwner && !isAdmin) {
            throw new https_1.HttpsError('permission-denied', `You do not have permission to share record ${recordId}.`);
        }
    }
    // ── Check if a guest account already exists for this email ───────────────
    // If the patient re-sends an invite to the same doctor, we reuse the
    // existing guest account instead of creating a duplicate.
    let guestUid;
    let isNewGuest = false;
    try {
        const existingUser = await admin.auth().getUserByEmail(guestEmail);
        guestUid = existingUser.uid;
        console.log(`ℹ️  Reusing existing guest account for ${guestEmail}: ${guestUid}`);
    }
    catch (err) {
        // 'auth/user-not-found' is expected — create a new guest account
        if (err.code !== 'auth/user-not-found') {
            throw new https_1.HttpsError('internal', 'Failed to check for existing user.');
        }
        isNewGuest = true;
        // ── Create Firebase Auth account ──────────────────────────────────────
        const newUser = await admin.auth().createUser({
            email: guestEmail,
            emailVerified: true, // clicking the link confirms the address is valid
            // No password — this account can only be accessed via custom token
            displayName: guestEmail,
        });
        guestUid = newUser.uid;
        console.log(`✅ Created guest Firebase Auth account: ${guestUid}`);
    }
    // ── Generate RSA key pair for the guest ──────────────────────────────────
    // We always regenerate on each invite so each invite link has a fresh key.
    const { publicKeyBase64, privateKeyBase64 } = generateRsaKeyPair();
    // Derive guestIdHash and guestWallet from UID for blockchain transactions
    const guestIdHash = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(guestUid));
    const guestWallet = ethers_1.ethers.getAddress('0x' + ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(`guest:${guestUid}`)).slice(-40));
    // ── Write/update guest user profile in Firestore ─────────────────────────
    // This is the minimal profile that sharingService.grantEncryptionAccess
    // needs — specifically encryption.publicKey.
    const guestProfile = {
        uid: guestUid,
        email: guestEmail,
        displayName: guestEmail,
        emailVerified: true,
        isGuest: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        encryption: {
            publicKey: publicKeyBase64,
        },
        onChainIdentity: {
            userIdHash: guestIdHash,
            status: 'Active',
            linkedWallets: [
                {
                    address: guestWallet,
                    type: 'eoa', // placeholder EOA, never holds funds
                    txHash: '', // no tx — registered via grantGuestAccess
                    blockNumber: 0,
                    linkedAt: new Date(),
                    isWalletActive: true,
                },
            ],
        },
    };
    await db.collection('users').doc(guestUid).set(guestProfile, { merge: true });
    console.log(`✅ Guest user profile written to Firestore: ${guestUid}`);
    // ── Create a guestInvites document ───────────────────────────────────────
    // This is the server-side record of the invite. Used to validate the
    // invite link and to clean up expired invites later.
    const durationSeconds = request.data.durationSeconds ?? 604800;
    const expiresAt = new Date(Date.now() + durationSeconds * 1000);
    const durationLabel = durationSeconds <= 86400
        ? '1 day'
        : durationSeconds <= 259200
            ? '3 days'
            : durationSeconds <= 604800
                ? '7 days'
                : '30 days';
    // ── Generate invite code ─────────────────────────────────────────────────────
    // Random 32-byte hex string — goes in the URL instead of the custom token.
    // Custom tokens expire in 1 hour; this code is valid for the full invite duration.
    const inviteCode = crypto.randomBytes(32).toString('hex');
    await db.collection('guestInvites').add({
        guestUserId: guestUid,
        invitedBy: patientUid,
        guestEmail,
        recordIds,
        status: 'pending', // pending | accepted | revoked | expired
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        isNewGuest,
        guestIdHash,
        guestWallet,
        inviteCode,
    });
    console.log(`✅ guestInvites document created`);
    // ── Send invite email via SendGrid ───────────────────────────────────────
    // The private key goes in the URL fragment (#). Fragments are never sent
    // to servers — they exist only in the browser. This means even if someone
    // intercepts the URL in transit, the key isn't in the logged path.
    //
    // URL format: /invite?token=<customToken>#<privateKeyBase64>
    const appUrl = 'https://belrosehealth.com';
    const inviteUrl = `${appUrl}/invite?code=${inviteCode}#${privateKeyBase64}`;
    const resend = new resend_1.Resend(resendKey.value());
    try {
        await resend.emails.send({
            to: guestEmail,
            from: 'Belrose Health <noreply@belrosehealth.com>',
            subject: `${patientName} has shared their health records with you`,
            html: buildInviteEmail(patientName, inviteUrl, durationLabel),
        });
        console.log(`✅ Invite email sent to ${guestEmail}`);
    }
    catch (emailError) {
        // Log but don't fail the whole function — invite doc and token are already created
        console.error('⚠️  Failed to send invite email:', emailError);
        console.log(`🔗 Invite URL (dev only): ${inviteUrl}`);
    }
    // ── Return to patient's client ───────────────────────────────────────────
    // The client uses guestUserId to immediately call PermissionsService.grantViewer
    // so the wrapped key is in place before the doctor ever clicks the link.
    return {
        success: true,
        guestUid,
        guestPrivateKeyBase64: privateKeyBase64,
    };
});
// ==================== EMAIL TEMPLATE ====================
function buildInviteEmail(patientName, inviteUrl, durationLabel) {
    const year = new Date().getFullYear();
    const marketingUrl = 'https://www.belrosehealth.com';
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${patientName} has shared their health records with you</title>
  <style>
    body { margin:0; padding:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; background:#f4f4f5; color:#18181b; }
    .wrapper { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:#0f172a; padding:40px 40px 32px; text-align:center; }
    .badge { display:inline-block; background:#3b82f620; color:#60a5fa; font-size:12px; font-weight:600; letter-spacing:0.5px; text-transform:uppercase; padding:4px 12px; border-radius:100px; border:1px solid #3b82f640; }
    .header h1 { color:#f8fafc; font-size:24px; font-weight:700; margin:16px 0 8px; letter-spacing:-0.5px; }
    .header p { color:#94a3b8; font-size:14px; margin:0; }
    .body { padding:36px 40px; }
    .body p { font-size:15px; line-height:1.7; color:#3f3f46; margin:0 0 0px; }
    .cta-block { text-align:center; margin:28px 0; }
    .cta-button { display:inline-block; background:#0f172a; color:#ffffff !important; text-decoration:none; padding:14px 36px; border-radius:10px; font-size:15px; font-weight:600; }
    .mission-block { background:#0f172a; border-radius:12px; padding:28px; margin:28px 0; }
    .mission-block p { color:#cbd5e1; font-size:14px; line-height:1.8; margin:0 0 12px; }
    .mission-block p:last-child { margin:0; }
    .mission-block strong { color:#f8fafc; }
    .pillars { margin:28px 0; }
    .pillars h3 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; margin:0 0 16px; }
    .pillar { display:flex; align-items:flex-start; gap:14px; margin-bottom:16px; }
    .pillar-icon { flex-shrink:0; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px; }
    .pillar-text h4 { font-size:14px; font-weight:600; color:#0f172a; margin:0 0 2px; }
    .pillar-text p { font-size:13px; color:#64748b; margin:0; line-height:1.5; }
    .divider { height:1px; background:#f1f5f9; margin:24px 0; }
    .footer { background:#f8fafc; padding:20px 40px; text-align:center; }
    .footer p { font-size:12px; color:#94a3b8; margin:0; line-height:1.6; }
  </style>
</head>
<body>
<div class="wrapper">

  <div class="header">
    <span class="badge">Record Shared</span>
    <h1>You've received health records</h1>
    <p>${patientName} has shared their records with you on Belrose Health</p>
  </div>

  <div class="body">
    <p>Hi there,</p>
      <p>
      <strong>${patientName}</strong> has shared their health records
      with you via Belrose Health. Click below to view them.
      This link expires in <strong>${durationLabel}</strong>.
    </p>

    <div class="cta-block">
      <a href="${inviteUrl}" class="cta-button">View Health Records →</a>
    </div>

    <p style="font-size:13px; color:#94a3b8; text-align:center; margin-top:-12px;">
      This link is personal to you. Forwarding it to any third party without the
      patient's consent may constitute a breach of GDPR and applicable data protection law.
    </p>

    <div class="divider"></div>

    <div class="mission-block">
      <p><strong>What is Belrose Health?</strong></p>
      <p>
        Belrose Health enables and incentivizes people to collect records
        from providers and standardize them into a single verified record.
      </p>
      <p>
        As a provider, you can receive records from patients, add clinical notes,
        and build a verified history — without changing your existing workflow.
      </p>
    </div>

    <div class="pillars">
      <h3>Why providers use Belrose</h3>
      <div class="pillar">
        <div class="pillar-icon">🗂️</div>
        <div class="pillar-text">
          <h4>Complete health history</h4>
          <p>Records are compiled by the patient from their prior providers, standardised, and ready to review.</p>
        </div>
      </div>
      <div class="pillar">
        <div class="pillar-icon">✅</div>
        <div class="pillar-text">
          <h4>Record credibility</h4>
          <p>Every record carries a cryptographic signature — you know it hasn't been altered. You can also see who has verified it and if any data is missing.</p>
        </div>
      </div>
      <div class="pillar">
        <div class="pillar-icon">💾</div>
        <div class="pillar-text">
          <h4>EHR system agnostic</h4>
          <p>Belrose accepts data from any EHR or patient management system and even handwritten notes. Never be forced into an IT implementation again.</p>
        </div>
      </div>
    </div>

    <div class="cta-block">
      <a href="${marketingUrl}" class="cta-button" style="background:#f8fafc; color:#0f172a !important; border:1px solid #e2e8f0;">
        Learn more about Belrose →
      </a>
    </div>

    <div class="divider"></div>
    <p style="font-size:13px; color:#94a3b8;">
      Questions? Reach us at
      <a href="mailto:hello@belrosehealth.com" style="color:#64748b;">hello@belrosehealth.com</a>.
    </p>
  </div>

  <div class="footer">
    <p>© ${year} Belrose Health. All rights reserved.<br />
    You received this because a patient shared records with you via Belrose.</p>
  </div>

</div>
</body>
</html>`;
}
//# sourceMappingURL=createGuestInvite.js.map