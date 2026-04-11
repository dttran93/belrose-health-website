"use strict";
// functions/src/handlers/refineRecord.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.refineRecord = void 0;
/**
 * refineRecord Cloud Function
 *
 * Takes a plain-English edit request from the user and applies it
 * to the record's FHIR data and Belrose fields.
 *
 * Used from the ViewEditRecord edit screen — record is already
 * decrypted client-side before being sent here.
 */
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const anthropicService_1 = require("../services/anthropicService");
const prompts_1 = require("../utils/prompts");
const anthropicKey = (0, params_1.defineSecret)('ANTHROPIC_KEY');
exports.refineRecord = (0, https_1.onRequest)({
    secrets: [anthropicKey],
    cors: true,
    timeoutSeconds: 120,
}, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        const { fhirData, belroseFields, userRequest } = req.body;
        if (!fhirData || !userRequest) {
            res.status(400).json({ error: 'fhirData and userRequest are required' });
            return;
        }
        const apiKey = anthropicKey.value();
        if (!apiKey) {
            res.status(500).json({ error: 'API key not configured' });
            return;
        }
        const anthropicService = new anthropicService_1.AnthropicService(apiKey);
        const prompt = (0, prompts_1.getRefinementEditPrompt)({
            fhirData,
            belroseFields,
            userRequest,
        });
        const responseText = await anthropicService.sendTextMessage(prompt, {
            model: anthropicService_1.MODELS.SONNET,
            maxTokens: 4000,
            temperature: 0.1,
        });
        const result = anthropicService_1.AnthropicService.parseJSONResponse(responseText);
        if (result.status !== 'complete') {
            throw new Error('AI returned unexpected status');
        }
        res.json(result);
    }
    catch (error) {
        console.error('❌ refineRecord error:', error);
        res.status(500).json({
            error: 'Edit request failed',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
//# sourceMappingURL=refineRecord.js.map