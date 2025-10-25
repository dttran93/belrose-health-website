"use strict";
// functions/src/handlers/convertToFHIR.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToFHIR = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const anthropicService_1 = require("../services/anthropicService");
const prompts_1 = require("../utils/prompts");
/**
 * FHIR Conversion Handler
 * Converts medical document text into FHIR format using AI
 */
// Define the secret
const anthropicKey = (0, params_1.defineSecret)('ANTHROPIC_KEY');
/**
 * Convert To FHIR Function
 * Takes raw medical document text and converts it to a FHIR Bundle
 *
 * Input: { documentText: string }
 * Output: FHIR Bundle (JSON)
 */
exports.convertToFHIR = (0, https_1.onRequest)({
    secrets: [anthropicKey],
    cors: true,
}, async (req, res) => {
    // Validate HTTP method
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        // Extract and validate request body
        const { documentText } = req.body;
        if (!documentText || typeof documentText !== 'string') {
            res.status(400).json({
                error: 'documentText is required and must be a string',
            });
            return;
        }
        // Get API key
        const apiKey = anthropicKey.value();
        if (!apiKey) {
            console.error('❌ Anthropic API key not configured');
            res.status(500).json({ error: 'API key not configured' });
            return;
        }
        console.log('📄 Converting document to FHIR...', {
            textLength: documentText.length,
        });
        // Create Anthropic service
        const anthropicService = new anthropicService_1.AnthropicService(apiKey);
        // Generate prompt and call AI
        const prompt = (0, prompts_1.getFHIRConversionPrompt)(documentText);
        const responseText = await anthropicService.sendTextMessage(prompt, {
            model: anthropicService_1.MODELS.SONNET, // Use smart model for complex conversion
            maxTokens: 4000,
            temperature: 0.1,
        });
        // Parse the AI response into FHIR format
        const fhirJson = anthropicService_1.AnthropicService.parseJSONResponse(responseText);
        // Validate that we got a proper FHIR Bundle
        if (!fhirJson.resourceType || fhirJson.resourceType !== 'Bundle') {
            throw new Error('Response is not a valid FHIR Bundle');
        }
        console.log('✅ FHIR conversion successful');
        res.json(fhirJson);
    }
    catch (error) {
        console.error('❌ FHIR conversion error:', error);
        handleConversionError(res, error);
    }
});
/**
 * Handle FHIR conversion errors
 */
function handleConversionError(res, error) {
    var _a, _b, _c, _d;
    if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('JSON')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('parse'))) {
        res.status(500).json({
            error: 'Failed to parse FHIR response from AI',
            details: 'The AI returned invalid JSON format',
        });
    }
    else if (((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes('Anthropic')) || error.name === 'AnthropicAPIError') {
        res.status(502).json({
            error: 'External AI service error',
            details: 'Unable to connect to AI service',
        });
    }
    else if ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes('Bundle')) {
        res.status(500).json({
            error: 'Invalid FHIR format',
            details: 'The response is not a valid FHIR Bundle',
        });
    }
    else {
        res.status(500).json({
            error: 'Internal server error',
            details: 'An unexpected error occurred during FHIR conversion',
        });
    }
}
//# sourceMappingURL=convertToFHIR.js.map