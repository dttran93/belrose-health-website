"use strict";
// functions/src/handlers/stripeIdentity.ts
//
// Two Cloud Functions for Stripe Identity verification:
//
// 1. createStripeVerificationSession (onCall)
//    Called by the frontend to create a VerificationSession server-side.
//    Returns only the client_secret — never the Stripe secret key.
//    Stores the sessionId → userId mapping in Firestore for webhook lookup.
//
// 2. stripeIdentityWebhook (onRequest)
//    Called by Stripe when a verification completes or fails.
//    Verifies the webhook signature, saves the certificate to Firestore,
//    immediately calls the Stripe redact API to delete PII, then
//    updates the session status so the frontend polling can resolve.
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
exports.stripeIdentityWebhook = exports.getStripeSessionStatus = exports.createStripeVerificationSession = void 0;
const stripe_1 = __importDefault(require("stripe"));
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const stripeSecretKey = (0, params_1.defineSecret)('STRIPE_SECRET_KEY');
const stripeWebhookSecret = (0, params_1.defineSecret)('STRIPE_WEBHOOK_SECRET');
const db = admin.firestore();
// ── 1. Create Verification Session ──────────────────────────────────
exports.createStripeVerificationSession = (0, https_1.onCall)({ secrets: [stripeSecretKey], cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated to verify identity.');
    }
    const { userId } = request.data;
    if (!userId || typeof userId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'userId is required.');
    }
    const stripe = new stripe_1.default(stripeSecretKey.value());
    try {
        const session = await stripe.identity.verificationSessions.create({
            type: 'document',
            options: {
                document: {
                    // Accept passport, driving licence, and national ID
                    allowed_types: ['passport', 'driving_license', 'id_card'],
                    require_id_number: false,
                    require_live_capture: true,
                    require_matching_selfie: true,
                },
            },
            metadata: {
                belrose_user_id: userId,
            },
        });
        // Store sessionId → userId so the webhook can look it up
        await db.collection('stripeVerificationSessions').doc(session.id).set({
            userId,
            sessionId: session.id,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`✅ Stripe session created: ${session.id} for user: ${userId}`);
        return {
            clientSecret: session.client_secret,
            sessionId: session.id,
        };
    }
    catch (err) {
        console.error('❌ Failed to create Stripe session:', err);
        throw new https_1.HttpsError('internal', 'Failed to create verification session.');
    }
});
// ── 2. Get Session Status (polled by frontend) ───────────────────────
exports.getStripeSessionStatus = (0, https_1.onCall)({ secrets: [stripeSecretKey], cors: true }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated.');
    }
    const { sessionId } = request.data;
    if (!sessionId) {
        throw new https_1.HttpsError('invalid-argument', 'sessionId is required.');
    }
    // Read from Firestore — webhook writes here when done
    const doc = await db.collection('stripeVerificationSessions').doc(sessionId).get();
    if (!doc.exists) {
        throw new https_1.HttpsError('not-found', 'Session not found.');
    }
    const data = doc.data();
    // Confirm the session belongs to the requesting user
    if (data.userId !== request.auth.uid) {
        throw new https_1.HttpsError('permission-denied', 'Session does not belong to this user.');
    }
    return {
        status: data.status,
        verifiedName: data.verifiedName ?? undefined,
        verifiedDOB: data.verifiedDOB ?? undefined,
    };
});
// ── 3. Webhook ───────────────────────────────────────────────────────
exports.stripeIdentityWebhook = (0, https_1.onRequest)({
    secrets: [stripeSecretKey, stripeWebhookSecret],
    invoker: 'public',
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const stripe = new stripe_1.default(stripeSecretKey.value());
    const sig = req.headers['stripe-signature'];
    // Use req.rawBody if available (Firebase sets it), otherwise fall back to body
    const rawBody = req.rawBody ?? JSON.stringify(req.body);
    let event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret.value());
    }
    catch (err) {
        console.error('❌ Webhook signature verification failed:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    // Only handle the two events we care about
    if (event.type !== 'identity.verification_session.verified' &&
        event.type !== 'identity.verification_session.requires_input') {
        res.status(200).send('Event ignored');
        return;
    }
    const session = event.data.object;
    const sessionId = session.id;
    // Look up which Belrose user this belongs to
    const sessionDoc = await db.collection('stripeVerificationSessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
        console.error(`❌ No Belrose session found for Stripe session: ${sessionId}`);
        res.status(200).send('Session not found — ignored');
        return;
    }
    const { userId } = sessionDoc.data();
    const isVerified = event.type === 'identity.verification_session.verified';
    // Extract verified data if available
    const verifiedOutputs = session.verified_outputs;
    const verifiedName = verifiedOutputs?.name
        ? `${verifiedOutputs.name.first_name ?? ''} ${verifiedOutputs.name.last_name ?? ''}`.trim()
        : null;
    const verifiedDOB = verifiedOutputs?.dob
        ? `${verifiedOutputs.dob.year}-${String(verifiedOutputs.dob.month).padStart(2, '0')}-${String(verifiedOutputs.dob.day).padStart(2, '0')}`
        : null;
    try {
        // ── Save certificate to Firestore ──────────────────────────────
        await db
            .collection('IdVerificationCertificates')
            .doc(userId)
            .set({
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            verifiedName,
            verifiedDOB,
            verificationProvider: 'stripe_identity',
            verificationId: sessionId,
            status: session.status,
            finalResult: isVerified ? 'verified' : 'failed',
            rejectionReason: isVerified ? null : (session.last_error?.code ?? 'unknown'),
            rejectionDetail: isVerified ? null : (session.last_error?.reason ?? null),
            captureMethod: 'stripe_modal',
            certifiedAt: new Date().toISOString(),
        }, { merge: true });
        // ── Update session status so frontend polling resolves ─────────
        await db
            .collection('stripeVerificationSessions')
            .doc(sessionId)
            .update({
            status: isVerified ? 'verified' : 'failed',
            verifiedName,
            verifiedDOB,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // ── Immediately redact PII from Stripe ─────────────────────────
        // This deletes the ID images and selfie from Stripe's servers.
        // The certificate above is all we keep.
        try {
            await stripe.identity.verificationSessions.redact(sessionId);
            console.log(`🗑️  Stripe session ${sessionId} redacted — PII deleted`);
        }
        catch (redactErr) {
            // Non-fatal — log but don't fail the webhook
            // Stripe may already be processing a redaction
            console.warn(`⚠️ Redaction failed for ${sessionId}:`, redactErr.message);
        }
        console.log(`✅ Webhook processed: ${sessionId} → ${isVerified ? 'verified' : 'failed'}`);
        res.status(200).send('OK');
    }
    catch (err) {
        console.error('❌ Webhook processing failed:', err);
        // Return 500 so Stripe retries
        res.status(500).send('Internal error');
    }
});
//# sourceMappingURL=stripeIdentity.js.map