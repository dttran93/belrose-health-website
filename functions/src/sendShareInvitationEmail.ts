// functions/src/functions/sharing/sendShareInvitationEmail.ts

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';
import { defineSecret } from 'firebase-functions/params';

// Define SendGrid API key as a secret
const sendgridKey = defineSecret('SENDGRID_API_KEY');

interface ShareInvitationData {
  senderName: string;
  senderEmail: string;
  receiverEmail: string;
  recordName: string;
}

interface ShareInvitationResult {
  success: boolean;
  message: string;
  action: 'signup_required' | 'verification_required' | 'already_verified';
}

/**
 * Cloud Function to send an email invitation when someone tries to share
 * a record with an unverified user
 */
export const sendShareInvitationEmail = onCall(
  {
    secrets: [sendgridKey], // Make the secret available to this function
  },
  async (request): Promise<ShareInvitationResult> => {
    // Verify the user is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to send invitations.');
    }

    // Initialize SendGrid
    const apiKey = sendgridKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'SendGrid API key not configured');
    }
    sgMail.setApiKey(apiKey);

    // Extract and validate data
    const data = request.data as ShareInvitationData;
    const { senderName, senderEmail, receiverEmail, recordName } = data;

    if (!receiverEmail || !senderName || !recordName) {
      throw new HttpsError(
        'invalid-argument',
        'Missing required fields: receiverEmail, senderName, or recordName'
      );
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
    } catch (error) {
      console.error('Error sending invitation email:', error);
      throw new HttpsError('internal', 'Failed to send invitation email');
    }
  }
);

/**
 * Send an invitation to sign up for Belrose
 */
async function sendSignupInvitation(
  senderName: string,
  senderEmail: string,
  receiverEmail: string,
  recordName: string
) {
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
              <a href="${getFrontendUrl()}/register?invite=${encodeURIComponent(
      receiverEmail
    )}" class="button">
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

  await sgMail.send(msg);
  console.log(`✅ Signup invitation sent to ${receiverEmail}`);
}

/**
 * Send a reminder to verify email
 */
async function sendVerificationReminder(
  senderName: string,
  receiverEmail: string,
  recordName: string,
  receiverUserId: string
) {
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
  } catch (error) {
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

  await sgMail.send(msg);
  console.log(`✅ Verification reminder sent to ${receiverEmail}`);
}

/**
 * Helper to get frontend URL based on environment
 */
function getFrontendUrl(): string {
  // In production, use your actual domain
  if (process.env.FUNCTIONS_EMULATOR) {
    return 'http://localhost:5173'; // or your local dev port
  }
  return 'https://belrosehealth.com'; // Replace with your actual domain
}
