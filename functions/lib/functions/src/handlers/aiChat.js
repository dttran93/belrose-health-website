"use strict";
// functions/src/aiChat.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiChat = void 0;
const params_1 = require("firebase-functions/params");
const cors_1 = __importDefault(require("cors"));
const https_1 = require("firebase-functions/https");
const corsHandler = (0, cors_1.default)({ origin: true });
// Define secrets
const anthropicApiKey = (0, params_1.defineSecret)('ANTHROPIC_KEY');
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
exports.aiChat = (0, https_1.onRequest)({
    timeoutSeconds: 540,
    memory: '1GiB',
    secrets: [anthropicApiKey, geminiApiKey],
}, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        try {
            const { message, healthContext, model, provider, conversationHistory } = req.body;
            if (!message || !provider) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            let response;
            switch (provider) {
                case 'anthropic':
                    response = await callClaudeAPI(message, healthContext, model, conversationHistory);
                    break;
                case 'google':
                    response = await callGeminiAPI(message, healthContext, model, conversationHistory);
                    break;
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
            res.json({ response });
        }
        catch (error) {
            console.error('AI Chat error:', error);
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });
});
/**
 * Call Anthropic's Claude API
 */
async function callClaudeAPI(message, healthContext, model, history) {
    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
        throw new Error('Anthropic API key not configured');
    }
    // Build system prompt with health context
    const systemPrompt = `You are a helpful medical AI assistant analyzing health records for a patient. You have access to their FHIR-formatted health data.

CRITICAL INSTRUCTIONS:
- Only answer based on the provided FHIR health records
- If information is not in the records, clearly state "I don't see that information in your records"
- Do not make up, infer, or assume medical information
- Provide clear, accurate summaries with specific dates and values when available
- Use plain language alongside medical terms
- Always recommend consulting healthcare providers for medical decisions
- When citing specific values, include the date of the observation

HEALTH RECORDS:
${healthContext}

Remember: You are analyzing real patient data. Be precise and only reference what's explicitly in the records.`;
    // Build conversation messages
    const messages = [
        ...history.map(msg => ({
            role: msg.role,
            content: msg.content,
        })),
        {
            role: 'user',
            content: message,
        },
    ];
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: model || 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            temperature: 0.2,
            system: systemPrompt,
            messages,
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
    }
    const data = (await response.json());
    console.log('✅ Claude API response:', {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
        stopReason: data.stop_reason,
    });
    return data.content[0].text;
}
/**
 * Call Google's Gemini API
 */
async function callGeminiAPI(message, healthContext, model, history) {
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
        throw new Error('Gemini API key not configured');
    }
    const systemPrompt = `You are a helpful medical AI assistant analyzing health records for a patient. You have access to their FHIR-formatted health data.

CRITICAL INSTRUCTIONS:
- Only answer based on the provided FHIR health records
- If information is not in the records, clearly state "I don't see that information in your records"
- Do not make up, infer, or assume medical information
- Provide clear, accurate summaries with specific dates and values when available
- Use plain language alongside medical terms
- Always recommend consulting healthcare providers for medical decisions
- When citing specific values, include the date of the observation

HEALTH RECORDS:
${healthContext}

Remember: You are analyzing real patient data. Be precise and only reference what's explicitly in the records.`;
    // Gemini uses 'user' and 'model' as roles
    const contents = [
        ...history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        })),
        {
            role: 'user',
            parts: [{ text: message }],
        },
    ];
    const modelName = model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents,
            system_instruction: {
                parts: [{ text: systemPrompt }],
            },
            generationConfig: {
                maxOutputTokens: 4096,
                temperature: 0.2, // Lower temperature for medical precision
            },
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }
    const data = (await response.json());
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error('Gemini returned no response candidates');
    }
    return data.candidates[0].content.parts[0].text;
}
//# sourceMappingURL=aiChat.js.map