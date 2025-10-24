"use strict";
// functions/src/handlers/verification.ts
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
exports.personaWebhook = exports.checkVerificationStatus = exports.createVerificationSession = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const firestore_1 = require("firebase-admin/firestore");
const crypto = __importStar(require("crypto"));
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
const personaKey = (0, params_1.defineSecret)('PERSONA_API_KEY');
const personaWebhookSecret = (0, params_1.defineSecret)('PERSONA_WEBHOOK_SECRET');
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
exports.createVerificationSession = (0, https_1.onCall)({ secrets: [personaKey] }, async (request) => {
    // Check if user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to verify identity');
    }
    const userId = request.auth.uid;
    const { templateId } = request.data;
    // Validate input
    if (!templateId) {
        throw new https_1.HttpsError('invalid-argument', 'templateId is required');
    }
    console.log('📝 Creating verification session for user:', userId);
    console.log('📋 Using template:', templateId);
    try {
        // Get Persona API key
        const apiKey = personaKey.value();
        if (!apiKey) {
            console.error('❌ Persona API key not configured');
            throw new https_1.HttpsError('failed-precondition', 'Persona API key not configured');
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
            throw new https_1.HttpsError('internal', `Persona API error: ${response.status}`);
        }
        // Parse response
        const personaData = await response.json();
        const inquiryId = personaData.data.id;
        console.log('✅ Inquiry created:', inquiryId);
        // Save verification record to database
        const db = (0, firestore_1.getFirestore)();
        await db.collection('verifications').doc(userId).set({
            inquiryId: inquiryId,
            status: 'pending',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // Return the inquiry ID (your frontend will use this to open Persona)
        return {
            sessionToken: inquiryId,
            inquiryId: inquiryId,
        };
    }
    catch (error) {
        console.error('❌ Error creating verification session:', error);
        // Re-throw HttpsErrors (they have proper error codes)
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        // Wrap other errors
        throw new https_1.HttpsError('internal', 'Failed to create verification session');
    }
});
// ==================== CHECK VERIFICATION STATUS ====================
/**
 * Check Verification Status
 * Checks the current status of a verification inquiry
 *
 * Also a "callable" function - called from frontend with Firebase SDK
 */
exports.checkVerificationStatus = (0, https_1.onCall)({ secrets: [personaKey] }, async (request) => {
    // Check authentication
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userId = request.auth.uid;
    const { inquiryId } = request.data;
    // Validate input
    if (!inquiryId) {
        throw new https_1.HttpsError('invalid-argument', 'inquiryId is required');
    }
    console.log('🔍 Checking verification status:', { userId, inquiryId });
    try {
        // Get Persona API key
        const apiKey = personaKey.value();
        if (!apiKey) {
            throw new https_1.HttpsError('failed-precondition', 'Persona API key not configured');
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
            throw new https_1.HttpsError('internal', 'Failed to fetch verification status');
        }
        // Parse inquiry data
        const inquiry = await response.json();
        const status = inquiry.data.attributes.status;
        console.log('📊 Inquiry status from Persona:', status);
        const verified = status === 'approved';
        // If approved, extract and save verified data
        if (verified) {
            const verifiedData = {
                firstName: inquiry.data.attributes.name_first || '',
                lastName: inquiry.data.attributes.name_last || '',
                dateOfBirth: inquiry.data.attributes.birthdate || '',
                address: inquiry.data.attributes.address_street_1 || '',
                postcode: inquiry.data.attributes.address_postal_code || '',
            };
            console.log('✅ User verified successfully:', userId);
            // Update both users and verifications collections
            const db = (0, firestore_1.getFirestore)();
            const batch = db.batch();
            batch.update(db.collection('users').doc(userId), {
                identityVerified: true,
                verifiedData: verifiedData,
                verifiedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            batch.update(db.collection('verifications').doc(userId), {
                status: 'approved',
                completedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            await batch.commit();
            return { verified: true, data: verifiedData };
        }
        else {
            // Not approved - update status
            console.log('❌ Verification not approved:', status);
            const db = (0, firestore_1.getFirestore)();
            await db.collection('verifications').doc(userId).update({
                status: status,
                completedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            return { verified: false, reason: status };
        }
    }
    catch (error) {
        console.error('❌ Error checking verification:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to check verification status');
    }
});
// ==================== PERSONA WEBHOOK ====================
/**
 * Persona Webhook Handler
 * Receives and processes webhook events from Persona
 *
 * This is an HTTP endpoint that Persona calls when verification status changes
 * (Regular HTTP request, not a callable function)
 */
exports.personaWebhook = (0, https_1.onRequest)({
    secrets: [personaKey, personaWebhookSecret],
    cors: true,
}, async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g;
    // Only accept POST requests
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        // Get webhook signature from headers
        const signature = req.headers['persona-signature'];
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
        const eventName = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.attributes) === null || _b === void 0 ? void 0 : _b.name;
        const inquiry = (_e = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.attributes) === null || _d === void 0 ? void 0 : _d.payload) === null || _e === void 0 ? void 0 : _e.data;
        const status = (_f = inquiry === null || inquiry === void 0 ? void 0 : inquiry.attributes) === null || _f === void 0 ? void 0 : _f.status;
        const userId = (_g = inquiry === null || inquiry === void 0 ? void 0 : inquiry.attributes) === null || _g === void 0 ? void 0 : _g['reference-id'];
        console.log('📬 Processing verified webhook:', { eventName, status, userId });
        // Validate we have a userId
        if (!userId) {
            console.error('⚠️ Missing reference-id in webhook payload');
            res.status(200).json({ received: true, warning: 'Missing reference_id' });
            return;
        }
        // Update database based on status
        const db = (0, firestore_1.getFirestore)();
        switch (status) {
            case 'approved':
                console.log('✅ Webhook: User verified', userId);
                await db.collection('verifications').doc(userId).update({
                    status: 'approved',
                    completedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                await db.collection('users').doc(userId).update({
                    identityVerified: true,
                    verifiedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                break;
            case 'declined':
                console.log('❌ Webhook: Verification declined', userId);
                await db.collection('verifications').doc(userId).update({
                    status: 'declined',
                    completedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                break;
            case 'needs_review':
                console.log('⏳ Webhook: Manual review needed', userId);
                await db.collection('verifications').doc(userId).update({
                    status: 'needs_review',
                    reviewRequestedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                break;
            default:
                console.log('ℹ️ Unknown or unhandled status:', status);
        }
        // Always return 200 to acknowledge receipt (even if processing failed)
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('❌ Webhook processing error:', error);
        // Return 200 anyway to prevent Persona from retrying
        res.status(200).json({ received: true, error: 'Processing failed but acknowledged' });
    }
});
// ==================== HELPER FUNCTIONS ====================
/**
 * Verify Persona Webhook Signature
 * Ensures the webhook actually came from Persona (security measure)
 */
function verifyWebhookSignature(signature, body, secret) {
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
    }
    catch (error) {
        console.error('❌ Error verifying webhook signature:', error);
        return false;
    }
}
//# sourceMappingURL=verification.js.map