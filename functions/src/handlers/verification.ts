// functions/src/handlers/verification.ts

import * as crypto from 'crypto';

// ==================== WEBHOOK SIGNATURE VERIFICATION ====================

/**
 * verifyWebhookSignature
 *
 * Generic HMAC-SHA256 webhook signature verifier. Adapted from Persona's
 * original implementation — kept for reuse with future verification providers
 * (e.g. IDswyft webhooks, Onfido etc).
 *
 * Expects signature header in the format: "t=timestamp,v1=hmac_hex"
 * Rejects payloads older than 5 minutes to prevent replay attacks.
 *
 * Usage:
 *   const isValid = verifyWebhookSignature(req.headers['x-signature'], req.body, secret);
 *   if (!isValid) return res.status(401).json({ error: 'Invalid signature' });
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
