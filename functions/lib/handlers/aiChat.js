"use strict";
// functions/src/handlers/aiChat.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiChat = void 0;
const params_1 = require("firebase-functions/params");
const cors_1 = __importDefault(require("cors"));
const https_1 = require("firebase-functions/https");
const claudeChatService_1 = require("../services/claudeChatService");
const geminiService_1 = require("../services/geminiService");
const aiChatPrompt_1 = require("../utils/aiChatPrompt");
const openaiService_1 = require("../services/openaiService");
const corsHandler = (0, cors_1.default)({ origin: true });
// Define secrets
const anthropicApiKey = (0, params_1.defineSecret)('ANTHROPIC_KEY');
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
const openaiApiKey = (0, params_1.defineSecret)('OPENAI_API_KEY');
exports.aiChat = (0, https_1.onRequest)({
    timeoutSeconds: 540,
    memory: '1GiB',
    secrets: [anthropicApiKey, geminiApiKey, openaiApiKey],
}, (req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        try {
            const { message, healthContext, model, provider, conversationHistory, mediaParts = [], } = req.body;
            if (!message || !provider) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }
            // ✅ Set SSE headers for streaming
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            // Helper to send a chunck to the client
            const sendChunk = (text) => {
                res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
            };
            const sendStatus = (status) => {
                res.write(`data: ${JSON.stringify({ status })}\n\n`);
            };
            const systemPrompt = (0, aiChatPrompt_1.generateSystemPrompt)(healthContext);
            switch (provider) {
                case 'anthropic': {
                    const service = new claudeChatService_1.ClaudeChatService(anthropicApiKey.value());
                    await service.streamChat(message, systemPrompt, model, conversationHistory, mediaParts, sendChunk, sendStatus);
                    break;
                }
                case 'google': {
                    const service = new geminiService_1.GeminiService(geminiApiKey.value());
                    await service.streamChat(message, systemPrompt, model, conversationHistory, mediaParts, sendChunk, sendStatus);
                    break;
                }
                case 'openai': {
                    const service = new openaiService_1.OpenAIService(openaiApiKey.value());
                    await service.streamChat(message, systemPrompt, model, conversationHistory, mediaParts, sendChunk, sendStatus);
                    break;
                }
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
            // Signal stream is done
            res.write('data: [DONE]\n\n');
            res.end();
        }
        catch (error) {
            console.error('AI Chat error:', error);
            // If headers not sent yet, send JSON error
            if (!res.headersSent) {
                res.status(500).json({
                    error: error instanceof Error ? error.message : 'Internal server error',
                });
            }
            else {
                res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
                res.end();
            }
        }
    });
});
//# sourceMappingURL=aiChat.js.map