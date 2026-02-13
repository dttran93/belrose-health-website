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

interface ClaudeAPIResponse {
  content: Array<{ text: string; type: string }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason?: string;
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

        let response: string;

        switch (provider) {
          case 'anthropic':
            response = await callClaudeAPI(
              message,
              healthContext,
              model,
              conversationHistory,
              mediaParts
            );
            break;
          case 'google':
            response = await callGeminiAPI(
              message,
              healthContext,
              model,
              conversationHistory,
              mediaParts
            );
            break;
          default:
            throw new Error(`Unsupported provider: ${provider}`);
        }

        res.json({ response });
      } catch (error) {
        console.error('AI Chat error:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Internal server error',
        });
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
async function callClaudeAPI(
  message: string,
  healthContext: string,
  model: string,
  history: Array<{ role: string; content: string }>,
  mediaParts: MediaPart[] = []
): Promise<string> {
  const apiKey = anthropicApiKey.value();

  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  // Build system prompt with health context
  const systemPrompt = generateSystemPrompt(healthContext);

  // 2. Format the current message content
  const userContent: any[] = [{ type: 'text', text: message }];

  // Filter out videos since Claude doesn't support them
  const supportedMedia = mediaParts.filter(part => part.type === 'image');

  if (mediaParts.length > supportedMedia.length) {
    console.warn(
      `⚠️ Filtering out ${mediaParts.length - supportedMedia.length} video(s) - Claude doesn't support video`
    );
  }

  supportedMedia.forEach(part => {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: part.mimeType, data: part.url.split(',')[1] },
    });
  });

  // Build conversation messages
  const messages = [
    ...history.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    {
      role: 'user',
      content: userContent,
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

  const data = (await response.json()) as ClaudeAPIResponse;

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
