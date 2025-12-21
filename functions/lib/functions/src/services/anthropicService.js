"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicAPIError = exports.AnthropicService = exports.MODELS = void 0;
exports.createAnthropicService = createAnthropicService;
// Configuration constants
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
// Default models for different use cases
exports.MODELS = {
    SONNET: 'claude-sonnet-4-5-20250929', // Best for complex tasks
    HAIKU: 'claude-haiku-4-5-20251001', // Fast and cost-effective
};
// Default options
const DEFAULT_OPTIONS = {
    temperature: 0.1, // Low temperature for consistent, factual outputs
    maxTokens: 8000,
};
/**
 * Main Anthropic service class
 */
class AnthropicService {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Anthropic API key is required');
        }
        this.apiKey = apiKey;
    }
    /**
     * Send a text-only message to Claude
     */
    async sendTextMessage(prompt, options = {}) {
        const response = await this.sendMessage([{ role: 'user', content: prompt }], options);
        return this.extractTextFromResponse(response);
    }
    /**
     * Send a message with an image to Claude
     */
    async sendImageMessage(imageBase64, mediaType, prompt, options = {}) {
        const messages = [
            {
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mediaType,
                            data: imageBase64,
                        },
                    },
                    {
                        type: 'text',
                        text: prompt,
                    },
                ],
            },
        ];
        const response = await this.sendMessage(messages, options);
        return this.extractTextFromResponse(response);
    }
    /**
     * Core method to send messages to the Anthropic API
     */
    async sendMessage(messages, options = {}) {
        const requestBody = {
            model: options.model || exports.MODELS.SONNET,
            max_tokens: options.maxTokens || DEFAULT_OPTIONS.maxTokens,
            temperature: options.temperature ?? DEFAULT_OPTIONS.temperature,
            messages,
        };
        console.log('🤖 Sending request to Anthropic API...', {
            model: requestBody.model,
            maxTokens: requestBody.max_tokens,
        });
        try {
            const response = await fetch(ANTHROPIC_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': ANTHROPIC_VERSION,
                },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                await this.handleAPIError(response);
            }
            const data = (await response.json());
            console.log('✅ Received response from Anthropic API', {
                inputTokens: data.usage.input_tokens,
                outputTokens: data.usage.output_tokens,
            });
            // ✨ Check if response was truncated
            if (data.stop_reason === 'max_tokens') {
                console.warn('⚠️ Response was truncated at max_tokens limit!');
                console.warn('⚠️ The JSON response may be incomplete.');
            }
            return data;
        }
        catch (error) {
            console.error('❌ Anthropic API request failed:', error);
            throw error;
        }
    }
    /**
     * Extract text content from Claude's response
     */
    extractTextFromResponse(response) {
        if (!response.content || response.content.length === 0) {
            throw new Error('No content in Anthropic API response');
        }
        return response.content[0].text;
    }
    /**
     * Handle API errors with detailed information
     */
    async handleAPIError(response) {
        let errorData;
        try {
            errorData = await response.json();
        }
        catch {
            errorData = { message: 'Unknown error' };
        }
        const errorMessage = errorData.error?.message || errorData.message || 'Unknown error';
        console.error('❌ Anthropic API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
        });
        throw new AnthropicAPIError(`Anthropic API error: ${response.status} - ${errorMessage}`, response.status, errorData);
    }
    /**
     * Utility: Clean markdown JSON formatting that Claude sometimes adds
     */
    static cleanMarkdownJson(content) {
        let cleaned = content.trim();
        // Remove opening code fence (more permissive)
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
        // Remove closing code fence (more permissive)
        cleaned = cleaned.replace(/\s*```\s*$/i, '');
        return cleaned.trim();
    }
    /**
     * Utility: Parse JSON response from Claude with automatic cleaning
     */
    static parseJSONResponse(content) {
        const cleaned = this.cleanMarkdownJson(content);
        // --- Check for incomplete JSON (truncated at end) ---
        const trimmed = cleaned.trim();
        const lastChar = trimmed[trimmed.length - 1];
        if (lastChar !== '}' && lastChar !== ']') {
            console.warn('⚠️ JSON response appears truncated:', trimmed.slice(-50));
            throw new Error('Incomplete JSON response from Anthropic API');
        }
        try {
            return JSON.parse(cleaned);
        }
        catch (error) {
            console.error('❌ Failed to parse JSON response:', {
                originalContent: content.substring(0, 200),
                cleanedContent: cleaned.substring(0, 200),
            });
            throw new Error('Failed to parse JSON response from Anthropic API');
        }
    }
}
exports.AnthropicService = AnthropicService;
/**
 * Custom error class for Anthropic API errors
 */
class AnthropicAPIError extends Error {
    constructor(message, statusCode, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AnthropicAPIError';
    }
}
exports.AnthropicAPIError = AnthropicAPIError;
/**
 * Factory function to create an AnthropicService instance
 * This is useful for dependency injection
 */
function createAnthropicService(apiKey) {
    return new AnthropicService(apiKey);
}
//# sourceMappingURL=anthropicService.js.map