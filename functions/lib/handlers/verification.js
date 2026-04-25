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
const crypto = __importStar(require("crypto"));
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