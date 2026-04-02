"use strict";
// functions/src/handlers/belroseNarrative.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDetailedNarrative = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const anthropicService_1 = require("../services/anthropicService");
const prompts_1 = require("../utils/prompts");
// Define the secret
const anthropicKey = (0, params_1.defineSecret)('ANTHROPIC_KEY');
// ==================== CLOUD FUNCTION ====================
/**
 * Create Detailed Narrative Function
 *
 * Takes FHIR data and generates a comprehensive, human-readable narrative
 * Uses Claude Sonnet for better quality narrative generation
 */
exports.createDetailedNarrative = (0, https_1.onRequest)({
    secrets: [anthropicKey],
    cors: true,
    timeoutSeconds: 120, // Longer timeout for narrative generation
}, async (req, res) => {
    // Validate HTTP method
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    try {
        console.log('📖 Detailed narrative generation request received');
        // Extract and validate request body
        const { fhirData, belroseFields, fileName, extractedText, originalText, contextText } = req.body;
        if (!fhirData) {
            res.status(400).json({ error: 'fhirData is required' });
            return;
        }
        // Get API key
        const apiKey = anthropicKey.value();
        if (!apiKey) {
            console.error('❌ Anthropic API key not configured');
            res.status(500).json({ error: 'API key not configured' });
            return;
        }
        console.log('🤖 Processing narrative with AI...', {
            fileName,
            hasBelroseFields: !!belroseFields,
            hasExtractedText: !!extractedText,
            hasOriginalText: !!originalText,
            hasContextText: !!contextText,
        });
        // Generate the narrative
        const result = await generateNarrativeWithAI(fhirData, apiKey, belroseFields, fileName, extractedText, originalText, contextText);
        console.log('✅ Narrative generation successful');
        res.json(result);
    }
    catch (error) {
        console.error('❌ Narrative generation error:', error);
        res.status(500).json({
            error: 'Narrative generation failed',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// ==================== HELPER FUNCTIONS ====================
/**
 * Generate narrative using AI
 */
async function generateNarrativeWithAI(fhirData, apiKey, belroseFields, fileName, extractedText, originalText, contextText) {
    const anthropicService = new anthropicService_1.AnthropicService(apiKey);
    // Build the prompt with all context
    const prompt = (0, prompts_1.getDetailedNarrativePrompt)(fhirData, belroseFields, fileName, extractedText, originalText, contextText);
    try {
        // Use Sonnet model - better reasoning and narrative generation
        const responseText = await anthropicService.sendTextMessage(prompt, {
            model: anthropicService_1.MODELS.SONNET, // This is Claude Sonnet 3.5 or 4 depending on your setup
            maxTokens: 2000, // Allow for longer narratives
            temperature: 0.3, // Slightly higher for more natural prose
        });
        // The response should be the narrative directly
        // Clean up any potential markdown or extra formatting
        const narrative = responseText.trim();
        if (!narrative || narrative.length < 50) {
            console.warn('⚠️ Generated narrative seems too short, using fallback');
            return createFallbackNarrative(belroseFields, fileName);
        }
        return {
            detailedNarrative: narrative,
        };
    }
    catch (error) {
        console.error('❌ Narrative generation with AI failed:', error);
        return createFallbackNarrative(belroseFields, fileName);
    }
}
/**
 * Create a fallback narrative when AI generation fails
 */
function createFallbackNarrative(belroseFields, fileName) {
    const title = belroseFields?.title || fileName || 'Health Record';
    const date = belroseFields?.completedDate || new Date().toISOString().split('T')[0];
    const provider = belroseFields?.provider || 'Healthcare Provider';
    const institution = belroseFields?.institution || 'Medical Center';
    const fallbackNarrative = `This is a medical record titled "${title}" dated ${date}. The record was created at ${institution} with ${provider}. ${belroseFields?.summary || 'Additional details are available in the structured FHIR data.'}`;
    return {
        detailedNarrative: fallbackNarrative,
    };
}
//# sourceMappingURL=belroseNarrative.js.map