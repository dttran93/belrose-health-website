"use strict";
// functions/src/handlers/image.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeImageWithAI = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const anthropicService_1 = require("../services/anthropicService");
const prompts_1 = require("../utils/prompts");
// Define the secret
const anthropicKey = (0, params_1.defineSecret)('ANTHROPIC_KEY');
/**
 * Image Analysis Function
 * Analyzes medical images and documents using AI vision
 */
exports.analyzeImageWithAI = (0, https_1.onRequest)({
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
        const { image, fileName = '', fileType = '', analysisType = 'full', } = req.body;
        if (!image || !image.base64 || !image.mediaType) {
            res.status(400).json({ error: 'Image data is required' });
            return;
        }
        // Get API key
        const apiKey = anthropicKey.value();
        if (!apiKey) {
            console.error('❌ Anthropic API key not configured');
            res.status(500).json({ error: 'API key not configured' });
            return;
        }
        console.log('🖼️ Analyzing image...', {
            fileName,
            fileType,
            analysisType,
            imageSize: image.base64.length,
        });
        // Create Anthropic service
        const anthropicService = new anthropicService_1.AnthropicService(apiKey);
        // Get the appropriate prompt for this analysis type
        const prompt = (0, prompts_1.getImageAnalysisPrompt)(analysisType);
        // Send image for analysis
        const responseText = await anthropicService.sendImageMessage(image.base64, image.mediaType, prompt, {
            model: anthropicService_1.MODELS.SONNET,
            maxTokens: 2000,
            temperature: 0.1,
        });
        // Parse the response
        const analysisResult = anthropicService_1.AnthropicService.parseJSONResponse(responseText);
        // Enrich the result with metadata
        enrichAnalysisResult(analysisResult, fileName, fileType, analysisType);
        console.log('✅ Image analysis successful', {
            isMedical: analysisResult.isMedical,
            confidence: analysisResult.confidence,
        });
        res.json(analysisResult);
    }
    catch (error) {
        console.error('❌ Image analysis error:', error);
        handleImageAnalysisError(res, error);
    }
});
/**
 * Enrich analysis result with additional metadata
 */
function enrichAnalysisResult(result, fileName, fileType, analysisType) {
    // Add timestamp
    result.analyzedAt = new Date().toISOString();
    // Add file info
    result.fileName = fileName;
    result.fileType = fileType;
    result.analysisType = analysisType;
    // Ensure confidence is between 0 and 1
    if (result.confidence !== undefined) {
        result.confidence = Math.max(0, Math.min(1, result.confidence));
    }
    // Provide default values if missing
    if (result.isMedical === undefined) {
        result.isMedical = false;
    }
    if (!result.suggestion) {
        result.suggestion = result.isMedical
            ? 'Medical content detected in image'
            : 'No medical content detected';
    }
}
/**
 * Handle image analysis errors with appropriate fallback response
 */
function handleImageAnalysisError(res, error) {
    console.error('❌ Image analysis failed:', error);
    // Determine error type and response
    let statusCode = 500;
    let errorMessage = 'Failed to process image';
    if (error.message?.includes('JSON') || error.message?.includes('parse')) {
        errorMessage = 'Failed to parse AI response';
    }
    else if (error.message?.includes('Anthropic') || error.name === 'AnthropicAPIError') {
        statusCode = 502;
        errorMessage = 'External AI service error';
    }
    // Return error response with safe fallback values
    res.status(statusCode).json({
        error: errorMessage,
        isMedical: false,
        confidence: 0,
        extractedText: '',
        suggestion: 'Image analysis failed - please try again',
        analyzedAt: new Date().toISOString(),
    });
}
//# sourceMappingURL=image.js.map