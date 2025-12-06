"use strict";
// functions/src/functions/handlers/sendShareInvitationEmail.ts
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendShareInvitationEmail = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const mail_1 = __importDefault(require("@sendgrid/mail"));
const params_1 = require("firebase-functions/params");
// Define SendGrid API key as a secret
const sendgridKey = (0, params_1.defineSecret)('SENDGRID_API_KEY');
/**
 * Cloud Function to send an email invitation when someone tries to share
 * a record with an unverified user
 */
exports.sendShareInvitationEmail = (0, https_1.onCall)({
    secrets: [sendgridKey], // Make the secret available to this function
}, async (request) => {
    // Verify the user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to send invitations.');
    }
    // Initialize SendGrid
    const apiKey = sendgridKey.value();
    if (!apiKey) {
        throw new https_1.HttpsError('failed-precondition', 'SendGrid API key not configured');
    }
    mail_1.default.setApiKey(apiKey);
    // Extract and validate data
    const data = request.data;
    const { senderName, senderEmail, receiverEmail, recordName } = data;
    if (!receiverEmail || !senderName || !recordName) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields: receiverEmail, senderName, or recordName');
    }
    try {
        // Check if receiver exists in the system
        const usersRef = admin.firestore().collection('users');
        const receiverQuery = await usersRef.where('email', '==', receiverEmail).get();
        if (receiverQuery.empty) {
            // User doesn't exist - send signup invitation
            await sendSignupInvitation(senderName, senderEmail, receiverEmail, recordName);
            return {
                success: true,
                message: 'Signup invitation sent',
                action: 'signup_required',
            };
        }
        const receiverDoc = receiverQuery.docs[0];
        const receiverData = receiverDoc.data();
        if (receiverData.emailVerified === false) {
            // User exists but email not verified - send verification reminder
            await sendVerificationReminder(senderName, receiverEmail, recordName, receiverDoc.id);
            return {
                success: true,
                message: 'Verification reminder sent',
                action: 'verification_required',
            };
        }
        // Email is already verified
        return {
            success: false,
            message: 'Email already verified',
            action: 'already_verified',
        };
    }
    catch (error) {
        console.error('Error sending invitation email:', error);
        throw new https_1.HttpsError('internal', 'Failed to send invitation email');
    }
});
/**
 * Send an invitation to sign up for Belrose
 */
async function sendSignupInvitation(senderName, senderEmail, receiverEmail, recordName) {
    // Store pending invitation in Firestore
    await admin.firestore().collection('pendingInvitations').add({
        senderName,
        receiverEmail,
        recordName,
        type: 'signup',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
    });
    // Send the actual email
    const msg = {
        to: receiverEmail,
        from: 'noreply@belrosehealth.com',
        subject: `${senderName} wants to share a health record with you`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .feature { margin: 10px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 You've Been Invited to Belrose Health</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            
            <p><strong>${senderName}</strong> wants to share their health record <strong>"${recordName}"</strong> with you on Belrose Health.</p>
            
            <p>Belrose is a secure platform for managing and sharing health records with end-to-end encryption.</p>
            
            <div class="features">
              <div class="feature">✅ Your health data is encrypted end-to-end</div>
              <div class="feature">✅ You control who sees your records</div>
              <div class="feature">✅ Blockchain-verified for authenticity</div>
              <div class="feature">✅ HIPAA-compliant security</div>
            </div>
            
            <p><strong>To receive this shared record, you'll need to:</strong></p>
            <ol>
              <li>Create a free Belrose account</li>
              <li>Verify your email address</li>
              <li>Set up your secure encryption</li>
            </ol>
            
            <p style="text-align: center;">
              <a href="${getFrontendUrl()}/register?invite=${encodeURIComponent(receiverEmail)}" class="button">
                Create Your Account
              </a>
            </p>
            
            <p>Once you complete these steps, ${senderName} can share their record with you securely.</p>
            
            <div class="footer">
              <p>This invitation was sent by ${senderName} (${senderEmail || 'a Belrose user'})</p>
              <p>© ${new Date().getFullYear()} Belrose Health. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
        text: `
Hi there,

${senderName} wants to share their health record "${recordName}" with you on Belrose Health.

Belrose is a secure platform for managing and sharing health records. To receive this shared record, you'll need to:

1. Create a free Belrose account at: ${getFrontendUrl()}/register
2. Verify your email address
3. Set up your secure encryption

Once you complete these steps, ${senderName} can share their record with you securely.

Why Belrose?
✅ Your health data is encrypted end-to-end
✅ You control who sees your records
✅ Blockchain-verified for authenticity

Get started: ${getFrontendUrl()}/register?invite=${encodeURIComponent(receiverEmail)}

Best regards,
The Belrose Health Team
    `,
    };
    await mail_1.default.send(msg);
    console.log(`✅ Signup invitation sent to ${receiverEmail}`);
}
/**
 * Send a reminder to verify email
 */
async function sendVerificationReminder(senderName, receiverEmail, recordName, receiverUserId) {
    // Store pending share in Firestore
    await admin.firestore().collection('pendingInvitations').add({
        senderName,
        receiverEmail,
        receiverUserId,
        recordName,
        type: 'verification_reminder',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
    });
    // Get verification link from Firebase Auth
    let verificationLink = `${getFrontendUrl()}/verify-email`;
    try {
        const userRecord = await admin.auth().getUserByEmail(receiverEmail);
        if (!userRecord.emailVerified) {
            verificationLink = await admin.auth().generateEmailVerificationLink(receiverEmail);
        }
    }
    catch (error) {
        console.error('Error generating verification link:', error);
    }
    // Send the actual email
    const msg = {
        to: receiverEmail,
        from: 'noreply@belrosehealth.com',
        subject: `${senderName} is waiting to share a health record with you`,
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #fffbeb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .alert { background: white; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Email Verification Required</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            
            <div class="alert">
              <strong>${senderName}</strong> tried to share their health record <strong>"${recordName}"</strong> with you, but your email address isn't verified yet.
            </div>
            
            <p><strong>Please verify your email to receive this shared record:</strong></p>
            
            <p style="text-align: center;">
              <a href="${verificationLink}" class="button">
                Verify My Email
              </a>
            </p>
            
            <p>Once verified, ${senderName} can immediately share their record with you.</p>
            
            <p><strong>Why verify?</strong></p>
            <ul>
              <li>✅ Receive shared health records</li>
              <li>✅ Secure your account</li>
              <li>✅ Enable account recovery</li>
              <li>✅ Build trust with other users</li>
            </ul>
            
            <p>Having trouble? Reply to this email for help.</p>
            
            <div class="footer">
              <p>This reminder was sent because ${senderName} attempted to share with you</p>
              <p>© ${new Date().getFullYear()} Belrose Health. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
        text: `
Hi there,

${senderName} tried to share their health record "${recordName}" with you on Belrose Health, but your email address isn't verified yet.

Please verify your email to receive this shared record:

👉 Click here to verify: ${verificationLink}

Once verified, ${senderName} can immediately share their record with you.

Why verify?
✅ Receive shared health records
✅ Secure your account
✅ Enable account recovery

Having trouble? Reply to this email for help.

Best regards,
The Belrose Health Team
    `,
    };
    await mail_1.default.send(msg);
    console.log(`✅ Verification reminder sent to ${receiverEmail}`);
}
/**
 * Helper to get frontend URL based on environment
 */
function getFrontendUrl() {
    // In production, use your actual domain
    if (process.env.FUNCTIONS_EMULATOR) {
        return 'http://localhost:5173'; // or your local dev port
    }
    return 'https://belrosehealth.com'; // Replace with your actual domain
}
//# sourceMappingURL=sendShareInvitationEmail.js.map