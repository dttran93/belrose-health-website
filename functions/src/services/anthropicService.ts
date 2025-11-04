// functions/src/services/anthropicService.ts

/**
 * Service for interacting with the Anthropic Claude API
 * Centralizes all API calls to avoid duplication and make maintenance easier
 */

// Types for Anthropic API
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | MessageContent[];
}

export interface MessageContent {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
}

export interface ClaudeResponse {
  content: Array<{
    text: string;
    type: string;
  }>;
  id: string;
  model: string;
  role: string;
  stop_reason: string;
  stop_sequence: null;
  type: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

// Configuration constants
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Default models for different use cases
export const MODELS = {
  SONNET: 'claude-sonnet-4-5-20250929', // Best for complex tasks
  HAIKU: 'claude-haiku-4-5-20251001', // Fast and cost-effective
} as const;

// Default options
const DEFAULT_OPTIONS = {
  temperature: 0.1, // Low temperature for consistent, factual outputs
  maxTokens: 4000,
} as const;

/**
 * Main Anthropic service class
 */
export class AnthropicService {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Send a text-only message to Claude
   */
  async sendTextMessage(prompt: string, options: AnthropicRequestOptions = {}): Promise<string> {
    const response = await this.sendMessage([{ role: 'user', content: prompt }], options);

    return this.extractTextFromResponse(response);
  }

  /**
   * Send a message with an image to Claude
   */
  async sendImageMessage(
    imageBase64: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
    prompt: string,
    options: AnthropicRequestOptions = {}
  ): Promise<string> {
    const messages: ClaudeMessage[] = [
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
  private async sendMessage(
    messages: ClaudeMessage[],
    options: AnthropicRequestOptions = {}
  ): Promise<ClaudeResponse> {
    const requestBody = {
      model: options.model || MODELS.SONNET,
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

      const data: ClaudeResponse = await response.json();

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
    } catch (error) {
      console.error('❌ Anthropic API request failed:', error);
      throw error;
    }
  }

  /**
   * Extract text content from Claude's response
   */
  private extractTextFromResponse(response: ClaudeResponse): string {
    if (!response.content || response.content.length === 0) {
      throw new Error('No content in Anthropic API response');
    }

    return response.content[0].text;
  }

  /**
   * Handle API errors with detailed information
   */
  private async handleAPIError(response: Response): Promise<never> {
    let errorData: any;

    try {
      errorData = await response.json();
    } catch {
      errorData = { message: 'Unknown error' };
    }

    const errorMessage = errorData.error?.message || errorData.message || 'Unknown error';

    console.error('❌ Anthropic API error:', {
      status: response.status,
      statusText: response.statusText,
      error: errorData,
    });

    throw new AnthropicAPIError(
      `Anthropic API error: ${response.status} - ${errorMessage}`,
      response.status,
      errorData
    );
  }

  /**
   * Utility: Clean markdown JSON formatting that Claude sometimes adds
   */
  static cleanMarkdownJson(content: string): string {
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
  static parseJSONResponse<T>(content: string): T {
    const cleaned = this.cleanMarkdownJson(content);

    try {
      return JSON.parse(cleaned) as T;
    } catch (error) {
      console.error('❌ Failed to parse JSON response:', {
        originalContent: content.substring(0, 200),
        cleanedContent: cleaned.substring(0, 200),
      });
      throw new Error('Failed to parse JSON response from Anthropic API');
    }
  }
}

/**
 * Custom error class for Anthropic API errors
 */
export class AnthropicAPIError extends Error {
  constructor(message: string, public statusCode: number, public details?: any) {
    super(message);
    this.name = 'AnthropicAPIError';
  }
}

/**
 * Factory function to create an AnthropicService instance
 * This is useful for dependency injection
 */
export function createAnthropicService(apiKey: string): AnthropicService {
  return new AnthropicService(apiKey);
}
