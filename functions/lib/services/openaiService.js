"use strict";
// functions/src/services/openaiService.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIService = void 0;
const _shared_1 = require("../_shared");
class OpenAIService {
    constructor(apiKey) {
        if (!apiKey)
            throw new Error('OpenAI API key is required');
        this.apiKey = apiKey;
    }
    async streamChat(message, systemPrompt, model, history, mediaParts, onChunk, onStatus) {
        // Responses API uses a flat `input` array, not a `messages` array
        const input = [
            ...history.map(msg => ({ role: msg.role, content: msg.content })),
            {
                role: 'user',
                content: [
                    { type: 'input_text', text: message },
                    ...mediaParts
                        .filter(p => p.type === 'image')
                        .map(p => ({
                        type: 'input_image',
                        image_url: p.url,
                    })),
                ],
            },
        ];
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: model || _shared_1.DEFAULT_MODEL_ID_BY_PROVIDER.openai,
                max_output_tokens: 4096,
                temperature: 0.2,
                stream: true,
                instructions: systemPrompt, // equivalent of system prompt
                input,
                tools: [{ type: 'web_search_preview' }],
            }),
        });
        if (!response.ok)
            throw new Error(`OpenAI API error: ${response.status} - ${await response.text()}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const lines = decoder
                .decode(value)
                .split('\n')
                .filter(l => l.startsWith('data: '));
            for (const line of lines) {
                const data = line.replace('data: ', '').trim();
                if (!data || data === '[DONE]')
                    continue;
                try {
                    const parsed = JSON.parse(data);
                    switch (parsed.type) {
                        // Text streaming
                        case 'response.output_text.delta':
                            onChunk(parsed.delta);
                            break;
                        // Search tool starting
                        case 'response.web_search_call.in_progress':
                            onStatus('searching');
                            break;
                        // Search done, model is now writing response
                        case 'response.web_search_call.completed':
                            onStatus('responding');
                            break;
                    }
                }
                catch {
                    /* ignore malformed lines */
                }
            }
        }
    }
}
exports.OpenAIService = OpenAIService;
//# sourceMappingURL=openaiService.js.map