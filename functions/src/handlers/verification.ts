// functions/src/handlers/verification.ts

import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

export interface PersonaInquiryResponse {
  data: {
    id: string;
    attributes: {
      session_token: string;
      status: 'created' | 'pending' | 'approved' | 'declined' | 'needs_review';
      name_first?: string;
      name_last?: string;
      birthdate?: string;
      address_street_1?: string;
      address_postal_code?: string;
    };
  };
}

export interface VerifiedData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: string;
  postcode: string;
}

export interface CreateSessionResponse {
  sessionToken: string;
  inquiryId: string;
}

export interface CheckStatusRequest {
  inquiryId: string;
}

export interface CheckStatusResponse {
  verified: boolean;
  data?: VerifiedData;
  reason?: string;
}

export interface CreateVerificationSessionRequest {
  templateId: string;
}

/**
 * Verification Handler
 * Handles identity verification using Persona API
 *
 * This handler manages:
 * - Creating verification sessions
 * - Checking verification status
 * - Processing webhooks from Persona
 */

// Define secrets
const personaKey = defineSecret('PERSONA_API_KEY');
const personaWebhookSecret = defineSecret('PERSONA_WEBHOOK_SECRET');

// ==================== PERSONA API CONFIGURATION ====================

const PERSONA_API_URL = 'https://withpersona.com/api/v1';
const PERSONA_VERSION = '2023-01-05';

// ==================== CREATE VERIFICATION SESSION ====================

/**
 * Create Verification Session
 * Creates a new identity verification session for a user
 *
 * This is a "callable" function, meaning it's called directly from your
 * frontend using the Firebase SDK (not a regular HTTP request)
 */
export const createVerificationSession = onCall<
  CreateVerificationSessionRequest,
  Promise<CreateSessionResponse>
>(
  { secrets: [personaKey] },
  async (
    request: CallableRequest<CreateVerificationSessionRequest>
  ): Promise<CreateSessionResponse> => {
    // Check if user is authenticated
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to verify identity');
    }

    const userId = request.auth.uid;
    const { templateId } = request.data;

    // Validate input
    if (!templateId) {
      throw new HttpsError('invalid-argument', 'templateId is required');
    }

    console.log('📝 Creating verification session for user:', userId);
    console.log('📋 Using template:', templateId);

    try {
      // Get Persona API key
      const apiKey = personaKey.value();
      if (!apiKey) {
        console.error('❌ Persona API key not configured');
        throw new HttpsError('failed-precondition', 'Persona API key not configured');
      }

      // Create inquiry with Persona
      const response = await fetch(`${PERSONA_API_URL}/inquiries`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Persona-Version': PERSONA_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            attributes: {
              reference_id: userId, // Link this inquiry to your user
              inquiry_template_id: templateId,
            },
          },
        }),
      });

      // Handle API errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Persona API error:', errorText);
        throw new HttpsError('internal', `Persona API error: ${response.status}`);
      }

      // Parse response
      const personaData: PersonaInquiryResponse = await response.json();
      const inquiryId = personaData.data.id;

      console.log('✅ Inquiry created:', inquiryId);

      // Save verification record to database
      const db = getFirestore();
      await db.collection('verifications').doc(userId).set({
        inquiryId: inquiryId,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });

      // Return the inquiry ID (your frontend will use this to open Persona)
      return {
        sessionToken: inquiryId,
        inquiryId: inquiryId,
      };
    } catch (error: any) {
      console.error('❌ Error creating verification session:', error);

      // Re-throw HttpsErrors (they have proper error codes)
      if (error instanceof HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpsError('internal', 'Failed to create verification session');
    }
  }
);

// ==================== CHECK VERIFICATION STATUS ====================

/**
 * Check Verification Status
 * Checks the current status of a verification inquiry
 *
 * Also a "callable" function - called from frontend with Firebase SDK
 */
export const checkVerificationStatus = onCall<CheckStatusRequest, Promise<CheckStatusResponse>>(
  { secrets: [personaKey] },
  async (request: CallableRequest<CheckStatusRequest>): Promise<CheckStatusResponse> => {
    // Check authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = request.auth.uid;
    const { inquiryId } = request.data;

    // Validate input
    if (!inquiryId) {
      throw new HttpsError('invalid-argument', 'inquiryId is required');
    }

    console.log('🔍 Checking verification status:', { userId, inquiryId });

    try {
      // Get Persona API key
      const apiKey = personaKey.value();
      if (!apiKey) {
        throw new HttpsError('failed-precondition', 'Persona API key not configured');
      }

      // Fetch inquiry status from Persona
      const response = await fetch(`${PERSONA_API_URL}/inquiries/${inquiryId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Persona-Version': PERSONA_VERSION,
        },
      });

      if (!response.ok) {
        console.error(`❌ Persona API error: ${response.status}`);
        throw new HttpsError('internal', 'Failed to fetch verification status');
      }

      // Parse inquiry data
      const inquiry: PersonaInquiryResponse = await response.json();
      const status = inquiry.data.attributes.status;

      console.log('📊 Inquiry status from Persona:', status);

      const verified = status === 'approved';

      // If approved, extract and save verified data
      if (verified) {
        const verifiedData: VerifiedData = {
          firstName: inquiry.data.attributes.name_first || '',
          lastName: inquiry.data.attributes.name_last || '',
          dateOfBirth: inquiry.data.attributes.birthdate || '',
          address: inquiry.data.attributes.address_street_1 || '',
          postcode: inquiry.data.attributes.address_postal_code || '',
        };

        console.log('✅ User verified successfully:', userId);

        // Update both users and verifications collections
        const db = getFirestore();
        const batch = db.batch();

        batch.update(db.collection('users').doc(userId), {
          identityVerified: true,
          verifiedData: verifiedData,
          verifiedAt: FieldValue.serverTimestamp(),
        });

        batch.update(db.collection('verifications').doc(userId), {
          status: 'approved',
          completedAt: FieldValue.serverTimestamp(),
        });

        await batch.commit();

        return { verified: true, data: verifiedData };
      } else {
        // Not approved - update status
        console.log('❌ Verification not approved:', status);

        const db = getFirestore();
        await db.collection('verifications').doc(userId).update({
          status: status,
          completedAt: FieldValue.serverTimestamp(),
        });

        return { verified: false, reason: status };
      }
    } catch (error: any) {
      console.error('❌ Error checking verification:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', 'Failed to check verification status');
    }
  }
);

// ==================== PERSONA WEBHOOK ====================

/**
 * Persona Webhook Handler
 * Receives and processes webhook events from Persona
 *
 * This is an HTTP endpoint that Persona calls when verification status changes
 * (Regular HTTP request, not a callable function)
 */
export const personaWebhook = onRequest(
  {
    secrets: [personaKey, personaWebhookSecret],
    cors: true,
  },
  async (req: Request, res: Response) => {
    // Only accept POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      // Get webhook signature from headers
      const signature = req.headers['persona-signature'] as string | undefined;
      const webhookSecret = personaWebhookSecret.value();

      // Check webhook secret is configured
      if (!webhookSecret) {
        console.error('⚠️ Webhook secret not configured');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      // Verify the webhook signature (prevents fake requests)
      const isValid = verifyWebhookSignature(signature, req.body, webhookSecret);

      if (!isValid) {
        console.error('❌ Invalid webhook signature - possible fake request');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      console.log('✅ Webhook signature verified - legitimate request from Persona');

      // Extract event data
      const event = req.body;
      const eventName = event.data?.attributes?.name;
      const inquiry = event.data?.attributes?.payload?.data;
      const status = inquiry?.attributes?.status;
      const userId = inquiry?.attributes?.['reference-id'];

      console.log('📬 Processing verified webhook:', { eventName, status, userId });

      // Validate we have a userId
      if (!userId) {
        console.error('⚠️ Missing reference-id in webhook payload');
        res.status(200).json({ received: true, warning: 'Missing reference_id' });
        return;
      }

      // Update database based on status
      const db = getFirestore();

      switch (status) {
        case 'approved':
          console.log('✅ Webhook: User verified', userId);
          await db.collection('verifications').doc(userId).update({
            status: 'approved',
            completedAt: FieldValue.serverTimestamp(),
          });
          await db.collection('users').doc(userId).update({
            identityVerified: true,
            verifiedAt: FieldValue.serverTimestamp(),
          });
          break;

        case 'declined':
          console.log('❌ Webhook: Verification declined', userId);
          await db.collection('verifications').doc(userId).update({
            status: 'declined',
            completedAt: FieldValue.serverTimestamp(),
          });
          break;

        case 'needs_review':
          console.log('⏳ Webhook: Manual review needed', userId);
          await db.collection('verifications').doc(userId).update({
            status: 'needs_review',
            reviewRequestedAt: FieldValue.serverTimestamp(),
          });
          break;

        default:
          console.log('ℹ️ Unknown or unhandled status:', status);
      }

      // Always return 200 to acknowledge receipt (even if processing failed)
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      // Return 200 anyway to prevent Persona from retrying
      res.status(200).json({ received: true, error: 'Processing failed but acknowledged' });
    }
  }
);

// ==================== HELPER FUNCTIONS ====================

/**
 * Verify Persona Webhook Signature
 * Ensures the webhook actually came from Persona (security measure)
 */
function verifyWebhookSignature(signature: string | undefined, body: any, secret: string): boolean {
  if (!signature) {
    console.error('⚠️ No signature provided in webhook');
    return false;
  }

  try {
    // Parse signature (format: "t=timestamp,v1=signature")
    const parts = signature.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      console.error('⚠️ Invalid signature format');
      return false;
    }

    const timestamp = timestampPart.split('=')[1];
    const receivedSignature = signaturePart.split('=')[1];

    // Check timestamp is recent (within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    const maxAge = 300; // 5 minutes in seconds

    if (Math.abs(currentTime - parseInt(timestamp)) > maxAge) {
      console.error('⚠️ Webhook timestamp too old');
      return false;
    }

    // Calculate expected signature
    const payload = `${timestamp}.${JSON.stringify(body)}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    // Compare signatures (timing-safe to prevent timing attacks)
    return crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature));
  } catch (error) {
    console.error('❌ Error verifying webhook signature:', error);
    return false;
  }
}
