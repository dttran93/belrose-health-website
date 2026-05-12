"use strict";
// packages/shared/src/config/aiChat.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MODEL_ID_BY_PROVIDER = exports.DEFAULT_MODEL_ID = exports.AVAILABLE_MODELS = void 0;
exports.AVAILABLE_MODELS = [
    {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        provider: 'anthropic',
        description: "Anthropic's best combination of speed and intelligence",
    },
    {
        id: 'gemini-3.1-flash-lite-preview',
        name: 'Gemini 3.1 Flash Lite',
        provider: 'google',
        description: 'Fast and affordable',
    },
    {
        id: 'gpt-5.4-nano',
        name: 'GPT-5.4 Nano',
        provider: 'openai',
        description: "OpenAI's fastest and most affordable model",
    },
];
exports.DEFAULT_MODEL_ID = 'claude-sonnet-4-6';
exports.DEFAULT_MODEL_ID_BY_PROVIDER = {
    anthropic: 'claude-sonnet-4-6',
    google: 'gemini-3.1-flash-lite-preview',
    openai: 'gpt-5.4-nano',
};
