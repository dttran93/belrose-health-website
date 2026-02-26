// functions/src/aiChat.ts

import { defineSecret } from 'firebase-functions/params';
import cors from 'cors';
import { onRequest } from 'firebase-functions/https';

const corsHandler = cors({ origin: true });

// Define secrets
const anthropicApiKey = defineSecret('ANTHROPIC_KEY');
const geminiApiKey = defineSecret('GEMINI_API_KEY');

interface MediaPart {
  type: 'image' | 'video';
  url: string;
  mimeType: string;
}

interface ChatRequest {
  message: string;
  healthContext: string;
  mediaParts?: MediaPart[];
  model: string;
  provider: 'anthropic' | 'google';
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason?: string;
  }>;
  error?: {
    message: string;
    code: number;
  };
}

export const aiChat = onRequest(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
    secrets: [anthropicApiKey, geminiApiKey],
  },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      try {
        const {
          message,
          healthContext,
          model,
          provider,
          conversationHistory,
          mediaParts = [],
        }: ChatRequest = req.body;

        if (!message || !provider) {
          res.status(400).json({ error: 'Missing required fields' });
          return;
        }

        // ✅ Set SSE headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Helper to send a chunck to the client
        const sendChunk = (text: string) => {
          res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
        };

        switch (provider) {
          case 'anthropic':
            await streamClaudeAPI(
              message,
              healthContext,
              model,
              conversationHistory,
              mediaParts,
              sendChunk,
              anthropicApiKey.value()
            );
            break;
          case 'google':
            const geminiResponse = await callGeminiAPI(
              message,
              healthContext,
              model,
              conversationHistory,
              mediaParts
            );
            sendChunk(geminiResponse);
            break;
          default:
            throw new Error(`Unsupported provider: ${provider}`);
        }

        // Signal stream is done
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (error) {
        console.error('AI Chat error:', error);
        // If headers not sent yet, send JSON error
        if (!res.headersSent) {
          res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error',
          });
        } else {
          res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
          res.end();
        }
      }
    });
  }
);

/**
 * MASTER SYSTEM PROMPT
 * Defines the personality, constraints, and data-handling rules for Belrose's AI Assistant.
 */
const generateSystemPrompt = (healthContext: string): string => {
  return `You are Belrose's AI Health Assistant, a specialized assistant for analyzing patient health data.
You have access to structured health data wrapped in XML tags (<HEALTH_RECORD>, <FILE_ATTACHMENT>, etc.).

### 1. GROUNDING & ACCURACY
- ONLY answer based on the provided records and visual media.
- If information is not present, explicitly state: "I don't see that information in your records."
- DO NOT infer, assume, or hallucinate medical details. 
- When citing information, include record titles, IDs, and dates (e.g., "According to your blood test record from reocrdID: abc123 dated 2025-05-10...").

### 2. DATA HANDLING & CITATION
- Use the [CONTEXT_MANIFEST] at the top of the context to understand the inventory.
- Reference specific records by their ID or Title (e.g., "In your 'Complete Blood Count' (recordID: abc123) from 2025-05-10...").
- If visual media (images/videos) are provided, analyze them in conjunction with the metadata provided in the XML.

### 3. TONE & STYLE
- Use a professional, empathetic, and clear tone.
- Explain medical terminology using plain language.
- Provide structured summaries (bullet points) for complex data.

### 4. SAFETY & DISCLAIMERS
- You are an assistant, not a doctor. 
- ALWAYS conclude with a recommendation to consult a qualified healthcare provider for medical decisions.

### HEALTH RECORDS CONTEXT:
${healthContext}`;
};

/**
 * Call Anthropic's Claude API
 */
async function streamClaudeAPI(
  message: string,
  healthContext: string,
  model: string,
  history: Array<{ role: string; content: string }>,
  mediaParts: MediaPart[],
  onChunk: (text: string) => void,
  apiKey: string
): Promise<void> {
  const systemPrompt = generateSystemPrompt(healthContext);

  const userContent: any[] = [{ type: 'text', text: message }];
  const supportedMedia = mediaParts.filter(part => part.type === 'image');
  supportedMedia.forEach(part => {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: part.mimeType, data: part.url.split(',')[1] },
    });
  });

  const messages = [
    ...history.map(msg => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: userContent },
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
      stream: true, // ✅ Enable streaming
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  // ✅ Read the stream line by line
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const data = line.replace('data: ', '').trim();
      if (data === '[DONE]' || data === '') continue;

      try {
        const parsed = JSON.parse(data);
        // Anthropic stream events: content_block_delta contains the text
        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          onChunk(parsed.delta.text);
        }
      } catch {
        // Ignore malformed JSON lines
      }
    }
  }
}

/**
 * Call Google's Gemini API
 */
async function callGeminiAPI(
  message: string,
  healthContext: string,
  model: string,
  history: Array<{ role: string; content: string }>,
  mediaParts: MediaPart[] = []
): Promise<string> {
  const apiKey = geminiApiKey.value();

  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const systemPrompt = generateSystemPrompt(healthContext);

  // Gemini uses 'user' and 'model' as roles
  const contents = [
    ...history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })),
    {
      role: 'user',
      parts: [
        { text: message },
        ...mediaParts.map(part => ({
          inline_data: { mime_type: part.mimeType, data: part.url.split(',')[1] },
        })),
      ],
    },
  ];

  const modelName = model || 'gemini-2.5-flash';
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
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as GeminiResponse;

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Gemini returned no response candidates');
  }

  return data.candidates[0].content.parts[0].text;
}
